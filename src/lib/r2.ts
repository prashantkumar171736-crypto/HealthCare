import "@/lib/env";
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import crypto from "crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "0a3cbe6f17e4c7af5282f6ea74a15943";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "ac0e90071f79e3b4dcb9ac3d02cbe98e";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "6367dc023915612f4568d30734e691389175eb6db79ba94fcf8099950883a425";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "healthcare-uploads";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://pub-8ded07f2075a43daaa93fc2d473091fb.r2.dev";

/**
 * Cloudflare R2 client (S3-compatible API).
 * Reads from environment variables with fallback credentials for serverless environments.
 */
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

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

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

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

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
  } catch (err) {
    console.error("deleteFromR2: failed to delete", publicUrl, err);
  }
}

export interface R2Stats {
  status: "Connected" | "Offline";
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

/**
 * Queries Cloudflare R2 bucket to compile real-time storage monitoring metrics.
 * Wrapped with a 3-second timeout to prevent stalling the dashboard response.
 */
export async function getR2Stats(): Promise<R2Stats> {
  const start = Date.now();
  const bucketName = R2_BUCKET_NAME;
  const publicUrl = R2_PUBLIC_URL;
  const freeTierLimitGB = 10;

  const fetchPromise = (async (): Promise<R2Stats> => {
    let totalObjects = 0;
    let totalSizeBytes = 0;
    let continuationToken: string | undefined = undefined;
    let iterations = 0;

    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const response = await r2Client.send(command);

      if (response.Contents) {
        totalObjects += response.Contents.length;
        for (const item of response.Contents) {
          totalSizeBytes += item.Size || 0;
        }
      }
      continuationToken = response.NextContinuationToken;
      iterations++;
    } while (continuationToken && iterations < 5); // Cap iterations to prevent long runtimes

    const pingTimeMs = Date.now() - start;
    const totalSizeMB = parseFloat((totalSizeBytes / (1024 * 1024)).toFixed(2));
    const totalSizeGB = parseFloat((totalSizeBytes / (1024 * 1024 * 1024)).toFixed(3));
    const freeTierBytes = freeTierLimitGB * 1024 * 1024 * 1024;
    const freeTierUsedPct = parseFloat(((totalSizeBytes / freeTierBytes) * 100).toFixed(2));
    const freeTierRemainingGB = parseFloat((freeTierLimitGB - totalSizeGB).toFixed(3));

    return {
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
  })();

  const timeoutPromise = new Promise<R2Stats>((resolve) =>
    setTimeout(
      () =>
        resolve({
          status: "Offline",
          pingTimeMs: 0,
          bucketName,
          publicUrl,
          totalObjects: 0,
          totalSizeBytes: 0,
          totalSizeMB: 0,
          totalSizeGB: 0,
          freeTierLimitGB: 10,
          freeTierUsedPct: 0,
          freeTierRemainingGB: 10,
        }),
      2500
    )
  );

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    console.error("getR2Stats failed:", err);
    return {
      status: "Offline",
      pingTimeMs: Date.now() - start,
      bucketName,
      publicUrl,
      totalObjects: 0,
      totalSizeBytes: 0,
      totalSizeMB: 0,
      totalSizeGB: 0,
      freeTierLimitGB: 10,
      freeTierUsedPct: 0,
      freeTierRemainingGB: 10,
    };
  }
}
