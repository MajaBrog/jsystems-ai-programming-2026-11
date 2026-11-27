import type { AssessmentRepository, CaseRecord, CaseRepository, MessageRepository } from '../persistence/index.ts';

export const CASE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `GET /api/cases/{id}` body (ADR-001 §4). The stored image analysis is deliberately not part of it. */
export function buildCaseView(
  record: CaseRecord,
  assessmentRepo: AssessmentRepository,
  messageRepo: MessageRepository,
) {
  const assessments = assessmentRepo.findByCase(record.id);
  const categoryById = new Map(assessments.map((a) => [a.id, a.category]));
  return {
    id: record.id,
    caseType: record.caseType,
    deviceCategory: record.deviceCategory,
    modelName: record.modelName,
    purchaseDate: record.purchaseDate,
    description: record.description,
    photoUrl: `/api/cases/${record.id}/photo`,
    currentCategory: record.currentCategory,
    assessments: assessments.map((a) => ({
      category: a.category,
      previousCategory: a.previousCategory,
      source: a.source,
      justification: a.justification,
      nextSteps: a.nextSteps,
      createdAt: a.createdAt,
    })),
    messages: messageRepo.findByCase(record.id).map((m) => {
      const category = m.assessmentId === null ? undefined : categoryById.get(m.assessmentId);
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        ...(category ? { assessmentCategory: category } : {}),
      };
    }),
    createdAt: record.createdAt,
  };
}

export type CaseRepositories = { cases: CaseRepository; assessments: AssessmentRepository; messages: MessageRepository };
