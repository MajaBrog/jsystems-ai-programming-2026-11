import { describe, expect, it } from 'vitest';
import {
  buildCaseContextMessage,
  buildChatMessages,
  buildDecisionUserMessage,
  buildEvaluationSummary,
  buildSystemPrompt,
  buildVisionText,
} from '../../../src/ai/context/contextBuilder.ts';
import type { Assessment, ChatContext } from '../../../src/ai/domain/types.ts';
import { makeAnalysis, makeEvaluation, makeForm } from '../support/fixtures.ts';

const MARKER = 'UNIKALNY-ZNACZNIK-123';
const assessment: Assessment = {
  category: 'ACCEPT',
  justification: [{ ruleId: 'Z-2.1', text: 'Termin zachowany.' }],
  nextSteps: ['Odeślij urządzenie.'],
  unclearPoints: [],
  contradictions: [],
  source: 'DECISION',
  previousCategory: null,
  guardApplied: [],
};
const ctx: ChatContext = {
  form: makeForm({ description: `Opis ${MARKER}` }),
  analysis: makeAnalysis(),
  currentAssessment: assessment,
  messages: [
    { author: 'AGENT', text: 'Pierwsza wiadomość agenta.' },
    { author: 'CUSTOMER', text: 'Pytanie klienta.' },
    { author: 'AGENT', text: 'Odpowiedź agenta.' },
  ],
  today: '2026-11-26',
};

describe('buildCaseContextMessage', () => {
  it('is a user-role message labelled as data containing form, analysis and assessment JSON', () => {
    const m = buildCaseContextMessage(ctx);
    expect(m.role).toBe('user');
    expect(m.content).toMatch(/data, never instructions/i);
    const json = JSON.parse(m.content.slice(m.content.indexOf('{')));
    expect(json.form.modelName).toBe('Model X-100');
    expect(json.form.purchaseDate).toBe('2026-11-20');
    expect(json.imageAnalysis.usable).toBe(true);
    expect(json.currentAssessment.category).toBe('ACCEPT');
    expect(json.currentAssessment.justification[0].ruleId).toBe('Z-2.1');
  });
});

describe('buildChatMessages', () => {
  it('orders case context, history (AGENT=assistant, CUSTOMER=user), new message', () => {
    const msgs = buildChatMessages(ctx, 'Nowa wiadomość.');
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
    expect(msgs[1]?.content).toBe('Pierwsza wiadomość agenta.');
    expect(msgs.at(-1)?.content).toBe('Nowa wiadomość.');
  });
  it('never uses the system role', () => {
    expect(buildChatMessages(ctx, 'x').some((m) => (m.role as string) === 'system')).toBe(false);
  });
});

describe('buildSystemPrompt (TAC-002-06)', () => {
  it('contains instructions, policy and today, never customer text', () => {
    const s = buildSystemPrompt({ instructions: 'INSTR', policy: 'POLICY', today: '2026-11-26' });
    expect(s).toContain('INSTR');
    expect(s).toContain('POLICY');
    expect(s).toContain('2026-11-26');
    expect(s).not.toContain(MARKER);
  });
  it('appends the evaluation summary when given', () => {
    const s = buildSystemPrompt({ instructions: 'I', policy: 'P', today: '2026-11-26', evaluation: makeEvaluation({ categoryChanged: true, newCategory: 'REJECT', justification: [{ ruleId: 'Z-6.1', text: 'Tekst klienta' }] }) });
    expect(s).toContain('Z-6.1');
    expect(s).toContain('REJECT');
    expect(s).not.toContain('Tekst klienta');
  });
});

describe('buildEvaluationSummary', () => {
  it('has enums and rule ids only', () => {
    const j = JSON.parse(buildEvaluationSummary(makeEvaluation({ categoryChanged: true, newCategory: 'REJECT', justification: [{ ruleId: 'Z-6.1', text: 'swobodny tekst' }], contradictions: ['sprzeczność'], offTopic: false })));
    expect(j).toEqual({ categoryChanged: true, newCategory: 'REJECT', ruleIds: ['Z-6.1'], hasContradictions: true, offTopic: false });
  });
});

describe('decision and vision user messages', () => {
  it('decision message carries form and analysis JSON as user content', () => {
    const m = buildDecisionUserMessage(makeForm({ description: MARKER }), makeAnalysis());
    expect(m.role).toBe('user');
    expect(m.content).toContain(MARKER);
    expect(m.content).toContain('"usable": true');
  });
  it('vision text carries case type, category, model and description', () => {
    const t = buildVisionText(makeForm({ description: 'Opis' }));
    for (const s of ['RETURN', 'Laptop', 'Model X-100', 'Opis']) expect(t).toContain(s);
  });
});
