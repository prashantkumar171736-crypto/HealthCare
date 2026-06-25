import fs from "fs";
import path from "path";

/**
 * Manually parses .env.local and populates process.env.
 * Useful when the hosting server or process manager (like PM2/systemd)
 * does not load local env files automatically.
 */
export function loadEnvLocal() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const fileContent = fs.readFileSync(envPath, "utf-8");
      const lines = fileContent.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (trimmed.startsWith("#") || !trimmed.includes("=")) {
          continue;
        }

        const equalIndex = trimmed.indexOf("=");
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();

        // Strip quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.substring(1, value.length - 1);
        }

        // Set variable if not already set
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (err) {
    console.error("Error manually reading .env.local:", err);
  }
}

// Auto-execute on import
loadEnvLocal();
