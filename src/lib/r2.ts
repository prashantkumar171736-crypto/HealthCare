import "@/lib/env";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

/**
 * Cloudflare R2 client (S3-compatible API).
 * All credentials are read from environment variables set in .env.local / Vercel.
 */
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * Uploads a file buffer to Cloudflare R2 and returns the public CDN URL.
 *
 * @param buffer    - Raw file bytes
 * @param originalName - Original filename (used to preserve extension)
 * @param mimeType  - MIME type (e.g. "image/jpeg")
 * @returns Permanent public CDN URL (e.g. https://pub-xxx.r2.dev/uploads/17xxx-photo.jpg)
 */
export async function uploadToR2(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  // Generate a unique filename: timestamp + random suffix + original extension
  const ext = originalName.split(".").pop() || "bin";
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const key = `uploads/${Date.now()}-${randomSuffix}.${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Long cache: images are immutable once uploaded (unique filename each time)
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  // Return the public Cloudflare CDN URL
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/**
 * Deletes a file from R2 by its public URL.
 * Extracts the R2 key from the URL and issues a DeleteObjectCommand.
 *
 * @param publicUrl - The full public CDN URL of the file to delete
 */
export async function deleteFromR2(publicUrl: string): Promise<void> {
  try {
    const baseUrl = process.env.R2_PUBLIC_URL!;
    const key = publicUrl.replace(`${baseUrl}/`, "");
    if (!key || key === publicUrl) return; // Not an R2 URL, skip

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
      })
    );
  } catch (err) {
    console.error("deleteFromR2: failed to delete", publicUrl, err);
  }
}
