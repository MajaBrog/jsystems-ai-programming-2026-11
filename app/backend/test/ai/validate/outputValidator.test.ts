import { describe, expect, it } from 'vitest';
import {
  validateAssessmentProposal,
  validateChatEvaluation,
  validateImageAnalysis,
} from '../../../src/ai/validate/outputValidator.ts';
import { loadPromptRepository } from '../../../src/ai/prompt/promptRepository.ts';
import { makeAnalysis, makeEvaluation, makeProposal } from '../support/fixtures.ts';

const ids = loadPromptRepository().ruleIds('RETURN');
const point = (ruleId = 'Z-7.1') => ({ ruleId, text: 'Tekst.' });

describe('validateImageAnalysis', () => {
  it('accepts a valid analysis', () => {
    expect(validateImageAnalysis(makeAnalysis()).ok).toBe(true);
  });
  it('rejects non-objects and wrong enums', () => {
    expect(validateImageAnalysis(null).ok).toBe(false);
    expect(validateImageAnalysis('text').ok).toBe(false);
    expect(validateImageAnalysis({ ...makeAnalysis(), confidence: 'ZERO' }).ok).toBe(false);
  });
  it('requires unusableReason when usable=false', () => {
    const r = validateImageAnalysis(makeAnalysis({ usable: false, unusableReason: null }));
    expect(r.ok).toBe(false);
    expect(validateImageAnalysis(makeAnalysis({ usable: false, unusableReason: 'BLURRED' })).ok).toBe(true);
  });
  it('limits observations to 800 chars', () => {
    expect(validateImageAnalysis(makeAnalysis({ observations: 'a'.repeat(800) })).ok).toBe(true);
    expect(validateImageAnalysis(makeAnalysis({ observations: 'a'.repeat(801) })).ok).toBe(false);
  });
});

describe('validateAssessmentProposal', () => {
  const v = (raw: unknown) => validateAssessmentProposal(raw, ids);
  it('accepts a valid proposal and returns it', () => {
    const r = v(makeProposal());
    expect(r.ok && r.value.category).toBe('ACCEPT');
  });
  it('rejects category outside the enum with a readable error', () => {
    const r = v({ ...makeProposal(), category: 'MAYBE' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('category');
  });
  it.each([
    ['0 justification points', { justification: [] }],
    ['7 justification points', { justification: Array.from({ length: 7 }, () => point()) }],
    ['0 next steps', { nextSteps: [] }],
    ['6 next steps', { nextSteps: ['1', '2', '3', '4', '5', '6'] }],
    ['blank next step', { nextSteps: ['  '] }],
    ['blank justification text', { justification: [{ ruleId: 'Z-7.1', text: ' ' }] }],
    ['NEEDS_REVIEW without unclear points', { category: 'NEEDS_REVIEW' as const, unclearPoints: [] }],
  ])('rejects %s', (_n, patch) => {
    expect(v(makeProposal(patch)).ok).toBe(false);
  });
  it('accepts 6 points and 5 steps', () => {
    expect(v(makeProposal({ justification: Array.from({ length: 6 }, () => point()), nextSteps: ['1', '2', '3', '4', '5'] })).ok).toBe(true);
  });
  it('accepts NEEDS_REVIEW with unclear points', () => {
    expect(v(makeProposal({ category: 'NEEDS_REVIEW', unclearPoints: ['Co jest niejasne.'] })).ok).toBe(true);
  });
  it('rejects when no cited rule id exists in the policy (G6 leaves nothing)', () => {
    expect(v(makeProposal({}, 'X-9.9')).ok).toBe(false);
  });
  it('tolerates a partly unknown id list (guard drops the unknown points)', () => {
    expect(v(makeProposal({ justification: [point('X-9.9'), point('Z-2.1')] })).ok).toBe(true);
  });
  it('a complaint rule id is unknown for the return policy', () => {
    expect(v(makeProposal({}, 'R-2.1')).ok).toBe(false);
  });
});

describe('validateChatEvaluation', () => {
  const v = (raw: unknown) => validateChatEvaluation(raw, ids);
  it('accepts an unchanged evaluation', () => {
    expect(v(makeEvaluation()).ok).toBe(true);
  });
  it('accepts a complete change', () => {
    expect(v(makeEvaluation({ categoryChanged: true, newCategory: 'REJECT', justification: [point('Z-6.1')], nextSteps: ['Krok.'] })).ok).toBe(true);
  });
  it.each([
    ['no newCategory', { newCategory: null, justification: [point()], nextSteps: ['k'] }],
    ['no justification', { newCategory: 'REJECT' as const, justification: [], nextSteps: ['k'] }],
    ['no next steps', { newCategory: 'REJECT' as const, justification: [point()], nextSteps: [] }],
    ['only unknown rule ids', { newCategory: 'REJECT' as const, justification: [point('X-1.1')], nextSteps: ['k'] }],
  ])('rejects a change with %s', (_n, patch) => {
    expect(v(makeEvaluation({ categoryChanged: true, ...patch })).ok).toBe(false);
  });
  it('rejects wrong enum', () => {
    expect(v({ ...makeEvaluation(), newCategory: 'MAYBE' }).ok).toBe(false);
  });
});
