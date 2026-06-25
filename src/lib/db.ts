import "@/lib/env";
import { MongoClient, ServerApiVersion } from "mongodb";

// Hardcoded fallback URI for Vercel production (where .env.local is not uploaded).
// IMPORTANT: Also add MONGODB_URI in Vercel Project → Settings → Environment Variables.
const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://healthcare:1994%40prashant@cluster0.ry3iuxp.mongodb.net/healthcare?retryWrites=true&w=majority&appName=Cluster0";

// MongoClient options tuned for Vercel serverless and MongoDB Atlas TLS compatibility
const mongoOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,            // false allows $count in aggregations
    deprecationErrors: true,
  },
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
};

let cachedClient: MongoClient | null = null;
let cachedClientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      const client = new MongoClient(MONGO_URI, mongoOptions);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    return globalWithMongo._mongoClientPromise;
  }

  // In production mode (Vercel), cache at module scope.
  if (!cachedClientPromise) {
    cachedClient = new MongoClient(MONGO_URI, mongoOptions);
    cachedClientPromise = cachedClient.connect();
  }
  return cachedClientPromise;
}

export async function getDb(dbName = "healthcare") {
  const connection = await getClientPromise();
  return connection.db(dbName);
}

export default getClientPromise;
