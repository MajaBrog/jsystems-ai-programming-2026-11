import { z } from 'zod';
import {
  CATEGORIES,
  CONFIDENCES,
  DAMAGE_TYPES,
  LIKELY_CAUSES,
  UNUSABLE_REASONS,
} from './types.ts';

// JSON-schema friendly (feeds zodResponseFormat in T13): no transforms, no refinements,
// no min/max constraints (strict structured outputs do not support them) and every field
// required, optional values expressed with .nullable(). Sizes/lengths are enforced by
// outputValidator (ADR-002 §3.3).

const JustificationPointSchema = z.object({
  ruleId: z.string().describe('Id of a rule that exists in the attached policy, e.g. Z-2.1 or R-4.1'),
  text: z.string().describe('Polish explanation of how the rule applies'),
});

export const ImageAnalysisSchema = z.object({
  usable: z.boolean().describe('false when the photo cannot be assessed'),
  unusableReason: z.enum(UNUSABLE_REASONS).nullable().describe('Required when usable is false, otherwise null'),
  deviceVisible: z.boolean(),
  matchesCategory: z.boolean(),
  damageVisible: z.boolean(),
  damageTypes: z.array(z.enum(DAMAGE_TYPES)).describe('Empty when no damage is visible'),
  signsOfUse: z.boolean(),
  resalableAsNew: z.boolean(),
  likelyCause: z.enum(LIKELY_CAUSES),
  confidence: z.enum(CONFIDENCES),
  observations: z.string().describe('Polish, at most 800 characters: what is visible, no speculation'),
});

export const AssessmentProposalSchema = z.object({
  category: z.enum(CATEGORIES),
  justification: z.array(JustificationPointSchema).describe('1 to 6 points'),
  nextSteps: z.array(z.string()).describe('1 to 5 Polish steps'),
  unclearPoints: z.array(z.string()).describe('Polish; non-empty when category is NEEDS_REVIEW'),
  contradictions: z.array(z.string()).describe('Polish; contradictions between form and photo'),
});

export const ChatEvaluationSchema = z.object({
  categoryChanged: z.boolean(),
  newCategory: z.enum(CATEGORIES).nullable().describe('Required when categoryChanged is true, otherwise null'),
  justification: z.array(JustificationPointSchema).describe('Required when changed, otherwise empty'),
  nextSteps: z.array(z.string()).describe('Required when changed, otherwise empty'),
  contradictions: z.array(z.string()),
  offTopic: z.boolean(),
});
