import { describe, expect, it } from 'vitest';
import { createCaseLocks } from '../../src/cases/case-locks.ts';
import { UNUSABLE_REASONS } from '../../src/ai/domain/types.ts';
import { UNUSABLE_PHOTO_MESSAGES } from '../../src/cases/unusable-photo-messages.ts';

describe('CaseLocks', () => {
  it('is non-blocking and per case id', () => {
    const locks = createCaseLocks();
    expect(locks.tryAcquire('a')).toBe(true);
    expect(locks.tryAcquire('a')).toBe(false);
    expect(locks.tryAcquire('b')).toBe(true);
    expect(locks.isLocked('a')).toBe(true);
    locks.release('a');
    expect(locks.isLocked('a')).toBe(false);
    expect(locks.tryAcquire('a')).toBe(true);
  });
});

describe('unusable photo messages (ADR-001 §4)', () => {
  it('has one distinct Polish reason+tip text per reason', () => {
    const texts = UNUSABLE_REASONS.map((r) => UNUSABLE_PHOTO_MESSAGES[r]);
    expect(new Set(texts).size).toBe(UNUSABLE_REASONS.length);
    for (const t of texts) expect(t).toMatch(/[ąęłńóśźż]|zdjęci/i);
    expect(UNUSABLE_PHOTO_MESSAGES.BLURRED).toMatch(/rozmyte/);
    expect(UNUSABLE_PHOTO_MESSAGES.TOO_DARK).toMatch(/ciemne/);
    expect(UNUSABLE_PHOTO_MESSAGES.NO_DEVICE).toMatch(/nie widać urządzenia/);
    expect(UNUSABLE_PHOTO_MESSAGES.CATEGORY_MISMATCH).toMatch(/kategori/);
  });
});
