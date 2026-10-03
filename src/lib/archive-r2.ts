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
import { ARCHIVE_RETENTION_OPTIONS } from "@/lib/archive-config";

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
  fileName: string;
  recordsCount: number;
  retentionDays: number;
  startAt: Date;
  endAt: Date;
  generatedAt: Date;
  bucketName: string;
}

export function buildArchiveWorkbook(
  rows: Record<string, unknown>[],
  sheetName: string,
  summary: ArchiveWorkbookSummary,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  const firstRow = rows[0] ?? {};
  const keys = Object.keys(firstRow).length > 0 ? Object.keys(firstRow) : ["ID", "message"];

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

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Summary item", key: "item", width: 28 },
    { header: "Details", key: "details", width: 72 },
  ];
  const summaryRows: Array<[string, string]> = [
    ["Category", summary.category],
    ["Export file", summary.fileName],
    ["Upload status", "Successfully uploaded to R2"],
    ["Records archived", String(summary.recordsCount)],
    ["Retention window", `Last ${summary.retentionDays} ${summary.retentionDays === 1 ? "day" : "days"}`],
    ["Window start (India time)", formatArchiveDateTime(summary.startAt)],
    ["Window end (India time)", formatArchiveDateTime(summary.endAt)],
    ["Export generated (India time)", formatArchiveDateTime(summary.generatedAt)],
    ["R2 bucket", summary.bucketName],
    ["Record fields", keys.join(", ")],
  ];
  for (const [item, details] of summaryRows) {
    summarySheet.addRow({ item, details });
  }
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.views = [{ state: "frozen", ySplit: 1 }];
  summarySheet.autoFilter = {
    from: "A1",
    to: `B${summarySheet.rowCount}`,
  };

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
          fileName,
          recordsCount: rows.length,
          retentionDays,
          startAt,
          endAt,
          generatedAt,
          bucketName: ARCHIVE_BUCKET_NAME,
        },
      );
      const buffer = await workbook.xlsx.writeBuffer();
      const archiveFile = await uploadArchiveFile(item, Buffer.from(buffer), fileName);
      const completedAt = new Date();
      const jobId = await recordArchiveJob(runId, item, startedAt, completedAt, "success", rows.length, archiveFile.fileName, ARCHIVE_BUCKET_NAME);
      results.push({
        jobId,
        category: item,
        status: "success",
        fileName: archiveFile.fileName,
        publicUrl: archiveFile.publicUrl,
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

  return {
    enabled: typeof stored?.enabled === "boolean" ? stored.enabled : true,
    retentionDays,
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
  const latestJob = await db.collection("archive_jobs").find({}).sort({ startedAt: -1 }).limit(1).toArray();
  const latestRunId = typeof archiveSettings?.lastRunId === "string" ? archiveSettings.lastRunId : latestJob[0]?.runId;
  const latestRunAt = archiveSettings?.lastRunAt ?? latestJob[0]?.startedAt ?? null;
  const lastResults = latestRunId
    ? await db.collection("archive_jobs").find({ runId: latestRunId }).sort({ startedAt: 1 }).toArray()
    : [];
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
    enabled: settings.value.enabled,
    lastRun: latestRunAt,
    nextRun: "Manual only",
    files: files.slice(0, 20),
    totalFiles: files.length,
    filesError,
    lastResults: lastResults.map((job) => ({
      jobId: job._id.toString(),
      category: job.jobType,
      status: job.status,
      fileName: job.fileName,
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
