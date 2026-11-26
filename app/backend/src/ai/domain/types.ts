// Domain types for the AI package (ADR-002 §3.3, §4). String-literal unions, no enums (ADR-005).

export const CASE_TYPES = ['RETURN', 'COMPLAINT'] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CATEGORIES = ['ACCEPT', 'REJECT', 'NEEDS_REVIEW'] as const;
export type Category = (typeof CATEGORIES)[number];

export const UNUSABLE_REASONS = ['BLURRED', 'TOO_DARK', 'NO_DEVICE', 'CATEGORY_MISMATCH'] as const;
export type UnusableReason = (typeof UNUSABLE_REASONS)[number];

export const DAMAGE_TYPES = ['CRACK', 'DENT', 'SCRATCH', 'BURN', 'CORROSION', 'DISPLAY_DEFECT', 'OTHER'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const LIKELY_CAUSES = [
  'MANUFACTURING_DEFECT',
  'NORMAL_WEAR',
  'MECHANICAL_DAMAGE',
  'LIQUID_DAMAGE',
  'OTHER_UNKNOWN',
  'NOT_APPLICABLE',
] as const;
export type LikelyCause = (typeof LIKELY_CAUSES)[number];

export const CONFIDENCES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/** `YYYY-MM-DD` (the Java `LocalDate` equivalent). */
export type IsoDate = string;

export type JustificationPoint = { ruleId: string; text: string };

export type CaseForm = {
  caseType: CaseType;
  deviceCategory: string;
  modelName: string;
  purchaseDate: IsoDate;
  description: string | null;
};

export type ImageAnalysis = {
  usable: boolean;
  unusableReason: UnusableReason | null;
  deviceVisible: boolean;
  matchesCategory: boolean;
  damageVisible: boolean;
  damageTypes: DamageType[];
  signsOfUse: boolean;
  resalableAsNew: boolean;
  likelyCause: LikelyCause;
  confidence: Confidence;
  observations: string;
};

export type AssessmentProposal = {
  category: Category;
  justification: JustificationPoint[];
  nextSteps: string[];
  unclearPoints: string[];
  contradictions: string[];
};

export type ChatEvaluation = {
  categoryChanged: boolean;
  newCategory: Category | null;
  justification: JustificationPoint[];
  nextSteps: string[];
  contradictions: string[];
  offTopic: boolean;
};

/** Proposal after the guard + provenance (ADR-002 §4). */
export type Assessment = AssessmentProposal & {
  source: 'DECISION' | 'CHAT';
  previousCategory: Category | null;
  guardApplied: string[];
};

export type PolicyLimits = { returnDays: number; complaintYears: number };

export type ChatMessage = { author: 'AGENT' | 'CUSTOMER'; text: string };

export type ChatContext = {
  form: CaseForm;
  analysis: ImageAnalysis;
  currentAssessment: Assessment;
  messages: ChatMessage[];
  today: IsoDate;
};
