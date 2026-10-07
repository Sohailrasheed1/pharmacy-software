import fs from 'fs';
import path from 'path';
import { db } from '../config/database.js';

export function runMigrations(database = db) {
  // Create migrations tracker table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const migrationsDir = path.resolve(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
    'migrations'
  );

  const appliedRows = database.prepare(`SELECT name FROM _migrations`).all() as { name: string }[];
  const appliedNames = new Set(appliedRows.map((r) => r.name));

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (!appliedNames.has(file)) {
      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      database.transaction(() => {
        database.exec(sql);
        database.prepare(`INSERT INTO _migrations (name) VALUES (?)`).run(file);
      })();
      console.log(`Applied: ${file}`);
    }
  }
}

// When called directly
if (process.argv[1]?.includes('migrate')) {
  try {
    runMigrations();
    console.log('All migrations executed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}
