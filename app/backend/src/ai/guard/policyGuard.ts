import { addYears, daysBetween } from '../domain/dates.ts';
import type {
  AssessmentProposal,
  CaseType,
  Category,
  ChatEvaluation,
  ImageAnalysis,
  IsoDate,
  JustificationPoint,
  PolicyLimits,
} from '../domain/types.ts';

/** Rule ids the guard cites; a test asserts they exist in the policies. */
export const GUARD_RULE_IDS = {
  RETURN: ['Z-2.1', 'Z-3.1', 'Z-3.2'],
  COMPLAINT: ['R-2.1', 'R-4.1', 'R-4.2'],
} as const;

export class GuardInvalidOutputError extends Error {}

type GuardBase = {
  caseType: CaseType;
  purchaseDate: IsoDate;
  /** Injected "today" (no hidden clock access). */
  today: IsoDate;
  analysis: ImageAnalysis;
  limits: PolicyLimits;
  /** Rule ids of the policy of this case type (G6). */
  ruleIds: ReadonlySet<string>;
};

export type GuardInput = GuardBase & { proposal: AssessmentProposal };
export type GuardedProposal = AssessmentProposal & { guardApplied: string[] };

export type GuardChatInput = GuardBase & {
  evaluation: ChatEvaluation;
  currentCategory: Category;
};
export type GuardedEvaluation = ChatEvaluation & { guardApplied: string[]; unclearPoints: string[] };

function yearsWord(n: number): string {
  const last = n % 10;
  const teen = n % 100 >= 12 && n % 100 <= 14;
  return !teen && last >= 2 && last <= 4 ? 'lata' : 'lat';
}

function runGuard(base: GuardBase, proposal: AssessmentProposal): GuardedProposal {
  const { caseType, purchaseDate, today, analysis, limits, ruleIds } = base;
  const applied = new Set<string>();

  // G6: drop points citing rule ids that are not in the policy.
  let justification: JustificationPoint[] = proposal.justification.filter((p) => ruleIds.has(p.ruleId));
  if (justification.length !== proposal.justification.length) applied.add('G6');
  if (justification.length === 0) {
    throw new GuardInvalidOutputError('No justification point cites a rule id from the policy');
  }

  let category: Category = proposal.category;
  let unclearPoints = [...proposal.unclearPoints];

  const ensure = (gid: string, ruleId: string, text: string) => {
    if (!justification.some((p) => p.ruleId === ruleId)) {
      justification = [...justification, { ruleId, text }];
      applied.add(gid);
    }
  };
  const downgradeAccept = (gid: string) => {
    if (category !== 'ACCEPT') return;
    category = analysis.confidence === 'LOW' ? 'NEEDS_REVIEW' : 'REJECT';
    applied.add(gid);
  };

  if (caseType === 'RETURN') {
    // G1 (AC-18)
    if (daysBetween(purchaseDate, today) > limits.returnDays) {
      if (category === 'ACCEPT') {
        category = 'REJECT';
        applied.add('G1');
      }
      ensure('G1', 'Z-2.1',
        `Od daty zakupu minęło więcej niż ${limits.returnDays} dni, a zwrot jest możliwy w terminie ${limits.returnDays} dni od otrzymania urządzenia.`);
    }
    // G2 (AC-19)
    if (analysis.damageVisible || analysis.signsOfUse) {
      downgradeAccept('G2');
      if (analysis.damageVisible) {
        ensure('G2', 'Z-3.1', 'Analiza zdjęcia wskazuje na widoczne uszkodzenie, a zwracane urządzenie nie może nosić śladów uszkodzenia.');
      }
      if (analysis.signsOfUse) {
        ensure('G2', 'Z-3.2', 'Analiza zdjęcia wskazuje na ślady używania wykraczającego poza sprawdzenie stanu, cech i działania urządzenia.');
      }
    }
  } else {
    // G3 (AC-20)
    if (today > addYears(purchaseDate, limits.complaintYears)) {
      if (category === 'ACCEPT') {
        category = 'REJECT';
        applied.add('G3');
      }
      ensure('G3', 'R-2.1',
        `Od daty zakupu minęło więcej niż ${limits.complaintYears} ${yearsWord(limits.complaintYears)}, a odpowiedzialność sprzedawcy obejmuje ${limits.complaintYears} ${yearsWord(limits.complaintYears)} od dostarczenia urządzenia.`);
    }
    // G4 (AC-21)
    if (analysis.likelyCause === 'MECHANICAL_DAMAGE' || analysis.likelyCause === 'LIQUID_DAMAGE') {
      downgradeAccept('G4');
      if (analysis.likelyCause === 'MECHANICAL_DAMAGE') {
        ensure('G4', 'R-4.1', 'Prawdopodobną przyczyną jest uszkodzenie mechaniczne; uszkodzenia spowodowane przez klienta nie są objęte reklamacją.');
      } else {
        ensure('G4', 'R-4.2', 'Prawdopodobną przyczyną jest zalanie lub działanie cieczy; uszkodzenia spowodowane przez klienta nie są objęte reklamacją.');
      }
    }
  }

  // G5 (AC-22)
  if (proposal.contradictions.length > 0 && category !== 'NEEDS_REVIEW') {
    category = 'NEEDS_REVIEW';
    applied.add('G5');
  }

  // A guard-made NEEDS_REVIEW must still tell the customer what is unclear.
  if (category === 'NEEDS_REVIEW' && unclearPoints.length === 0 && proposal.contradictions.length === 0) {
    unclearPoints = ['Pewność analizy zdjęcia jest niska; zespół serwisowy sprawdzi stan urządzenia po jego otrzymaniu.'];
  }

  return {
    category,
    justification,
    nextSteps: [...proposal.nextSteps],
    unclearPoints,
    contradictions: [...proposal.contradictions],
    guardApplied: [...applied],
  };
}

/** G1–G6 for the decision step. Never upgrades a category towards ACCEPT. */
export function applyPolicyGuard(input: GuardInput): GuardedProposal {
  const { proposal, ...base } = input;
  return runGuard(base, proposal);
}

/**
 * Guard for the chat evaluation. Only a *changed* evaluation is guarded (ADR-002 §3.4); after the
 * guard, a result equal to the current category is normalized to "unchanged" (§3.3).
 */
export function guardChatEvaluation(input: GuardChatInput): GuardedEvaluation {
  const { evaluation, currentCategory, ...base } = input;
  const unchanged = (guardApplied: string[]): GuardedEvaluation => ({
    ...evaluation,
    categoryChanged: false,
    newCategory: null,
    justification: [],
    nextSteps: [],
    unclearPoints: [],
    guardApplied,
  });

  if (!evaluation.categoryChanged) return unchanged([]);
  if (evaluation.newCategory === null) {
    throw new GuardInvalidOutputError('categoryChanged=true requires newCategory');
  }

  const guarded = runGuard(base, {
    category: evaluation.newCategory,
    justification: evaluation.justification,
    nextSteps: evaluation.nextSteps,
    unclearPoints: [],
    contradictions: evaluation.contradictions,
  });
  if (guarded.category === currentCategory) return unchanged(guarded.guardApplied);

  return {
    categoryChanged: true,
    newCategory: guarded.category,
    justification: guarded.justification,
    nextSteps: guarded.nextSteps,
    contradictions: guarded.contradictions,
    offTopic: evaluation.offTopic,
    unclearPoints: guarded.unclearPoints,
    guardApplied: guarded.guardApplied,
  };
}
