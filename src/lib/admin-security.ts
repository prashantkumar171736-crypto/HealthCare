import crypto from "crypto";
import { isIP } from "node:net";
import type { Db } from "mongodb";

export const DEFAULT_IP_BLOCK_SETTINGS = {
  maxFailedAttempts: 5,
  attemptWindowMinutes: 15,
  blockDurationMinutes: 1440,
};

export const DEFAULT_EMAIL_LOGIN_SETTINGS = {
  requireOtp: true,
  otpExpiryMinutes: 2,
  maxOtpAttempts: 5,
  resendCooldownSeconds: 60,
};

export interface IpBlockSettings {
  maxFailedAttempts: number;
  attemptWindowMinutes: number;
  blockDurationMinutes: number;
}

export interface EmailLoginSettings {
  requireOtp: boolean;
  otpExpiryMinutes: number;
  maxOtpAttempts: number;
  resendCooldownSeconds: number;
}

const SETTINGS_CACHE_MS = 30_000;
const IP_SETTINGS_KEY = "ipBlock";
const EMAIL_SETTINGS_KEY = "emailLogin";
let ipBlockSettingsCache: { value: IpBlockSettings; at: number } | null = null;
let emailLoginSettingsCache: { value: EmailLoginSettings; at: number } | null = null;

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

async function sendAdminEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
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
      body: JSON.stringify({ from: provider.from, to: [to], subject, text, ...(html ? { html } : {}) }),
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

export async function sendAdminEmailTest(expiryMinutes = DEFAULT_EMAIL_LOGIN_SETTINGS.otpExpiryMinutes): Promise<void> {
  const recipient = process.env.ADMIN_OTP_EMAIL;
  if (!recipient) throw new Error("ADMIN_OTP_EMAIL must be configured.");
  const message = buildOtpEmail({ code: "123456", expiryMinutes, testMode: true });
  await sendAdminEmail(recipient, message.subject, message.text, message.html);
}

export function ensureAdminSecurityIndexes(db: Db): Promise<void> {
  if (!securityIndexesPromise) {
    securityIndexesPromise = (async () => {
      const blocks = db.collection("admin_ip_blocks");
      let indexes: Array<{ name?: string; key: Record<string, unknown>; unique?: boolean; expireAfterSeconds?: number }> = [];
      try {
        indexes = await blocks.listIndexes().toArray();
      } catch (error) {
        if ((error as { code?: number }).code !== 26) throw error;
      }
      for (const index of indexes) {
        const isOldUniqueFingerprint = index.key.ipKey === 1 && index.unique === true;
        const isOldExpiryTtl = index.key.expiresAt === 1 && index.expireAfterSeconds !== undefined;
        if (index.name !== "_id_" && (isOldUniqueFingerprint || isOldExpiryTtl)) {
          if (index.name) {
            try {
              await blocks.dropIndex(index.name);
            } catch (error) {
              if ((error as { code?: number }).code !== 27) throw error;
            }
          }
        }
      }

      await Promise.all([
        db.collection("admin_login_attempts").createIndex({ ipKey: 1 }, { unique: true }),
        db.collection("admin_login_attempts").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        blocks.createIndex({ ipKey: 1 }),
        blocks.createIndex({ expiresAt: 1 }),
        blocks.createIndex({ status: 1, expiresAt: 1 }),
        blocks.createIndex({ blockedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }),
        blocks.createIndex({ ipKey: 1, expiresAt: 1 }, { unique: true }),
        db.collection("admin_otp_challenges").createIndex({ challengeHash: 1 }, { unique: true }),
        db.collection("admin_otp_challenges").createIndex(
          { adminId: 1 },
          { unique: true, partialFilterExpression: { status: "pending" } }
        ),
        db.collection("admin_otp_challenges").createIndex({ adminId: 1, createdAt: -1 }),
        db.collection("admin_otp_challenges").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("admin_otp_cooldowns").createIndex({ adminId: 1 }, { unique: true }),
        db.collection("admin_otp_cooldowns").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]);
    })().catch((error) => {
      securityIndexesPromise = null;
      throw error;
    });
  }
  return securityIndexesPromise;
}

