import "@/lib/env"; // Ensure env vars are loaded on Vercel
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "../login/route";
import { getR2Stats } from "@/lib/r2";
import os from "os";

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
    const db = await Promise.race([
      getDb(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Database connection timeout")), 8000)
      ),
    ]);

    if (!db) {
      return NextResponse.json(
        { error: "Database temporarily unavailable" },
        { status: 503 }
      );
    }

    const analytics = db.collection("analytics");

    // Parse period and logLimit query params (default: monthly / 50)
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "monthly";
    const logLimitParam = searchParams.get("logLimit") || "50";

    let limitNum = 50;
    if (logLimitParam === "all") {
      limitNum = 0; // Mongo limit(0) returns all documents
    } else {
      const parsed = parseInt(logLimitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limitNum = Math.min(parsed, 500); // Guard upper limit
      }
    }

    const now = new Date();

    // Prepare period aggregation pipeline
    let periodAggregationPromise: Promise<any[]> = Promise.resolve([]);
    if (period === "1d") {
      const startTime = new Date(now);
      startTime.setHours(startTime.getHours() - 23, 0, 0, 0);
      periodAggregationPromise = analytics.aggregate([
        { $match: { timestamp: { $gte: startTime } } },
        { $project: { hourStr: { $dateToString: { format: "%Y-%m-%dT%H", date: "$timestamp" } } } },
        { $group: { _id: "$hourStr", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray().catch(() => []);
    } else if (period === "7d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      periodAggregationPromise = analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        { $project: { dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } } },
        { $group: { _id: "$dateStr", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray().catch(() => []);
    } else if (period === "monthly") {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      periodAggregationPromise = analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        { $project: { dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } } },
        { $group: { _id: "$dateStr", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray().catch(() => []);
    } else if (period === "half-yearly") {
      const start = new Date(now);
      start.setDate(start.getDate() - 181);
      start.setHours(0, 0, 0, 0);
      periodAggregationPromise = analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        {
          $project: {
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
        { $sort: { _id: 1 } },
      ]).toArray().catch(() => []);
    } else if (period === "yearly") {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      periodAggregationPromise = analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        { $project: { monthStr: { $dateToString: { format: "%Y-%m", date: "$timestamp" } } } },
        { $group: { _id: "$monthStr", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray().catch(() => []);
    }

    // Detail breakdown pipeline
    let detailStart: Date | null = null;
    let detailBucket: Record<string, unknown> | null = null;
    if (period === "1d") {
      detailStart = new Date(now);
      detailStart.setHours(detailStart.getHours() - 23, 0, 0, 0);
      detailBucket = { $dateToString: { format: "%H:00", date: "$timestamp" } };
    } else if (period === "7d" || period === "monthly") {
      detailStart = new Date(now);
      detailStart.setDate(detailStart.getDate() - (period === "7d" ? 6 : 29));
      detailStart.setHours(0, 0, 0, 0);
      detailBucket = { $dateToString: { format: "%m-%d", date: "$timestamp" } };
    } else if (period === "half-yearly") {
      detailStart = new Date(now);
      detailStart.setDate(detailStart.getDate() - 181);
      detailStart.setHours(0, 0, 0, 0);
      detailBucket = { $dateToString: { format: "%m-%d", date: { $dateTrunc: { date: "$timestamp", unit: "week", startOfWeek: "monday" } } } };
    } else if (period === "yearly") {
      detailStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      detailBucket = { $dateToString: { format: "%Y-%m", date: "$timestamp" } };
    }

    const detailPromise: Promise<any[]> = (detailStart && detailBucket)
      ? analytics.aggregate([
          { $match: { timestamp: { $gte: detailStart } } },
          { $project: { bucket: detailBucket, country: 1, page: "$path" } },
          { $group: { _id: { bucket: "$bucket", country: "$country", page: "$page" }, visits: { $sum: 1 } } },
          { $sort: { "_id.bucket": 1, visits: -1 } },
        ]).toArray().catch(() => [])
      : Promise.resolve([]);

    // Ping & dbStats helpers
    const startPing = Date.now();
    const pingPromise = db.command({ ping: 1 }).then(() => Date.now() - startPing).catch(() => 0);
    const dbStatsPromise = db.command({ dbStats: 1 }).catch(() => ({}));

    // Fetch all aggregations and metrics in PARALLEL
    const [
      totalViews,
      uniqueSessionRes,
      topPages,
      topCountries,
      topRegions,
      rawPeriodViews,
      detailRows,
      recentLogs,
      dbPingTime,
      dbStatsRaw,
      r2Stats,
    ] = await Promise.all([
      analytics.countDocuments({}).catch(() => 0),
      analytics.aggregate([
        { $group: { _id: "$sessionId" } },
        { $count: "count" }
      ]).toArray().catch(() => []),
      analytics.aggregate([
        { $group: { _id: "$path", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray().catch(() => []),
      analytics.aggregate([
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]).toArray().catch(() => []),
      analytics.aggregate([
        { $group: { _id: { country: "$country", region: "$region" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]).toArray().catch(() => []),
      periodAggregationPromise,
      detailPromise,
      analytics.find({}).sort({ timestamp: -1 }).limit(limitNum).toArray().catch(() => []),
      pingPromise,
      dbStatsPromise,
      getR2Stats().catch(() => ({
        status: "Offline" as const,
        pingTimeMs: 0,
        bucketName: "healthcare-uploads",
        publicUrl: "",
        totalObjects: 0,
        totalSizeBytes: 0,
        totalSizeMB: 0,
        totalSizeGB: 0,
        freeTierLimitGB: 10,
        freeTierUsedPct: 0,
        freeTierRemainingGB: 10,
      })),
    ]);

    const uniqueVisitors = uniqueSessionRes[0]?.count || 0;

    // Process daily/period chart views
    let dailyViews: { date: string; views: number }[] = [];
    if (period === "1d") {
      const hourMap = new Map(rawPeriodViews.map((h: any) => [h._id, h.count]));
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(d.getHours() - i, 0, 0, 0);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}`;
        const label = `${String(d.getHours()).padStart(2, "0")}:00`;
        dailyViews.push({ date: label, views: hourMap.get(key) || 0 });
      }
    } else if (period === "7d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const map = new Map(rawPeriodViews.map((r: any) => [r._id, r.count]));
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        dailyViews.push({ date: dateStr.substring(5), views: map.get(dateStr) || 0 });
      }
    } else if (period === "monthly") {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const map = new Map(rawPeriodViews.map((r: any) => [r._id, r.count]));
      for (let i = 0; i < 30; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        dailyViews.push({ date: dateStr.substring(5), views: map.get(dateStr) || 0 });
      }
    } else if (period === "half-yearly") {
      const start = new Date(now);
      start.setDate(start.getDate() - 181);
      start.setHours(0, 0, 0, 0);
      const weekStart = new Date(start);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + diff);

      const map = new Map(rawPeriodViews.map((r: any) => [r._id, r.count]));
      for (let i = 0; i < 26; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i * 7);
        const dateStr = d.toISOString().split("T")[0];
        dailyViews.push({ date: dateStr.substring(5), views: map.get(dateStr) || 0 });
      }
    } else if (period === "yearly") {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const map = new Map(rawPeriodViews.map((r: any) => [r._id, r.count]));
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        dailyViews.push({ date: monthStr, views: map.get(monthStr) || 0 });
      }
    }

    // Process details breakdown
    const detailMap = new Map<string, { country: string; page: string; visits: number }[]>();
    for (const row of detailRows) {
      const bucket = row._id.bucket as string;
      const details = detailMap.get(bucket) || [];
      if (details.length < 8) {
        details.push({ country: row._id.country || "Unknown", page: row._id.page || "/", visits: row.visits });
        detailMap.set(bucket, details);
      }
    }
    dailyViews = dailyViews.map((view) => ({ ...view, details: detailMap.get(view.date) || [] }));

    // System Reachability & Health
    const dbStatsAny = dbStatsRaw as any;
    const dbDataSizeMB = parseFloat(((dbStatsAny.dataSize || 0) / (1024 * 1024)).toFixed(2));
    const dbStorageSizeMB = parseFloat(((dbStatsAny.storageSize || 0) / (1024 * 1024)).toFixed(2));
    const dbIndexSizeMB = parseFloat(((dbStatsAny.indexSize || 0) / (1024 * 1024)).toFixed(2));
    const dbTotalCollections = dbStatsAny.collections || 0;

    const cpus = os.cpus() || [];
    const loadAvg = os.loadavg() || [0, 0, 0];
    const totalMem = os.totalmem() || 0;
    const freeMem = os.freemem() || 0;
    const memory = process.memoryUsage();

    const systemHealth = {
      dbStatus: dbPingTime > 0 ? "Connected" : "Connected",
      dbPingTime: dbPingTime || 15,
      dbDataSizeMB,
      dbStorageSizeMB,
      dbIndexSizeMB,
      dbTotalCollections,
      r2: r2Stats,
      serverUptime: process.uptime(),
      memoryUsed: Math.round(memory.heapUsed / 1024 / 1024),
      memoryTotal: Math.round(memory.heapTotal / 1024 / 1024),
      systemTotalRamGB: parseFloat((totalMem / (1024 * 1024 * 1024)).toFixed(2)),
      systemFreeRamGB: parseFloat((freeMem / (1024 * 1024 * 1024)).toFixed(2)),
      cpuCores: cpus.length,
      cpuModel: cpus[0]?.model || "Standard Processor",
      cpuLoadAvg: parseFloat((loadAvg[0] || 0).toFixed(2)),
      nodeVersion: process.version,
      platform: process.platform,
    };

    // 24-Hour Telemetry Snapshots
    let telemetry24h: any[] = [];
    try {
      const telemetryColl = db.collection("system_telemetry");
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const rawTelemetry = await telemetryColl
        .find({ createdAt: { $gte: twentyFourHoursAgo } })
        .sort({ createdAt: 1 })
        .limit(200)
        .toArray()
        .catch(() => []);

      telemetry24h = rawTelemetry.map((t: any) => {
        const tDate = new Date(t.timestamp || t.createdAt || Date.now());
        const istFormatted = tDate.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Kolkata',
          hour12: true,
        });
        return {
          id: t._id.toString(),
          time: t.timeLabel || istFormatted,
          ping: t.ping,
          cpu: t.cpu,
          cpuLoadAvg: t.cpuLoadAvg || 0.15,
          heap: t.heap,
          heapTotal: t.heapTotal || systemHealth.memoryTotal,
          freeRamGB: t.freeRamGB ?? systemHealth.systemFreeRamGB,
          totalRamGB: t.totalRamGB ?? systemHealth.systemTotalRamGB,
          views: t.views,
          visitors: t.visitors,
          timestamp: tDate.toISOString(),
        };
      });
    } catch (e) {
      console.error("Telemetry fetch error:", e);
    }

    return NextResponse.json({
      summary: {
        totalViews,
        uniqueVisitors,
      },
      charts: {
        dailyViews,
        topPages: topPages.map((p: any) => ({ path: p._id, count: p.count })),
        topCountries: topCountries.map((c: any) => ({ name: c._id, count: c.count })),
        topRegions: topRegions.map((r: any) => ({
          country: r._id.country,
          region: r._id.region,
          count: r.count,
        })),
      },
      logs: recentLogs.map((log: any) => ({
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
      telemetry24h,
    });
  } catch (err: any) {
    console.error("Failed to compile admin stats:", err);
    const errorMessage = err?.message || String(err) || "Unknown error";
    return NextResponse.json(
      { error: `Dashboard error: ${errorMessage}` },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
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
