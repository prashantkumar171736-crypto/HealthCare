import crypto from "crypto";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
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
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  const recipient = process.env.ADMIN_OTP_EMAIL;
  const otpSecret = process.env.OTP_HMAC_SECRET;
  const configured = Boolean(host && process.env.SMTP_PORT && Number.isInteger(port) && port > 0 && user && password && from && recipient && otpSecret);

  return {
    configured,
    maskedDestination: recipient ? recipient.replace(/^(.).+(@.*)$/, "$1***$2") : "",
  };
}

function createAdminSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) {
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    tls: { minVersion: "TLSv1.2" },
    auth: { user, pass: password },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
}

export function getAdminSmtpErrorMessage(error: unknown): string {
  const smtpError = error as { code?: string; responseCode?: number };
  const code = smtpError?.code || "";
  const responseCode = smtpError?.responseCode;

  if (code === "EAUTH" || responseCode === 535) {
    return "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD in the deployment environment; your provider may require an app password or SMTP API key.";
  }
  if (code === "ETLS" || code === "EPROTOCOL") {
    return "SMTP TLS negotiation failed. Check SMTP_PORT and the provider's required TLS mode (465 for implicit TLS, usually 587 for STARTTLS).";
  }
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ENOTFOUND"].includes(code)) {
    return "Could not connect to the SMTP server. Check SMTP_HOST and SMTP_PORT, and confirm the provider allows connections from the deployment.";
  }
  if ([550, 553, 554].includes(responseCode || 0) || code === "EENVELOPE") {
    return "The SMTP provider rejected the sender or recipient. Check that SMTP_FROM and ADMIN_OTP_EMAIL are valid and allowed by your provider.";
  }
  return "Check the SMTP host, port, credentials, sender address, and provider logs.";
}

export async function sendAdminSmtpTest(): Promise<void> {
  const recipient = process.env.ADMIN_OTP_EMAIL;
  if (!recipient) throw new Error("ADMIN_OTP_EMAIL must be configured.");
  await createAdminSmtpTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    subject: "Admin email delivery test",
    text: "This test confirms that the configured admin SMTP account accepted an email for delivery. It does not contain a verification code.",
  });
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
  await createAdminSmtpTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Your admin sign-in verification code",
    text: `Your admin verification code is ${code}. It expires in 2 minutes. If you did not request this code, you can ignore this email.`,
  });
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