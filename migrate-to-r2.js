/**
 * migrate-to-r2.js
 *
 * ONE-TIME migration script:
 * - Reads all documents from MongoDB "uploads" collection (base64 images)
 * - Uploads each one to Cloudflare R2
 * - Scans all content collections (diseases, posts, library, tips) and
 *   replaces old /api/admin/upload/<id> URLs with new R2 CDN URLs
 * - Optionally deletes the old "uploads" collection to free ~240 MB
 *
 * Usage:
 *   node migrate-to-r2.js
 *
 * Add --dry-run flag to preview without making changes:
 *   node migrate-to-r2.js --dry-run
 *
 * Add --delete-old to remove the uploads collection after migration:
 *   node migrate-to-r2.js --delete-old
 */

const fs = require("fs");
const path = require("path");

// Load .env.local if exists
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      process.env[key.trim()] = vals.join("=").trim();
    }
  }
}

const { MongoClient } = require("mongodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

// ── Config ────────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const DRY_RUN = process.argv.includes("--dry-run");
const DELETE_OLD = process.argv.includes("--delete-old");

// Collections that store HTML content with image URLs
const CONTENT_COLLECTIONS = ["diseases", "posts", "library", "tips", "faq", "settings"];

// ── R2 Client ─────────────────────────────────────────────────────────────────
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function uploadBufferToR2(buffer, mimeType, originalExt) {
  const ext = originalExt || "jpg";
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const key = `uploads/${Date.now()}-${randomSuffix}.${ext}`;

  if (!DRY_RUN) {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  }

  return `${R2_PUBLIC_URL}/${key}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function bytesToMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("🚀  MongoDB → Cloudflare R2 Migration");
  console.log("═".repeat(60));
  if (DRY_RUN) console.log("⚠️  DRY RUN MODE — no changes will be made\n");
  if (DELETE_OLD) console.log("🗑️  DELETE OLD enabled — uploads collection will be dropped\n");

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("✅ Connected to MongoDB Atlas\n");

  const db = client.db("healthcare");
  const uploadsColl = db.collection("uploads");

  // Step 1: Count uploads
  const total = await uploadsColl.countDocuments({});
  console.log(`📦 Found ${total} images in MongoDB uploads collection`);

  if (total === 0) {
    console.log("✅ Nothing to migrate!");
    await client.close();
    return;
  }

  // Step 2: Migrate each upload to R2
  console.log("\n" + "─".repeat(60));
  console.log("📤 Uploading images to Cloudflare R2...\n");

  const urlMap = new Map(); // mongoId → r2Url
  let success = 0, failed = 0, totalBytes = 0;

  const cursor = uploadsColl.find({});
  let i = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    i++;
    const mongoId = doc._id.toString();
    const mimeType = doc.mimeType || "image/jpeg";
    const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";
    const dataSizeBytes = doc.data ? Math.round(doc.data.length * 0.75) : 0;
    totalBytes += dataSizeBytes;

    process.stdout.write(`  [${i}/${total}] ${doc.filename || mongoId} (${bytesToMB(dataSizeBytes)} MB)... `);

    try {
      const buffer = Buffer.from(doc.data, "base64");
      const r2Url = await uploadBufferToR2(buffer, mimeType, ext);
      urlMap.set(mongoId, r2Url);
      success++;
      console.log(`✅ → ${r2Url.split("/").pop()}`);
    } catch (err) {
      failed++;
      console.log(`❌ Failed: ${err.message}`);
    }

    // Small delay to avoid rate limiting
    await sleep(100);
  }

  console.log(`\n  ✅ Uploaded: ${success}/${total}`);
  if (failed > 0) console.log(`  ❌ Failed: ${failed}`);
  console.log(`  💾 Total data migrated: ${bytesToMB(totalBytes)} MB`);

  // Step 3: Update content collections — replace old URLs with R2 URLs
  console.log("\n" + "─".repeat(60));
  console.log("🔄 Updating content collections with new R2 URLs...\n");

  let totalDocsUpdated = 0;

  for (const collName of CONTENT_COLLECTIONS) {
    const coll = db.collection(collName);
    const docs = await coll.find({}).toArray();
    let collUpdated = 0;

    for (const doc of docs) {
      let docStr = JSON.stringify(doc);
      let modified = false;

      for (const [mongoId, r2Url] of urlMap.entries()) {
        const oldUrl = `/api/admin/upload/${mongoId}`;
        if (docStr.includes(oldUrl)) {
          docStr = docStr.replaceAll(oldUrl, r2Url);
          modified = true;
        }
      }

      if (modified) {
        const updated = JSON.parse(docStr);
        const { _id, ...fields } = updated;
        if (!DRY_RUN) {
          await coll.updateOne({ _id: doc._id }, { $set: fields });
        }
        collUpdated++;
        totalDocsUpdated++;
        console.log(`  [${collName}] Updated: ${doc.name || doc.title || doc._id}`);
      }
    }

    if (collUpdated === 0) {
      console.log(`  [${collName}] No image references found`);
    }
  }

  console.log(`\n  📝 Total documents updated: ${totalDocsUpdated}`);

  // Step 4: Optionally delete the old uploads collection
  if (DELETE_OLD && !DRY_RUN) {
    console.log("\n" + "─".repeat(60));
    console.log("🗑️  Dropping uploads collection from MongoDB...");
    await db.collection("uploads").drop();
    console.log(`  ✅ Dropped! ~${bytesToMB(totalBytes)} MB freed from MongoDB Atlas`);
  }

  // Step 5: Summary
  console.log("\n" + "═".repeat(60));
  console.log("✅  MIGRATION COMPLETE!");
  console.log("═".repeat(60));
  console.log(`  Images migrated  : ${success}/${total}`);
  console.log(`  Docs updated     : ${totalDocsUpdated}`);
  console.log(`  Space freed      : ~${bytesToMB(totalBytes)} MB from MongoDB`);
  if (!DELETE_OLD) {
    console.log(`\n  💡 To free MongoDB space, run with --delete-old flag:`);
    console.log(`     node migrate-to-r2.js --delete-old`);
  }
  console.log("═".repeat(60) + "\n");

  await client.close();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