export async function getAdminSecuritySettings(db: Db): Promise<AdminSecuritySettings> {
  const settings = await getEmailLoginSettings(db);
  return { otpEnabled: settings.requireOtp };
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
}

export async function getIpBlockSettings(db: Db): Promise<IpBlockSettings> {
  if (ipBlockSettingsCache && Date.now() - ipBlockSettingsCache.at < SETTINGS_CACHE_MS) {
    return ipBlockSettingsCache.value;
  }
  const document = await db.collection("settings").findOne({ key: IP_SETTINGS_KEY });
  const storedBlockDuration = document?.blockDurationMinutes === 30
    ? DEFAULT_IP_BLOCK_SETTINGS.blockDurationMinutes
    : document?.blockDurationMinutes;
  const value: IpBlockSettings = {
    maxFailedAttempts: boundedInteger(document?.maxFailedAttempts, DEFAULT_IP_BLOCK_SETTINGS.maxFailedAttempts, 3, 20),
    attemptWindowMinutes: boundedInteger(document?.attemptWindowMinutes, DEFAULT_IP_BLOCK_SETTINGS.attemptWindowMinutes, 1, 120),
    blockDurationMinutes: boundedInteger(storedBlockDuration, DEFAULT_IP_BLOCK_SETTINGS.blockDurationMinutes, 1, 43200),
  };
  ipBlockSettingsCache = { value, at: Date.now() };
  return value;
}

export function clearIpBlockSettingsCache(): void {
  ipBlockSettingsCache = null;
}

export async function getEmailLoginSettings(db: Db): Promise<EmailLoginSettings> {
  if (emailLoginSettingsCache && Date.now() - emailLoginSettingsCache.at < SETTINGS_CACHE_MS) {
    return emailLoginSettingsCache.value;
  }
  const [document, legacy] = await Promise.all([
    db.collection("settings").findOne({ key: EMAIL_SETTINGS_KEY }),
    db.collection("settings").findOne({ key: "admin_security_settings" }),
  ]);
  const value: EmailLoginSettings = {
    requireOtp: typeof document?.requireOtp === "boolean"
      ? document.requireOtp
      : typeof legacy?.otpEnabled === "boolean"
        ? legacy.otpEnabled
        : DEFAULT_EMAIL_LOGIN_SETTINGS.requireOtp,
    otpExpiryMinutes: boundedInteger(document?.otpExpiryMinutes, DEFAULT_EMAIL_LOGIN_SETTINGS.otpExpiryMinutes, 1, 10),
    maxOtpAttempts: boundedInteger(document?.maxOtpAttempts, DEFAULT_EMAIL_LOGIN_SETTINGS.maxOtpAttempts, 3, 10),
    resendCooldownSeconds: boundedInteger(document?.resendCooldownSeconds, DEFAULT_EMAIL_LOGIN_SETTINGS.resendCooldownSeconds, 30, 300),
  };
  emailLoginSettingsCache = { value, at: Date.now() };
  return value;
}

export function clearEmailLoginSettingsCache(): void {
  emailLoginSettingsCache = null;
}

export async function findActiveIpBlock(db: Db, ipKey: string, now = new Date()) {
  return db.collection("admin_ip_blocks").findOne({
    ipKey,
    expiresAt: { $gt: now },
    $or: [{ status: "blocked" }, { status: { $exists: false } }],
  });
}

export async function findActiveLoginLock(db: Db, ipKey: string, now = new Date()) {
  return db.collection("admin_login_attempts").findOne({ ipKey, lockedUntil: { $gt: now } });
}

