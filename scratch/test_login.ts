import { getDb } from "../src/lib/db";
import crypto from "crypto";

async function verifyLogin(username: string, password: string): Promise<boolean> {
  const db = await getDb();
  const admin = await db.collection("admins").findOne({ username });

  let isValid = false;

  if (admin) {
    if (admin.passwordHash && admin.salt) {
      const hash = crypto
        .pbkdf2Sync(password, admin.salt, 10000, 64, "sha512")
        .toString("hex");
      if (hash === admin.passwordHash) {
        isValid = true;
      }
    }
  } else {
    const adminCount = await db.collection("admins").countDocuments();
    if (adminCount === 0) {
      const expectedUsername = process.env.ADMIN_USERNAME || "admin";
      const expectedPassword = process.env.ADMIN_PASSWORD || "admin";
      if (username === expectedUsername && password === expectedPassword) {
        isValid = true;
      }
    }
  }
  return isValid;
}

async function test() {
  console.log("Testing with valid DB credentials (admin / admin)...");
  const test1 = await verifyLogin("admin", "admin");
  console.log("Result:", test1 ? "SUCCESS" : "FAILED");

  console.log("Testing with invalid DB credentials (admin / wrongpass)...");
  const test2 = await verifyLogin("admin", "wrongpass");
  console.log("Result:", test2 ? "FAILED" : "SUCCESS (Rejected)");

  console.log("Testing with non-existent user...");
  const test3 = await verifyLogin("nonexistent", "somepass");
  console.log("Result:", test3 ? "FAILED" : "SUCCESS (Rejected)");
}

test()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
