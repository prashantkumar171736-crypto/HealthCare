import "@/lib/env";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export function getSessionHash(username: string) {
  const secret = process.env.JWT_SECRET || "healthcare-default-secret-2026";
  return crypto
    .createHmac("sha256", secret)
    .update(`${username}:${secret}`)
    .digest("hex");
}

/**
 * POST /api/admin/login
 * Validates admin credentials using MongoDB and sets an HTTP-only session cookie.
 */
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const db = await getDb();
    const admin = await db.collection("admins").findOne({ username });

    let isValid = false;

    if (admin) {
      if (admin.passwordHash && admin.salt) {
        const hash = crypto
          .pbkdf2Sync(password, admin.salt, 10000, 64, "sha512")
          .toString("hex");
        if (hash === admin.passwordHash) {
          isValid = true;
        }
      }
    } else {
      // Graceful fallback: If no admins are created in the database yet,
      // allow login with .env.local values to prevent lockout.
      const adminCount = await db.collection("admins").countDocuments();
      if (adminCount === 0) {
        const expectedUsername = process.env.ADMIN_USERNAME || "admin";
        const expectedPassword = process.env.ADMIN_PASSWORD || "admin";
        if (username === expectedUsername && password === expectedPassword) {
          isValid = true;
        }
      }
    }

    if (isValid) {
      const hash = getSessionHash(username);
      const cookieStore = await cookies();

      cookieStore.set("admin_session", hash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24, // 24 hours
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  } catch (err) {
    console.error("Admin login API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

