import "@/lib/env";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { logServer } from "@/lib/server-logger";
import os from "os";

export const runtime = "nodejs";

async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;
    return await validateSession(token);
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/debug
 * Returns diagnostic info to help identify why the stats route fails.
 * Only accessible by authenticated admins.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {
    nodeVersion: process.version,
    platform: process.platform,
    env: {
      MONGODB_URI: process.env.MONGODB_URI ? "SET (hidden)" : "NOT SET",
      R2_UPLOADS_ACCOUNT_ID: process.env.R2_UPLOADS_ACCOUNT_ID || process.env.R2_ACCOUNT_ID ? "SET" : "NOT SET",
      R2_UPLOADS_ACCESS_KEY_ID: process.env.R2_UPLOADS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID ? "SET (hidden)" : "NOT SET",
      R2_UPLOADS_SECRET_ACCESS_KEY: process.env.R2_UPLOADS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY ? "SET (hidden)" : "NOT SET",
      VERCEL: process.env.VERCEL || "NOT SET",
    },
    osCheck: null as any,
    dbCheck: null as any,
  };

  // Test os module
  try {
    results.osCheck = {
      cpus: os.cpus().length,
      totalMem: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100,
      freeMem: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100,
      loadAvg: os.loadavg(),
      platform: os.platform(),
      status: "OK",
    };
  } catch (e: any) {
    void logServer({ level: "error", message: "Admin debug OS check failed", source: "admin.debug.os-check", path: "/api/admin/debug", method: "GET", error: e });
    results.osCheck = { status: "FAILED", error: e?.message };
  }

  // Test DB connection
  try {
    const db = await Promise.race([
      getDb(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB connection timeout after 8s")), 8000)
      ),
    ]);
    if (!db) {
      results.dbCheck = { status: "NULL" };
    } else {
      const ping = await db.command({ ping: 1 });
      const collections = await db.listCollections().toArray();
      results.dbCheck = {
        status: "OK",
        ping,
        collections: collections.map((c) => c.name),
      };
    }
  } catch (e: any) {
    void logServer({ level: "error", message: "Admin debug database check failed", source: "admin.debug.database-check", path: "/api/admin/debug", method: "GET", statusCode: 503, error: e });
    results.dbCheck = { status: "FAILED", error: e?.message };
  }

  return NextResponse.json(results);
}
