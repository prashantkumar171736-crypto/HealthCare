import "@/lib/env"; // Ensure env vars are loaded on Vercel
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/admin-auth";
import { normalizeCountryName, normalizeRegionName } from "@/lib/geo";
import type { Document } from "mongodb";
import os from "os";

export const runtime = "nodejs";
// Note: maxDuration is ignored on Vercel Hobby (10s hard limit).
// All queries MUST complete in < 9s total.

interface ChartBucketDetail {
  country: string;
  region: string;
  page: string;
  visits: number;
}

interface ChartPeriodBucket extends Document {
  _id: string;
  count: number;
  details: ChartBucketDetail[];
}

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
 * Returns dashboard stats. Optimized to complete in < 9s on Vercel Hobby.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hard 8-second timeout — ensures we always return JSON before Vercel's 10s limit
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<NextResponse>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve(
        NextResponse.json(
          { error: "Dashboard stats timed out. Please retry." },
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      );
    }, 8500);
  });

  const statsPromise = (async (): Promise<NextResponse> => {
    try {
      const db = await Promise.race([
        getDb(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("DB connection timeout")), 5000)
        ),
      ]);

      const analytics = db.collection("analytics");

      const { searchParams } = new URL(request.url);
      const period = searchParams.get("period") || "monthly";
      const logLimitParam = searchParams.get("logLimit") || "50";
      const limitNum = Math.min(
        logLimitParam === "all" ? 50 : (parseInt(logLimitParam, 10) || 50),
        50 // Hard cap at 50 on Vercel
      );

      const now = new Date();

      // ── Period chart aggregation ─────────────────────────────────────────
      let periodAggregationPromise: Promise<ChartPeriodBucket[]> = Promise.resolve([]);
      const aggregateChartPeriod = (startTime: Date, bucketExpression: Document) => analytics.aggregate<ChartPeriodBucket>([
        { $match: { timestamp: { $gte: startTime } } },
        {
          $project: {
            bucket: bucketExpression,
            country: { $ifNull: ["$country", "Unknown"] },
            region: { $ifNull: ["$region", "Unknown"] },
            page: { $ifNull: ["$path", "/"] },
          },
        },
        {
          $group: {
            _id: { bucket: "$bucket", country: "$country", region: "$region", page: "$page" },
            visits: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.bucket",
            count: { $sum: "$visits" },
            details: {
              $push: {
                country: "$_id.country",
                region: "$_id.region",
                page: "$_id.page",
                visits: "$visits",
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray().catch(() => []);

      if (period === "1d") {
        const startTime = new Date(now);
        startTime.setHours(startTime.getHours() - 23, 0, 0, 0);
        periodAggregationPromise = aggregateChartPeriod(startTime, {
          $dateToString: { format: "%Y-%m-%dT%H", date: "$timestamp" },
        });
      } else if (period === "7d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        periodAggregationPromise = aggregateChartPeriod(start, {
          $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
        });
      } else if (period === "monthly") {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        periodAggregationPromise = aggregateChartPeriod(start, {
          $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
        });
      } else if (period === "half-yearly") {
        const start = new Date(now);
        start.setDate(start.getDate() - 181);
        start.setHours(0, 0, 0, 0);
        periodAggregationPromise = aggregateChartPeriod(start, {
          $dateToString: {
            format: "%Y-%m-%d",
            date: { $dateTrunc: { date: "$timestamp", unit: "week", startOfWeek: "monday" } },
          },
        });
      } else if (period === "yearly") {
        const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        periodAggregationPromise = aggregateChartPeriod(start, {
          $dateToString: { format: "%Y-%m", date: "$timestamp" },
        });
      }

      // ── Scoped date window for fast queries (last 90 days only) ──────────
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // ── Parallel queries — all date-scoped to prevent full collection scans ──
      const startPing = Date.now();
      const [
        totalViews,
        uniqueSessionRes,
        topPages,
        topCountries,
        topRegions,
        rawPeriodViews,
        recentLogs,
        dbPingTime,
        mongoDbStats,
      ] = await Promise.all([
        // Fast: estimated count (no full scan)
        analytics.estimatedDocumentCount().catch(() => 0),

        // Fast: unique sessions in last 90 days only (not all-time)
        analytics.aggregate([
          { $match: { timestamp: { $gte: ninetyDaysAgo } } },
          { $group: { _id: "$sessionId" } },
          { $count: "count" },
        ]).toArray().catch(() => []),

        // Fast: top pages in last 90 days
        analytics.aggregate([
          { $match: { timestamp: { $gte: ninetyDaysAgo } } },
          { $group: { _id: "$path", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]).toArray().catch(() => []),

        // Fast: top countries in last 90 days
        analytics.aggregate([
          { $match: { timestamp: { $gte: ninetyDaysAgo } } },
          { $group: { _id: "$country", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ]).toArray().catch(() => []),

        // Fast: top regions in last 90 days
        analytics.aggregate([
          { $match: { timestamp: { $gte: ninetyDaysAgo } } },
          { $group: { _id: { country: "$country", region: "$region" }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ]).toArray().catch(() => []),

        // Period aggregation (already date-filtered above)
        periodAggregationPromise,

        // Recent logs — capped at 50
        analytics.find({}).sort({ timestamp: -1 }).limit(limitNum).toArray().catch(() => []),

        // DB ping
        db.command({ ping: 1 }).then(() => Date.now() - startPing).catch(() => 0),

        // Database size metrics are returned in bytes; keep the full command independent
        // from analytics queries so a stats failure does not break dashboard loading.
        db.command({ dbStats: 1 }).catch((error) => {
          console.error("MongoDB dbStats failed:", error);
          return null;
        }),
      ]);

      const uniqueVisitors = (uniqueSessionRes as any[])[0]?.count || 0;

      // ── Build daily views chart ───────────────────────────────────────────
      const dailyViews: Array<{ date: string; views: number; details: ChartBucketDetail[] }> = [];
      const detailsByBucket = new Map<string, ChartBucketDetail[]>(
        rawPeriodViews.map((row): [string, ChartBucketDetail[]] => [row._id, row.details || []])
      );
      if (period === "1d") {
        const hourMap = new Map<string, number>(rawPeriodViews.map((row): [string, number] => [row._id, row.count]));
        for (let i = 23; i >= 0; i--) {
          const d = new Date(now);
          d.setHours(d.getHours() - i, 0, 0, 0);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}`;
          dailyViews.push({ date: `${String(d.getHours()).padStart(2, "0")}:00`, views: hourMap.get(key) || 0, details: detailsByBucket.get(key) || [] });
        }
      } else if (period === "7d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        const map = new Map<string, number>(rawPeriodViews.map((row): [string, number] => [row._id, row.count]));
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split("T")[0];
          dailyViews.push({ date: dateStr.substring(5), views: map.get(dateStr) || 0, details: detailsByBucket.get(dateStr) || [] });
        }
      } else if (period === "monthly") {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        const map = new Map<string, number>(rawPeriodViews.map((row): [string, number] => [row._id, row.count]));
        for (let i = 0; i < 30; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split("T")[0];
          dailyViews.push({ date: dateStr.substring(5), views: map.get(dateStr) || 0, details: detailsByBucket.get(dateStr) || [] });
        }
      } else if (period === "half-yearly") {
        const start = new Date(now);
        start.setDate(start.getDate() - 181);
        start.setHours(0, 0, 0, 0);
        const weekStart = new Date(start);
        const dow = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() + (dow === 0 ? -6 : 1 - dow));
        const map = new Map<string, number>(rawPeriodViews.map((row): [string, number] => [row._id, row.count]));
        for (let i = 0; i < 26; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i * 7);
          const dateStr = d.toISOString().split("T")[0];
          dailyViews.push({ date: dateStr.substring(5), views: map.get(dateStr) || 0, details: detailsByBucket.get(dateStr) || [] });
        }
      } else if (period === "yearly") {
        const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const map = new Map<string, number>(rawPeriodViews.map((row): [string, number] => [row._id, row.count]));
        for (let i = 0; i < 12; i++) {
          const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
          const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          dailyViews.push({ date: monthStr, views: map.get(monthStr) || 0, details: detailsByBucket.get(monthStr) || [] });
        }
      }

      // ── System health (synchronous — no extra DB calls) ──────────────────
      const cpus = os.cpus() || [];
      const loadAvg = os.loadavg() || [0, 0, 0];
      const totalMem = os.totalmem() || 0;
      const freeMem = os.freemem() || 0;
      const memory = process.memoryUsage();
      const dbDataSizeMB = Number(((mongoDbStats?.dataSize || 0) / (1024 * 1024)).toFixed(2));
      const dbIndexSizeMB = Number(((mongoDbStats?.indexSize || 0) / (1024 * 1024)).toFixed(2));

      const systemHealth = {
        dbStatus: "Connected",
        dbPingTime: (dbPingTime as number) || 15,
        dbDataSizeMB,
        dbUsedSizeMB: Number((dbDataSizeMB + dbIndexSizeMB).toFixed(2)),
        dbStorageSizeMB: Number(((mongoDbStats?.storageSize || 0) / (1024 * 1024)).toFixed(2)),
        dbIndexSizeMB,
        dbTotalCollections: mongoDbStats?.collections || 0,
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

      // ── Telemetry (quick query, capped at 50) ────────────────────────────
      let telemetry24h: any[] = [];
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const rawTelemetry = await db
          .collection("system_telemetry")
          .find({ createdAt: { $gte: twentyFourHoursAgo } })
          .sort({ createdAt: 1 })
          .limit(50)
          .toArray()
          .catch(() => []);

        telemetry24h = rawTelemetry.map((t: any) => {
          const tDate = new Date(t.timestamp || t.createdAt || Date.now());
          return {
            id: t._id.toString(),
            time: t.timeLabel || tDate.toLocaleTimeString("en-IN", {
              hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata", hour12: true,
            }),
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
      } catch {
        // Non-fatal
      }

      if (timeoutHandle) clearTimeout(timeoutHandle);

      const normalizedDailyViews = dailyViews.map((bucket) => ({
        ...bucket,
        details: (bucket.details || []).map((detail) => ({
          ...detail,
          country: normalizeCountryName(detail.country),
          region: normalizeRegionName(detail.country, detail.region),
        })),
      }));

      return NextResponse.json(
        {
          summary: { totalViews, uniqueVisitors },
          charts: {
            dailyViews: normalizedDailyViews,
            topPages: (topPages as any[]).map((p: any) => ({ path: p._id, count: p.count })),
            topCountries: (topCountries as any[]).map((c: any) => ({ name: normalizeCountryName(c._id), count: c.count })),
            topRegions: (topRegions as any[]).map((r: any) => ({
              country: normalizeCountryName(r._id.country),
              region: normalizeRegionName(r._id.country, r._id.region),
              count: r.count,
            })),
          },
          logs: (recentLogs as any[]).map((log: any) => ({
            id: log._id.toString(),
            path: log.path,
            referrer: log.referrer,
            visitorId: typeof log.sessionId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(log.sessionId)
              ? log.sessionId.slice(0, 12)
              : "",
            userAgent: log.userAgent,
            country: normalizeCountryName(log.country),
            region: normalizeRegionName(log.country, log.region),
            city: log.city,
            timestamp: log.timestamp,
          })),
          systemHealth,
          telemetry24h,
        },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      console.error("Admin stats error:", err);
      return NextResponse.json(
        { error: `Dashboard error: ${err?.message || String(err)}` },
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  })();

  // Race: whichever resolves first — our stats or the 8.5s safety timeout
  return Promise.race([statsPromise, timeoutPromise]);
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
