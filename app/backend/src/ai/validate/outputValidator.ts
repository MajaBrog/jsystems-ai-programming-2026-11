import { AssessmentProposalSchema, ChatEvaluationSchema, ImageAnalysisSchema } from '../domain/schemas.ts';
import type { AssessmentProposal, ChatEvaluation, ImageAnalysis, JustificationPoint } from '../domain/types.ts';
import type { z } from 'zod';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/**
 * Output is invalid (-> one repair call, ADR-002 D5) when: it does not match the schema (enums,
 * required fields), or violates the extra rules below. Rule ids: points citing ids missing from the
 * policy are tolerated (G6 drops them) unless no point is left.
 */

function parse<T>(schema: z.ZodType<T>, raw: unknown): { value: T } | { errors: string[] } {
  const result = schema.safeParse(raw);
  if (result.success) return { value: result.data };
  return { errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
}

function checkPoints(
  field: string,
  points: JustificationPoint[],
  ruleIds: ReadonlySet<string>,
  errors: string[],
): void {
  if (points.some((p) => p.text.trim() === '' || p.ruleId.trim() === '')) {
    errors.push(`${field}: every point needs non-empty ruleId and text`);
  }
  if (points.length > 0 && !points.some((p) => ruleIds.has(p.ruleId))) {
    errors.push(`${field}: no ruleId exists in the policy (known ids: ${[...ruleIds].join(', ')})`);
  }
}

function checkSteps(steps: string[], errors: string[], min: number, max: number): void {
  if (steps.length < min || steps.length > max) errors.push(`nextSteps: expected ${min} to ${max} items, got ${steps.length}`);
  if (steps.some((s) => s.trim() === '')) errors.push('nextSteps: items must not be blank');
}

export function validateImageAnalysis(raw: unknown): ValidationResult<ImageAnalysis> {
  const parsed = parse(ImageAnalysisSchema, raw);
  if ('errors' in parsed) return { ok: false, errors: parsed.errors };
  const v = parsed.value;
  const errors: string[] = [];
  if (!v.usable && v.unusableReason === null) errors.push('unusableReason: required when usable=false');
  if (v.observations.length > 800) errors.push(`observations: at most 800 characters, got ${v.observations.length}`);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: v };
}

export function validateAssessmentProposal(raw: unknown, ruleIds: ReadonlySet<string>): ValidationResult<AssessmentProposal> {
  const parsed = parse(AssessmentProposalSchema, raw);
  if ('errors' in parsed) return { ok: false, errors: parsed.errors };
  const v = parsed.value;
  const errors: string[] = [];
  if (v.justification.length < 1 || v.justification.length > 6) {
    errors.push(`justification: expected 1 to 6 items, got ${v.justification.length}`);
  }
  checkPoints('justification', v.justification, ruleIds, errors);
  checkSteps(v.nextSteps, errors, 1, 5);
  if (v.category === 'NEEDS_REVIEW' && v.unclearPoints.filter((s) => s.trim() !== '').length === 0) {
    errors.push('unclearPoints: required (non-empty) when category is NEEDS_REVIEW');
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: v };
}

export function validateChatEvaluation(raw: unknown, ruleIds: ReadonlySet<string>): ValidationResult<ChatEvaluation> {
  const parsed = parse(ChatEvaluationSchema, raw);
  if ('errors' in parsed) return { ok: false, errors: parsed.errors };
  const v = parsed.value;
  const errors: string[] = [];
  if (v.categoryChanged) {
    if (v.newCategory === null) errors.push('newCategory: required when categoryChanged=true');
    if (v.justification.length < 1) errors.push('justification: required when categoryChanged=true');
    checkPoints('justification', v.justification, ruleIds, errors);
    checkSteps(v.nextSteps, errors, 1, 5);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: v };
}
