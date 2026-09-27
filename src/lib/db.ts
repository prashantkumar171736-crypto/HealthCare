import "@/lib/env";
import { MongoClient, ServerApiVersion } from "mongodb";

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
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI must be configured.");
  }

  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      const client = new MongoClient(mongoUri, mongoOptions);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    return globalWithMongo._mongoClientPromise;
  }

  // In production mode (Vercel), cache at module scope.
  if (!cachedClientPromise) {
    cachedClient = new MongoClient(mongoUri, mongoOptions);
    cachedClientPromise = cachedClient.connect();
  }
  return cachedClientPromise;
}

export async function getDb(dbName = "healthcare") {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be configured.");
  }
  const connection = await getClientPromise();
  return connection.db(dbName);
}

export default getClientPromise;
