import { describe, expect, it } from 'vitest';
import {
  MANDATORY_NOTICE,
  categoryLabel,
  changeNoticeLine,
  composeFirstMessage,
} from '../../../src/ai/compose/firstMessageComposer.ts';
import type { Assessment, Category } from '../../../src/ai/domain/types.ts';
import { makeForm } from '../support/fixtures.ts';

function assessment(category: Category, extra: Partial<Assessment> = {}): Assessment {
  return {
    category,
    justification: [{ ruleId: 'Z-2.1', text: 'Termin 14 dni został zachowany.' }, { ruleId: 'Z-3.1', text: 'Brak uszkodzeń.' }],
    nextSteps: ['Odeślij urządzenie.', 'Dołącz dowód zakupu.'],
    unclearPoints: [],
    contradictions: [],
    source: 'DECISION',
    previousCategory: null,
    guardApplied: [],
    ...extra,
  };
}

describe('mandatory texts', () => {
  it('uses the exact notice from PRD 11.2', () => {
    expect(MANDATORY_NOTICE).toBe('To jest wstępna ocena. Ostateczną decyzję podejmie zespół serwisowy po otrzymaniu i sprawdzeniu urządzenia.');
  });
  it('labels categories', () => {
    expect(categoryLabel('ACCEPT')).toBe('Przyjęte wstępnie');
    expect(categoryLabel('REJECT')).toBe('Odrzucone wstępnie');
    expect(categoryLabel('NEEDS_REVIEW')).toBe('Wymaga weryfikacji');
  });
  it('builds the AC-28 change line', () => {
    expect(changeNoticeLine('ACCEPT', 'REJECT')).toBe('Wstępna ocena zmieniona: Przyjęte wstępnie → Odrzucone wstępnie');
  });
});

describe('composeFirstMessage order (AC-23)', () => {
  it.each(['ACCEPT', 'REJECT', 'NEEDS_REVIEW'] as const)('%s: greeting, assessment, justification, steps, notice', (category) => {
    const text = composeFirstMessage(makeForm(), assessment(category, category === 'NEEDS_REVIEW' ? { unclearPoints: ['Niejasna przyczyna.'] } : {}));
    const pos = ['Dzień dobry,', '**Wstępna ocena: ', '### Uzasadnienie', '### Następne kroki', MANDATORY_NOTICE].map((s) => text.indexOf(s));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    expect(text.split('\n').at(-1)).toBe(MANDATORY_NOTICE);
    expect(text).toContain(`**Wstępna ocena: ${categoryLabel(category)}**`);
  });

  it('names case type and model in the greeting block', () => {
    const text = composeFirstMessage(makeForm({ caseType: 'COMPLAINT', modelName: 'Model X-100' }), assessment('ACCEPT'));
    expect(text.split('\n')[0]).toBe('Dzień dobry,');
    expect(text).toMatch(/reklamacj/i);
    expect(text).toContain('Model X-100');
  });

  it('renders justification bullets with rule ids and numbered steps', () => {
    const text = composeFirstMessage(makeForm(), assessment('ACCEPT'));
    expect(text).toContain('- Termin 14 dni został zachowany. (Z-2.1)');
    expect(text).toContain('1. Odeślij urządzenie.\n2. Dołącz dowód zakupu.');
  });

  it('NEEDS_REVIEW adds "### Do wyjaśnienia" between justification and steps with unclear points and contradictions', () => {
    const text = composeFirstMessage(makeForm(), assessment('NEEDS_REVIEW', { unclearPoints: ['Niejasna przyczyna.'], contradictions: ['Opis sprzeczny ze zdjęciem.'] }));
    const a = text.indexOf('### Uzasadnienie');
    const b = text.indexOf('### Do wyjaśnienia');
    const c = text.indexOf('### Następne kroki');
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(text).toContain('- Niejasna przyczyna.');
    expect(text).toContain('- Opis sprzeczny ze zdjęciem.');
  });

  it('other categories have no "### Do wyjaśnienia"', () => {
    expect(composeFirstMessage(makeForm(), assessment('ACCEPT'))).not.toContain('### Do wyjaśnienia');
    expect(composeFirstMessage(makeForm(), assessment('REJECT'))).not.toContain('### Do wyjaśnienia');
  });

  it('NEEDS_REVIEW with no points still has the section', () => {
    expect(composeFirstMessage(makeForm(), assessment('NEEDS_REVIEW'))).toContain('### Do wyjaśnienia');
  });

  it('keeps model-supplied and customer text on one line so it cannot add headings', () => {
    const text = composeFirstMessage(
      makeForm({ modelName: 'X\n### Fałszywy nagłówek' }),
      assessment('ACCEPT', { justification: [{ ruleId: 'Z-2.1', text: 'a\n### Inny\nb' }] }),
    );
    expect(text.split('\n').filter((l) => l.startsWith('### '))).toEqual(['### Uzasadnienie', '### Następne kroki']);
  });
});
