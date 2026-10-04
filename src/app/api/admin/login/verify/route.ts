import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { logServer } from "@/lib/server-logger";
import { createAdminSession, SESSION_TTL_SECONDS } from "@/lib/admin-auth";
import {
  ensureAdminSecurityIndexes,
  getEmailLoginSettings,
  hashChallengeId,
  hashOtp,
} from "@/lib/admin-security";

export const runtime = "nodejs";

function rejectOtp(reason: string) {
  void logServer({
    level: "warn",
    message: "Admin OTP verification rejected",
    source: "admin.login.verify",
    path: "/api/admin/login/verify",
    method: "POST",
    statusCode: 400,
    meta: { reason },
  });
  return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 400 });
}

export async function POST(request: Request) {
  let body: { challengeId?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^[a-f0-9]{64}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
    return rejectOtp("invalid_format");
  }

  try {
    const db = await getDb();
    await ensureAdminSecurityIndexes(db);
    const emailSettings = await getEmailLoginSettings(db);
    if (!emailSettings.requireOtp) {
      return NextResponse.json({ error: "Email verification is currently disabled." }, { status: 400 });
    }
    const challenges = db.collection("admin_otp_challenges");
    const challengeHash = hashChallengeId(challengeId);
    const now = new Date();
    const challenge = await challenges.findOne({
      challengeHash,
      status: "pending",
      expiresAt: { $gt: now },
    });

    if (!challenge || typeof challenge.username !== "string") {
      return rejectOtp("missing_or_expired_challenge");
    }
    const maxOtpAttempts = Number.isInteger(challenge.maxOtpAttempts) && challenge.maxOtpAttempts >= 3 && challenge.maxOtpAttempts <= 10
      ? challenge.maxOtpAttempts
      : emailSettings.maxOtpAttempts;
    if (challenge.attemptCount >= maxOtpAttempts) {
      await challenges.updateOne({ _id: challenge._id, status: "pending" }, { $set: { status: "invalidated", invalidatedAt: now } });
      return rejectOtp("attempt_limit_reached");
    }

    const expected = Buffer.from(challenge.otpHash, "hex");
    const actual = Buffer.from(hashOtp(challengeId, code), "hex");
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!matches) {
      const update = await challenges.updateOne(
        {
          _id: challenge._id,
          status: "pending",
          expiresAt: { $gt: now },
          attemptCount: { $lt: maxOtpAttempts },
        },
        { $inc: { attemptCount: 1 } }
      );
      if (update.modifiedCount && challenge.attemptCount + 1 >= maxOtpAttempts) {
        await challenges.updateOne(
          { _id: challenge._id, status: "pending" },
          { $set: { status: "invalidated", invalidatedAt: new Date() } }
        );
      }
      return rejectOtp("incorrect_code");
    }

    const consumed = await challenges.updateOne(
      {
        _id: challenge._id,
        status: "pending",
        expiresAt: { $gt: now },
        attemptCount: { $lt: maxOtpAttempts },
      },
      { $set: { status: "consumed", consumedAt: now } }
    );
    if (!consumed.modifiedCount) {
      return rejectOtp("challenge_already_consumed");
    }

    const sessionToken = await createAdminSession(challenge.username);
    const cookieStore = await cookies();
    cookieStore.set("admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin OTP verification failed:", error);
    void logServer({
      level: "error",
      message: "Admin OTP verification service failed",
      source: "admin.login.verify",
      path: "/api/admin/login/verify",
      method: "POST",
      statusCode: 503,
      error,
    });
    return NextResponse.json({ error: "Verification service is temporarily unavailable." }, { status: 503 });
  }
}