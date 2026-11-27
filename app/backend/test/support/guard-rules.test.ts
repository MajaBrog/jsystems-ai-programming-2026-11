import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/persistence/database.ts';
import { checkPersistedGuardRules } from './guard-rules.ts';

// TAC-002-02: persisted assessments are re-evaluated against the date guard rules (G1 return
// 14 days, G3 complaint 2 years) independently of PolicyGuard. Synthetic rows only.
async function db() {
  return openDatabase(await mkdtemp(join(tmpdir(), 'guard-')));
}
function insertCase(d: ReturnType<typeof openDatabase>, id: string, type: string, purchase: string, category: string) {
  d.prepare(`INSERT INTO cases (id, case_type, device_category, model_name, purchase_date, description, photo_path, image_analysis_json, current_category, vision_model, decision_model, created_at)
    VALUES (?, ?, 'LAPTOP', 'Model testowy', ?, NULL, 'uploads/x.jpg', '{}', ?, 'm', 'm', '2026-11-26T10:00:00.000Z')`).run(id, type, purchase, category);
  d.prepare(`INSERT INTO assessments (case_id, category, previous_category, source, justification_json, next_steps_json, guard_applied, created_at)
    VALUES (?, ?, NULL, 'INITIAL', '[]', '[]', NULL, '2026-11-26T10:00:00.000Z')`).run(id, category);
}

describe('checkPersistedGuardRules (TAC-002-02)', () => {
  it('accepts compliant rows (ACCEPT within limits, REJECT beyond them)', async () => {
    const d = await db();
    insertCase(d, 'a1', 'RETURN', '2026-11-12', 'ACCEPT'); // exactly 14 days
    insertCase(d, 'a2', 'RETURN', '2026-10-01', 'REJECT');
    insertCase(d, 'a3', 'COMPLAINT', '2024-11-26', 'ACCEPT'); // exactly 2 years
    expect(checkPersistedGuardRules(d, { returnDays: 14, complaintYears: 2 })).toEqual([]);
  });

  it('detects an ACCEPT that violates G1 or G3 (controlled mutation)', async () => {
    const d = await db();
    insertCase(d, 'b1', 'RETURN', '2026-11-11', 'ACCEPT'); // 15 days
    insertCase(d, 'b2', 'COMPLAINT', '2024-11-25', 'ACCEPT'); // 2 years + 1 day
    const v = checkPersistedGuardRules(d, { returnDays: 14, complaintYears: 2 });
    expect(v).toHaveLength(2);
    expect(v.join('\n')).toMatch(/b1.*G1/);
    expect(v.join('\n')).toMatch(/b2.*G3/);
  });
});
