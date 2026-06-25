import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { getSessionHash } from "../login/route";

export const runtime = "nodejs";

// Helper to authenticate requests
async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;
    if (!token) return false;

    const username = process.env.ADMIN_USERNAME || "admin";
    const expectedHash = getSessionHash(username);

    return token === expectedHash;
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/stats
 * Authenticates admin session and returns compiled visitor and reachability stats.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const analytics = db.collection("analytics");

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

    // 5. Daily Views (Past 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // include today
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyViewsRaw = await analytics.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      {
        $project: {
          dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
        }
      },
      { $group: { _id: "$dateStr", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    // Fill in missing days with 0 views
    const dailyViewsMap = new Map(dailyViewsRaw.map((item) => [item._id, item.count]));
    const dailyViews: { date: string; views: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      dailyViews.push({
        date: dateStr,
        views: dailyViewsMap.get(dateStr) || 0,
      });
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
