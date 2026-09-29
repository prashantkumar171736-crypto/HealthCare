import crypto from "crypto";
import { getDb } from "@/lib/db";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
let sessionIndexPromise: Promise<string> | null = null;

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function validateSession(sessionToken: string | undefined): Promise<boolean> {
  if (!sessionToken || !/^[a-f0-9]{64}$/i.test(sessionToken)) return false;
  try {
    const db = await Promise.race([
      getDb(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB timeout")), 10000)
      ),
    ]);

    if (!db) return false;
    const session = await db.collection("admin_sessions").findOne({
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: { $gt: new Date() },
    });
    if (!session?.username || session.username.toLowerCase() === "admin") return false;

    const admin = await db.collection("admins").findOne(
      { username: session.username },
      { projection: { _id: 1 } }
    );
    return Boolean(admin);
  } catch (err) {
    console.error("validateSession DB lookup error:", err);
    return false;
  }
}

export async function createAdminSession(username: string): Promise<string> {
  const db = await getDb();
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const sessions = db.collection("admin_sessions");
  if (!sessionIndexPromise) {
    sessionIndexPromise = sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
      sessionIndexPromise = null;
      throw error;
    });
  }
  await sessionIndexPromise;
  await sessions.insertOne({
    tokenHash: hashSessionToken(sessionToken),
    username,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return sessionToken;
}

export async function revokeSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken || !/^[a-f0-9]{64}$/i.test(sessionToken)) return;
  try {
    const db = await getDb();
    await db.collection("admin_sessions").deleteOne({
      tokenHash: hashSessionToken(sessionToken),
    });
  } catch (err) {
    console.error("Failed to revoke admin session:", err);
  }
}