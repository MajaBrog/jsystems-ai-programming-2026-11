import type { DatabaseSync } from 'node:sqlite';

/**
 * Runs `fn` in `BEGIN IMMEDIATE` ... `COMMIT`; any throw rolls back and is rethrown.
 * Repositories never open transactions themselves (ADR-003 §3). Not re-entrant.
 */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}
