/**
 * Run this script once from your local machine to create indexes
 * that make the analytics queries fast on MongoDB Atlas.
 * 
 * Usage: node scripts/create-indexes.js
 */
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGODB_URI ||
  "mongodb+srv://healthcare:1994%40prashant@cluster0.ry3iuxp.mongodb.net/healthcare?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");
    const db = client.db("healthcare");
    const analytics = db.collection("analytics");

    // Index on timestamp (most critical — used in every query)
    await analytics.createIndex({ timestamp: -1 });
    console.log("✅ Index created: analytics.timestamp");

    // Compound index for session uniqueness queries
    await analytics.createIndex({ timestamp: -1, sessionId: 1 });
    console.log("✅ Index created: analytics.timestamp + sessionId");

    // Index for country breakdown
    await analytics.createIndex({ timestamp: -1, country: 1 });
    console.log("✅ Index created: analytics.timestamp + country");

    // Index for page breakdown
    await analytics.createIndex({ timestamp: -1, path: 1 });
    console.log("✅ Index created: analytics.timestamp + path");

    // Telemetry index
    await db.collection("system_telemetry").createIndex({ createdAt: -1 });
    console.log("✅ Index created: system_telemetry.createdAt");

    console.log("\n🎉 All indexes created! Analytics queries will now be much faster.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
  }
}

main();
