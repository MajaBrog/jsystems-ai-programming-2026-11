import { describe, expect, it } from 'vitest';
import type { AssessmentProposal, CaseType, Category, ImageAnalysis } from '../../../src/ai/domain/types.ts';
import {
  GuardInvalidOutputError,
  applyPolicyGuard,
  guardChatEvaluation,
} from '../../../src/ai/guard/policyGuard.ts';
import { loadPromptRepository } from '../../../src/ai/prompt/promptRepository.ts';
import { makeAnalysis, makeEvaluation, makeProposal } from '../support/fixtures.ts';

const repo = loadPromptRepository();
const TODAY = '2026-11-26';

function guard(
  caseType: CaseType,
  purchaseDate: string,
  proposal: AssessmentProposal,
  analysis: ImageAnalysis = makeAnalysis(),
) {
  return applyPolicyGuard({
    caseType,
    purchaseDate,
    today: TODAY,
    analysis,
    proposal,
    limits: repo.limits,
    ruleIds: repo.ruleIds(caseType),
  });
}
const cites = (r: { justification: { ruleId: string }[] }, id: string) =>
  r.justification.filter((j) => j.ruleId === id).length;

describe('G1 late return (AC-18)', () => {
  it('exactly 14 days keeps ACCEPT', () => {
    const r = guard('RETURN', '2026-11-12', makeProposal());
    expect(r.category).toBe('ACCEPT');
    expect(r.guardApplied).toEqual([]);
  });
  it('15 days turns ACCEPT into REJECT citing Z-2.1', () => {
    const r = guard('RETURN', '2026-11-11', makeProposal());
    expect(r.category).toBe('REJECT');
    expect(cites(r, 'Z-2.1')).toBe(1);
    expect(r.guardApplied).toContain('G1');
  });
});

describe('G2 return condition (AC-19)', () => {
  it.each([
    ['HIGH', 'REJECT'],
    ['MEDIUM', 'REJECT'],
    ['LOW', 'NEEDS_REVIEW'],
  ] as const)('signsOfUse with %s confidence -> %s', (confidence, expected) => {
    const r = guard('RETURN', '2026-11-20', makeProposal(), makeAnalysis({ signsOfUse: true, confidence }));
    expect(r.category).toBe(expected);
    expect(cites(r, 'Z-3.2')).toBe(1);
    expect(r.guardApplied).toContain('G2');
  });
  it('damageVisible only', () => {
    const r = guard('RETURN', '2026-11-20', makeProposal(), makeAnalysis({ damageVisible: true }));
    expect(r.category).toBe('REJECT');
    expect(cites(r, 'Z-3.1')).toBe(1);
  });
  it('LOW confidence downgrade gives the service team a point to check', () => {
    const r = guard('RETURN', '2026-11-20', makeProposal(), makeAnalysis({ signsOfUse: true, confidence: 'LOW' }));
    expect(r.unclearPoints.length).toBeGreaterThan(0);
  });
  it('does not apply to complaints', () => {
    const r = guard('COMPLAINT', '2026-11-20', makeProposal({}, 'R-7.1'), makeAnalysis({ damageVisible: true, signsOfUse: true }));
    expect(r.category).toBe('ACCEPT');
  });
});

describe('G3 old complaint (AC-20)', () => {
  it('exactly 2 years keeps ACCEPT', () => {
    const r = guard('COMPLAINT', '2024-11-26', makeProposal({}, 'R-7.1'));
    expect(r.category).toBe('ACCEPT');
  });
  it('2 years and 1 day turns ACCEPT into REJECT with R-2.1', () => {
    const r = guard('COMPLAINT', '2024-11-25', makeProposal({}, 'R-7.1'));
    expect(r.category).toBe('REJECT');
    expect(cites(r, 'R-2.1')).toBe(1);
    expect(r.guardApplied).toContain('G3');
  });
});

