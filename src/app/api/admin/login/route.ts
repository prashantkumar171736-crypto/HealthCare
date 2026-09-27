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

export async function validateSession(sessionToken: string | undefined): Promise<boolean> {
  if (!sessionToken) return false;

  // 1. Fast memory check for configured and primary admin hashes
  const knownAdmins = [
    process.env.ADMIN_USERNAME || "admin",
    "admin",
    "kumar.pk6342@gmail.com",
  ];

  for (const u of knownAdmins) {
    if (sessionToken === getSessionHash(u)) {
      return true;
    }
  }

  // 2. Fallback check MongoDB for dynamically added admin accounts
  try {
    const db = await Promise.race([
      getDb(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB timeout")), 3000)
      ),
    ]);

    if (db) {
      const admins = await db.collection("admins").find({}, { projection: { username: 1 } }).toArray();
      for (const admin of admins) {
        if (admin.username && sessionToken === getSessionHash(admin.username)) {
          return true;
        }
      }
    }
  } catch {
    // If DB is unreachable, memory check was already performed
  }

  return false;
}

/**
 * POST /api/admin/login
 * Validates admin credentials using direct credentials or MongoDB and sets an HTTP-only session cookie.
 */
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    let isValid = false;

    // 1. Direct authentication for primary admin accounts (Zero latency, impervious to Atlas connection lag)
    const adminPassword = process.env.ADMIN_PASSWORD || "admin";
    const allowedAccounts: Record<string, string> = {
      admin: adminPassword,
      "kumar.pk6342@gmail.com": adminPassword,
    };

    if (process.env.ADMIN_USERNAME) {
      allowedAccounts[process.env.ADMIN_USERNAME] = adminPassword;
    }

    if (allowedAccounts[username] && allowedAccounts[username] === password) {
      isValid = true;
    }

    // 2. Check MongoDB for custom admin users with pbkdf2 hash
    if (!isValid) {
      try {
        const db = await Promise.race([
          getDb(),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("DB timeout")), 3500)
          ),
        ]);

        if (db) {
          const admin = await db.collection("admins").findOne({ username });
          if (admin && admin.passwordHash && admin.salt) {
            const hash = crypto
              .pbkdf2Sync(password, admin.salt, 10000, 64, "sha512")
              .toString("hex");
            if (hash === admin.passwordHash) {
              isValid = true;
            }
          }
        }
      } catch (dbErr) {
        console.warn("DB check bypassed due to timeout or connection issue:", dbErr);
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

      return NextResponse.json({ success: true, username });
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
