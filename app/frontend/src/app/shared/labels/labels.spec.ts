import { DEVICE_CATEGORIES } from '../../core/models';
import {
  ASSESSMENT_CATEGORY_LABELS,
  CASE_TYPE_LABELS,
  DEVICE_CATEGORY_LABELS,
  STAGE_LABELS,
} from './labels';

describe('Polish labels', () => {
  it('labels both case types', () => {
    expect(CASE_TYPE_LABELS).toEqual({ COMPLAINT: 'Reklamacja', RETURN: 'Zwrot' });
  });

  it('labels all 13 device categories in ADR-004 order', () => {
    expect(DEVICE_CATEGORIES.map((c) => DEVICE_CATEGORY_LABELS[c])).toEqual([
      'Smartfon',
      'Laptop',
      'Tablet',
      'Komputer stacjonarny',
      'Monitor',
      'Telewizor',
      'Słuchawki / audio',
      'Smartwatch / urządzenie ubieralne',
      'Aparat fotograficzny',
      'Konsola do gier',
      'Drukarka',
      'Małe AGD',
      'Inne',
    ]);
  });

  it('labels assessment categories (PRD 9.2)', () => {
    expect(ASSESSMENT_CATEGORY_LABELS).toEqual({
      ACCEPT: 'Przyjęte wstępnie',
      REJECT: 'Odrzucone wstępnie',
      NEEDS_REVIEW: 'Wymaga weryfikacji',
    });
  });

  it('labels submission stages (PRD 9.1)', () => {
    expect(STAGE_LABELS).toEqual({
      ANALYZING_PHOTO: 'Analizujemy zdjęcie…',
      ASSESSING: 'Przygotowujemy ocenę…',
    });
  });

  it('contains none of the English UI words (TAC-004-02)', () => {
    const all = [
      ...Object.values(CASE_TYPE_LABELS),
      ...Object.values(DEVICE_CATEGORY_LABELS),
      ...Object.values(ASSESSMENT_CATEGORY_LABELS),
      ...Object.values(STAGE_LABELS),
    ].join(' ');
    for (const word of ['Submit', 'Error', 'Loading']) expect(all).not.toContain(word);
  });
});
