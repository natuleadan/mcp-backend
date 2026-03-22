import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { runSql } from "../db.js";

function collectSqlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSqlFiles(full));
    else if (entry.name.endsWith(".sql")) files.push(full);
  }
  return files.sort();
}

async function main() {
  console.log("📦 Running data seed (03-data.ee)...");
  const files = collectSqlFiles(config.dataDir);

  for (const file of files) {
    const sql = fs.readFileSync(file, "utf8");
    const rel = path.relative(config.dataDir, file);
    console.log(`  → ${rel}`);
    await runSql(sql);
  }
  console.log("✅ Data seed complete.");
}

main().catch(err => { console.error(err); process.exit(1); });
