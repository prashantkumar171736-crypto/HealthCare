import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/admin-auth";
import {
  clearEmailLoginSettingsCache,
  ensureAdminSecurityIndexes,
  getEmailLoginSettings,
  getOtpConfiguration,
} from "@/lib/admin-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminContext() {
  const token = (await cookies()).get("admin_session")?.value;
  if (!(await validateSession(token))) return null;
  const db = await getDb();
  const tokenHash = token ? crypto.createHash("sha256").update(token).digest("hex") : "";
  const session = tokenHash ? await db.collection("admin_sessions").findOne({ tokenHash }, { projection: { username: 1 } }) : null;
  return { db, username: session?.username || "unknown" };
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
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const settings = await getEmailLoginSettings(context.db);
    const otp = getOtpConfiguration();
    return NextResponse.json({
      ...settings,
      emailOtpConfigured: otp.configured,
      emailProvider: otp.provider,
      maskedDestination: otp.maskedDestination,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Unable to load email login settings." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.requireOtp !== "boolean") {
    return NextResponse.json({ error: "requireOtp must be a boolean." }, { status: 400 });
  }
  const ranges = {
    otpExpiryMinutes: [1, 10],
    maxOtpAttempts: [3, 10],
    resendCooldownSeconds: [30, 300],
  } as const;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const value = body[key];
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
      return NextResponse.json({ error: `${key} must be an integer between ${min} and ${max}.` }, { status: 400 });
    }
  }
  if (body.requireOtp && !getOtpConfiguration().configured) {
    return NextResponse.json({ error: "Configure the email provider, admin destination, and OTP secret before enabling email OTP." }, { status: 400 });
  }
  if (body.requireOtp && !process.env.IP_RATE_LIMIT_SECRET) {
    return NextResponse.json({ error: "Configure IP_RATE_LIMIT_SECRET before enabling login security." }, { status: 400 });
  }

  try {
    await ensureAdminSecurityIndexes(context.db);
    const settings = {
      key: "emailLogin",
      requireOtp: body.requireOtp,
      otpExpiryMinutes: body.otpExpiryMinutes as number,
      maxOtpAttempts: body.maxOtpAttempts as number,
      resendCooldownSeconds: body.resendCooldownSeconds as number,
      updatedAt: new Date(),
      updatedBy: context.username,
    };
    await context.db.collection("settings").updateOne({ key: settings.key }, { $set: settings }, { upsert: true });
    if (!settings.requireOtp) {
      await context.db.collection("admin_otp_challenges").updateMany(
        { status: "pending" },
        { $set: { status: "invalidated", invalidatedAt: new Date() } }
      );
    }
    clearEmailLoginSettingsCache();
    return NextResponse.json({ success: true, ...settings });
  } catch {
    return NextResponse.json({ error: "Unable to save email login settings." }, { status: 503 });
  }
}