const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://healthcare:1994%40prashant@cluster0.ry3iuxp.mongodb.net/healthcare?retryWrites=true&w=majority&appName=Cluster0";

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
