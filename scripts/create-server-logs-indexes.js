require("dotenv").config({ path: ".env.local" });

const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGODB_URI;
const retentionDays = Number.parseInt(process.env.SERVER_LOG_RETENTION_DAYS || "30", 10);

async function main() {
  if (!MONGO_URI) throw new Error("MONGODB_URI must be configured.");
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error("SERVER_LOG_RETENTION_DAYS must be a positive integer.");
  }

  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const collection = client.db("healthcare").collection("server_logs");
    await collection.createIndex({ createdAt: -1 }, { name: "server_logs_createdAt_desc" });
    await collection.createIndex({ level: 1, createdAt: -1 }, { name: "server_logs_level_createdAt" });
    await collection.createIndex(
      { createdAt: 1 },
      {
        name: "server_logs_createdAt_ttl",
        expireAfterSeconds: retentionDays * 24 * 60 * 60,
      },
    );
    console.log(`Server log indexes created. TTL retention: ${retentionDays} days.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Failed to create server log indexes:", error);
  process.exitCode = 1;
});