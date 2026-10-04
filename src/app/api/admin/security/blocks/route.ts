import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId, type WithId, type Document } from "mongodb";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/admin-auth";
import { ensureAdminSecurityIndexes } from "@/lib/admin-security";
import { logServer } from "@/lib/server-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return validateSession(cookieStore.get("admin_session")?.value);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  try {
    return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    await ensureAdminSecurityIndexes(db);
    const blocks = await db.collection("admin_ip_blocks")
      .find({ expiresAt: { $gt: new Date() }, $or: [{ status: "blocked" }, { status: { $exists: false } }] })
      .sort({ blockedAt: -1 })
      .limit(100)
      .toArray();
    return NextResponse.json({ blocks: blocks.map((block) => ({
      id: block._id.toString(),
      fingerprint: String(block.ipKey).slice(0, 10),
      ip: block.ip || "Not retained",
      country: block.country || "Unknown",
      attemptCount: block.attemptCount || 0,
      blockedAt: block.blockedAt,
      expiresAt: block.expiresAt,
      status: block.status || "blocked",
    })) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    void logServer({ level: "error", message: "Admin blocked IP list fetch failed", source: "admin.security.blocks", path: "/api/admin/security/blocks", method: "GET", statusCode: 503, error });
    return NextResponse.json({ error: "Unable to load blocked IPs." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid block ID." }, { status: 400 });

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("admin_session")?.value;
    const db = await getDb();
    await ensureAdminSecurityIndexes(db);
    let block: WithId<Document> | null = null;
    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        block = await db.collection("admin_ip_blocks").findOne(
          { _id: new ObjectId(id) },
          { session }
        );
        if (!block) return;
        const sessionHash = sessionToken
          ? crypto.createHash("sha256").update(sessionToken).digest("hex")
          : "";
        const adminSession = sessionHash
          ? await db.collection("admin_sessions").findOne(
              { tokenHash: sessionHash },
              { projection: { username: 1 }, session }
            )
          : null;
        await db.collection("admin_ip_blocks").updateOne(
          { _id: block._id, status: { $ne: "unblocked" } },
          { $set: { status: "unblocked", unblockedAt: new Date(), unblockedBy: adminSession?.username || "unknown" } },
          { session }
        );
        await db.collection("admin_login_attempts").deleteOne({ ipKey: block.ipKey }, { session });
        await db.collection("admin_security_audit").insertOne({
          action: "ip_block_unblocked",
          blockId: block._id,
          actor: adminSession?.username || "unknown",
          country: block.country || "Unknown",
          createdAt: new Date(),
        }, { session });
      });
    } finally {
      await session.endSession();
    }
    if (!block) return NextResponse.json({ error: "Block not found." }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    void logServer({ level: "error", message: "Admin IP unblock request failed", source: "admin.security.blocks", path: "/api/admin/security/blocks", method: "DELETE", statusCode: 503, error });
    return NextResponse.json({ error: "Unable to remove IP block." }, { status: 503 });
  }
}