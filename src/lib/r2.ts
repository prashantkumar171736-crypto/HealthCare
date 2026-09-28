import "@/lib/env";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import crypto from "crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "healthcare-uploads";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://pub-8ded07f2075a43daaa93fc2d473091fb.r2.dev";

/**
 * Cloudflare R2 client (S3-compatible API).
 * Reads from environment variables with fallback credentials for serverless environments.
 */
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be configured.");
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      maxAttempts: 1,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 1500,
        requestTimeout: 2000,
      }),
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

/**
 * Uploads a file buffer to Cloudflare R2 and returns the public CDN URL.
 */
export async function uploadToR2(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  const ext = originalName.split(".").pop() || "bin";
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const key = `uploads/${Date.now()}-${randomSuffix}.${ext}`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  // New upload changes the stats, so drop the cache
  r2StatsCache = null;

  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Deletes a file from R2 by its public URL.
 */
export async function deleteFromR2(publicUrl: string): Promise<void> {
  try {
    const baseUrl = R2_PUBLIC_URL;
    const key = publicUrl.replace(`${baseUrl}/`, "");
    if (!key || key === publicUrl) return;

    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    // Deleted file changes the stats, so drop the cache
    r2StatsCache = null;
  } catch (err) {
    console.error("deleteFromR2: failed to delete", publicUrl, err);
  }
}

export interface R2Stats {
  status: "Connected" | "Offline";
  error?: string;
  pingTimeMs: number;
  bucketName: string;
  publicUrl: string;
  totalObjects: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  totalSizeGB: number;
  freeTierLimitGB: number;
  freeTierUsedPct: number;
  freeTierRemainingGB: number;
}

// In-memory cache (per serverless instance; resets on cold start)
let r2StatsCache: { at: number; data: R2Stats } | null = null;
const R2_STATS_TTL_MS = 10 * 60 * 1000; // 10 minutes
const R2_LISTING_DEADLINE_MS = 4000;

function describeR2Error(error: unknown): string {
  const err = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = err?.Code || err?.code || err?.name || "UnknownError";
  const status = err?.$metadata?.httpStatusCode;

  if (code === "AccessDenied" || status === 403) return "Access denied; check R2 token permissions.";
  if (code === "NoSuchBucket" || status === 404) return "Bucket not found; check R2_BUCKET_NAME.";
  if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch" || status === 401) {
    return "R2 rejected the credentials (HTTP 401). Check that the access key ID and secret are a matching R2 S3 API token pair.";
  }
  if (/timeout|timedout|abort/i.test(code)) return "R2 request timed out.";
  if (code === "Error" && /must be configured/i.test((error as Error).message || "")) {
    return "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY is missing.";
  }
  return `R2 request failed (${status ? `HTTP ${status}, ` : ""}${code}).`;
}

/**
 * Compiles R2 storage monitoring metrics.
 *
 * - Status comes from a lightweight HeadBucket call (fast), so the card shows
 *   "Connected" even when the full object listing is slow.
 * - Object count / size come from a ListObjectsV2 scan, cached for 10 minutes.
 * - If anything fails, the last cached stats are returned when available.
 */
export async function getR2Stats(): Promise<R2Stats> {
  const start = Date.now();
  const bucketName = R2_BUCKET_NAME;
  const publicUrl = R2_PUBLIC_URL;
  const freeTierLimitGB = 10;

  const emptyStats = (
    status: R2Stats["status"],
    pingTimeMs: number,
    error?: string
  ): R2Stats => ({
    status,
    error,
    pingTimeMs,
    bucketName,
    publicUrl,
    totalObjects: 0,
    totalSizeBytes: 0,
    totalSizeMB: 0,
    totalSizeGB: 0,
    freeTierLimitGB,
    freeTierUsedPct: 0,
    freeTierRemainingGB: freeTierLimitGB,
  });

  // Fresh cache: return immediately
  if (r2StatsCache && Date.now() - r2StatsCache.at < R2_STATS_TTL_MS) {
    return r2StatsCache.data;
  }

  // 1) Lightweight connectivity check
  let pingTimeMs = 0;
  try {
    await getR2Client().send(new HeadBucketCommand({ Bucket: bucketName }));
    pingTimeMs = Date.now() - start;
  } catch (err) {
    console.error("getR2Stats HeadBucket failed:", err);
    const error = describeR2Error(err);
    return r2StatsCache
      ? { ...r2StatsCache.data, status: "Offline", error }
      : emptyStats("Offline", 0, error);
  }

  // 2) Object listing (slow), limited by a deadline
  try {
    let totalObjects = 0;
    let totalSizeBytes = 0;
    let continuationToken: string | undefined = undefined;
    let iterations = 0;
    const deadline = start + R2_LISTING_DEADLINE_MS;

    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const response = await getR2Client().send(command);

      if (response.Contents) {
        totalObjects += response.Contents.length;
        for (const item of response.Contents) {
          totalSizeBytes += item.Size || 0;
        }
      }
      continuationToken = response.NextContinuationToken;
      iterations++;
    } while (continuationToken && iterations < 5 && Date.now() < deadline);

    const totalSizeMB = parseFloat((totalSizeBytes / (1024 * 1024)).toFixed(2));
    const totalSizeGB = parseFloat((totalSizeBytes / (1024 * 1024 * 1024)).toFixed(3));
    const freeTierBytes = freeTierLimitGB * 1024 * 1024 * 1024;
    const freeTierUsedPct = parseFloat(((totalSizeBytes / freeTierBytes) * 100).toFixed(2));
    const freeTierRemainingGB = parseFloat((freeTierLimitGB - totalSizeGB).toFixed(3));

    const data: R2Stats = {
      status: "Connected",
      pingTimeMs,
      bucketName,
      publicUrl,
      totalObjects,
      totalSizeBytes,
      totalSizeMB,
      totalSizeGB,
      freeTierLimitGB,
      freeTierUsedPct,
      freeTierRemainingGB,
    };

    r2StatsCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error("getR2Stats listing failed:", err);
    // HeadBucket passed, so R2 is reachable; only the numbers are unavailable
    const error = describeR2Error(err);
    return r2StatsCache
      ? { ...r2StatsCache.data, error }
      : emptyStats("Connected", pingTimeMs, error);
  }
}