export async function recordFailedLogin(
  db: Db,
  ipKey: string,
  country: string,
  createIpBlock: boolean,
  clientIp: string,
  now = new Date()
): Promise<{ attempts: number; lockedUntil: Date | null }> {
  const settings = await getIpBlockSettings(db);
  const failureWindowMs = settings.attemptWindowMinutes * 60_000;
  const blockDurationMs = settings.blockDurationMinutes * 60_000;
  const attemptsCollection = db.collection("admin_login_attempts");
  const cutoff = new Date(now.getTime() - failureWindowMs);
  const expiresAt = new Date(now.getTime() + failureWindowMs + blockDurationMs);
  const newLockedUntil = new Date(now.getTime() + blockDurationMs);

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
              { $gte: ["$attempts", settings.maxFailedAttempts] },
              {
                $cond: [
                  { $gt: [{ $ifNull: ["$lockedUntil", new Date(0)] }, now] },
                  "$lockedUntil",
                  newLockedUntil,
                ],
              },
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

  if (createIpBlock && attempts >= settings.maxFailedAttempts && lockedUntil) {
    await db.collection("admin_ip_blocks").updateOne(
      { ipKey, expiresAt: lockedUntil },
      {
        $setOnInsert: {
          ipKey,
          ip: clientIp,
          country,
          attemptCount: attempts,
          blockedAt: now,
          expiresAt: lockedUntil,
          status: "blocked",
          reason: "failed_admin_login",
        },
      },
      { upsert: true }
    );
  }

  return { attempts, lockedUntil };
}

export async function sendAdminOtp(
  email: string,
  code: string,
  expiryMinutes = DEFAULT_EMAIL_LOGIN_SETTINGS.otpExpiryMinutes
): Promise<void> {
  const message = buildOtpEmail({ code, expiryMinutes });
  await sendAdminEmail(email, message.subject, message.text, message.html);
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

export function otpExpiry(now = new Date(), expiryMinutes = DEFAULT_EMAIL_LOGIN_SETTINGS.otpExpiryMinutes): Date {
  return new Date(now.getTime() + expiryMinutes * 60_000);
}

export function buildOtpEmail({ code, expiryMinutes, testMode = false }: { code: string; expiryMinutes: number; testMode?: boolean }) {
  if (!/^\d{6}$/.test(code)) throw new Error("OTP code must contain six digits.");
  const expiryLabel = `${expiryMinutes} minute${expiryMinutes === 1 ? "" : "s"}`;
  const subject = "Your HealthEdu admin verification code";
  const text = [
    ...(testMode ? ["This is a delivery test. The preview code below cannot be used to sign in.", ""] : []),
    "HealthEdu — Admin Verification",
    "",
    `Your verification code is: ${code}`,
    `This code expires in ${expiryLabel}.`,
    "",
    "Never share this code with anyone. HealthEdu will never ask you for it.",
    "If you did not request this code, you can safely ignore this email.",
    "",
    "— HealthEdu Security",
  ].join("\n");
  const testBanner = testMode
    ? '<tr><td style="padding:14px 28px 0;color:#92400e;font-size:13px;">Delivery test: the preview code below cannot be used to sign in.</td></tr>'
    : "";
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f6f8;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">Your HealthEdu admin verification code is ${code}. It expires in ${expiryLabel}.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f8;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Segoe UI,Arial,sans-serif;">
      <tr><td style="background:#0f766e;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;">HealthEdu</td></tr>
      ${testBanner}
      <tr><td style="padding:32px 28px 8px;color:#111827;"><h1 style="margin:0 0 10px;font-size:22px;">Verify your admin sign-in</h1><p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">Use the code below to finish signing in to the HealthEdu admin panel.</p></td></tr>
      <tr><td align="center" style="padding:20px 28px;"><div style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px 28px;font-size:34px;font-weight:700;letter-spacing:10px;color:#0f766e;font-family:Consolas,Menlo,monospace;">${code}</div></td></tr>
      <tr><td style="padding:0 28px 8px;text-align:center;font-size:14px;color:#374151;">This code expires in <strong>${expiryLabel}</strong>.</td></tr>
      <tr><td style="padding:20px 28px 28px;"><div style="background:#fff7ed;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.6;color:#92400e;"><strong>Keep this code private.</strong> HealthEdu will never ask you to share it. If you did not request this code, you can safely ignore this email.</div></td></tr>
      <tr><td style="background:#f9fafb;padding:16px 28px;text-align:center;font-size:12px;color:#9ca3af;">This is an automated message from HealthEdu Security. Please do not reply.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, html, text };
}