describe('G4 user-caused damage (AC-21)', () => {
  it('LIQUID_DAMAGE -> REJECT with R-4.2', () => {
    const r = guard('COMPLAINT', '2026-01-01', makeProposal({}, 'R-7.1'), makeAnalysis({ likelyCause: 'LIQUID_DAMAGE' }));
    expect(r.category).toBe('REJECT');
    expect(cites(r, 'R-4.2')).toBe(1);
  });
  it('MECHANICAL_DAMAGE with LOW confidence -> NEEDS_REVIEW with R-4.1', () => {
    const r = guard('COMPLAINT', '2026-01-01', makeProposal({}, 'R-7.1'), makeAnalysis({ likelyCause: 'MECHANICAL_DAMAGE', confidence: 'LOW' }));
    expect(r.category).toBe('NEEDS_REVIEW');
    expect(cites(r, 'R-4.1')).toBe(1);
    expect(r.guardApplied).toContain('G4');
  });
  it('MANUFACTURING_DEFECT keeps ACCEPT', () => {
    const r = guard('COMPLAINT', '2026-01-01', makeProposal({}, 'R-7.1'), makeAnalysis({ likelyCause: 'MANUFACTURING_DEFECT' }));
    expect(r.category).toBe('ACCEPT');
  });
});

describe('G5 contradictions (AC-22)', () => {
  it.each(['ACCEPT', 'REJECT'] as const)('%s with contradictions -> NEEDS_REVIEW', (category) => {
    const r = guard('RETURN', '2026-11-20', makeProposal({ category, contradictions: ['Opis nie zgadza się ze zdjęciem.'] }));
    expect(r.category).toBe('NEEDS_REVIEW');
    expect(r.guardApplied).toContain('G5');
    expect(r.contradictions).toEqual(['Opis nie zgadza się ze zdjęciem.']);
  });
});

describe('G6 unknown rule ids', () => {
  it('drops unknown points and keeps known ones', () => {
    const r = guard('RETURN', '2026-11-20', makeProposal({
      justification: [{ ruleId: 'X-9.9', text: 'Wymyślona reguła.' }, { ruleId: 'Z-7.1', text: 'Prawdziwa reguła.' }],
    }));
    expect(r.justification.map((j) => j.ruleId)).toEqual(['Z-7.1']);
    expect(r.guardApplied).toContain('G6');
  });
  it('throws when nothing valid is left', () => {
    expect(() => guard('RETURN', '2026-11-20', makeProposal({}, 'X-9.9'))).toThrow(GuardInvalidOutputError);
  });
});

const scenarios: { name: string; caseType: CaseType; purchase: string; analysis: ImageAnalysis; ruleId: string; rule: string }[] = [
  { name: 'late return', caseType: 'RETURN', purchase: '2026-10-01', analysis: makeAnalysis(), ruleId: 'Z-7.1', rule: 'Z-2.1' },
  { name: 'return with damage', caseType: 'RETURN', purchase: '2026-11-20', analysis: makeAnalysis({ damageVisible: true }), ruleId: 'Z-7.1', rule: 'Z-3.1' },
  { name: 'return with signs of use', caseType: 'RETURN', purchase: '2026-11-20', analysis: makeAnalysis({ signsOfUse: true }), ruleId: 'Z-7.1', rule: 'Z-3.2' },
  { name: 'old complaint', caseType: 'COMPLAINT', purchase: '2023-01-01', analysis: makeAnalysis(), ruleId: 'R-7.1', rule: 'R-2.1' },
  { name: 'liquid damage', caseType: 'COMPLAINT', purchase: '2026-01-01', analysis: makeAnalysis({ likelyCause: 'LIQUID_DAMAGE' }), ruleId: 'R-7.1', rule: 'R-4.2' },
  { name: 'mechanical damage', caseType: 'COMPLAINT', purchase: '2026-01-01', analysis: makeAnalysis({ likelyCause: 'MECHANICAL_DAMAGE' }), ruleId: 'R-7.1', rule: 'R-4.1' },
];

describe('rule point ensured in every category', () => {
  for (const s of scenarios) {
    it.each(['REJECT', 'NEEDS_REVIEW'] as const)(`${s.name}: ${'%s'} kept, point added once`, (category) => {
      const proposal = makeProposal({ category, unclearPoints: category === 'NEEDS_REVIEW' ? ['Do sprawdzenia.'] : [] }, s.ruleId);
      const r = guard(s.caseType, s.purchase, proposal, s.analysis);
      expect(r.category).toBe(category);
      expect(cites(r, s.rule)).toBe(1);
    });
    it(`${s.name}: existing point is not duplicated`, () => {
      const proposal = makeProposal({ category: 'REJECT', justification: [{ ruleId: s.rule, text: 'Już wskazane.' }] }, s.ruleId);
      const r = guard(s.caseType, s.purchase, proposal, s.analysis);
      expect(cites(r, s.rule)).toBe(1);
      expect(r.guardApplied).not.toContain('G1');
    });
  }
});

