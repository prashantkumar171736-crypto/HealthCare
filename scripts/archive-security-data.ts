import "@/lib/env";
import { runArchiveExport } from "@/lib/archive-r2";

async function main() {
  try {
    const retentionDays = Number(process.env.ARCHIVE_RETENTION_DAYS || "30");
    const result = await runArchiveExport("all", retentionDays);
    console.log("Archive export completed.", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Archive export failed:", error);
    process.exitCode = 1;
  }
}

void main();
