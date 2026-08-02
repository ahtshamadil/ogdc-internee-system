import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

/**
 * Every query in the app goes through this module.
 *
 * node:sqlite ships inside Node (>= 22.5) so there is no native module to
 * compile on the machine this gets installed on -- that is the whole reason it
 * was chosen. It is still flagged experimental, so keeping all SQL behind this
 * seam means switching to better-sqlite3 later is a single-file change: both
 * expose the same prepare()/run()/get()/all() shape.
 */
const db = new DatabaseSync(config.dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

/** Rows as plain objects. */
export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/** First row, or undefined. */
export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

/** INSERT/UPDATE/DELETE -> { changes, lastInsertRowid }. */
export function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

export function exec(sql) {
  return db.exec(sql);
}

/** Run fn inside a transaction, rolling back on any throw. */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* the transaction was already unwound */
    }
    throw err;
  }
}

export function getSchemaVersion() {
  return db.prepare('PRAGMA user_version').get().user_version;
}

export function setSchemaVersion(version) {
  db.exec(`PRAGMA user_version = ${Number(version)}`);
}

/**
 * Consistent hot snapshot -- safe to call while the app is serving requests,
 * unlike copying the .db file out from under an open WAL.
 */
export async function backupTo(destPath) {
  const { backup } = await import('node:sqlite');
  await backup(db, destPath);
  return destPath;
}

export default db;
