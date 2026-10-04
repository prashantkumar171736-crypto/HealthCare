import "@/lib/env";
import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";
import { ARCHIVE_CATEGORY_OPTIONS, ARCHIVE_RETENTION_OPTIONS, type ArchiveCategorySelection } from "@/lib/archive-config";

export const ARCHIVE_BUCKET_NAME = process.env.R2_SECURITY_BUCKET_NAME || process.env.R2_IP_SECURITY_BUCKET_NAME || "healthcare-ip-security";
export const ARCHIVE_PUBLIC_URL = process.env.R2_SECURITY_PUBLIC_URL || process.env.R2_IP_SECURITY_PUBLIC_URL || "";
export const ARCHIVE_RETENTION_DAYS = Number(process.env.ARCHIVE_RETENTION_DAYS || "30");

const ARCHIVE_ACCOUNT_ID = process.env.R2_SECURITY_ACCOUNT_ID || process.env.R2_IP_SECURITY_ACCOUNT_ID;
const ARCHIVE_ACCESS_KEY_ID = process.env.R2_SECURITY_ACCESS_KEY_ID || process.env.R2_IP_SECURITY_ACCESS_KEY_ID;
const ARCHIVE_SECRET_ACCESS_KEY = process.env.R2_SECURITY_SECRET_ACCESS_KEY || process.env.R2_IP_SECURITY_SECRET_ACCESS_KEY;

export type ArchiveCategory = "analytics" | "ip-security" | "server-logs";
export type ArchiveSettings = {
  enabled: boolean;
  retentionDays: number;
  category: ArchiveCategorySelection;
};

const ARCHIVE_SETTINGS_KEY = "data_archive_settings";

let archiveClient: S3Client | null = null;

