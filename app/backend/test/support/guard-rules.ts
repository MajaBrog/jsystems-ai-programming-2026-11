import type { DatabaseSync } from 'node:sqlite';

type Limits = { returnDays: number; complaintYears: number };
type Row = { case_id: string; case_type: string; purchase_date: string; category: string; created_at: string };

const DAY_MS = 86_400_000;

function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y + years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0); // 29 Feb -> 28 Feb
  return target.toISOString().slice(0, 10);
}

/**
 * TAC-002-02: re-evaluates every persisted assessment against the hard date rules, with raw SQL and
 * an independent implementation (not PolicyGuard): an ACCEPT must not exist for a RETURN older than
 * `returnDays` (G1) or a COMPLAINT older than `complaintYears` (G3) at the assessment date.
 */
export function checkPersistedGuardRules(db: DatabaseSync, limits: Limits): string[] {
  const rows = db
    .prepare(
      `SELECT a.case_id, c.case_type, c.purchase_date, a.category, a.created_at
       FROM assessments a JOIN cases c ON c.id = a.case_id ORDER BY a.case_id, a.id`,
    )
    .all() as Row[];
  const violations: string[] = [];
  for (const r of rows) {
    if (r.category !== 'ACCEPT') continue;
    const assessedOn = r.created_at.slice(0, 10);
    if (r.case_type === 'RETURN') {
      const days = Math.round((Date.parse(assessedOn) - Date.parse(r.purchase_date)) / DAY_MS);
      if (days > limits.returnDays) violations.push(`${r.case_id}: ACCEPT on a return ${days} days after purchase (G1)`);
    } else if (assessedOn > addYears(r.purchase_date, limits.complaintYears)) {
      violations.push(`${r.case_id}: ACCEPT on a complaint older than ${limits.complaintYears} years (G3)`);
    }
  }
  return violations;
}
