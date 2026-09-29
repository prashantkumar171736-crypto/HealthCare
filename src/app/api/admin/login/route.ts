import "@/lib/env"; // Ensures environment variables are loaded across dev, PM2, systemd, and cloud
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { createAdminSession, SESSION_TTL_SECONDS } from "@/lib/admin-auth";
import {
  createOtpCode,
  ensureAdminSecurityIndexes,
  findActiveIpBlock,
  findActiveLoginLock,
  getAdminSmtpErrorMessage,
  getAdminSecuritySettings,
  getIpKey,
  getOtpConfiguration,
  getTrustedClientIp,
  hashChallengeId,
  hashOtp,
  otpExpiry,
  recordFailedLogin,
  sendAdminOtp,
} from "@/lib/admin-security";

export { revokeSession, validateSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helper: Verify Password Against MongoDB Admin Document
// ---------------------------------------------------------------------------
interface AdminPasswordRecord {
  passwordHash?: unknown;
  salt?: unknown;
}

function verifyAdminPassword(password: string, admin: AdminPasswordRecord): boolean {
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

  const trustedIp = getTrustedClientIp(request) || (process.env.NODE_ENV === "development" ? "127.0.0.1" : null);
  if (!trustedIp) {
    return NextResponse.json({ error: "Unable to verify the client network. Please retry." }, { status: 503 });
  }

  // --- Authenticate credentials against MongoDB ---
  let isValid = false;
  let authenticatedUsername = username;
  let authenticatedDb: Awaited<ReturnType<typeof getDb>> | null = null;

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
    authenticatedDb = db;

    await ensureAdminSecurityIndexes(db);
    if (!process.env.IP_RATE_LIMIT_SECRET) {
      return NextResponse.json({ error: "IP_RATE_LIMIT_SECRET must be configured." }, { status: 503 });
    }
    const ipKey = getIpKey(trustedIp);
    const [activeBlock, activeLock] = await Promise.all([
      findActiveIpBlock(db, ipKey),
      findActiveLoginLock(db, ipKey),
    ]);
    const lockedUntil = activeBlock?.expiresAt || activeLock?.lockedUntil;
    if (lockedUntil instanceof Date && lockedUntil > new Date()) {
      const retryAfter = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
      return NextResponse.json(
        { error: "This network is temporarily blocked from admin sign-in." },
        { status: 429, headers: { "Retry-After": String(retryAfter), "X-RateLimit-Limit": "5" } }
      );
    }

    const country = request.headers.get("x-vercel-ip-country") || "Unknown";
    if (username.length > 254 || password.length > 1024) {
      await recordFailedLogin(db, ipKey, country, true);
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const securitySettings = await getAdminSecuritySettings(db);
    const otpConfiguration = getOtpConfiguration();
    if (securitySettings.otpEnabled && !otpConfiguration.configured) {
      return NextResponse.json({ error: "Email OTP is enabled but its SMTP or admin-email configuration is incomplete." }, { status: 503 });
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
      isValid = verifyAdminPassword(password, {
        passwordHash: admin.passwordHash,
        salt: admin.salt,
      });
      if (isValid) {
        if (securitySettings.otpEnabled) {
          const now = new Date();
          const challenges = db.collection("admin_otp_challenges");
          const recentChallenge = await challenges.findOne({
            adminId: admin._id,
            createdAt: { $gt: new Date(now.getTime() - 60_000) },
          });
          if (recentChallenge) {
            return NextResponse.json(
              { error: "A verification code was requested recently. Please wait before trying again." },
              { status: 429, headers: { "Retry-After": "60" } }
            );
          }

          const challengeId = crypto.randomBytes(32).toString("hex");
          const code = createOtpCode();
          await challenges.updateMany(
            { adminId: admin._id, status: "pending" },
            { $set: { status: "invalidated", invalidatedAt: now } }
          );
          try {
            await challenges.insertOne({
              challengeHash: hashChallengeId(challengeId),
              adminId: admin._id,
              username: authenticatedUsername,
              otpHash: hashOtp(challengeId, code),
              createdAt: now,
              expiresAt: otpExpiry(now),
              attemptCount: 0,
              status: "pending",
            });
          } catch (error) {
            if ((error as { code?: number }).code === 11000) {
              return NextResponse.json(
                { error: "A verification code was requested recently. Please wait before trying again." },
                { status: 429, headers: { "Retry-After": "60" } }
              );
            }
            throw error;
          }

          try {
            await sendAdminOtp(process.env.ADMIN_OTP_EMAIL!, code);
          } catch (mailError) {
            await challenges.updateOne(
              { challengeHash: hashChallengeId(challengeId), status: "pending" },
              { $set: { status: "invalidated", invalidatedAt: new Date() } }
            );
            const smtpError = mailError as { code?: string; responseCode?: number };
            console.error("Admin OTP email delivery failed:", { code: smtpError?.code, responseCode: smtpError?.responseCode });
            return NextResponse.json({
              error: `Could not send the verification email. No admin session was created. ${getAdminSmtpErrorMessage(mailError)}`,
            }, { status: 503 });
          }

          return NextResponse.json({
            otpRequired: true,
            challengeId,
            maskedDestination: otpConfiguration.maskedDestination,
            expiresAt: otpExpiry(now).toISOString(),
          });
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

  const ipKey = getIpKey(trustedIp);
  const db = authenticatedDb;
  if (!db) return NextResponse.json({ error: "Authentication service is temporarily unavailable." }, { status: 503 });

  if (isValid) {
    const sessionToken = await createAdminSession(authenticatedUsername);

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

  const now = new Date();
  const country = request.headers.get("x-vercel-ip-country") || "Unknown";
  await recordFailedLogin(db, ipKey, country, true, now);

  await new Promise((resolve) => setTimeout(resolve, crypto.randomInt(50, 151)));

  return NextResponse.json(
    { error: "Invalid username or password." },
    { status: 401 }
  );
}
