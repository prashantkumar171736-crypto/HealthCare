const { MongoClient } = require("mongodb");
const crypto = require("crypto");
require("dotenv").config({ path: ".env.local" });

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
    if (!process.argv.includes("--apply")) {
      console.log("Dry run only. Back up the database, then rerun with --apply to remove these records.");
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

main().catch((error) => {
  console.error("Analytics IP minimization failed:", error.message);
  process.exitCode = 1;
});