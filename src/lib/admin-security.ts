import crypto from "crypto";
import { isIP } from "node:net";
import type { Db } from "mongodb";

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_DURATION_MS = 30 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const OTP_TTL_MS = 2 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export interface AdminSecuritySettings {
  otpEnabled: boolean;
}

let securityIndexesPromise: Promise<void> | null = null;

export function getTrustedClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  if (!candidate || isIP(candidate) === 0) return null;
  return candidate.startsWith("::ffff:") ? candidate.slice(7) : candidate;
}

export function getIpKey(value: string): string {
  const secret = process.env.IP_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("IP_RATE_LIMIT_SECRET must be configured.");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function getOtpConfiguration() {
  const provider = getEmailProvider();
  const recipient = process.env.ADMIN_OTP_EMAIL;
  const otpSecret = process.env.OTP_HMAC_SECRET;
  const configured = Boolean(provider && recipient && otpSecret);

  return {
    configured,
    provider: provider?.name || "",
    maskedDestination: recipient ? recipient.replace(/^(.).+(@.*)$/, "$1***$2") : "",
  };
}

type EmailProvider = { name: "Resend HTTPS API"; apiKey: string; from: string };

function getEmailProvider(): EmailProvider | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  return apiKey && from ? { name: "Resend HTTPS API", apiKey, from } : null;
}

export function getAdminEmailErrorMessage(error: unknown): string {
  const emailError = error as { code?: string; responseCode?: number };
  const code = emailError?.code || "";
  const responseCode = emailError?.responseCode;

  if (code === "ERESEND") {
    if (responseCode === 401) return "Resend rejected the API key. Check RESEND_API_KEY in the deployment environment.";
    if (responseCode === 403) return "Resend rejected this sender. Verify the sending domain and check RESEND_FROM in the deployment environment.";
    if (responseCode === 400 || responseCode === 422) return "Resend rejected the email. Verify the sending domain and confirm RESEND_FROM and ADMIN_OTP_EMAIL are valid addresses.";
    if (responseCode === 429) return "Resend rate limit reached. Wait briefly and try again.";
    return "Resend could not accept the email. Check the API key, verified sending domain, and Resend account logs.";
  }
  if (code === "ERESEND_NETWORK") {
    return "Could not connect to Resend over HTTPS. Check that RESEND_API_KEY is valid and outbound HTTPS requests are allowed from the deployment.";
  }

  return "Check RESEND_API_KEY, the verified sending domain, RESEND_FROM, and your Resend account logs.";
}

async function sendAdminEmail(to: string, subject: string, text: string): Promise<void> {
  const provider = getEmailProvider();
  if (!provider) {
    throw new Error("Configure RESEND_API_KEY and RESEND_FROM.");
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: provider.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw Object.assign(new Error("Unable to reach the Resend API."), { code: "ERESEND_NETWORK", cause: error });
  }
  if (!response.ok) {
    throw Object.assign(new Error("Resend rejected the email request."), {
      code: "ERESEND",
      responseCode: response.status,
    });
  }
}

export async function sendAdminEmailTest(): Promise<void> {
  const recipient = process.env.ADMIN_OTP_EMAIL;
  if (!recipient) throw new Error("ADMIN_OTP_EMAIL must be configured.");
  await sendAdminEmail(
    recipient,
    "Admin email delivery test",
    "This test confirms that the configured admin email provider accepted a message for delivery. It does not contain a verification code."
  );
}

