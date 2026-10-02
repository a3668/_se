import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const migrationsDirectory = resolve(root, "migrations");
const dataDirectory = resolve(root, "data");

mkdirSync(dataDirectory, { recursive: true });

const db = new DatabaseSync(resolve(dataDirectory, "hw2.sqlite"));

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const filenames = readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  const applied = new Set(
    db.prepare("SELECT filename FROM schema_migrations")
      .all()
      .map((row) => row.filename as string),
  );

  let pending = 0;

  for (const filename of filenames) {
    if (applied.has(filename)) {
      console.log(`Skipping ${filename}`);
      continue;
    }

    pending++;
    console.log(`Applying ${filename}...`);

    try {
      const sql = readFileSync(resolve(migrationsDirectory, filename), "utf8");
      db.exec("BEGIN");
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)").run(filename);
      db.exec("COMMIT");
      console.log(`Applied ${filename}`);
    } catch (error: unknown) {
      if (db.isTransaction) db.exec("ROLLBACK");
      console.error(`Failed ${filename}:`, error);
      process.exitCode = 1;
      break;
    }
  }

  if (process.exitCode !== 1) {
    console.log(pending === 0 ? "No pending migrations." : "All migrations applied.");
  }
} finally {
  db.close();
}
