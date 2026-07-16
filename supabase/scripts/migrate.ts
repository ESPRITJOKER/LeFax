/**
 * Applies supabase/migrations/*.sql to SUPABASE_DB_URL in filename order,
 * tracking what's already been applied in a schema_migrations table.
 * Exists so the team can ship schema changes without installing the
 * Supabase CLI, Docker, or psql locally (none are available on this box).
 *
 * Usage:
 *   pnpm db:migrate         # apply pending migrations
 *   pnpm --filter @lefax/supabase seed   # also run seed.sql (idempotent)
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..", "..");

// apps/api/.env is where SUPABASE_DB_URL is expected to live.
config({ path: join(rootDir, "apps", "api", ".env") });
config({ path: join(rootDir, ".env"), override: false });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error(
    "SUPABASE_DB_URL is not set. Copy .env.example to apps/api/.env and fill it in " +
      "(Supabase dashboard -> Settings -> Database -> Connection string -> URI)."
  );
  process.exit(1);
}

const migrationsDir = join(rootDir, "supabase", "migrations");
const runSeed = process.argv.includes("--seed");

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const { rows } = await client.query<{ filename: string }>("select filename from schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (filename) values ($1)", [file]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    if (runSeed) {
      const seedPath = join(rootDir, "supabase", "seed.sql");
      console.log("apply seed.sql");
      await client.query(readFileSync(seedPath, "utf8"));
    }

    console.log("done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
