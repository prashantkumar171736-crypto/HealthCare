import "@/lib/env"; // Ensure env vars are loaded on Vercel
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "../login/route";

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

export interface TrafficDay {
  date: string;          // display label e.g. "Sep 26" or "Week 39"
  isoDate: string;       // ISO date string for the bucket start
  totalVisits: number;
  uniqueSessions: number;
  countries: Array<{ name: string; count: number }>;
  topPages: Array<{ name: string; count: number }>;
}

/**
 * GET /api/admin/traffic?range=daily|weekly|biweekly|monthly
 * Returns traffic breakdown bars from the analytics collection.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const analytics = db.collection("analytics");

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "daily";

    const now = new Date();
    let buckets: TrafficDay[] = [];

    if (range === "daily") {
      // Find earliest analytics record date to cover all records across 2+ months if present
      const earliestDoc = await analytics.find({}).sort({ timestamp: 1 }).limit(1).toArray();
      let daysCount = 60; // default 60 days (2 months)
      if (earliestDoc.length > 0 && earliestDoc[0].timestamp) {
        const earliestDate = new Date(earliestDoc[0].timestamp);
        const diffTime = Math.abs(now.getTime() - earliestDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysCount = Math.max(30, Math.min(120, diffDays + 1));
      }

      const start = new Date(now);
      start.setDate(start.getDate() - (daysCount - 1));
      start.setHours(0, 0, 0, 0);

      const raw = await analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        { $project: { dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, country: 1, path: 1, sessionId: 1 } },
        { $group: { _id: "$dateStr", totalVisits: { $sum: 1 }, uniqueSessions: { $addToSet: "$sessionId" }, countries: { $push: "$country" }, paths: { $push: "$path" } } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const rawMap = new Map(raw.map(r => [r._id as string, r]));

      for (let i = 0; i < daysCount; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const iso = d.toISOString().split("T")[0];
        const row = rawMap.get(iso);
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        if (row) {
          const countryCounts = countOccurrences(row.countries as string[]);
          const pageCounts = countOccurrences(row.paths as string[]);
          buckets.push({
            date: label,
            isoDate: iso,
            totalVisits: row.totalVisits,
            uniqueSessions: (row.uniqueSessions as string[]).length,
            countries: topN(countryCounts, 5),
            topPages: topN(pageCounts, 5),
          });
        } else {
          buckets.push({ date: label, isoDate: iso, totalVisits: 0, uniqueSessions: 0, countries: [], topPages: [] });
        }
      }

    } else if (range === "weekly") {
      // Last 12 weeks — one bar per week
      const start = new Date(now);
      start.setDate(start.getDate() - 83);
      start.setHours(0, 0, 0, 0);

      // Align to Monday
      const weekStart = new Date(start);
      const dow = weekStart.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      weekStart.setDate(weekStart.getDate() + diff);

      const raw = await analytics.aggregate([
        { $match: { timestamp: { $gte: weekStart } } },
        {
          $project: {
            weekStart: { $dateTrunc: { date: "$timestamp", unit: "week", startOfWeek: "monday" } },
            country: 1, path: 1, sessionId: 1
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$weekStart" } },
            totalVisits: { $sum: 1 },
            uniqueSessions: { $addToSet: "$sessionId" },
            countries: { $push: "$country" },
            paths: { $push: "$path" }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

      const rawMap = new Map(raw.map(r => [r._id as string, r]));

      for (let i = 0; i < 12; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i * 7);
        const iso = d.toISOString().split("T")[0];
        const row = rawMap.get(iso);
        const label = `W${getISOWeek(d)} ${d.toLocaleDateString("en-US", { month: "short" })}`;

        if (row) {
          const countryCounts = countOccurrences(row.countries as string[]);
          const pageCounts = countOccurrences(row.paths as string[]);
          buckets.push({
            date: label,
            isoDate: iso,
            totalVisits: row.totalVisits,
            uniqueSessions: (row.uniqueSessions as string[]).length,
            countries: topN(countryCounts, 5),
            topPages: topN(pageCounts, 5),
          });
        } else {
          buckets.push({ date: label, isoDate: iso, totalVisits: 0, uniqueSessions: 0, countries: [], topPages: [] });
        }
      }

    } else if (range === "biweekly") {
      // Last 26 weeks (6 months) — one bar per 2 weeks
      const start = new Date(now);
      start.setDate(start.getDate() - 181);
      start.setHours(0, 0, 0, 0);

      const weekStart = new Date(start);
      const dow = weekStart.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      weekStart.setDate(weekStart.getDate() + diff);

      const raw = await analytics.aggregate([
        { $match: { timestamp: { $gte: weekStart } } },
        {
          $project: {
            weekStart: { $dateTrunc: { date: "$timestamp", unit: "week", startOfWeek: "monday" } },
            country: 1, path: 1, sessionId: 1
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$weekStart" } },
            totalVisits: { $sum: 1 },
            uniqueSessions: { $addToSet: "$sessionId" },
            countries: { $push: "$country" },
            paths: { $push: "$path" }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

      // Merge into 2-week buckets
      const weekRows: Array<typeof raw[0]> = [];
      for (let i = 0; i < 26; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i * 7);
        const iso = d.toISOString().split("T")[0];
        const row = raw.find(r => r._id === iso);
        weekRows.push(row || { _id: iso, totalVisits: 0, uniqueSessions: [] as string[], countries: [], paths: [] });
      }

      for (let i = 0; i < 13; i++) {
        const w1 = weekRows[i * 2];
        const w2 = weekRows[i * 2 + 1];
        if (!w1) break;
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i * 14);
        const iso = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        const allCountries = [...(w1.countries as string[] || []), ...(w2?.countries as string[] || [])];
        const allPaths = [...(w1.paths as string[] || []), ...(w2?.paths as string[] || [])];
        const allSessions = [...(w1.uniqueSessions as string[] || []), ...(w2?.uniqueSessions as string[] || [])];

        buckets.push({
          date: label,
          isoDate: iso,
          totalVisits: (w1.totalVisits || 0) + (w2?.totalVisits || 0),
          uniqueSessions: new Set(allSessions).size,
          countries: topN(countOccurrences(allCountries), 5),
          topPages: topN(countOccurrences(allPaths), 5),
        });
      }

    } else if (range === "monthly") {
      // Last 12 months — one bar per month
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const raw = await analytics.aggregate([
        { $match: { timestamp: { $gte: start } } },
        { $project: { monthStr: { $dateToString: { format: "%Y-%m", date: "$timestamp" } }, country: 1, path: 1, sessionId: 1 } },
        {
          $group: {
            _id: "$monthStr",
            totalVisits: { $sum: 1 },
            uniqueSessions: { $addToSet: "$sessionId" },
            countries: { $push: "$country" },
            paths: { $push: "$path" }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

      const rawMap = new Map(raw.map(r => [r._id as string, r]));

      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const row = rawMap.get(iso);
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

        if (row) {
          const countryCounts = countOccurrences(row.countries as string[]);
          const pageCounts = countOccurrences(row.paths as string[]);
          buckets.push({
            date: label,
            isoDate: iso + "-01",
            totalVisits: row.totalVisits,
            uniqueSessions: (row.uniqueSessions as string[]).length,
            countries: topN(countryCounts, 5),
            topPages: topN(pageCounts, 5),
          });
        } else {
          buckets.push({ date: label, isoDate: iso + "-01", totalVisits: 0, uniqueSessions: 0, countries: [], topPages: [] });
        }
      }
    }

    return NextResponse.json({ range, buckets });
  } catch (err: any) {
    console.error("Traffic API error:", err);
    return NextResponse.json({ error: `Failed to fetch traffic data: ${err.message}` }, { status: 500 });
  }
}

// --- Helpers ---

function countOccurrences(arr: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of arr) {
    const k = v || "Unknown";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function topN(m: Map<string, number>, n: number): Array<{ name: string; count: number }> {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function getISOWeek(d: Date): number {
  const date = new Date(d.valueOf());
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7);
}
