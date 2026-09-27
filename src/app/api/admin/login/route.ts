import "@/lib/env"; // Ensures environment variables are loaded across dev, PM2, systemd, and cloud
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Rate Limiter (per IP)
// ---------------------------------------------------------------------------
interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 10;           // max failed attempts before lockout
const WINDOW_MS = 15 * 60 * 1000;  // 15-minute rolling window
const LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) return { allowed: true, retryAfterMs: 0 };

  if (entry.lockedUntil !== null) {
    if (now < entry.lockedUntil) {
      return { allowed: false, retryAfterMs: entry.lockedUntil - now };
    }
    rateLimitMap.delete(ip);
    return { allowed: true, retryAfterMs: 0 };
  }

  if (now - entry.firstAttemptAt > WINDOW_MS) {
    rateLimitMap.delete(ip);
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, retryAfterMs: LOCKOUT_MS };
  }

  return { allowed: true, retryAfterMs: 0 };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { attempts: 1, firstAttemptAt: now, lockedUntil: null });
    return;
  }
  if (now - entry.firstAttemptAt > WINDOW_MS && entry.lockedUntil === null) {
    rateLimitMap.set(ip, { attempts: 1, firstAttemptAt: now, lockedUntil: null });
    return;
  }
  entry.attempts += 1;
  if (entry.attempts >= MAX_ATTEMPTS && entry.lockedUntil === null) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

function clearRateLimit(ip: string): void {
  rateLimitMap.delete(ip);
}

// ---------------------------------------------------------------------------
// Secret Key Handling
// ---------------------------------------------------------------------------
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function validateSession(
  sessionToken: string | undefined
): Promise<boolean> {
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

// ---------------------------------------------------------------------------
// Helper: Verify Password Against MongoDB Admin Document
// ---------------------------------------------------------------------------
function verifyAdminPassword(password: string, admin: any): boolean {
  if (typeof admin.passwordHash !== "string" || typeof admin.salt !== "string") return false;
  try {
    const computed = crypto
      .pbkdf2Sync(password, admin.salt, 10000, 64, "sha512")
      .toString("hex");
    const expected = Buffer.from(admin.passwordHash, "hex");
    const actual = Buffer.from(computed, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/login
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const ip = getClientIP(request);

  // --- Rate limit check ---
  const { allowed, retryAfterMs } = checkRateLimit(ip);
  if (!allowed) {
    const retryAfterSecs = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      {
        error: `Too many failed attempts. Please try again in ${Math.ceil(retryAfterSecs / 60)} minutes.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": String(MAX_ATTEMPTS),
        },
      }
    );
  }

  // --- Parse input ---
  let username = "";
  let password = "";

  try {
    const body = await request.json();
    username = typeof body.username === "string" ? body.username.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  if (username.length > 254 || password.length > 1024) {
    recordFailedAttempt(ip);
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  // --- Authenticate credentials against MongoDB ---
  let isValid = false;
  let authenticatedUsername = username;
  let sessionToken = "";

  try {
    const db = await Promise.race([
      getDb(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Database connection timeout")), 10000)
      ),
    ]);

    if (!db) {
      console.error("Login: DB connection returned null.");
      return NextResponse.json(
        { error: "Database service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Look up in MongoDB admins collection (exact or case-insensitive)
    const admin = await db.collection("admins").findOne({
      $or: [
        { username: username },
        { username: { $regex: new RegExp(`^${escapedUsername}$`, "i") } },
      ],
    });

    if (admin && admin.username?.trim().toLowerCase() !== "admin") {
      authenticatedUsername = admin.username || username;
      isValid = verifyAdminPassword(password, admin);
      if (isValid) {
        sessionToken = crypto.randomBytes(32).toString("hex");
        const now = new Date();
        const sessions = db.collection("admin_sessions");
        await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        await sessions.insertOne({
          tokenHash: hashSessionToken(sessionToken),
          username: authenticatedUsername,
          createdAt: now,
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        });
      }
    }
  } catch (dbErr) {
    console.error("Login: DB error during authentication:", dbErr);
    return NextResponse.json(
      { error: "Authentication service temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  // --- Success: Set session cookie ---
  if (isValid) {
    clearRateLimit(ip);

    const cookieStore = await cookies();

    cookieStore.set("admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return NextResponse.json({ success: true, username: authenticatedUsername });
  }

  // Failed login: record the attempt
  recordFailedAttempt(ip);

  // Small random delay to mitigate timing side-channels
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  return NextResponse.json(
    { error: "Invalid username or password." },
    { status: 401 }
  );
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
