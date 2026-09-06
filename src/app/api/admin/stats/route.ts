import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "../login/route";

export const runtime = "nodejs";

// Helper to authenticate requests
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
 * GET /api/admin/stats
 * Authenticates admin session and returns compiled visitor and reachability stats.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const analytics = db.collection("analytics");

    // Parse period query param (default: monthly)
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "monthly";

    // 1. Core KPIs
    const totalViews = await analytics.countDocuments({});

    // Count unique sessions
    const uniqueSessionRes = await analytics.aggregate([
      { $group: { _id: "$sessionId" } },
      { $count: "count" }
    ]).toArray();
    const uniqueVisitors = uniqueSessionRes[0]?.count || 0;

    // 2. Top Visited Pages
    const topPages = await analytics.aggregate([
      { $group: { _id: "$path", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    // 3. Top Countries
    const topCountries = await analytics.aggregate([
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]).toArray();

    // 4. Top Regions / States
    const topRegions = await analytics.aggregate([
      { $group: { _id: { country: "$country", region: "$region" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]).toArray();

    // 5. Chart Views — flexible period
    const now = new Date();
    let dailyViews: { date: string; views: number }[] = [];

    if (period === "1d") {
      // Last 24 hours grouped by hour
      const startTime = new Date(now);
      startTime.setHours(startTime.getHours() - 23, 0, 0, 0);

      const rawHourly = await analytics.aggregate([
        { $match: { timestamp: { $gte: startTime } } },
        {
          $project: {
            hourStr: { $dateToString: { format: "%Y-%m-%dT%H", date: "$timestamp" } }
          }
        },
        { $group: { _id: "$hourStr", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const hourMap = new Map(rawHourly.map((h) => [h._id, h.count]));
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(d.getHours() - i, 0, 0, 0);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}`;
        const label = `${String(d.getHours()).padStart(2, "0")}:00`;
        dailyViews.push({ date: label, views: hourMap.get(key) || 0 });
      }

    } else if (period === "7d") {
      // Last 7 days grouped by day
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const raw = await analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        { $project: { dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } } },
        { $group: { _id: "$dateStr", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const map = new Map(raw.map((r) => [r._id, r.count]));
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        dailyViews.push({ date: dateStr.substring(5), views: map.get(dateStr) || 0 });
      }

    } else if (period === "monthly") {
      // Last 30 days grouped by day
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);

      const raw = await analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        { $project: { dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } } },
        { $group: { _id: "$dateStr", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const map = new Map(raw.map((r) => [r._id, r.count]));
      for (let i = 0; i < 30; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        dailyViews.push({ date: dateStr.substring(5), views: map.get(dateStr) || 0 });
      }

    } else if (period === "half-yearly") {
      // Last 26 weeks grouped by week (ISO week start = Monday)
      const start = new Date(now);
      start.setDate(start.getDate() - 181);
      start.setHours(0, 0, 0, 0);

      const raw = await analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        {
          $project: {
            weekStr: {
              $dateToString: {
                format: "%Y-W%V",
                date: "$timestamp"
              }
            },
            // truncate to week start for grouping
            weekStart: {
              $dateTrunc: { date: "$timestamp", unit: "week", startOfWeek: "monday" }
            }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$weekStart" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

      // Build 26 weekly buckets
      // Find monday of the week containing `start`
      const weekStart = new Date(start);
      const dayOfWeek = weekStart.getDay(); // 0 = Sun
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + diff);

      const map = new Map(raw.map((r) => [r._id, r.count]));
      for (let i = 0; i < 26; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i * 7);
        const dateStr = d.toISOString().split("T")[0];
        const label = dateStr.substring(5);
        dailyViews.push({ date: label, views: map.get(dateStr) || 0 });
      }

    } else if (period === "yearly") {
      // Last 12 months grouped by month
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const raw = await analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        { $project: { monthStr: { $dateToString: { format: "%Y-%m", date: "$timestamp" } } } },
        { $group: { _id: "$monthStr", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const map = new Map(raw.map((r) => [r._id, r.count]));
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        dailyViews.push({ date: monthStr, views: map.get(monthStr) || 0 });
      }

    } else {
      dailyViews = [];
    }

    // 6. Recent Visitors Logs (Past 50)
    const recentLogs = await analytics
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    // 7. System Reachability & Health
    let dbStatus = "Offline";
    let dbPingTime = 0;
    try {
      const startPing = Date.now();
      await db.command({ ping: 1 });
      dbStatus = "Connected";
      dbPingTime = Date.now() - startPing;
    } catch {
      // Offline
    }

    const memory = process.memoryUsage();
    const systemHealth = {
      dbStatus,
      dbPingTime,
      serverUptime: process.uptime(),
      memoryUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
      memoryTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
      nodeVersion: process.version,
      platform: process.platform,
    };

    return NextResponse.json({
      summary: {
        totalViews,
        uniqueVisitors,
      },
      charts: {
        dailyViews,
        topPages: topPages.map((p) => ({ path: p._id, count: p.count })),
        topCountries: topCountries.map((c) => ({ name: c._id, count: c.count })),
        topRegions: topRegions.map((r) => ({
          country: r._id.country,
          region: r._id.region,
          count: r.count,
        })),
      },
      logs: recentLogs.map((log) => ({
        id: log._id.toString(),
        path: log.path,
        referrer: log.referrer,
        ip: log.ip,
        userAgent: log.userAgent,
        country: log.country,
        region: log.region,
        city: log.city,
        timestamp: log.timestamp,
      })),
      systemHealth,
    });
  } catch (err: any) {
    console.error("Failed to compile admin stats:", err);
    return NextResponse.json({ error: `Failed to gather statistics: ${err.message || err}` }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/stats
 * Clears all tracking records in the analytics collection.
 */
export async function DELETE() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    await db.collection("analytics").deleteMany({});
    return NextResponse.json({ success: true, message: "Analytics database cleared successfully." });
  } catch (err) {
    console.error("Failed to clear analytics:", err);
    return NextResponse.json({ error: "Failed to clear database" }, { status: 500 });
  }
}
