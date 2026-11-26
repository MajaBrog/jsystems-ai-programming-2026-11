import {
  AssessmentCategory,
  CaseType,
  DeviceCategory,
  PhotoUnusableReason,
  SubmissionStage,
} from '../../core/models';

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  COMPLAINT: 'Reklamacja',
  RETURN: 'Zwrot',
};

export const DEVICE_CATEGORY_LABELS: Record<DeviceCategory, string> = {
  SMARTPHONE: 'Smartfon',
  LAPTOP: 'Laptop',
  TABLET: 'Tablet',
  DESKTOP: 'Komputer stacjonarny',
  MONITOR: 'Monitor',
  TV: 'Telewizor',
  AUDIO: 'Słuchawki / audio',
  WEARABLE: 'Smartwatch / urządzenie ubieralne',
  CAMERA: 'Aparat fotograficzny',
  GAME_CONSOLE: 'Konsola do gier',
  PRINTER: 'Drukarka',
  SMALL_APPLIANCE: 'Małe AGD',
  OTHER: 'Inne',
};

export const ASSESSMENT_CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  ACCEPT: 'Przyjęte wstępnie',
  REJECT: 'Odrzucone wstępnie',
  NEEDS_REVIEW: 'Wymaga weryfikacji',
};

export const STAGE_LABELS: Record<SubmissionStage, string> = {
  ANALYZING_PHOTO: 'Analizujemy zdjęcie…',
  ASSESSING: 'Przygotowujemy ocenę…',
};

export const PHOTO_UNUSABLE_REASON_LABELS: Record<PhotoUnusableReason, string> = {
  BLURRED: 'Zdjęcie jest nieostre',
  TOO_DARK: 'Zdjęcie jest zbyt ciemne',
  NO_DEVICE: 'Na zdjęciu nie widać urządzenia',
  CATEGORY_MISMATCH: 'Urządzenie nie pasuje do wybranej kategorii',
};
