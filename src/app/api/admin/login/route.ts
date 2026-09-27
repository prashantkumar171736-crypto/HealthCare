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
const DEFAULT_JWT_SECRET =
  "d03ed891cf12e6fcff59180ab19183a6909a3f60dd343e1bb045863bf02bad41bafa76851b461a579c4e5a0101cd5fad";

export function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length >= 32) {
    return secret.trim();
  }
  return DEFAULT_JWT_SECRET;
}

export function requireSecret(): string {
  return getSecret();
}

export function getSessionHash(username: string): string {
  const secret = getSecret();
  const normalized = (username || "").trim().toLowerCase();
  return crypto
    .createHmac("sha256", secret)
    .update(`admin-session:${normalized}:${secret}`)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Session Cache & Validation
// ---------------------------------------------------------------------------
const sessionCache = new Map<string, { username: string; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache to avoid constant Atlas lag

export async function validateSession(
  sessionToken: string | undefined
): Promise<boolean> {
  if (!sessionToken || sessionToken.length !== 64) return false;

  const now = Date.now();
  const cached = sessionCache.get(sessionToken);
  if (cached && cached.expiresAt > now) {
    return true;
  }

  const secret = getSecret();

  // Fast-check known primary admin identifiers
  const knownAdmins = [
    "admin",
    "kumar.pk6342@gmail.com",
    process.env.ADMIN_USERNAME,
  ].filter(Boolean) as string[];

  for (const name of knownAdmins) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`admin-session:${name.trim().toLowerCase()}:${secret}`)
      .digest("hex");
    if (
      expected.length === sessionToken.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sessionToken))
    ) {
      sessionCache.set(sessionToken, { username: name, expiresAt: now + CACHE_TTL_MS });
      return true;
    }
  }

  // Check MongoDB admins collection
  try {
    const db = await Promise.race([
      getDb(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB timeout")), 10000)
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
        .update(`admin-session:${admin.username.trim().toLowerCase()}:${secret}`)
        .digest("hex");

      if (
        expected.length === sessionToken.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sessionToken))
      ) {
        sessionCache.set(sessionToken, { username: admin.username, expiresAt: now + CACHE_TTL_MS });
        return true;
      }
    }
  } catch (err) {
    console.error("validateSession DB lookup error:", err);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Helper: Verify Password Against MongoDB Admin Document
// ---------------------------------------------------------------------------
function verifyAdminPassword(password: string, admin: any): boolean {
  // 1. PBKDF2 with salt (standard format in MongoDB admins collection)
  if (admin.passwordHash && admin.salt) {
    try {
      const computed = crypto
        .pbkdf2Sync(password, admin.salt, 10000, 64, "sha512")
        .toString("hex");

      if (
        computed.length === admin.passwordHash.length &&
        crypto.timingSafeEqual(
          Buffer.from(computed),
          Buffer.from(admin.passwordHash)
        )
      ) {
        return true;
      }
    } catch (e) {
      console.error("PBKDF2 verification error:", e);
    }
  }

  // 2. Direct SHA-256 hash without salt
  if (admin.passwordHash) {
    try {
      const sha256 = crypto.createHash("sha256").update(password).digest("hex");
      if (
        sha256.length === admin.passwordHash.length &&
        crypto.timingSafeEqual(
          Buffer.from(sha256),
          Buffer.from(admin.passwordHash)
        )
      ) {
        return true;
      }
    } catch (e) {
      console.error("SHA256 verification error:", e);
    }
  }

  // 3. Plaintext match if stored directly
  if (typeof admin.password === "string" && admin.password === password) {
    return true;
  }
  if (typeof admin.passwordHash === "string" && admin.passwordHash === password) {
    return true;
  }

  // 4. Default admin password fallback for primary administrative accounts
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || "admin";
  if (password === defaultAdminPassword) {
    const uLower = (admin.username || "").toLowerCase();
    if (
      uLower === "admin" ||
      uLower === "kumar.pk6342@gmail.com" ||
      uLower === (process.env.ADMIN_USERNAME || "").toLowerCase()
    ) {
      return true;
    }
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

    if (admin) {
      authenticatedUsername = admin.username || username;
      isValid = verifyAdminPassword(password, admin);
    } else {
      // If admin doesn't exist yet, check primary configured credentials
      const defaultAdminUsername = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
      const defaultAdminPassword = process.env.ADMIN_PASSWORD || "admin";

      if (
        (username.toLowerCase() === "admin" || username.toLowerCase() === defaultAdminUsername) &&
        password === defaultAdminPassword
      ) {
        isValid = true;
        authenticatedUsername = "admin";

        // Auto-seed admin user into MongoDB so it lives in the database
        try {
          const salt = crypto.randomBytes(16).toString("hex");
          const passwordHash = crypto
            .pbkdf2Sync(password, salt, 10000, 64, "sha512")
            .toString("hex");

          await db.collection("admins").updateOne(
            { username: "admin" },
            {
              $set: {
                username: "admin",
                passwordHash,
                salt,
                updatedAt: new Date(),
              },
              $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true }
          );
        } catch (seedErr) {
          console.error("Auto-seed admin error:", seedErr);
        }
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

    const sessionHash = getSessionHash(authenticatedUsername);
    sessionCache.set(sessionHash, {
      username: authenticatedUsername,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    const cookieStore = await cookies();

    cookieStore.set("admin_session", sessionHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
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
