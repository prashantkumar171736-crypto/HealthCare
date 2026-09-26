const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://healthcare:1994%40prashant@cluster0.ry3iuxp.mongodb.net/healthcare?retryWrites=true&w=majority&appName=Cluster0";

function toMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
function toKB(bytes) {
  return (bytes / 1024).toFixed(2) + " KB";
}
function bar(usedMB, totalMB = 512, width = 30) {
  const pct = Math.min(usedMB / totalMB, 1);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const color = pct > 0.85 ? "\x1b[31m" : pct > 0.6 ? "\x1b[33m" : "\x1b[32m";
  return `${color}[${"█".repeat(filled)}${"░".repeat(empty)}]\x1b[0m ${(pct * 100).toFixed(1)}%`;
}

async function checkStorage() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("\n\x1b[32m✅ Connected to MongoDB Atlas\x1b[0m\n");
    console.log("═".repeat(60));

    const db = client.db("healthcare");
    const adminDb = client.db("admin");

    // ── 1. Overall DB Stats ────────────────────────────────────
    const dbStats = await db.command({ dbStats: 1, scale: 1 });

    const dataSizeMB   = dbStats.dataSize   / (1024 * 1024);
    const storageSizeMB= dbStats.storageSize/ (1024 * 1024);
    const indexSizeMB  = dbStats.indexSize  / (1024 * 1024);
    const totalUsedMB  = storageSizeMB + indexSizeMB;
    const atlasFreeLimit = 512; // MB
    const remainingMB  = atlasFreeLimit - totalUsedMB;

    console.log("\x1b[1m\x1b[36m📊  MONGODB ATLAS — STORAGE REPORT\x1b[0m");
    console.log("═".repeat(60));
    console.log(`\n  Atlas Free Tier Limit : 512 MB`);
    console.log(`  Storage Used (data)   : \x1b[33m${toMB(dbStats.storageSize)}\x1b[0m`);
    console.log(`  Index Size            : \x1b[33m${toMB(dbStats.indexSize)}\x1b[0m`);
    console.log(`  Total Occupied        : \x1b[31m${totalUsedMB.toFixed(2)} MB\x1b[0m`);
    console.log(`  Remaining Free Space  : \x1b[32m${remainingMB.toFixed(2)} MB\x1b[0m`);
    console.log(`  Actual Data Size      : ${toMB(dbStats.dataSize)} (uncompressed)`);
    console.log(`  Avg Object Size       : ${toKB(dbStats.avgObjSize || 0)}`);
    console.log(`  Total Documents       : \x1b[36m${(dbStats.objects || 0).toLocaleString()}\x1b[0m`);
    console.log(`  Total Collections     : ${dbStats.collections || 0}`);
    console.log(`  Total Indexes         : ${dbStats.indexes || 0}`);
    console.log(`\n  Usage Meter : ${bar(totalUsedMB, atlasFreeLimit)}\n`);

    if (remainingMB < 50) {
      console.log("  \x1b[31m⚠️  CRITICAL: Less than 50 MB remaining! Migrate soon.\x1b[0m\n");
    } else if (remainingMB < 150) {
      console.log("  \x1b[33m⚠️  WARNING: Less than 150 MB remaining.\x1b[0m\n");
    }

    // ── 2. Per-Collection Breakdown ────────────────────────────
    console.log("═".repeat(60));
    console.log("\x1b[1m\x1b[36m📁  PER-COLLECTION BREAKDOWN\x1b[0m");
    console.log("═".repeat(60));

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (collectionNames.length === 0) {
      console.log("  No collections found.");
    } else {
      const rows = [];

      for (const name of collectionNames) {
        try {
          const stats = await db.command({ collStats: name, scale: 1 });
          rows.push({
            name,
            count:       stats.count        || 0,
            dataSize:    stats.size          || 0,
            storageSize: stats.storageSize   || 0,
            indexSize:   stats.totalIndexSize|| 0,
            avgObjSize:  stats.avgObjSize    || 0,
            indexes:     stats.nindexes      || 0,
          });
        } catch (e) {
          rows.push({ name, count: 0, dataSize: 0, storageSize: 0, indexSize: 0, avgObjSize: 0, indexes: 0 });
        }
      }

      // Sort by storageSize desc
      rows.sort((a, b) => b.storageSize - a.storageSize);

      const nameW = Math.max(20, ...rows.map(r => r.name.length)) + 2;

      // Header
      console.log(
        "\n  " +
        "Collection".padEnd(nameW) +
        "Docs".padStart(10) +
        "Data Size".padStart(14) +
        "Storage".padStart(12) +
        "Index Size".padStart(13) +
        "Avg Doc".padStart(12) +
        "Indexes".padStart(9)
      );
      console.log("  " + "─".repeat(nameW + 10 + 14 + 12 + 13 + 12 + 9));

      for (const r of rows) {
        const storMB = r.storageSize / (1024 * 1024);
        const pct = ((r.storageSize / Math.max(dbStats.storageSize, 1)) * 100).toFixed(1);
        const colColor = storMB > 50 ? "\x1b[31m" : storMB > 10 ? "\x1b[33m" : "\x1b[0m";

        console.log(
          "  " +
          `${colColor}${r.name.padEnd(nameW)}\x1b[0m` +
          r.count.toLocaleString().padStart(10) +
          toMB(r.dataSize).padStart(14) +
          `${colColor}${toMB(r.storageSize).padStart(12)}\x1b[0m` +
          toMB(r.indexSize).padStart(13) +
          toKB(r.avgObjSize).padStart(12) +
          r.indexes.toString().padStart(9) +
          `  (${pct}%)`
        );
      }

      console.log("");

      // Top space consumers
      console.log("═".repeat(60));
      console.log("\x1b[1m\x1b[36m🔥  TOP SPACE CONSUMERS\x1b[0m");
      console.log("═".repeat(60));
      const top = rows.slice(0, 5);
      top.forEach((r, i) => {
        const storMB = (r.storageSize / (1024 * 1024)).toFixed(2);
        const idxMB  = (r.indexSize   / (1024 * 1024)).toFixed(2);
        const pct    = ((r.storageSize / Math.max(dbStats.storageSize, 1)) * 100).toFixed(1);
        console.log(`\n  ${i + 1}. \x1b[1m${r.name}\x1b[0m`);
        console.log(`     Documents : ${r.count.toLocaleString()}`);
        console.log(`     Data Size : ${storMB} MB  (${pct}% of total)`);
        console.log(`     Index Size: ${idxMB} MB`);
        console.log(`     Avg Doc   : ${toKB(r.avgObjSize)}`);
        console.log(`     ${bar(parseFloat(storMB), atlasFreeLimit, 25)}`);
      });
    }

    // ── 3. All Databases on the cluster ───────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("\x1b[1m\x1b[36m🗂️   ALL DATABASES ON YOUR CLUSTER\x1b[0m");
    console.log("═".repeat(60));
    try {
      const dbList = await adminDb.command({ listDatabases: 1, nameOnly: false });
      if (dbList && dbList.databases) {
        dbList.databases.forEach(d => {
          console.log(`  \x1b[36m${d.name}\x1b[0m  →  ${toMB(d.sizeOnDisk || 0)}`);
        });
        const clusterTotal = dbList.totalSize || 0;
        console.log(`\n  Cluster Total : \x1b[33m${toMB(clusterTotal)}\x1b[0m`);
      }
    } catch {
      console.log("  (Cluster-level stats require Atlas admin role)");
    }

    console.log("\n" + "═".repeat(60));
    console.log("\x1b[32m✅  Scan Complete!\x1b[0m\n");

  } catch (err) {
    console.error("\n\x1b[31m❌ Error:\x1b[0m", err.message);
  } finally {
    await client.close();
  }
}

checkStorage();
