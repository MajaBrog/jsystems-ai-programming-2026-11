import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type { MessageRole } from './types.ts';

export type NewMessage = {
  caseId: string;
  role: MessageRole;
  content: string;
  assessmentId: number | null;
  createdAt: string;
};
export type MessageRecord = NewMessage & { id: number };

export type MessageRepository = {
  /** Returns the generated id. */
  insert(record: NewMessage): number;
  findByCase(caseId: string): MessageRecord[];
};

function toMessage(row: Record<string, SQLOutputValue>): MessageRecord {
  return {
    id: Number(row.id),
    caseId: row.case_id as string,
    role: row.role as MessageRole,
    content: row.content as string,
    assessmentId: row.assessment_id === null ? null : Number(row.assessment_id),
    createdAt: row.created_at as string,
  };
}

export function createMessageRepository(db: DatabaseSync): MessageRepository {
  const insert = db.prepare(
    'INSERT INTO messages (case_id, role, content, assessment_id, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const findByCase = db.prepare('SELECT * FROM messages WHERE case_id = ? ORDER BY created_at, id');
  return {
    insert(r) {
      return Number(insert.run(r.caseId, r.role, r.content, r.assessmentId, r.createdAt).lastInsertRowid);
    },
    findByCase(caseId) {
      return findByCase.all(caseId).map(toMessage);
    },
  };
}
