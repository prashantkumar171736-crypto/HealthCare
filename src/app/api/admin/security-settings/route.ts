import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/admin-auth";
import {
  clearIpBlockSettingsCache,
  DEFAULT_IP_BLOCK_SETTINGS,
  ensureAdminSecurityIndexes,
  getIpBlockSettings,
} from "@/lib/admin-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminContext() {
  const token = (await cookies()).get("admin_session")?.value;
  if (!(await validateSession(token))) return null;
  const db = await getDb();
  const tokenHash = token ? crypto.createHash("sha256").update(token).digest("hex") : "";
  const session = tokenHash ? await db.collection("admin_sessions").findOne({ tokenHash }, { projection: { username: 1 } }) : null;
  return { db, username: session?.username || "unknown" };
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
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureAdminSecurityIndexes(context.db);
    const settings = await getIpBlockSettings(context.db);
    return NextResponse.json(settings, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Unable to load IP settings." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const ranges = {
    maxFailedAttempts: [3, 20],
    attemptWindowMinutes: [1, 120],
    blockDurationMinutes: [1, 1440],
  } as const;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const value = body[key];
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
      return NextResponse.json({ error: `${key} must be an integer between ${min} and ${max}.` }, { status: 400 });
    }
  }

  try {
    await ensureAdminSecurityIndexes(context.db);
    const value = {
      key: "ipBlock",
      maxFailedAttempts: body.maxFailedAttempts as number,
      attemptWindowMinutes: body.attemptWindowMinutes as number,
      blockDurationMinutes: body.blockDurationMinutes as number,
      updatedAt: new Date(),
      updatedBy: context.username,
    };
    await context.db.collection("settings").updateOne({ key: value.key }, { $set: value }, { upsert: true });
    clearIpBlockSettingsCache();
    return NextResponse.json({ success: true, ...DEFAULT_IP_BLOCK_SETTINGS, ...value });
  } catch {
    return NextResponse.json({ error: "Unable to save IP settings." }, { status: 503 });
  }
}