import type {
  AssessmentProposal,
  CaseForm,
  ChatEvaluation,
  ImageAnalysis,
} from '../../../src/ai/domain/types.ts';

// Field values per schema only; they make no claim about any example photo.
export function makeAnalysis(overrides: Partial<ImageAnalysis> = {}): ImageAnalysis {
  return {
    usable: true,
    unusableReason: null,
    deviceVisible: true,
    matchesCategory: true,
    damageVisible: false,
    damageTypes: [],
    signsOfUse: false,
    resalableAsNew: true,
    likelyCause: 'NOT_APPLICABLE',
    confidence: 'HIGH',
    observations: 'Obserwacje testowe.',
    ...overrides,
  };
}

export function makeProposal(
  overrides: Partial<AssessmentProposal> = {},
  ruleId = 'Z-7.1',
): AssessmentProposal {
  return {
    category: 'ACCEPT',
    justification: [{ ruleId, text: 'Warunki polityki są spełnione.' }],
    nextSteps: ['Odeślij urządzenie na wskazany adres.'],
    unclearPoints: [],
    contradictions: [],
    ...overrides,
  };
}

export function makeEvaluation(overrides: Partial<ChatEvaluation> = {}): ChatEvaluation {
  return {
    categoryChanged: false,
    newCategory: null,
    justification: [],
    nextSteps: [],
    contradictions: [],
    offTopic: false,
    ...overrides,
  };
}

export function makeForm(overrides: Partial<CaseForm> = {}): CaseForm {
  return {
    caseType: 'RETURN',
    deviceCategory: 'Laptop',
    modelName: 'Model X-100',
    purchaseDate: '2026-11-20',
    description: null,
    ...overrides,
  };
}
