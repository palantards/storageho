import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

const fileFlagIndex = args.findIndex((arg) => arg === "--file");
const selectedFile =
  fileFlagIndex >= 0 && args[fileFlagIndex + 1]
    ? args[fileFlagIndex + 1]
    : null;

const connectionString =
  process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL_ADMIN or DATABASE_URL is not set");
}

const migrationsDir = path.resolve(process.cwd(), "supabase", "migrations");
if (!fs.existsSync(migrationsDir)) {
  throw new Error(`Migrations directory not found: ${migrationsDir}`);
}

let files = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

if (selectedFile) {
  files = files.filter((name) => name === selectedFile);
  if (files.length === 0) {
    throw new Error(
      `Could not find migration file '${selectedFile}' in ${migrationsDir}`,
    );
  }
}

if (files.length === 0) {
  console.log("No SQL migration files found in supabase/migrations.");
  process.exit(0);
}

console.log("Supabase-first migration runner");
console.log(`Target: ${isDryRun ? "dry-run" : "apply"}`);
console.log(`Migrations dir: ${migrationsDir}`);
console.log("Files:");
for (const file of files) {
  console.log(` - ${file}`);
}

if (isDryRun) {
  process.exit(0);
}

const client = new Client({ connectionString });

async function run() {
  await client.connect();

  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");

      console.log(`\nApplying ${file} ...`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
      console.log(`Applied ${file}`);
    }

    console.log("\nAll migrations applied successfully.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Migration failed:");
  console.error(error);
  process.exit(1);
});
