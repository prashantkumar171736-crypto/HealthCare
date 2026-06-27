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
const defaultUsername = "kumar.pk6342@gmail.com";
const defaultPassword = "P7@xN4!Lm9#Qv2$Tr8^Hy5&Bk1*Zw6Cf3%Ud0!Js8@Rp2#Xe7$Mn5^Lt9&Wq4";

async function run() {
  const db = await getDb();
  
  // 1. Create/update the new admin user
  await createAdmin(defaultUsername, defaultPassword);
  
  // 2. Delete the old "admin" user if it exists to clean up
  const result = await db.collection("admins").deleteOne({ username: "admin" });
  if (result.deletedCount > 0) {
    console.log("Successfully removed old 'admin' user from the database.");
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error updating admin:", err);
    process.exit(1);
  });

