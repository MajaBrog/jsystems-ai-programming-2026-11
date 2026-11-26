import type { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ADR-003 invariants I1-I4, checked with raw SQL (independent of the repositories).
 * Returns human-readable violations; an empty array means the database is consistent.
 * Call from any integration test with the db and the data dir it runs against.
 */
export function checkInvariants(db: DatabaseSync, dataDir: string): string[] {
  const violations: string[] = [];
  const cases = db.prepare('SELECT id, current_category, photo_path FROM cases ORDER BY id').all();

  for (const c of cases) {
    const id = String(c.id);

    // I1: >= 1 INITIAL assessment and >= 1 AGENT message linked to it (the first message).
    const initial = db
      .prepare("SELECT id FROM assessments WHERE case_id = ? AND source = 'INITIAL' ORDER BY id")
      .all(id);
    if (initial.length < 1) violations.push(`I1: case ${id} has no INITIAL assessment`);
    const first = db.prepare('SELECT role, assessment_id FROM messages WHERE case_id = ? ORDER BY id LIMIT 1').get(id);
    if (!first) violations.push(`I1: case ${id} has no messages`);
    else if (first.role !== 'AGENT') violations.push(`I1: first message of case ${id} is not AGENT`);
    else if (initial[0] && first.assessment_id !== initial[0].id) {
      violations.push(`I1: first message of case ${id} is not linked to the INITIAL assessment`);
    }

    // I2: current_category == category of the assessment with the highest id.
    const latest = db.prepare('SELECT category FROM assessments WHERE case_id = ? ORDER BY id DESC LIMIT 1').get(id);
    if (latest && latest.category !== c.current_category) {
      violations.push(`I2: case ${id} current_category ${String(c.current_category)} != latest assessment ${String(latest.category)}`);
    }

    // I3: after the first AGENT message, roles alternate CUSTOMER -> AGENT (written in pairs).
    const roles = db.prepare('SELECT role FROM messages WHERE case_id = ? ORDER BY id').all(id).map((m) => m.role);
    for (let i = 1; i < roles.length; i++) {
      const expected = i % 2 === 1 ? 'CUSTOMER' : 'AGENT';
      if (roles[i] !== expected) {
        violations.push(`I3: case ${id} message #${i + 1} is ${String(roles[i])}, expected ${expected}`);
        break;
      }
    }

    // I4: photo file exists.
    if (!existsSync(join(dataDir, String(c.photo_path)))) {
      violations.push(`I4: photo ${String(c.photo_path)} of case ${id} does not exist`);
    }
  }
  return violations;
}
