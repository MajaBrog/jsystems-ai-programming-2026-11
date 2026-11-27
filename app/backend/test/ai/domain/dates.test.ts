import { describe, expect, it } from 'vitest';
import { addYears, daysBetween } from '../../../src/ai/domain/dates.ts';

describe('dates', () => {
  it('counts whole days between ISO dates', () => {
    expect(daysBetween('2026-11-12', '2026-11-26')).toBe(14);
    expect(daysBetween('2026-11-26', '2026-11-26')).toBe(0);
    expect(daysBetween('2026-11-27', '2026-11-26')).toBe(-1);
  });
  it('adds years and clamps 29 Feb', () => {
    expect(addYears('2024-11-26', 2)).toBe('2026-11-26');
    expect(addYears('2024-02-29', 2)).toBe('2026-02-28');
  });
  it('rejects malformed dates', () => {
    expect(() => daysBetween('26-11-2026', '2026-11-26')).toThrow();
    expect(() => daysBetween('2026-02-30', '2026-11-26')).toThrow();
  });
});
