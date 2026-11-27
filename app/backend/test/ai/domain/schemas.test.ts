import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AssessmentProposalSchema,
  ChatEvaluationSchema,
  ImageAnalysisSchema,
} from '../../../src/ai/domain/schemas.ts';
import { makeAnalysis, makeEvaluation, makeProposal } from '../support/fixtures.ts';

describe('structured output schemas (ADR-002 §3.3)', () => {
  it('accept valid fixtures', () => {
    expect(ImageAnalysisSchema.safeParse(makeAnalysis()).success).toBe(true);
    expect(AssessmentProposalSchema.safeParse(makeProposal()).success).toBe(true);
    expect(ChatEvaluationSchema.safeParse(makeEvaluation()).success).toBe(true);
  });

  it('reject values outside the enums', () => {
    expect(AssessmentProposalSchema.safeParse(makeProposal({ category: 'MAYBE' as never })).success).toBe(false);
    expect(ImageAnalysisSchema.safeParse(makeAnalysis({ confidence: 'ZERO' as never })).success).toBe(false);
    expect(ImageAnalysisSchema.safeParse(makeAnalysis({ damageTypes: ['HOLE' as never] })).success).toBe(false);
    expect(ImageAnalysisSchema.safeParse(makeAnalysis({ unusableReason: 'BLURRY' as never })).success).toBe(false);
  });

  it('require every field (null must be explicit)', () => {
    const { unusableReason: _omit, ...partial } = makeAnalysis();
    expect(ImageAnalysisSchema.safeParse(partial).success).toBe(false);
  });

  it.each([
    ['ImageAnalysis', ImageAnalysisSchema],
    ['AssessmentProposal', AssessmentProposalSchema],
    ['ChatEvaluation', ChatEvaluationSchema],
  ])('%s converts to JSON schema with all properties required', (_name, schema) => {
    const json = z.toJSONSchema(schema) as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(json.properties).sort()).toEqual([...json.required].sort());
  });
});