function getArchiveClient(): S3Client {
  if (!ARCHIVE_ACCOUNT_ID || !ARCHIVE_ACCESS_KEY_ID || !ARCHIVE_SECRET_ACCESS_KEY) {
    throw new Error("Configure R2_SECURITY_ACCOUNT_ID, R2_SECURITY_ACCESS_KEY_ID, and R2_SECURITY_SECRET_ACCESS_KEY for the private archive bucket. Upload-bucket credentials are not used for archive exports.");
  }

  if (!archiveClient) {
    archiveClient = new S3Client({
      region: "auto",
      endpoint: `https://${ARCHIVE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      maxAttempts: 1,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 3000,
        requestTimeout: 10000,
      }),
      credentials: {
        accessKeyId: ARCHIVE_ACCESS_KEY_ID,
        secretAccessKey: ARCHIVE_SECRET_ACCESS_KEY,
      },
    });
  }

  return archiveClient;
}

function formatArchiveFileName(category: ArchiveCategory): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `${category}-archive-${dateStamp}-${Date.now()}.xlsx`;
}

function safeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatArchiveDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export interface ArchiveWorkbookSummary {
  category: ArchiveCategory;
  recordsCount: number;
  retentionDays: number;
  generatedAt: Date;
}

function formatCountBreakdown(counts: Map<string, number>): string {
  if (counts.size === 0) return "N/A";
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => `${label}: ${count}`)
    .join("; ");
}

function getDeviceType(userAgent: unknown): string {
  if (typeof userAgent !== "string" || !userAgent.trim() || userAgent === "Unknown") return "Unknown";
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return "Tablet";
  if (/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(userAgent)) return "Mobile";
  return "Desktop";
}

function getSummaryCounts(rows: Record<string, unknown>[]) {
  const countries = new Map<string, number>();
  const languages = new Map<string, number>();
  const devices = new Map<string, number>();
  const hasLanguageData = rows.some((row) => typeof row.browserLanguage === "string");
  const hasDeviceData = rows.some((row) => typeof row.userAgent === "string");

  for (const row of rows) {
    const country = typeof row.country === "string" && row.country.trim() ? row.country.trim() : "Unknown";
    countries.set(country, (countries.get(country) ?? 0) + 1);

    if (hasLanguageData) {
      const language = typeof row.browserLanguage === "string" && row.browserLanguage.trim()
        ? row.browserLanguage.trim()
        : "Not recorded";
      languages.set(language, (languages.get(language) ?? 0) + 1);
    }

    if (hasDeviceData) {
      const device = getDeviceType(row.userAgent);
      devices.set(device, (devices.get(device) ?? 0) + 1);
    }
  }

  return {
    countries: formatCountBreakdown(countries),
    languages: hasLanguageData ? formatCountBreakdown(languages) : "N/A",
    devices: hasDeviceData ? formatCountBreakdown(devices) : "N/A",
  };
}

function applyWorkbookCellStyle(
  cell: ExcelJS.Cell,
  options: {
    fill?: string;
    fontColor?: string;
    bold?: boolean;
    align?: "center" | "left" | "right";
    valign?: "middle" | "top";
    border?: boolean;
    borderColor?: string;
    fontSize?: number;
  } = {},
) {
  const {
    fill,
    fontColor = "FFFFFF",
    bold = false,
    align = "left",
    valign = "middle",
    border = true,
    borderColor = "D9D9D9",
    fontSize = 10,
  } = options;

  cell.font = {
    bold,
    color: { argb: fontColor },
    size: fontSize,
  };
  cell.alignment = { vertical: valign, horizontal: align };
  if (border) {
    cell.border = {
      top: { style: "thin", color: { argb: borderColor } },
      left: { style: "thin", color: { argb: borderColor } },
      bottom: { style: "thin", color: { argb: borderColor } },
      right: { style: "thin", color: { argb: borderColor } },
    };
  }
  if (fill) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fill },
    };
  }
}

function getBrowserName(userAgent: unknown): string {
  if (typeof userAgent !== "string") return "Unknown";
  const ua = userAgent.toLowerCase();
  if (/edg|chrome/.test(ua)) return "Chrome";
  if (/firefox/.test(ua)) return "Firefox";
  if (/safari/.test(ua) && !/chrome|android/.test(ua)) return "Safari";
  if (/opr|opera/.test(ua)) return "Opera";
  if (/msie|trident/.test(ua)) return "IE";
  return "Other";
}

function getDeviceKind(userAgent: unknown): string {
  if (typeof userAgent !== "string") return "Unknown";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return "Tablet";
  if (/mobi|android|iphone|ipod|iemobile|opera mini/.test(ua)) return "Mobile";
  return "Desktop";
}

function getOperatingSystem(userAgent: unknown): string {
  if (typeof userAgent !== "string") return "Unknown";
  const ua = userAgent.toLowerCase();
  if (/windows/.test(ua)) return "Windows";
  if (/android/.test(ua)) return "Android";
  if (/iphone|ipad|ipod/.test(ua)) return "iOS";
  if (/mac/.test(ua)) return "macOS";
  if (/linux/.test(ua)) return "Linux";
  return "Other";
}

function getTimeOfDayBucket(timestamp: unknown): string {
  if (!(timestamp instanceof Date)) {
    const value = timestamp ? new Date(String(timestamp)) : null;
    if (value && !Number.isNaN(value.getTime())) {
      return getTimeOfDayBucket(value);
    }
    return "Unknown";
  }
  const hour = timestamp.getHours();
  if (hour >= 0 && hour < 6) return "Night (00-06)";
  if (hour < 12) return "Morning (06-12)";
  if (hour < 18) return "Afternoon (12-18)";
  if (hour < 22) return "Evening (18-22)";
  return "Late Night (22-24)";
}

function getPageCategory(path: unknown): string {
  const value = typeof path === "string" ? path : "";
  if (!value) return "Direct";
  if (/\/admin\//i.test(value) || value.includes("/admin")) return "Admin Console";
  if (/\/api\//i.test(value)) return "API";
  if (/\/diseases\//i.test(value)) return "Disease Detail";
  if (/\/diseases/i.test(value)) return "Disease Index";
  if (/\/health-library/i.test(value)) return "Health Library";
  if (/\/health-tips/i.test(value)) return "Health Tips";
  if (/\/faq/i.test(value)) return "FAQ";
  if (/\/feedback/i.test(value)) return "Feedback";
  if (/\/donate/i.test(value)) return "Donation";
  if (/\/privacy-policy/i.test(value)) return "Privacy Policy";
  return "Public Page";
}

function getCategoryPalette(category: string) {
  const normalized = category.toLowerCase();

  if (normalized.includes("ip")) {
    return {
      headerFill: "FF2E2A5F",
      subHeaderFill: "FF3A3C74",
      metricColors: ["FF2F80ED", "FF27AE60", "FFFFA726", "FFDC2626", "FF8B5CF6", "FF14B8A6"],
      panelFill: "FFF7F7FB",
      border: "FFD1D5DB",
      titleColor: "FF0F172A",
      muted: "FF6B7280",
    };
  }

  if (normalized.includes("server") || normalized.includes("log")) {
    return {
      headerFill: "FF273C71",
      subHeaderFill: "FF415E9A",
      metricColors: ["FF0EA5E9", "FF10B981", "FFF59E0B", "FFEF4444", "FF8B5CF6", "FF14B8A6"],
      panelFill: "FFF8FAFC",
      border: "FFD8DEE9",
      titleColor: "FF111827",
      muted: "FF6B7280",
    };
  }

  return {
    headerFill: "FF2B2C6F",
    subHeaderFill: "FF3E3D8C",
    metricColors: ["FF2563EB", "FF16A34A", "FFFF8A00", "FFDC2626", "FF7C3AED", "FF0891B2"],
    panelFill: "FFF3F4F6",
    border: "FFD9D9D9",
    titleColor: "FF111827",
    muted: "FF6B7280",
  };
}

function buildAnalyticsSummary(rows: Record<string, unknown>[]) {
  const countryMap = new Map<string, number>();
  const regionMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const browserMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  const osMap = new Map<string, number>();
  const pageMap = new Map<string, number>();
  const referrerMap = new Map<string, number>();
  const timeMap = new Map<string, number>();
  const sessionSet = new Set<string>();
  let botHits = 0;
  let adminHits = 0;

  for (const row of rows) {
    const country = String(row.country ?? "Unknown").trim() || "Unknown";
    const region = String(row.region ?? "Unknown").trim() || "Unknown";
    const city = String(row.city ?? "Unknown").trim() || "Unknown";
    const path = String(row.path ?? "").trim() || "Direct";
    const referrer = String(row.referrer ?? "Direct").trim() || "Direct";
    const userAgent = String(row.userAgent ?? "Unknown");
    const sessionId = String(row.sessionId ?? "").trim();
    const browserName = getBrowserName(userAgent);
    const deviceName = getDeviceKind(userAgent);
    const osName = getOperatingSystem(userAgent);
    const timeBucket = getTimeOfDayBucket(row.timestamp ?? new Date());

    if (sessionId) sessionSet.add(sessionId);

    countryMap.set(country, (countryMap.get(country) ?? 0) + 1);
    regionMap.set(`${country} / ${region}`, (regionMap.get(`${country} / ${region}`) ?? 0) + 1);
    cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
    browserMap.set(browserName, (browserMap.get(browserName) ?? 0) + 1);
    deviceMap.set(deviceName, (deviceMap.get(deviceName) ?? 0) + 1);
    osMap.set(osName, (osMap.get(osName) ?? 0) + 1);
    pageMap.set(path, (pageMap.get(path) ?? 0) + 1);
    referrerMap.set(referrer, (referrerMap.get(referrer) ?? 0) + 1);
    timeMap.set(timeBucket, (timeMap.get(timeBucket) ?? 0) + 1);

    const ua = userAgent.toLowerCase();
    if (/bot|crawler|spider|bingpreview|headless|slurp|semrush|duckduckbot|googlebot|ahrefs/.test(ua)) {
      botHits += 1;
    }
    if (/\/admin\//i.test(path) || path.toLowerCase().includes("admin")) {
      adminHits += 1;
    }
  }

  const totalRecords = rows.length;
  const uniqueSessions = sessionSet.size || 0;
  const allCountries = countryMap.size || 0;
  const allCities = cityMap.size || 0;

  return {
    totalRecords,
    uniqueSessions,
    countries: allCountries,
    cities: allCities,
    botHits,
    adminHits,
    countryBreakdown: [...countryMap.entries()].sort((a, b) => b[1] - a[1]),
    regionBreakdown: [...regionMap.entries()].sort((a, b) => b[1] - a[1]),
    cityBreakdown: [...cityMap.entries()].sort((a, b) => b[1] - a[1]),
    browserBreakdown: [...browserMap.entries()].sort((a, b) => b[1] - a[1]),
    deviceBreakdown: [...deviceMap.entries()].sort((a, b) => b[1] - a[1]),
    osBreakdown: [...osMap.entries()].sort((a, b) => b[1] - a[1]),
    pageBreakdown: [...pageMap.entries()].sort((a, b) => b[1] - a[1]),
    referrerBreakdown: [...referrerMap.entries()].sort((a, b) => b[1] - a[1]),
    timeBreakdown: [...timeMap.entries()].sort((a, b) => b[1] - a[1]),
    pageTypeBreakdown: [...new Map([...pageMap.entries()].map(([path, count]) => [getPageCategory(path), (new Map([...pageMap.entries()].map(([p, c]) => [getPageCategory(p), 0]))).get(getPageCategory(path)) ?? 0]))].slice(0),
  };
}

export function buildArchiveWorkbook(
  rows: Record<string, unknown>[],
  sheetName: string,
  summary: ArchiveWorkbookSummary,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const palette = getCategoryPalette(sheetName);

  const analyticsSheet = workbook.addWorksheet("Analytics Report");
  const detailSheet = workbook.addWorksheet("Detailed Summary Report");

  const firstRow = rows[0] ?? {};
  const rawKeys = Object.keys(firstRow).length > 0 ? Object.keys(firstRow) : ["ID", "message"];
  const keys = rawKeys.map((key) => (key === "_id" ? "ID" : key));

  detailSheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: Math.max(18, key.length + 8),
  }));

  for (const row of rows) {
    const normalized: Record<string, unknown> = {};
    for (const key of keys) {
      const rawKey = key === "ID" ? "_id" : key;
      normalized[key] = safeValue((row as Record<string, unknown>)[rawKey] ?? (row as Record<string, unknown>)[key]);
    }
    detailSheet.addRow(normalized);
  }

  detailSheet.getRow(1).font = { bold: true };

  const summaryStats = buildAnalyticsSummary(rows);
  const metricCards = [
    { key: "TOTAL RECORDS", value: summaryStats.totalRecords, color: palette.metricColors[0] },
    { key: "UNIQUE SESSIONS", value: summaryStats.uniqueSessions, color: palette.metricColors[1] },
    { key: "COUNTRIES", value: summaryStats.countries, color: palette.metricColors[2] },
    { key: "CITIES", value: summaryStats.cities, color: palette.metricColors[3] },
    { key: "BOT HITS", value: summaryStats.botHits, color: palette.metricColors[4] },
    { key: "ADMIN CONSOLE HITS", value: summaryStats.adminHits, color: palette.metricColors[5] },
  ];

  const widths = [13, 15, 14, 18, 12, 12, 14, 18, 15, 14, 18, 14];
  analyticsSheet.columns = widths.map((width) => ({ width }));

  analyticsSheet.mergeCells("A1:K1");
  analyticsSheet.getCell("A1").value = "ANALYTICS ARCHIVE - DETAILED SUMMARY";
  analyticsSheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 18 };
  analyticsSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.headerFill } };
  analyticsSheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  analyticsSheet.getCell("A1").border = {
    top: { style: "thin", color: { argb: palette.headerFill } },
    left: { style: "thin", color: { argb: palette.headerFill } },
    bottom: { style: "thin", color: { argb: palette.headerFill } },
    right: { style: "thin", color: { argb: palette.headerFill } },
  };
  analyticsSheet.getRow(1).height = 28;

  analyticsSheet.mergeCells("A2:K2");
  analyticsSheet.getCell("A2").value = `Window: ${formatArchiveDateTime(new Date(summary.generatedAt.getTime() - summary.retentionDays * 24 * 60 * 60 * 1000))} - ${formatArchiveDateTime(summary.generatedAt)} | Records: ${summaryStats.totalRecords}`;
  analyticsSheet.getCell("A2").font = { italic: true, color: { argb: palette.muted }, size: 9 };
  analyticsSheet.getCell("A2").alignment = { horizontal: "center" };
  analyticsSheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
  analyticsSheet.getRow(2).height = 18;

  const cardStartCols = [1, 3, 5, 7, 9, 11];
  for (let i = 0; i < metricCards.length; i += 1) {
    const colIndex = cardStartCols[i];
    const titleCell = analyticsSheet.getCell(5, colIndex);
    const valueCell = analyticsSheet.getCell(6, colIndex);
    const cardWidth = 2;
    analyticsSheet.mergeCells(5, colIndex, 5, colIndex + cardWidth - 1);
    analyticsSheet.mergeCells(6, colIndex, 6, colIndex + cardWidth - 1);
    titleCell.value = metricCards[i].key;
    valueCell.value = metricCards[i].value;
    applyWorkbookCellStyle(titleCell, { fill: metricCards[i].color, fontColor: "FFFFFFFF", bold: true, align: "center", border: true, borderColor: palette.border, fontSize: 8 });
    applyWorkbookCellStyle(valueCell, { fill: "FFFFFFFF", fontColor: "FF111827", bold: true, align: "center", border: true, borderColor: palette.border, fontSize: 14 });
    analyticsSheet.getRow(5).height = 20;
    analyticsSheet.getRow(6).height = 28;
  }

  analyticsSheet.getRow(7).height = 8;

  const sectionDefinitions = [
    { title: "Visits by Country", startRow: 8, startCol: 1, endRow: 18, endCol: 6 },
    { title: "Device Type", startRow: 8, startCol: 8, endRow: 18, endCol: 11 },
    { title: "Browser Share", startRow: 20, startCol: 1, endRow: 29, endCol: 6 },
    { title: "Operating System", startRow: 20, startCol: 8, endRow: 29, endCol: 11 },
    { title: "Top Pages", startRow: 31, startCol: 1, endRow: 40, endCol: 6 },
    { title: "Time of Day (IST)", startRow: 31, startCol: 8, endRow: 40, endCol: 11 },
  ];

  for (const section of sectionDefinitions) {
    const titleCell = analyticsSheet.getCell(section.startRow, section.startCol);
    titleCell.value = section.title;
    titleCell.font = { bold: true, size: 12, color: { argb: palette.titleColor } };
    titleCell.alignment = { horizontal: "left", vertical: "middle" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.panelFill } };
    titleCell.border = {
      top: { style: "thin", color: { argb: palette.border } },
      left: { style: "thin", color: { argb: palette.border } },
      bottom: { style: "thin", color: { argb: palette.border } },
      right: { style: "thin", color: { argb: palette.border } },
    };
  }

  const writeMiniTable = (startRow: number, startCol: number, label: string, values: Array<[string, number]>, color: string) => {
    const heading = analyticsSheet.getCell(startRow, startCol);
    heading.value = label;
    heading.font = { bold: true, size: 10, color: { argb: "FF111827" } };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.panelFill } };
    heading.alignment = { horizontal: "left" };

    for (let i = 0; i < Math.min(values.length, 5); i += 1) {
      const item = values[i];
      const labelCell = analyticsSheet.getCell(startRow + 1 + i, startCol);
      const countCell = analyticsSheet.getCell(startRow + 1 + i, startCol + 1);
      const pctCell = analyticsSheet.getCell(startRow + 1 + i, startCol + 2);
      labelCell.value = item[0];
      countCell.value = item[1];
      pctCell.value = `${((item[1] / Math.max(1, summaryStats.totalRecords)) * 100).toFixed(1)}%`;
      applyWorkbookCellStyle(labelCell, { fill: color, fontColor: "FFFFFFFF", bold: false, align: "left", border: true, borderColor: palette.border, fontSize: 8 });
      applyWorkbookCellStyle(countCell, { fill: "FFFFFFFF", fontColor: "FF111827", bold: false, align: "center", border: true, borderColor: palette.border, fontSize: 8 });
      applyWorkbookCellStyle(pctCell, { fill: "FFEBF8FF", fontColor: "FF111827", bold: false, align: "center", border: true, borderColor: palette.border, fontSize: 8 });
    }
  };

  writeMiniTable(10, 1, "Country", summaryStats.countryBreakdown.slice(0, 5), "FF2563EB");
  writeMiniTable(10, 8, "Device", summaryStats.deviceBreakdown.slice(0, 5), "FF0F766E");
  writeMiniTable(22, 1, "Browser", summaryStats.browserBreakdown.slice(0, 5), "FF7C3AED");
  writeMiniTable(22, 8, "OS", summaryStats.osBreakdown.slice(0, 5), "FF10B981");
  writeMiniTable(33, 1, "Top Pages", summaryStats.pageBreakdown.slice(0, 5), "FFEA580C");
  writeMiniTable(33, 8, "Time of Day", summaryStats.timeBreakdown.slice(0, 5), "FF14B8A6");

  const detailedRows: Array<[string, string, number, string]> = [
    ["Country", "All", summaryStats.countryBreakdown.length, ""],
    ["Region / State", "All", summaryStats.regionBreakdown.length, ""],
    ["City", "All", summaryStats.cityBreakdown.length, ""],
    ["Page Path", "All", summaryStats.pageBreakdown.length, ""],
    ["Referrer", "All", summaryStats.referrerBreakdown.length, ""],
    ["Browser", "All", summaryStats.browserBreakdown.length, ""],
    ["Device Type", "All", summaryStats.deviceBreakdown.length, ""],
    ["Operating System", "All", summaryStats.osBreakdown.length, ""],
  ];

  const detailHeader = analyticsSheet.getRow(44);
  detailHeader.getCell(1).value = "DETAILS GROUPED BY";
  detailHeader.getCell(1).font = { bold: true, color: { argb: "FF111827" }, size: 12 };
  detailHeader.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

  const startRow = 45;
  for (let i = 0; i < detailedRows.length; i += 1) {
    const [label, group, count, value] = detailedRows[i];
    const row = analyticsSheet.getRow(startRow + i);
    row.getCell(1).value = label;
    row.getCell(2).value = group;
    row.getCell(3).value = count;
    row.getCell(4).value = value || "";
    applyWorkbookCellStyle(row.getCell(1), { fill: "FFFFFFFF", fontColor: "FF111827", bold: false, align: "left", border: true, borderColor: palette.border, fontSize: 8 });
    applyWorkbookCellStyle(row.getCell(2), { fill: "FFFFFFFF", fontColor: "FF111827", bold: false, align: "left", border: true, borderColor: palette.border, fontSize: 8 });
    applyWorkbookCellStyle(row.getCell(3), { fill: "FFEEF2FF", fontColor: "FF111827", bold: true, align: "center", border: true, borderColor: palette.border, fontSize: 8 });
    applyWorkbookCellStyle(row.getCell(4), { fill: "FFFFFFFF", fontColor: "FF111827", bold: false, align: "left", border: true, borderColor: palette.border, fontSize: 8 });
  }

  return workbook;
}

async function getAnalyticsArchiveRows(startAt: Date, endAt: Date): Promise<Record<string, unknown>[]> {
  const db = await getDb();
  const rows = await db.collection("analytics").find({
    timestamp: { $gte: startAt, $lte: endAt },
  }).sort({ timestamp: 1 }).toArray();

  return rows.map((row) => ({
    ID: row._id.toString(),
    path: row.path ?? "",
    referrer: row.referrer ?? "",
    userAgent: row.userAgent ?? "",
    browserLanguage: row.browserLanguage ?? "Not recorded",
    sessionId: row.sessionId ?? "",
    country: row.country ?? "",
    region: row.region ?? "",
    city: row.city ?? "",
    timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : "",
  }));
}

async function getIpSecurityArchiveRows(startAt: Date, endAt: Date): Promise<Record<string, unknown>[]> {
  const db = await getDb();

  const [blockedIps, failedAttempts] = await Promise.all([
    db.collection("admin_ip_blocks").find({ blockedAt: { $gte: startAt, $lte: endAt } }).sort({ blockedAt: 1 }).toArray(),
    db.collection("admin_login_attempts").find({ createdAt: { $gte: startAt, $lte: endAt } }).sort({ createdAt: 1 }).toArray(),
  ]);

  const blockRows = blockedIps.map((row) => ({
    ID: row._id.toString(),
    ip: row.ip ?? "",
    ipKey: row.ipKey ?? "",
    country: row.country ?? "",
    status: row.status ?? "",
    reason: row.reason ?? "",
    blockedAt: row.blockedAt ? new Date(row.blockedAt).toISOString() : "",
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : "",
    attemptCount: row.attemptCount ?? 0,
  }));

  const attemptRows = failedAttempts.map((row) => ({
    ID: row._id.toString(),
    ip: row.ip ?? "",
    ipKey: row.ipKey ?? "",
    country: row.country ?? "",
    attempts: row.attempts ?? 0,
    lockedUntil: row.lockedUntil ? new Date(row.lockedUntil).toISOString() : "",
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : "",
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
    windowStartedAt: row.windowStartedAt ? new Date(row.windowStartedAt).toISOString() : "",
  }));

  return [...blockRows, ...attemptRows];
}

async function getServerLogsArchiveRows(): Promise<Record<string, unknown>[]> {
  return [];
}

async function getArchiveRowsForCategory(category: ArchiveCategory, startAt: Date, endAt: Date): Promise<Record<string, unknown>[]> {
  switch (category) {
    case "analytics":
      return getAnalyticsArchiveRows(startAt, endAt);
    case "ip-security":
      return getIpSecurityArchiveRows(startAt, endAt);
    case "server-logs":
      return getServerLogsArchiveRows();
    default:
      return [];
  }
}

export async function listArchiveFiles(): Promise<Array<{ key: string; size: number; lastModified: string }>> {
  let response;
  try {
    response = await getArchiveClient().send(new ListObjectsV2Command({
      Bucket: ARCHIVE_BUCKET_NAME,
      MaxKeys: 100,
    }));
  } catch (error) {
    throw describeArchiveR2Error(error, "list archive objects");
  }

  return (response.Contents ?? []).filter((item) => item.Key && /^(analytics|ip-security|server-logs)-archive-\d{4}-\d{2}-\d{2}(?:-\d{13})?\.xlsx?$/.test(item.Key)).map((item) => ({
    key: item.Key ?? "",
    size: item.Size ?? 0,
    lastModified: item.LastModified ? item.LastModified.toISOString() : "",
  })).sort((a, b) => b.lastModified.localeCompare(a.lastModified));
}

export async function getArchiveFile(fileName: string): Promise<Uint8Array> {
  try {
    const response = await getArchiveClient().send(new GetObjectCommand({
      Bucket: ARCHIVE_BUCKET_NAME,
      Key: fileName,
    }));
    if (!response.Body) throw new Error("The requested archive file has no content.");
    return response.Body.transformToByteArray();
  } catch (error) {
    throw describeArchiveR2Error(error, "download archive object");
  }
}

export async function getArchiveBucketStatus(): Promise<{ status: "Connected" | "Offline"; bucketName: string; message?: string }> {
  try {
    await getArchiveClient().send(new HeadBucketCommand({ Bucket: ARCHIVE_BUCKET_NAME }));
    return { status: "Connected", bucketName: ARCHIVE_BUCKET_NAME };
  } catch (error) {
    const err = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
    const statusCode = err?.$metadata?.httpStatusCode;
    const code = err?.code || err?.name || "UnknownError";
    return {
      status: "Offline",
      bucketName: ARCHIVE_BUCKET_NAME,
      message: `R2 archive bucket is unavailable (${statusCode ? `HTTP ${statusCode}, ` : ""}${code}).`,
    };
  }
}

export async function uploadArchiveFile(
  category: ArchiveCategory,
  buffer: Buffer,
  fileName = formatArchiveFileName(category),
): Promise<{ fileName: string; publicUrl: string }> {

  try {
    await getArchiveClient().send(new PutObjectCommand({
      Bucket: ARCHIVE_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      CacheControl: "private, max-age=3600",
    }));
  } catch (error) {
    throw describeArchiveR2Error(error, "upload archive object");
  }

  return {
    fileName,
    publicUrl: `${ARCHIVE_PUBLIC_URL}/${fileName}`,
  };
}

function describeArchiveR2Error(error: unknown, operation: string): Error {
  const err = error as {
    name?: string;
    Code?: string;
    code?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = err?.Code || err?.code || err?.name || "UnknownError";
  const statusCode = err?.$metadata?.httpStatusCode;

  if (code === "AccessDenied" || statusCode === 403) {
    return new Error(`R2 denied the request to ${operation} in bucket "${ARCHIVE_BUCKET_NAME}". Configure an R2 token for this bucket with Object Read and Object Write permissions.`);
  }
  if (code === "NoSuchBucket" || statusCode === 404) {
    return new Error(`R2 archive bucket "${ARCHIVE_BUCKET_NAME}" was not found in the configured account.`);
  }
  if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch" || statusCode === 401) {
    return new Error("R2 rejected the archive credentials. Confirm the archive access key and secret belong to the configured account.");
  }
  return new Error(`R2 ${operation} failed (${statusCode ? `HTTP ${statusCode}, ` : ""}${code})${err.message ? `: ${err.message}` : ""}.`);
}

export async function recordArchiveJob(
  runId: string,
  jobType: ArchiveCategory,
  startedAt: Date,
  completedAt: Date,
  status: "success" | "failed",
  recordsCount: number,
  fileName: string,
  bucketName: string,
  error?: string,
  fileSizeBytes?: number | null,
) {
  const db = await getDb();
  const result = await db.collection("archive_jobs").insertOne({
    runId,
    jobType,
    startedAt,
    completedAt,
    status,
    recordsCount,
    fileName,
    bucketName,
    fileSizeBytes: fileSizeBytes ?? null,
    error: error ?? null,
    createdAt: new Date(),
  });
  return result.insertedId.toString();
}

export async function runArchiveExport(category: ArchiveCategory | "all" = "all", retentionDays = ARCHIVE_RETENTION_DAYS) {
  const categories: ArchiveCategory[] = category === "all"
    ? ["analytics", "ip-security", "server-logs"]
    : [category];

  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const runId = randomUUID();
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key: ARCHIVE_SETTINGS_KEY },
    { $set: { key: ARCHIVE_SETTINGS_KEY, lastRunId: runId, lastRunAt: endAt, updatedAt: endAt } },
    { upsert: true },
  );
  const results: Array<{
    jobId: string;
    category: ArchiveCategory;
    status: "success" | "failed";
    fileName?: string;
    publicUrl?: string;
    fileSizeBytes: number | null;
    recordsCount: number;
    archivedAt: Date;
    error?: string;
  }> = [];

  for (const item of categories) {
    const startedAt = new Date();
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await getArchiveRowsForCategory(item, startAt, endAt);
      const fileName = formatArchiveFileName(item);
      const generatedAt = new Date();
      const workbook = buildArchiveWorkbook(
        rows,
        item === "ip-security" ? "ip-security" : item === "server-logs" ? "server-logs" : "analytics",
        {
          category: item,
          recordsCount: rows.length,
          retentionDays,
          generatedAt,
        },
      );
      const buffer = await workbook.xlsx.writeBuffer();
      const archiveFile = await uploadArchiveFile(item, Buffer.from(buffer), fileName);
      const completedAt = new Date();
      const jobId = await recordArchiveJob(
        runId,
        item,
        startedAt,
        completedAt,
        "success",
        rows.length,
        archiveFile.fileName,
        ARCHIVE_BUCKET_NAME,
        undefined,
        Buffer.byteLength(buffer),
      );
      results.push({
        jobId,
        category: item,
        status: "success",
        fileName: archiveFile.fileName,
        publicUrl: archiveFile.publicUrl,
        fileSizeBytes: Buffer.byteLength(buffer),
        recordsCount: rows.length,
        archivedAt: completedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown archive export error.";
      const failedAt = new Date();
      const fileName = formatArchiveFileName(item);
      const jobId = await recordArchiveJob(runId, item, startedAt, failedAt, "failed", rows.length, fileName, ARCHIVE_BUCKET_NAME, message);
      results.push({
        jobId,
        category: item,
        status: "failed",
        fileName,
        fileSizeBytes: null,
        recordsCount: rows.length,
        archivedAt: failedAt,
        error: message,
      });
    }
  }

  return {
    bucketName: ARCHIVE_BUCKET_NAME,
    runId,
    startAt,
    endAt,
    results,
    retentionDays,
  };
}

export async function getArchiveSettings(): Promise<ArchiveSettings> {
  const db = await getDb();
  const stored = await db.collection("settings").findOne({ key: ARCHIVE_SETTINGS_KEY });
  const storedRetention = Number(stored?.retentionDays);
  const retentionDays = ARCHIVE_RETENTION_OPTIONS.some((option) => option.days === storedRetention)
    ? storedRetention
    : ARCHIVE_RETENTION_DAYS;
  const category = ARCHIVE_CATEGORY_OPTIONS.find((option) => option.value === stored?.category)?.value ?? "all";

  return {
    enabled: typeof stored?.enabled === "boolean" ? stored.enabled : true,
    retentionDays,
    category,
  };
}

export async function updateArchiveSettings(settings: Partial<ArchiveSettings>): Promise<ArchiveSettings> {
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key: ARCHIVE_SETTINGS_KEY },
    { $set: { key: ARCHIVE_SETTINGS_KEY, ...settings, updatedAt: new Date() } },
    { upsert: true },
  );
  return getArchiveSettings();
}

export async function getArchiveSummary() {
  const db = await getDb();
  const archiveSettings = await db.collection("settings").findOne({ key: ARCHIVE_SETTINGS_KEY });
  const archiveJobs = await db.collection("archive_jobs").find({}).sort({ startedAt: -1 }).toArray();
  const latestJob = archiveJobs[0];
  const latestRunAt = archiveSettings?.lastRunAt ?? latestJob?.startedAt ?? null;
  const [filesResult, settings] = await Promise.allSettled([listArchiveFiles(), getArchiveSettings()]);
  if (settings.status === "rejected") throw settings.reason;
  const files = filesResult.status === "fulfilled" ? filesResult.value : [];
  const filesError = filesResult.status === "rejected"
    ? filesResult.reason instanceof Error ? filesResult.reason.message : "Unable to list archive files from the configured bucket."
    : undefined;
  if (filesError) console.error("Archive file listing failed:", filesError);

  return {
    bucketName: ARCHIVE_BUCKET_NAME,
    retentionDays: settings.value.retentionDays,
    category: settings.value.category,
    enabled: settings.value.enabled,
    lastRun: latestRunAt,
    nextRun: "Manual only",
    files: files.slice(0, 20),
    totalFiles: files.length,
    filesError,
    lastResults: archiveJobs.map((job) => ({
      jobId: job._id.toString(),
      category: job.jobType,
      status: job.status,
      fileName: job.fileName,
      fileSizeBytes: typeof job.fileSizeBytes === "number"
        ? job.fileSizeBytes
        : files.find((file) => file.key === job.fileName)?.size ?? null,
      recordsCount: job.recordsCount,
      archivedAt: job.completedAt ?? job.startedAt,
      error: job.error ?? undefined,
    })),
  };
}

export async function clearArchiveJob(jobId: import("mongodb").ObjectId): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection("archive_jobs").deleteOne({ _id: jobId });
  return result.deletedCount === 1;
}
