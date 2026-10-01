import "@/lib/env";
import {
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";

export const ARCHIVE_BUCKET_NAME = process.env.R2_IP_SECURITY_BUCKET_NAME || "healthcare-ip-security";
export const ARCHIVE_PUBLIC_URL = process.env.R2_IP_SECURITY_PUBLIC_URL || process.env.R2_UPLOADS_PUBLIC_URL || "https://pub-8ded07f2075a43daaa93fc2d473091fb.r2.dev";
export const ARCHIVE_RETENTION_DAYS = Number(process.env.ARCHIVE_RETENTION_DAYS || "30");

const ARCHIVE_ACCOUNT_ID = process.env.R2_UPLOADS_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const ARCHIVE_ACCESS_KEY_ID = process.env.R2_UPLOADS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const ARCHIVE_SECRET_ACCESS_KEY = process.env.R2_UPLOADS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

export type ArchiveCategory = "analytics" | "ip-security" | "server-logs";

let archiveClient: S3Client | null = null;

function getArchiveClient(): S3Client {
  if (!ARCHIVE_ACCOUNT_ID || !ARCHIVE_ACCESS_KEY_ID || !ARCHIVE_SECRET_ACCESS_KEY) {
    throw new Error("R2_UPLOADS_ACCOUNT_ID, R2_UPLOADS_ACCESS_KEY_ID, and R2_UPLOADS_SECRET_ACCESS_KEY must be configured for archive export.");
  }

  if (!archiveClient) {
    archiveClient = new S3Client({
      region: "auto",
      endpoint: `https://${ARCHIVE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      maxAttempts: 1,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 1500,
        requestTimeout: 2000,
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
  return `${category}-archive-${dateStamp}.xls`;
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

function buildWorkbook(rows: Record<string, unknown>[], sheetName: string): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  const firstRow = rows[0] ?? {};
  const keys = Object.keys(firstRow).length > 0 ? Object.keys(firstRow) : ["message"];

  sheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: Math.max(18, key.length + 8),
  }));

  for (const row of rows) {
    const normalized: Record<string, unknown> = {};
    for (const key of keys) {
      normalized[key] = safeValue((row as Record<string, unknown>)[key]);
    }
    sheet.addRow(normalized);
  }

  sheet.getRow(1).font = { bold: true };
  return workbook;
}

async function getAnalyticsArchiveRows(cutoff: Date): Promise<Record<string, unknown>[]> {
  const db = await getDb();
  const rows = await db.collection("analytics").find({ timestamp: { $lt: cutoff } }).sort({ timestamp: 1 }).toArray();

  return rows.map((row) => ({
    path: row.path ?? "",
    referrer: row.referrer ?? "",
    userAgent: row.userAgent ?? "",
    sessionId: row.sessionId ?? "",
    country: row.country ?? "",
    region: row.region ?? "",
    city: row.city ?? "",
    timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : "",
  }));
}

async function getIpSecurityArchiveRows(cutoff: Date): Promise<Record<string, unknown>[]> {
  const db = await getDb();

  const [blockedIps, failedAttempts] = await Promise.all([
    db.collection("admin_ip_blocks").find({ blockedAt: { $lt: cutoff } }).sort({ blockedAt: 1 }).toArray(),
    db.collection("admin_login_attempts").find({ createdAt: { $lt: cutoff } }).sort({ createdAt: 1 }).toArray(),
  ]);

  const blockRows = blockedIps.map((row) => ({
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
  return [{
    timestamp: new Date().toISOString(),
    level: "info",
    message: "No persisted server log archive is currently stored by this application. Add a durable log writer if server logs must be archived to R2.",
  }];
}

async function getArchiveRowsForCategory(category: ArchiveCategory, cutoff: Date): Promise<Record<string, unknown>[]> {
  switch (category) {
    case "analytics":
      return getAnalyticsArchiveRows(cutoff);
    case "ip-security":
      return getIpSecurityArchiveRows(cutoff);
    case "server-logs":
      return getServerLogsArchiveRows();
    default:
      return [];
  }
}

export async function listArchiveFiles(): Promise<Array<{ key: string; size: number; lastModified: string }>> {
  try {
    const response = await getArchiveClient().send(new ListObjectsV2Command({
      Bucket: ARCHIVE_BUCKET_NAME,
      MaxKeys: 100,
    }));

    return (response.Contents ?? []).map((item) => ({
      key: item.Key ?? "",
      size: item.Size ?? 0,
      lastModified: item.LastModified ? item.LastModified.toISOString() : "",
    }));
  } catch (error) {
    return [];
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

export async function uploadArchiveFile(category: ArchiveCategory, buffer: Buffer): Promise<{ fileName: string; publicUrl: string }> {
  const fileName = formatArchiveFileName(category);

  await getArchiveClient().send(new PutObjectCommand({
    Bucket: ARCHIVE_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: "application/vnd.ms-excel",
    CacheControl: "private, max-age=3600",
  }));

  return {
    fileName,
    publicUrl: `${ARCHIVE_PUBLIC_URL}/${fileName}`,
  };
}

export async function recordArchiveJob(jobType: ArchiveCategory, startedAt: Date, completedAt: Date, status: "success" | "failed", recordsCount: number, fileName: string, bucketName: string, error?: string) {
  const db = await getDb();
  await db.collection("archive_jobs").insertOne({
    jobType,
    startedAt,
    completedAt,
    status,
    recordsCount,
    fileName,
    bucketName,
    error: error ?? null,
    createdAt: new Date(),
  });
}

export async function runArchiveExport(category: ArchiveCategory | "all" = "all", retentionDays = ARCHIVE_RETENTION_DAYS) {
  const categories: ArchiveCategory[] = category === "all"
    ? ["analytics", "ip-security", "server-logs"]
    : [category];

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const results: Array<{ category: ArchiveCategory; status: "success" | "failed"; fileName?: string; publicUrl?: string; recordsCount: number; error?: string }> = [];

  for (const item of categories) {
    const startedAt = new Date();
    try {
      const rows = await getArchiveRowsForCategory(item, cutoff);
      const workbook = buildWorkbook(rows, item === "ip-security" ? "ip-security" : item === "server-logs" ? "server-logs" : "analytics");
      const buffer = await workbook.xlsx.writeBuffer();
      const archiveFile = await uploadArchiveFile(item, Buffer.from(buffer));
      await recordArchiveJob(item, startedAt, new Date(), "success", rows.length, archiveFile.fileName, ARCHIVE_BUCKET_NAME);
      results.push({
        category: item,
        status: "success",
        fileName: archiveFile.fileName,
        publicUrl: archiveFile.publicUrl,
        recordsCount: rows.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown archive export error.";
      const failedAt = new Date();
      await recordArchiveJob(item, startedAt, failedAt, "failed", 0, formatArchiveFileName(item), ARCHIVE_BUCKET_NAME, message);
      results.push({
        category: item,
        status: "failed",
        recordsCount: 0,
        error: message,
      });
    }
  }

  return {
    bucketName: ARCHIVE_BUCKET_NAME,
    results,
    retentionDays,
  };
}

export async function getArchiveSummary() {
  const db = await getDb();
  const latestJob = await db.collection("archive_jobs").find({}).sort({ startedAt: -1 }).limit(1).toArray();
  const files = await listArchiveFiles();

  return {
    bucketName: ARCHIVE_BUCKET_NAME,
    retentionDays: ARCHIVE_RETENTION_DAYS,
    enabled: true,
    lastRun: latestJob[0]?.startedAt ?? null,
    nextRun: "Monthly (default schedule)",
    files: files.slice(0, 20),
    totalFiles: files.length,
  };
}
