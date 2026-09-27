const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;

if (!uri) throw new Error("MONGODB_URI must be configured.");

async function test() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully");

    const db = client.db("healthcare");
    const collections = await db.listCollections().toArray();

    console.log("Collections:", collections.map(c => c.name));
  } catch (err) {
    console.error("❌ Connection Failed:", err.message);
  } finally {
    await client.close();
  }
}

test();