export function ensureAdminSecurityIndexes(db: Db): Promise<void> {
  if (!securityIndexesPromise) {
    securityIndexesPromise = Promise.all([
    db.collection("admin_login_attempts").createIndex({ ipKey: 1 }, { unique: true }),
    db.collection("admin_login_attempts").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("admin_ip_blocks").createIndex({ ipKey: 1 }, { unique: true }),
    db.collection("admin_ip_blocks").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("admin_otp_challenges").createIndex({ challengeHash: 1 }, { unique: true }),
    db.collection("admin_otp_challenges").createIndex(
      { adminId: 1 },
      { unique: true, partialFilterExpression: { status: "pending" } }
    ),
    db.collection("admin_otp_challenges").createIndex({ adminId: 1, createdAt: -1 }),
    db.collection("admin_otp_challenges").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined).catch((error) => {
      securityIndexesPromise = null;
      throw error;
    });
  }
  return securityIndexesPromise;
}

export async function getAdminSecuritySettings(db: Db): Promise<AdminSecuritySettings> {
  const settings = await db.collection("settings").findOne({ key: "admin_security_settings" });
  return { otpEnabled: settings?.otpEnabled === true };
}

export async function findActiveIpBlock(db: Db, ipKey: string, now = new Date()) {
  return db.collection("admin_ip_blocks").findOne({ ipKey, expiresAt: { $gt: now } });
}

export async function findActiveLoginLock(db: Db, ipKey: string, now = new Date()) {
  return db.collection("admin_login_attempts").findOne({ ipKey, lockedUntil: { $gt: now } });
}

export async function recordFailedLogin(
  db: Db,
  ipKey: string,
  country: string,
  createIpBlock: boolean,
  now = new Date()
): Promise<{ attempts: number; lockedUntil: Date | null }> {
  const attemptsCollection = db.collection("admin_login_attempts");
  const cutoff = new Date(now.getTime() - FAILURE_WINDOW_MS);
  const expiresAt = new Date(now.getTime() + FAILURE_WINDOW_MS + BLOCK_DURATION_MS);

  const pipeline = [
      {
        $set: {
          windowExpired: {
            $lte: [{ $ifNull: ["$windowStartedAt", new Date(0)] }, cutoff],
          },
        },
      },
      {
        $set: {
          windowStartedAt: { $cond: ["$windowExpired", now, "$windowStartedAt"] },
          attempts: {
            $cond: ["$windowExpired", 1, { $add: [{ $ifNull: ["$attempts", 0] }, 1] }],
          },
          lockedUntil: { $cond: ["$windowExpired", null, "$lockedUntil"] },
          expiresAt,
        },
      },
      {
        $set: {
          lockedUntil: {
            $cond: [
              { $gte: ["$attempts", MAX_FAILED_LOGINS] },
              { $ifNull: ["$lockedUntil", new Date(now.getTime() + BLOCK_DURATION_MS)] },
              null,
            ],
          },
        },
      },
      { $unset: "windowExpired" },
  ];
  try {
    await attemptsCollection.updateOne({ ipKey }, pipeline, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    await attemptsCollection.updateOne({ ipKey }, pipeline);
  }

  const attempt = await attemptsCollection.findOne({ ipKey });
  const attempts = Number(attempt?.attempts || 0);
  const lockedUntil = attempt?.lockedUntil instanceof Date ? attempt.lockedUntil : null;

  if (createIpBlock && attempts >= MAX_FAILED_LOGINS && lockedUntil) {
    await db.collection("admin_ip_blocks").updateOne(
      { ipKey },
      {
        $set: {
          ipKey,
          country,
          attemptCount: attempts,
          blockedAt: now,
          expiresAt: lockedUntil,
          reason: "failed_admin_login",
        },
      },
      { upsert: true }
    );
  }

  return { attempts, lockedUntil };
}

export async function sendAdminOtp(email: string, code: string): Promise<void> {
  await sendAdminEmail(
    email,
    "Your admin sign-in verification code",
    `Your admin verification code is ${code}. It expires in 2 minutes. If you did not request this code, you can ignore this email.`
  );
}

export function createOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(challengeId: string, code: string): string {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret) throw new Error("OTP_HMAC_SECRET must be configured.");
  return crypto.createHmac("sha256", secret).update(`${challengeId}:${code}`).digest("hex");
}

export function hashChallengeId(challengeId: string): string {
  return crypto.createHash("sha256").update(challengeId).digest("hex");
}

export function otpExpiry(now = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_MS);
}

export const OTP_MAX_ATTEMPTS = MAX_OTP_ATTEMPTS;
export const IP_BLOCK_DURATION_MS = BLOCK_DURATION_MS;