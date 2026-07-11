import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "@/app/api/admin/login/route";

export const runtime = "nodejs";

const VALID_OPTIONS = ["disable", "12h", "24h", "1w", "1m", "3m", "6m", "1y"];

async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;
    return await validateSession(token);
  } catch {
    return false;
  }
}

export function getThresholdDate(autoCleanVal: string): Date | null {
  const now = Date.now();
  switch (autoCleanVal) {
    case "12h":
      return new Date(now - 12 * 60 * 60 * 1000);
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "1w":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "1m":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "3m":
      return new Date(now - 90 * 24 * 60 * 60 * 1000);
    case "6m":
      return new Date(now - 180 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now - 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export async function runAutoClean(db: any, autoCleanVal: string) {
  const thresholdDate = getThresholdDate(autoCleanVal);
  if (thresholdDate) {
    const res = await db.collection("feedback_comments").deleteMany({
      createdAt: { $lt: thresholdDate }
    });
    return res.deletedCount;
  }
  return 0;
}

/**
 * GET /api/feedback/settings
 * Unauthenticated: allows public layout / api routes to query clean value
 */
export async function GET() {
  try {
    const db = await getDb();
    const settings = await db.collection("settings").findOne({ key: "comment_settings" });

    return NextResponse.json({
      settings: settings || { autoCleanVal: "disable" }
    });
  } catch (error) {
    console.error("GET /api/feedback/settings error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

/**
 * POST /api/feedback/settings
 * Authenticated: update comment auto-clean settings
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { autoCleanVal } = body;

    if (!VALID_OPTIONS.includes(autoCleanVal)) {
      return NextResponse.json({ error: "Invalid autoCleanVal option" }, { status: 400 });
    }

    const db = await getDb();

    // Update settings
    await db.collection("settings").updateOne(
      { key: "comment_settings" },
      {
        $set: {
          key: "comment_settings",
          autoCleanVal,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    // Immediately run clean up to reflect setting change on GUI and DB
    const deletedCount = await runAutoClean(db, autoCleanVal);

    return NextResponse.json({
      success: true,
      message: "Comment settings updated successfully.",
      deletedCount
    });
  } catch (error: any) {
    console.error("POST /api/feedback/settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