describe('guard never upgrades', () => {
  const categories: Category[] = ['ACCEPT', 'REJECT', 'NEEDS_REVIEW'];
  for (const s of scenarios) {
    for (const category of categories) {
      for (const contradictions of [[], ['Sprzeczność.']]) {
        it(`${s.name} / ${category} / contradictions=${contradictions.length}`, () => {
          const proposal = makeProposal({ category, contradictions, unclearPoints: ['x'] }, s.ruleId);
          const r = guard(s.caseType, s.purchase, proposal, s.analysis);
          if (category !== 'ACCEPT') expect(r.category).not.toBe('ACCEPT');
          expect(r.justification.length).toBeGreaterThan(0);
        });
      }
    }
  }
});

describe('guardChatEvaluation', () => {
  const run = (evaluation: ReturnType<typeof makeEvaluation>, current: Category, analysis = makeAnalysis(), purchase = '2026-11-20') =>
    guardChatEvaluation({
      caseType: 'RETURN',
      purchaseDate: purchase,
      today: TODAY,
      analysis,
      evaluation,
      currentCategory: current,
      limits: repo.limits,
      ruleIds: repo.ruleIds('RETURN'),
    });

  it('keeps an unchanged evaluation unchanged', () => {
    const r = run(makeEvaluation(), 'ACCEPT');
    expect(r.categoryChanged).toBe(false);
    expect(r.newCategory).toBeNull();
  });

  it('keeps a valid change', () => {
    const r = run(makeEvaluation({ categoryChanged: true, newCategory: 'REJECT', justification: [{ ruleId: 'Z-6.1', text: 'Zakup stacjonarny.' }], nextSteps: ['Skontaktuj się z obsługą.'] }), 'ACCEPT');
    expect(r.categoryChanged).toBe(true);
    expect(r.newCategory).toBe('REJECT');
  });

  it('normalizes to unchanged when the guard returns the current category', () => {
    // late return: current REJECT, model proposes ACCEPT -> guard REJECT == current
    const r = run(
      makeEvaluation({ categoryChanged: true, newCategory: 'ACCEPT', justification: [{ ruleId: 'Z-7.1', text: 'x' }], nextSteps: ['y'] }),
      'REJECT', makeAnalysis(), '2026-10-01',
    );
    expect(r.categoryChanged).toBe(false);
    expect(r.newCategory).toBeNull();
    expect(r.justification).toEqual([]);
    expect(r.nextSteps).toEqual([]);
  });

  it('G5 applies in chat when contradictions are reported', () => {
    const r = run(
      makeEvaluation({ categoryChanged: true, newCategory: 'ACCEPT', justification: [{ ruleId: 'Z-7.1', text: 'x' }], nextSteps: ['y'], contradictions: ['Sprzeczność.'] }),
      'REJECT',
    );
    expect(r.newCategory).toBe('NEEDS_REVIEW');
    expect(r.categoryChanged).toBe(true);
    expect(r.guardApplied).toContain('G5');
  });

  it('G1 applies in chat (never ACCEPT for a late return)', () => {
    const r = run(
      makeEvaluation({ categoryChanged: true, newCategory: 'ACCEPT', justification: [{ ruleId: 'Z-7.1', text: 'x' }], nextSteps: ['y'] }),
      'NEEDS_REVIEW', makeAnalysis(), '2026-10-01',
    );
    expect(r.newCategory).toBe('REJECT');
    expect(r.justification.some((j) => j.ruleId === 'Z-2.1')).toBe(true);
  });

  it('throws when every cited rule id is unknown', () => {
    expect(() =>
      run(makeEvaluation({ categoryChanged: true, newCategory: 'REJECT', justification: [{ ruleId: 'X-1.1', text: 'x' }], nextSteps: ['y'] }), 'ACCEPT'),
    ).toThrow(GuardInvalidOutputError);
  });
});
