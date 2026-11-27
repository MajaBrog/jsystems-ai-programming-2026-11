import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type { AssessmentSource, Category } from './types.ts';

export type Justification = { ruleId: string; text: string };

export type NewAssessment = {
  caseId: string;
  category: Category;
  previousCategory: Category | null;
  source: AssessmentSource;
  justification: Justification[];
  nextSteps: string[];
  /** Guard rule ids (e.g. ['G1']) or null; stored comma-separated (ADR-003 §4). */
  guardApplied: string[] | null;
  createdAt: string;
};
export type AssessmentRecord = NewAssessment & { id: number };

export type AssessmentRepository = {
  /** Returns the generated id. */
  insert(record: NewAssessment): number;
  findByCase(caseId: string): AssessmentRecord[];
};

function toAssessment(row: Record<string, SQLOutputValue>): AssessmentRecord {
  const guard = row.guard_applied as string | null;
  return {
    id: Number(row.id),
    caseId: row.case_id as string,
    category: row.category as Category,
    previousCategory: row.previous_category as Category | null,
    source: row.source as AssessmentSource,
    justification: JSON.parse(row.justification_json as string) as Justification[],
    nextSteps: JSON.parse(row.next_steps_json as string) as string[],
    guardApplied: guard ? guard.split(',') : null,
    createdAt: row.created_at as string,
  };
}

export function createAssessmentRepository(db: DatabaseSync): AssessmentRepository {
  const insert = db.prepare(
    `INSERT INTO assessments (case_id, category, previous_category, source, justification_json, next_steps_json,
       guard_applied, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const findByCase = db.prepare('SELECT * FROM assessments WHERE case_id = ? ORDER BY created_at, id');
  return {
    insert(r) {
      const guard = r.guardApplied && r.guardApplied.length > 0 ? r.guardApplied.join(',') : null;
      const result = insert.run(
        r.caseId, r.category, r.previousCategory, r.source,
        JSON.stringify(r.justification), JSON.stringify(r.nextSteps), guard, r.createdAt,
      );
      return Number(result.lastInsertRowid);
    },
    findByCase(caseId) {
      return findByCase.all(caseId).map(toAssessment);
    },
  };
}
