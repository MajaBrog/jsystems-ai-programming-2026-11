export type CaseType = 'COMPLAINT' | 'RETURN';

export const DEVICE_CATEGORIES = [
  'SMARTPHONE',
  'LAPTOP',
  'TABLET',
  'DESKTOP',
  'MONITOR',
  'TV',
  'AUDIO',
  'WEARABLE',
  'CAMERA',
  'GAME_CONSOLE',
  'PRINTER',
  'SMALL_APPLIANCE',
  'OTHER',
] as const;
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

export type AssessmentCategory = 'ACCEPT' | 'REJECT' | 'NEEDS_REVIEW';

export type PhotoUnusableReason = 'BLURRED' | 'TOO_DARK' | 'NO_DEVICE' | 'CATEGORY_MISMATCH';
export type SubmissionStage = 'ANALYZING_PHOTO' | 'ASSESSING';

export interface JustificationItem {
  ruleId: string;
  text: string;
}

export interface AssessmentView {
  category: AssessmentCategory;
  previousCategory: AssessmentCategory | null;
  source: string;
  justification: JustificationItem[];
  nextSteps: string[];
  createdAt: string;
}

export interface MessageView {
  id: number;
  role: 'AGENT' | 'CUSTOMER';
  content: string;
  createdAt: string;
  assessmentCategory?: AssessmentCategory | null;
}

export interface CaseView {
  id: string;
  caseType: CaseType;
  deviceCategory: DeviceCategory;
  modelName: string;
  purchaseDate: string;
  description: string | null;
  photoUrl: string;
  currentCategory: AssessmentCategory;
  assessments: AssessmentView[];
  messages: MessageView[];
  createdAt: string;
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'CASE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_IMAGE'
  | 'REPLY_IN_PROGRESS'
  | 'INTERNAL_ERROR'
  // client-side codes
  | 'NETWORK'
  | 'STREAM_INTERRUPTED'
  | 'UNKNOWN';

export interface FieldError {
  field: string;
  message: string;
}

/** Typed error for non-2xx JSON bodies, network failures and interrupted streams. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type SseErrorCode = 'LLM_UNAVAILABLE' | 'LLM_INVALID_OUTPUT' | 'INTERNAL_ERROR';

export type SubmissionEvent =
  | { type: 'stage'; stage: SubmissionStage }
  | { type: 'photo_unusable'; reason: PhotoUnusableReason; message: string }
  | { type: 'completed'; caseId: string }
  | { type: 'error'; code: SseErrorCode; message: string };

export type ChatEvent =
  | { type: 'assessment_changed'; from: AssessmentCategory; to: AssessmentCategory }
  | { type: 'token'; text: string }
  | { type: 'completed'; message: MessageView; currentCategory: AssessmentCategory }
  | { type: 'error'; code: SseErrorCode; message: string };

export type SseEvent = SubmissionEvent | ChatEvent;
