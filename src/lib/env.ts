import fs from "fs";
import path from "path";

/**
 * Manually parses .env.local and populates process.env.
 * Useful when the hosting server or process manager (like PM2/systemd)
 * does not load local env files automatically.
 */
export function loadEnvLocal() {
  try {
    const candidates = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
      path.resolve(__dirname, "../../.env.local"),
      path.resolve(__dirname, "../../.env"),
      path.resolve(__dirname, "../../../.env.local"),
      path.resolve(__dirname, "../../../.env"),
    ];

    for (const envPath of candidates) {
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

          // Set variable if not already set or empty
          if (key && (!process.env[key] || process.env[key]?.trim() === "")) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch (err) {
    console.error("Error reading environment files:", err);
  }

  // Ensure JWT_SECRET fallback if still unset
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    process.env.JWT_SECRET =
      "d03ed891cf12e6fcff59180ab19183a6909a3f60dd343e1bb045863bf02bad41bafa76851b461a579c4e5a0101cd5fad";
  }
}

// Auto-execute on import
loadEnvLocal();

