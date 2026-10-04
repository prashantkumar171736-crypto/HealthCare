import "@/lib/env"; // Ensures environment variables are loaded across dev, PM2, systemd, and cloud
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { logServer } from "@/lib/server-logger";
import { normalizeCountryName } from "@/lib/geo";
import { createAdminSession, SESSION_TTL_SECONDS } from "@/lib/admin-auth";
import {
  createOtpCode,
  ensureAdminSecurityIndexes,
  getEmailLoginSettings,
  findActiveIpBlock,
  findActiveLoginLock,
  getAdminEmailErrorMessage,
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
    void logServer({ level: "error", message: "Admin login request could not resolve a trusted client network", source: "admin.login", path: "/api/admin/login", method: "POST", statusCode: 503 });
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
      void logServer({ level: "error", message: "Admin login database connection timed out", source: "admin.login", path: "/api/admin/login", method: "POST", statusCode: 503 });
      return NextResponse.json(
        { error: "Database service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
    authenticatedDb = db;

    await ensureAdminSecurityIndexes(db);
    if (!process.env.IP_RATE_LIMIT_SECRET) {
      void logServer({ level: "error", message: "Admin login IP rate-limit secret is not configured", source: "admin.login", path: "/api/admin/login", method: "POST", statusCode: 503 });
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
      void logServer({
        level: "warn",
        message: "Admin sign-in rejected by active network lock",
        source: "admin.login",
        path: "/api/admin/login",
        method: "POST",
        statusCode: 429,
      });
      return NextResponse.json(
        { error: "This network is temporarily blocked from admin sign-in." },
        { status: 429, headers: { "Retry-After": String(retryAfter), "X-RateLimit-Limit": "5" } }
      );
    }

    const country = normalizeCountryName(request.headers.get("x-vercel-ip-country"));
    if (username.length > 254 || password.length > 1024) {
      await recordFailedLogin(db, ipKey, country, true, trustedIp);
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const securitySettings = await getEmailLoginSettings(db);
    const otpConfiguration = getOtpConfiguration();
    if (securitySettings.requireOtp && !otpConfiguration.configured) {
      void logServer({ level: "error", message: "Admin login OTP provider is not configured", source: "admin.login", path: "/api/admin/login", method: "POST", statusCode: 503 });
      return NextResponse.json({ error: "Email OTP is enabled but its email-provider or admin-email configuration is incomplete." }, { status: 503 });
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
        if (securitySettings.requireOtp) {
          const now = new Date();
          const challenges = db.collection("admin_otp_challenges");
          const cooldowns = db.collection("admin_otp_cooldowns");
          const activeCooldown = await cooldowns.findOne({ adminId: admin._id, expiresAt: { $gt: now } });
          if (activeCooldown) {
            const retryAfter = Math.max(1, Math.ceil((activeCooldown.expiresAt.getTime() - now.getTime()) / 1000));
            return NextResponse.json(
              { error: `A verification code was sent recently. Please wait ${retryAfter} seconds before trying again.` },
              { status: 429, headers: { "Retry-After": String(retryAfter) } }
            );
          }

          const challengeId = crypto.randomBytes(32).toString("hex");
          const code = createOtpCode();
          const expiresAt = otpExpiry(now, securitySettings.otpExpiryMinutes);
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
              expiresAt,
              attemptCount: 0,
              maxOtpAttempts: securitySettings.maxOtpAttempts,
              resendCooldownSeconds: securitySettings.resendCooldownSeconds,
              status: "pending",
            });
          } catch (error) {
            if ((error as { code?: number }).code === 11000) {
              const existingChallenge = await challenges.findOne(
                { adminId: admin._id, status: "pending" },
                { sort: { createdAt: -1 } }
              );
              const challengeCooldown = existingChallenge && Number.isInteger(existingChallenge.resendCooldownSeconds)
                ? existingChallenge.resendCooldownSeconds
                : securitySettings.resendCooldownSeconds;
              const retryAfter = existingChallenge
                ? Math.max(1, Math.ceil((existingChallenge.createdAt.getTime() + challengeCooldown * 1000 - Date.now()) / 1000))
                : challengeCooldown;
              return NextResponse.json(
                { error: `A verification code was requested recently. Please wait ${retryAfter} seconds before trying again.` },
                { status: 429, headers: { "Retry-After": String(retryAfter) } }
              );
            }
            throw error;
          }

          await cooldowns.updateOne(
            { adminId: admin._id },
            {
              $set: {
                adminId: admin._id,
                createdAt: now,
                expiresAt: new Date(now.getTime() + securitySettings.resendCooldownSeconds * 1000),
              },
            },
            { upsert: true }
          );
          try {
            await sendAdminOtp(process.env.ADMIN_OTP_EMAIL!, code, securitySettings.otpExpiryMinutes);
          } catch (mailError) {
            await challenges.updateOne(
              { challengeHash: hashChallengeId(challengeId), status: "pending" },
              { $set: { status: "invalidated", invalidatedAt: new Date() } }
            );
            await cooldowns.deleteOne({ adminId: admin._id });
            const emailError = mailError as { code?: string; responseCode?: number };
            console.error("Admin OTP email delivery failed:", { code: emailError?.code, responseCode: emailError?.responseCode });
            void logServer({
              level: "error",
              message: "Admin OTP email delivery failed",
              source: "admin.login.otp-email",
              path: "/api/admin/login",
              method: "POST",
              statusCode: 503,
              error: mailError,
              meta: { providerCode: emailError?.code, responseCode: emailError?.responseCode },
            });
            return NextResponse.json({
              error: `Could not send the verification email. No admin session was created. ${getAdminEmailErrorMessage(mailError)}`,
            }, { status: 503 });
          }
          const sentAt = new Date();
          try {
            await cooldowns.updateOne(
              { adminId: admin._id },
              { $set: { createdAt: sentAt, expiresAt: new Date(sentAt.getTime() + securitySettings.resendCooldownSeconds * 1000) } }
            );
          } catch (cooldownError) {
            console.error("Admin OTP cooldown update failed after delivery:", cooldownError);
            void logServer({
              level: "error",
              message: "Admin OTP cooldown update failed",
              source: "admin.login.otp-cooldown",
              path: "/api/admin/login",
              method: "POST",
              statusCode: 500,
              error: cooldownError,
            });
          }

          return NextResponse.json({
            otpRequired: true,
            challengeId,
            maskedDestination: otpConfiguration.maskedDestination,
            expiresAt: expiresAt.toISOString(),
          });
        }
      }
    }
  } catch (dbErr) {
    console.error("Login: DB error during authentication:", dbErr);
    void logServer({
      level: "error",
      message: "Admin login authentication database operation failed",
      source: "admin.login",
      path: "/api/admin/login",
      method: "POST",
      statusCode: 503,
      error: dbErr,
    });
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
  const country = normalizeCountryName(request.headers.get("x-vercel-ip-country"));
  await recordFailedLogin(db, ipKey, country, true, trustedIp, now);
  void logServer({
    level: "warn",
    message: "Admin sign-in rejected due to invalid credentials",
    source: "admin.login",
    path: "/api/admin/login",
    method: "POST",
    statusCode: 401,
    meta: { reason: "invalid_credentials" },
  });

  await new Promise((resolve) => setTimeout(resolve, crypto.randomInt(50, 151)));

  return NextResponse.json(
    { error: "Invalid username or password." },
    { status: 401 }
  );
}
