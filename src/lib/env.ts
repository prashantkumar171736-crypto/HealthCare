import fs from "fs";
import path from "path";

/**
 * Manually parses .env.local and populates process.env.
 * Useful when the hosting server or process manager (like PM2/systemd)
 * does not load local env files automatically.
 */
export function loadEnvLocal() {
  // On Vercel or cloud serverless, environment variables are already injected in process.env.
  // Skipping filesystem operations prevents Turbopack NFT from tracing the workspace root into serverless function bundles.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
      process.env.JWT_SECRET =
        "d03ed891cf12e6fcff59180ab19183a6909a3f60dd343e1bb045863bf02bad41bafa76851b461a579c4e5a0101cd5fad";
    }
    return;
  }

  try {
    const cwd = /*turbopackIgnore: true*/ process.cwd();
    const envPath = path.join(/*turbopackIgnore: true*/ cwd, ".env.local");
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
  } catch (err) {
    // Non-fatal
  }

  // Ensure JWT_SECRET fallback if still unset
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    process.env.JWT_SECRET =
      "d03ed891cf12e6fcff59180ab19183a6909a3f60dd343e1bb045863bf02bad41bafa76851b461a579c4e5a0101cd5fad";
  }
}

// Auto-execute on import
loadEnvLocal();
