import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/admin-auth";
import { logServer } from "@/lib/server-logger";
import {
  ensureAdminSecurityIndexes,
  clearEmailLoginSettingsCache,
  getAdminEmailErrorMessage,
  getEmailLoginSettings,
  getAdminSecuritySettings,
  getOtpConfiguration,
  sendAdminEmailTest,
} from "@/lib/admin-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return validateSession(cookieStore.get("admin_session")?.value);
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
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const settings = await getAdminSecuritySettings(db);
    const otp = getOtpConfiguration();
    return NextResponse.json({
      ...settings,
      emailOtpConfigured: otp.configured,
      emailProvider: otp.provider,
      maskedDestination: otp.maskedDestination,
      ipRateLimitConfigured: Boolean(process.env.IP_RATE_LIMIT_SECRET),
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    void logServer({ level: "error", message: "Admin security settings fetch failed", source: "admin.security.settings", path: "/api/admin/security/settings", method: "GET", statusCode: 503, error });
    return NextResponse.json({ error: "Unable to load security settings." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });

  let body: { otpEnabled?: unknown; testEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.testEmail === true) {
    if (!getOtpConfiguration().configured) {
      return NextResponse.json({ error: "Configure all email OTP environment variables before testing email delivery." }, { status: 400 });
    }
    try {
      const db = await getDb();
      const settings = await getEmailLoginSettings(db);
      await sendAdminEmailTest(settings.otpExpiryMinutes);
      return NextResponse.json({ success: true, message: "Test email accepted by the configured email provider. Check the admin inbox and spam folder." });
    } catch (error) {
      const emailError = error as { code?: string; responseCode?: number };
      console.error("Admin email test failed:", { code: emailError?.code, responseCode: emailError?.responseCode });
      void logServer({ level: "error", message: "Admin email delivery test failed", source: "admin.security.settings.email-test", path: "/api/admin/security/settings", method: "POST", statusCode: 502, error });
      return NextResponse.json({ error: `Test email failed. ${getAdminEmailErrorMessage(error)}` }, { status: 502 });
    }
  }

  if (typeof body.otpEnabled !== "boolean") {
    return NextResponse.json({ error: "otpEnabled must be a boolean." }, { status: 400 });
  }
  if (body.otpEnabled && !getOtpConfiguration().configured) {
    return NextResponse.json({ error: "Configure RESEND_API_KEY and RESEND_FROM, along with ADMIN_OTP_EMAIL and OTP_HMAC_SECRET before enabling email OTP." }, { status: 400 });
  }
  if (body.otpEnabled && !process.env.IP_RATE_LIMIT_SECRET) {
    return NextResponse.json({ error: "Configure IP_RATE_LIMIT_SECRET before enabling login security." }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureAdminSecurityIndexes(db);
    const currentEmailSettings = await getEmailLoginSettings(db);
    const sessionToken = (await cookies()).get("admin_session")?.value;
    const tokenHash = sessionToken ? crypto.createHash("sha256").update(sessionToken).digest("hex") : "";
    const adminSession = tokenHash
      ? await db.collection("admin_sessions").findOne({ tokenHash }, { projection: { username: 1 } })
      : null;
    const now = new Date();
    await db.collection("settings").updateOne(
      { key: "emailLogin" },
      { $set: {
        key: "emailLogin",
        ...currentEmailSettings,
        requireOtp: body.otpEnabled,
        updatedAt: now,
        updatedBy: adminSession?.username || "unknown",
      } },
      { upsert: true }
    );
    await db.collection("settings").updateOne(
      { key: "admin_security_settings" },
      { $set: { key: "admin_security_settings", otpEnabled: body.otpEnabled, updatedAt: now } },
      { upsert: true }
    );
    clearEmailLoginSettingsCache();
    if (!body.otpEnabled) {
      await db.collection("admin_otp_challenges").updateMany(
        { status: "pending" },
        { $set: { status: "invalidated", invalidatedAt: new Date() } }
      );
    }
    return NextResponse.json({ success: true, otpEnabled: body.otpEnabled });
  } catch (error) {
    void logServer({ level: "error", message: "Admin security settings update failed", source: "admin.security.settings", path: "/api/admin/security/settings", method: "POST", statusCode: 503, error });
    return NextResponse.json({ error: "Unable to save security settings." }, { status: 503 });
  }
}