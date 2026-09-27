import { getDb } from "../src/lib/db";
import crypto from "crypto";

async function createAdmin(username: string, password: string) {
  const db = await getDb();
  const adminsCollection = db.collection("admins");

  // Check if admin already exists
  const existing = await adminsCollection.findOne({ username });
  if (existing) {
    console.log(`Admin user "${username}" already exists. Updating password...`);
  }

  // Generate salt and hash
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");

  // Insert or update admin details
  await adminsCollection.updateOne(
    { username },
    {
      $set: {
        username,
        passwordHash: hash,
        salt,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      }
    },
    { upsert: true }
  );

  console.log(`Successfully saved admin user "${username}" to MongoDB database.`);
}

async function run() {
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password || username.toLowerCase() === "admin") {
    throw new Error("Set ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD; username cannot be admin.");
  }

  const db = await getDb();

  await createAdmin(username, password);
  const result = await db.collection("admins").deleteMany({ username: /^admin$/i });
  if (result.deletedCount > 0) {
    console.log("Successfully removed old 'admin' user from the database.");
  }
  await db.collection("admin_sessions").deleteMany({});
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error updating admin:", err);
    process.exit(1);
  });

