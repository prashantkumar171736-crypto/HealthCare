import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { validateSession } from "@/lib/admin-auth";
import { ensureAdminSecurityIndexes } from "@/lib/admin-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZES = new Set([100, 250, 500, 1000]);

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return validateSession(cookieStore.get("admin_session")?.value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setHours(23, 59, 59, 999);
  return date;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const exportCsv = params.get("format") === "csv";
  const requestedPage = Number(params.get("page") || 1);
  const pageSize = Number(params.get("pageSize") || 100);
  if (!exportCsv && (!Number.isInteger(requestedPage) || requestedPage < 1)) {
    return NextResponse.json({ error: "page must be a positive integer." }, { status: 400 });
  }
  if (!exportCsv && (!Number.isInteger(pageSize) || !PAGE_SIZES.has(pageSize))) {
    return NextResponse.json({ error: "pageSize must be 100, 250, 500, or 1000." }, { status: 400 });
  }

  const q = (params.get("q") || "").trim();
  const dateKeys = ["blockedFrom", "blockedTo", "expiresFrom", "expiresTo"];
  const hasDateFilter = dateKeys.some((key) => Boolean(params.get(key)));
  const dateFilters = Object.fromEntries(dateKeys.map((key) => [key, parseDate(params.get(key), key.endsWith("To"))]));
  if (dateKeys.some((key) => params.get(key) && !dateFilters[key])) {
    return NextResponse.json({ error: "Date filters must contain valid dates." }, { status: 400 });
  }

  const attemptsMin = params.get("attemptsMin");
  const attemptsMax = params.get("attemptsMax");
  const minAttempts = attemptsMin === null || attemptsMin === "" ? null : Number(attemptsMin);
  const maxAttempts = attemptsMax === null || attemptsMax === "" ? null : Number(attemptsMax);
  if ((minAttempts !== null && (!Number.isInteger(minAttempts) || minAttempts < 0)) ||
      (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 0)) ||
      (minAttempts !== null && maxAttempts !== null && minAttempts > maxAttempts)) {
    return NextResponse.json({ error: "Failed-attempt filters must be non-negative integers with minimum no greater than maximum." }, { status: 400 });
  }

  const status = params.get("status") || "all";
  if (!["all", "blocked", "expired", "unblocked"].includes(status)) {
    return NextResponse.json({ error: "status must be all, blocked, expired, or unblocked." }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureAdminSecurityIndexes(db);
    const collection = db.collection("admin_ip_blocks");
    const now = new Date();
    await collection.updateMany(
      { expiresAt: { $lte: now }, status: { $in: ["blocked", null] } },
      { $set: { status: "expired", expiredAt: now } }
    );

    const filter: Record<string, unknown> = {};
    const and: Record<string, unknown>[] = [];
    const contains = (value: string) => ({ $regex: escapeRegex(value), $options: "i" });
    if (q) and.push({ $or: [{ ip: contains(q) }, { ipKey: contains(q) }, { country: contains(q) }] });
    for (const [key, field] of [["ip", "ip"], ["fingerprint", "ipKey"], ["country", "country"]] as const) {
      const value = params.get(key)?.trim();
      if (value) and.push({ [field]: contains(value) });
    }

    if (status === "blocked") {
      and.push({ expiresAt: { $gt: now } }, { $or: [{ status: "blocked" }, { status: { $exists: false } }] });
    } else if (status === "expired") {
      and.push({ expiresAt: { $lte: now }, status: { $ne: "unblocked" } });
    } else if (status === "unblocked") {
      and.push({ status: "unblocked" });
    }

    if (minAttempts !== null || maxAttempts !== null) {
      const attemptFilter: Record<string, number> = {};
      if (minAttempts !== null) attemptFilter.$gte = minAttempts;
      if (maxAttempts !== null) attemptFilter.$lte = maxAttempts;
      and.push({ attemptCount: attemptFilter });
    }

    const blockedAt: Record<string, Date> = {};
    const expiresAt: Record<string, Date> = {};
    if (dateFilters.blockedFrom) blockedAt.$gte = dateFilters.blockedFrom;
    if (dateFilters.blockedTo) blockedAt.$lte = dateFilters.blockedTo;
    if (dateFilters.expiresFrom) expiresAt.$gte = dateFilters.expiresFrom;
    if (dateFilters.expiresTo) expiresAt.$lte = dateFilters.expiresTo;
    if (Object.keys(blockedAt).length) and.push({ blockedAt });
    if (Object.keys(expiresAt).length) and.push({ expiresAt });
    if (!q && !hasDateFilter) and.push({ blockedAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } });
    if (and.length) filter.$and = and;

    const total = await collection.countDocuments(filter);
    const totalPages = Math.ceil(total / pageSize);
    const page = Math.min(requestedPage, Math.max(1, totalPages));
    const cursor = collection.find(filter).sort({ blockedAt: -1 });
    const items = exportCsv
      ? await cursor.toArray()
      : await cursor.skip((page - 1) * pageSize).limit(pageSize).toArray();

    const rows = items.map((block) => ({
      id: block._id.toString(),
      ip: typeof block.ip === "string" ? block.ip : "Not retained",
      fingerprint: String(block.ipKey || "").slice(0, 10),
      country: block.country || "Unknown",
      failedAttempts: block.attemptCount || 0,
      blockedAt: block.blockedAt,
      expiresAt: block.expiresAt,
      status: block.status === "unblocked" ? "unblocked" : new Date(block.expiresAt).getTime() <= now.getTime() ? "expired" : "blocked",
      unblockedAt: block.unblockedAt || null,
    }));

    if (exportCsv) {
      const columns = ["Record ID", "IP address", "Fingerprint", "Country", "Failed attempts", "Blocked at", "Blocked until", "Status", "Unblocked at"];
      const lines = [
        columns.map(csvCell).join(","),
        ...rows.map((row) => [row.id, row.ip, row.fingerprint, row.country, row.failedAttempts, csvDate(row.blockedAt), csvDate(row.expiresAt), row.status, csvDate(row.unblockedAt)].map(csvCell).join(",")),
      ];
      return new Response(`\uFEFF${lines.join("\r\n")}`, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Disposition": 'attachment; filename="ip-block-history.csv"',
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }

    return NextResponse.json({
      items: rows,
      total,
      page,
      pageSize,
      totalPages,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Unable to load IP block history." }, { status: 503 });
  }
}