import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec, getSchemaVersion, setSchemaVersion } from './index.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Migrations are plain .sql files named NNN_description.sql, applied in order.
 * PRAGMA user_version tracks how far we have got -- no migration library and
 * no extra table needed.
 */
export function migrate({ verbose = true } = {}) {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const current = getSchemaVersion();
  let applied = 0;

  for (const file of files) {
    const version = Number(file.slice(0, 3));
    if (!Number.isInteger(version)) throw new Error(`Bad migration filename: ${file}`);
    if (version <= current) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // node:sqlite exec() runs a whole script, and DDL in SQLite is
    // transactional, so a failure part-way leaves nothing half-applied.
    exec(sql);
    setSchemaVersion(version);
    applied += 1;
    if (verbose) console.log(`[migrate] applied ${file}`);
  }

  if (verbose && applied === 0) console.log(`[migrate] schema already at version ${current}`);
  return { from: current, to: getSchemaVersion(), applied };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.js')) {
  migrate();
}
