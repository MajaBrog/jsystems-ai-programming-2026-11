import { randomUUID } from 'node:crypto';

export { openDatabase } from './database.ts';
export { transaction } from './transaction.ts';
export { createCaseRepository } from './case-repository.ts';
export type { CaseRecord, CaseRepository } from './case-repository.ts';
export { createAssessmentRepository } from './assessment-repository.ts';
export type { AssessmentRecord, AssessmentRepository, Justification, NewAssessment } from './assessment-repository.ts';
export { createMessageRepository } from './message-repository.ts';
export type { MessageRecord, MessageRepository, NewMessage } from './message-repository.ts';
export type { AssessmentSource, CaseType, Category, MessageRole } from './types.ts';

/** New case id: UUID v4, lowercase (ADR-003 §3). */
export function newCaseId(): string {
  return randomUUID();
}
