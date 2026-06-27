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

// Load default credentials from environment or fallback
const defaultUsername = process.env.ADMIN_USERNAME || "admin";
const defaultPassword = process.env.ADMIN_PASSWORD || "admin";

createAdmin(defaultUsername, defaultPassword)
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error creating admin:", err);
    process.exit(1);
  });
