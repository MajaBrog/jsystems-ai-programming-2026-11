import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA_PATH = new URL('../../resources/schema.sql', import.meta.url);

/**
 * Opens (creating if needed) `{dataDir}/copilot.db`, applies the ADR-003 pragmas and
 * runs the idempotent schema. One connection per process (ADR-005).
 */
export function openDatabase(dataDir: string): DatabaseSync {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'copilot.db'));
  try {
    db.exec('PRAGMA foreign_keys=ON');
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA busy_timeout=5000');
    db.exec('PRAGMA synchronous=NORMAL');
    db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}
