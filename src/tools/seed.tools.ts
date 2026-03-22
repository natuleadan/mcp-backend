import { z } from "zod";
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

async function runDir(dir: string, label: string): Promise<string> {
  const files = collectSqlFiles(dir);
  const results: string[] = [];
  for (const file of files) {
    const sql = fs.readFileSync(file, "utf8");
    await runSql(sql);
    results.push(path.relative(dir, file));
  }
  return `✅ ${label}: ${results.length} files executed.\n${results.join("\n")}`;
}

export const seedTools = [
  {
    name: "run_base_seed",
    description: "Runs all SQL files in base/ (02-base equivalent with real natuleadan company data)",
    inputSchema: z.object({}),
    handler: async () => runDir(config.baseDir, "base seed"),
  },
  {
    name: "run_data_seed",
    description: "Runs all SQL files in data/ (03-data.ee equivalent with real users, products, courses)",
    inputSchema: z.object({}),
    handler: async () => runDir(config.dataDir, "data seed"),
  },
  {
    name: "run_all_seeds",
    description: "Runs base seed then data seed in order",
    inputSchema: z.object({}),
    handler: async () => {
      const base = await runDir(config.baseDir, "base seed");
      const data = await runDir(config.dataDir, "data seed");
      return `${base}\n\n${data}`;
    },
  },
  {
    name: "list_seed_files",
    description: "Lists all SQL files available in base/ and data/",
    inputSchema: z.object({
      target: z.enum(["base", "data", "all"]).default("all"),
    }),
    handler: async ({ target }: { target: string }) => {
      const lines: string[] = [];
      if (target !== "data") {
        const files = collectSqlFiles(config.baseDir);
        lines.push("=== base/ ===");
        lines.push(...files.map(f => path.relative(config.baseDir, f)));
      }
      if (target !== "base") {
        const files = collectSqlFiles(config.dataDir);
        lines.push("=== data/ ===");
        lines.push(...files.map(f => path.relative(config.dataDir, f)));
      }
      return lines.join("\n");
    },
  },
];
