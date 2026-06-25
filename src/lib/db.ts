import "@/lib/env";
import { MongoClient } from "mongodb";

// NOTE: Do NOT validate MONGODB_URI at module level — that would throw during
// Next.js build-time page data collection. Validate only at runtime inside getDb().

let cachedClient: MongoClient | null = null;
let cachedClientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  const uri =
    process.env.MONGODB_URI ||
    "mongodb+srv://healthcare:1994%40prashant@cluster0.ry3iuxp.mongodb.net/healthcare?retryWrites=true&w=majority&appName=Cluster0";

  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      const client = new MongoClient(uri);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    return globalWithMongo._mongoClientPromise;
  }

  // In production mode, cache at module scope.
  if (!cachedClientPromise) {
    cachedClient = new MongoClient(uri);
    cachedClientPromise = cachedClient.connect();
  }
  return cachedClientPromise;
}

export async function getDb(dbName = "healthcare") {
  const connection = await getClientPromise();
  return connection.db(dbName);
}

export default getClientPromise;
