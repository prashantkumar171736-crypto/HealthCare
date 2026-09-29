const { EJSON, MongoClient } = require("mongodb");
const crypto = require("crypto");
require("dotenv").config({ path: ".env.local" });
const { gzipSync } = require("zlib");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const ARCHIVE_BATCH_SIZE = 100;

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Set MONGODB_URI in the environment before running this script.");
  const pseudonymSecret = process.env.IP_RATE_LIMIT_SECRET;
  if (!pseudonymSecret) throw new Error("Set IP_RATE_LIMIT_SECRET before running this script.");

  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    const db = client.db("healthcare");
    const analytics = db.collection("analytics");
    const ipCache = db.collection("ip_cache");
    const legacyVisitorId = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{64})$/i;
    const recordsToMinimize = {
      $or: [
        { ip: { $exists: true } },
        { sessionId: { $not: legacyVisitorId } },
      ],
    };
    const [analyticsWithIp, cachedIps] = await Promise.all([
      analytics.countDocuments({ ip: { $exists: true } }),
      ipCache.countDocuments({}),
    ]);
    const analyticsToMinimize = await analytics.countDocuments(recordsToMinimize);

    console.log(`Analytics records with raw IP: ${analyticsWithIp}`);
    console.log(`Analytics records needing visitor-ID/IP cleanup: ${analyticsToMinimize}`);
    console.log(`Raw-IP GeoIP cache records: ${cachedIps}`);
    const shouldArchive = process.argv.includes("--archive");
    const shouldApply = process.argv.includes("--apply");
    const archiveConfig = shouldArchive ? createSecurityR2Client() : null;
    if (shouldArchive) {
      const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}`;
      console.log(`R2 IP archive run: ${runId}`);
      const archivedAnalytics = await archiveCollection(
        analytics,
        "analytics",
        { ip: { $exists: true } },
        archiveConfig,
        runId
      );
      console.log(`Archived analytics records: ${archivedAnalytics}`);
      const archivedCache = await archiveCollection(ipCache, "ip_cache", {}, archiveConfig, runId);
      console.log(`Archived raw-IP GeoIP cache records: ${archivedCache}`);
    }
    if (!shouldApply) {
      console.log(shouldArchive
        ? "Archive complete. MongoDB records were not changed. Add --apply to archive first, then minimize/delete the records."
        : "Dry run only. Back up the database, then rerun with -- --apply to remove these records.");
      return;
    }

    let updatedRecords = 0;
    const cursor = analytics.find(recordsToMinimize, { projection: { _id: 1, sessionId: 1, ip: 1 } });
    let operations = [];
    for await (const record of cursor) {
      const oldVisitorId = typeof record.sessionId === "string" ? record.sessionId : crypto.randomUUID();
      const sessionId = legacyVisitorId.test(oldVisitorId)
        ? crypto.createHmac("sha256", pseudonymSecret).update(`analytics-legacy:${oldVisitorId}`).digest("hex")
        : oldVisitorId;
      operations.push({
        updateOne: {
          filter: { _id: record._id },
          update: { $set: { sessionId }, $unset: { ip: "" } },
        },
      });
      if (operations.length === 250) {
        const result = await analytics.bulkWrite(operations, { ordered: false });
        updatedRecords += result.modifiedCount;
        operations = [];
      }
    }
    if (operations.length) {
      const result = await analytics.bulkWrite(operations, { ordered: false });
      updatedRecords += result.modifiedCount;
    }
    const cacheResult = await ipCache.deleteMany({});
    console.log(`Minimized analytics records: ${updatedRecords}`);
    console.log(`Deleted raw-IP GeoIP cache records: ${cacheResult.deletedCount}`);
  } finally {
    await client.close();
  }
}

function createSecurityR2Client() {
  const accountId = process.env.R2_SECURITY_ACCOUNT_ID;
  const accessKeyId = process.env.R2_SECURITY_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECURITY_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_SECURITY_BUCKET_NAME;
  const encryptionKey = process.env.R2_SECURITY_ENCRYPTION_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Set R2_SECURITY_ACCOUNT_ID, R2_SECURITY_ACCESS_KEY_ID, R2_SECURITY_SECRET_ACCESS_KEY, and R2_SECURITY_BUCKET_NAME to archive IP data.");
  }
  if (!encryptionKey || !/^[a-f0-9]{64}$/i.test(encryptionKey)) {
    throw new Error("Set R2_SECURITY_ENCRYPTION_KEY to a 64-character hex-encoded AES-256 key to archive IP data.");
  }

  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucketName,
    encryptionKey: Buffer.from(encryptionKey, "hex"),
  };
}

async function archiveCollection(collection, collectionName, filter, config, runId) {
  const cursor = collection.find(filter);
  let batch = [];
  let batchNumber = 0;
  let archivedRecords = 0;

  async function uploadBatch() {
    if (!batch.length) return;
    const archivedAt = new Date();
    const lines = batch.map((document) => EJSON.stringify({
      sourceCollection: collectionName,
      archivedAt,
      document,
    }, { relaxed: false }));
    const compressed = gzipSync(Buffer.from(lines.join("\n")));
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", config.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const encrypted = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    const key = `ip-archive/${runId}/${collectionName}/${String(batchNumber).padStart(6, "0")}.ndjson.gz.enc`;

    await config.client.send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: encrypted,
      ContentType: "application/octet-stream",
      Metadata: { format: "aes-256-gcm-gzip-ndjson-v1" },
    }));
    archivedRecords += batch.length;
    batchNumber++;
    batch = [];
  }

  for await (const document of cursor) {
    batch.push(document);
    if (batch.length >= ARCHIVE_BATCH_SIZE) await uploadBatch();
  }
  await uploadBatch();
  return archivedRecords;
}
main().catch((error) => {
  console.error("Analytics IP minimization failed:", error.message);
  process.exitCode = 1;
});