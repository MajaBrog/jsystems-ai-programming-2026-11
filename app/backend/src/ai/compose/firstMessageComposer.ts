import type { Assessment, CaseForm, CaseType, Category } from '../domain/types.ts';

export const MANDATORY_NOTICE =
  'To jest wstępna ocena. Ostateczną decyzję podejmie zespół serwisowy po otrzymaniu i sprawdzeniu urządzenia.';

const LABELS: Record<Category, string> = {
  ACCEPT: 'Przyjęte wstępnie',
  REJECT: 'Odrzucone wstępnie',
  NEEDS_REVIEW: 'Wymaga weryfikacji',
};
const CASE_LABELS: Record<CaseType, string> = { RETURN: 'zwrot', COMPLAINT: 'reklamacja' };

export function categoryLabel(category: Category): string {
  return LABELS[category];
}

/** AC-28 line streamed first when the category changes in the chat. */
export function changeNoticeLine(from: Category, to: Category): string {
  return `Wstępna ocena zmieniona: ${LABELS[from]} → ${LABELS[to]}`;
}

/** Single line, so free text can never open a heading or list of its own. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** One line with markdown control characters escaped (customer-entered values). */
function plain(text: string): string {
  return oneLine(text).replace(/[\\`*_[\]<>#|]/g, (c) => `\\${c}`);
}

/** Deterministic first agent message (ADR-002 §3.5, AC-23). Order and notice are guaranteed by code. */
export function composeFirstMessage(form: CaseForm, assessment: Assessment): string {
  const lines: string[] = [
    'Dzień dobry,',
    '',
    `Dotyczy zgłoszenia: ${CASE_LABELS[form.caseType]}, urządzenie: ${plain(form.modelName)}.`,
    '',
    `**Wstępna ocena: ${LABELS[assessment.category]}**`,
    '',
    '### Uzasadnienie',
    '',
    ...assessment.justification.map((p) => `- ${oneLine(p.text)} (${plain(p.ruleId)})`),
    '',
  ];

  if (assessment.category === 'NEEDS_REVIEW') {
    const points = [...new Set([...assessment.unclearPoints, ...assessment.contradictions].map(oneLine).filter(Boolean))];
    if (points.length === 0) points.push('Zespół serwisowy sprawdzi dane zgłoszenia po otrzymaniu urządzenia.');
    lines.push('### Do wyjaśnienia', '', ...points.map((p) => `- ${p}`), '');
  }

  lines.push(
    '### Następne kroki',
    '',
    ...assessment.nextSteps.map((s, i) => `${i + 1}. ${oneLine(s)}`),
    '',
    MANDATORY_NOTICE,
  );
  return lines.join('\n');
}
