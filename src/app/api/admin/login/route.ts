import "@/lib/env"; // Ensures .env.local is loaded in all environments (dev, PM2, systemd)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// In-memory brute-force rate limiter (per IP).
// ---------------------------------------------------------------------------
interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;            // max failed attempts before lockout
const WINDOW_MS = 15 * 60 * 1000; // 15-minute rolling window
const LOCKOUT_MS = 30 * 60 * 1000; // 30-minute lockout after breach

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
// Session token — HMAC-SHA256 bound to JWT_SECRET (must be ≥ 32 chars).
// No insecure fallback is accepted.
// ---------------------------------------------------------------------------
function requireSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET env var is missing or too short (minimum 32 characters). " +
        "Set a strong random value in .env.local."
    );
  }
  return secret;
}

export function getSessionHash(username: string): string {
  const secret = requireSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(`admin-session:${username}:${secret}`)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// validateSession — ONLY verifies against live MongoDB admin records.
// Hardcoded usernames and env-var bypasses are removed.
// ---------------------------------------------------------------------------
export async function validateSession(
  sessionToken: string | undefined
): Promise<boolean> {
  if (!sessionToken || sessionToken.length !== 64) return false;

  let secret: string;
  try {
    secret = requireSecret();
  } catch {
    console.error("validateSession: JWT_SECRET is not properly configured.");
    return false;
  }

  try {
    const db = await Promise.race([
      getDb(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB timeout")), 5000)
      ),
    ]);

    if (!db) return false;

    const admins = await db
      .collection("admins")
      .find({}, { projection: { username: 1 } })
      .toArray();

    for (const admin of admins) {
      if (!admin.username) continue;
      const expected = crypto
        .createHmac("sha256", secret)
        .update(`admin-session:${admin.username}:${secret}`)
        .digest("hex");
      // Constant-time comparison to prevent timing attacks
      if (
        expected.length === sessionToken.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sessionToken))
      ) {
        return true;
      }
    }
  } catch (err) {
    // If DB is unreachable, DENY access — never fall back to insecure bypasses.
    console.error("validateSession: DB unavailable, denying access:", err);
    return false;
  }

  return false;
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

  // --- Parse & sanitize input ---
  let username: string;
  let password: string;

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

  // Hard limits to prevent oversized payloads
  if (username.length > 254 || password.length > 1024) {
    recordFailedAttempt(ip);
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  // --- Ensure JWT_SECRET is configured ---
  try {
    requireSecret();
  } catch (err) {
    console.error("Login: JWT_SECRET misconfiguration:", err);
    return NextResponse.json(
      { error: "Server configuration error. Contact administrator." },
      { status: 500 }
    );
  }

  // --- Authenticate STRICTLY against MongoDB only ---
  let isValid = false;

  try {
    const db = await Promise.race([
      getDb(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB timeout")), 5000)
      ),
    ]);

    if (!db) {
      console.error("Login: DB connection returned null.");
      return NextResponse.json(
        { error: "Authentication service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const admin = await db
      .collection("admins")
      .findOne({ username }, { projection: { passwordHash: 1, salt: 1 } });

    if (admin && admin.passwordHash && admin.salt) {
      const computed = crypto
        .pbkdf2Sync(password, admin.salt, 10000, 64, "sha512")
        .toString("hex");

      // Constant-time comparison to prevent timing side-channels
      if (
        computed.length === admin.passwordHash.length &&
        crypto.timingSafeEqual(
          Buffer.from(computed),
          Buffer.from(admin.passwordHash)
        )
      ) {
        isValid = true;
      }
    }
    // Missing record or wrong password both fall through to isValid = false — no distinction.
  } catch (dbErr) {
    console.error("Login: DB error during authentication:", dbErr);
    return NextResponse.json(
      { error: "Authentication service temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  // --- Issue session or reject ---
  if (isValid) {
    clearRateLimit(ip); // reset counter on successful login

    const sessionHash = getSessionHash(username);
    const cookieStore = await cookies();

    cookieStore.set("admin_session", sessionHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",  // upgraded from 'lax' — tighter CSRF protection
      path: "/",
      maxAge: 60 * 60 * 8, // 8-hour session (reduced from 24 h)
    });

    return NextResponse.json({ success: true });
    // Deliberately NOT returning username in the response body.
  }

  // Failed login: record the attempt
  recordFailedAttempt(ip);

  // Add a small jitter delay to resist timing-based user enumeration
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  return NextResponse.json(
    { error: "Invalid username or password." },
    { status: 401 }
  );
}
