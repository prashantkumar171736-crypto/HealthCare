import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId, type WithId, type Document } from "mongodb";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/admin-auth";
import { ensureAdminSecurityIndexes } from "@/lib/admin-security";

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
      .find({ expiresAt: { $gt: new Date() } })
      .sort({ blockedAt: -1 })
      .limit(100)
      .toArray();
    return NextResponse.json({ blocks: blocks.map((block) => ({
      id: block._id.toString(),
      fingerprint: String(block.ipKey).slice(0, 10),
      country: block.country || "Unknown",
      attemptCount: block.attemptCount || 0,
      blockedAt: block.blockedAt,
      expiresAt: block.expiresAt,
    })) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
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
        block = await db.collection("admin_ip_blocks").findOneAndDelete(
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
  } catch {
    return NextResponse.json({ error: "Unable to remove IP block." }, { status: 503 });
  }
}