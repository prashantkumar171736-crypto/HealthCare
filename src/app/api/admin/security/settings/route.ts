import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/admin-auth";
import {
  ensureAdminSecurityIndexes,
  getAdminSecuritySettings,
  getOtpConfiguration,
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
      maskedDestination: otp.maskedDestination,
      ipRateLimitConfigured: Boolean(process.env.IP_RATE_LIMIT_SECRET),
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Unable to load security settings." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });

  let body: { otpEnabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.otpEnabled !== "boolean") {
    return NextResponse.json({ error: "otpEnabled must be a boolean." }, { status: 400 });
  }
  if (body.otpEnabled && !getOtpConfiguration().configured) {
    return NextResponse.json({ error: "Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, ADMIN_OTP_EMAIL, and OTP_HMAC_SECRET before enabling email OTP." }, { status: 400 });
  }
  if (body.otpEnabled && !process.env.IP_RATE_LIMIT_SECRET) {
    return NextResponse.json({ error: "Configure IP_RATE_LIMIT_SECRET before enabling login security." }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureAdminSecurityIndexes(db);
    await db.collection("settings").updateOne(
      { key: "admin_security_settings" },
      { $set: { key: "admin_security_settings", otpEnabled: body.otpEnabled, updatedAt: new Date() } },
      { upsert: true }
    );
    if (!body.otpEnabled) {
      await db.collection("admin_otp_challenges").updateMany(
        { status: "pending" },
        { $set: { status: "invalidated", invalidatedAt: new Date() } }
      );
    }
    return NextResponse.json({ success: true, otpEnabled: body.otpEnabled });
  } catch {
    return NextResponse.json({ error: "Unable to save security settings." }, { status: 503 });
  }
}