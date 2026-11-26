import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { compressForModel } from '../../../src/imaging/image-compressor.ts';
import { LlmInvalidOutputError, LlmUnavailableError } from '../../../src/ai/steps/types.ts';
import type { Assessment, ChatContext, ImageAnalysis } from '../../../src/ai/domain/types.ts';
import { examplePhoto } from '../../imaging/fixtures.ts';
import { makeAnalysis, makeForm } from '../support/fixtures.ts';
import { capture, prompts, startHarness, withContent, withFinishReason, withStatus, streamText, type Harness } from './harness.ts';

const TODAY = '2026-11-26';
let h: Harness;
beforeEach(async () => { h = await startHarness(); });
afterEach(async () => { await h.close(); });

const returnForm = makeForm({ caseType: 'RETURN', deviceCategory: 'LAPTOP', modelName: 'Testowy Laptop 14', purchaseDate: '2026-11-23' });
const complaintForm = makeForm({
  caseType: 'COMPLAINT', deviceCategory: 'SMARTPHONE', modelName: 'Testowy Telefon X', purchaseDate: '2026-05-10',
  description: 'Urządzenie przestało działać poprawnie podczas normalnego użytkowania.',
});
const body = (i: number) => JSON.parse(h.replay.requests[i]!.body) as { model: string; stream?: boolean; messages: Array<{ role: string; content: unknown }> };
const system = (i: number) => body(i).messages[0]!.content as string;

function chatCtx(form = returnForm, category: Assessment['category'] = 'REJECT'): ChatContext {
  return {
    form,
    analysis: makeAnalysis(),
    currentAssessment: {
      category, justification: [{ ruleId: 'Z-3.1', text: 'Widoczne uszkodzenie.' }], nextSteps: ['Skontaktuj się z obsługą.'],
      unclearPoints: [], contradictions: [], source: 'DECISION', previousCategory: null, guardApplied: [],
    },
    messages: [{ author: 'AGENT', text: 'Wstępna ocena została przygotowana na podstawie formularza i zdjęcia.' }],
    today: TODAY,
  };
}

describe('imageAnalysis.analyse', () => {
  it('replays vision-return-laptop-1: parsed analysis; TAC-002-01 path, vision prompt, JPEG <= 1568 (TAC-001-04)', async () => {
    const jpeg = (await compressForModel(await examplePhoto('laptop-1.png'))).jpeg;
    h.replay.enqueue(await capture('vision-return-laptop-1'));
    const result = await h.steps.imageAnalysis.analyse(returnForm, jpeg);
    expect(result).toMatchObject({ usable: true, damageVisible: true, damageTypes: ['CRACK'], confidence: 'HIGH' });
    expect(h.replay.requests).toHaveLength(1);
    expect(h.replay.requests[0]!.path).toBe('/api/v1/chat/completions');
    expect(system(0)).toBe(prompts.systemPrompt('vision', 'RETURN'));
    const parts = body(0).messages[1]!.content as Array<{ type: string; image_url?: { url: string } }>;
    const url = parts[1]!.image_url!.url;
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
    const sent = Buffer.from(url.slice('data:image/jpeg;base64,'.length), 'base64');
    const meta = await sharp(sent).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1568);
  });

  it('replays vision-complaint-phone-1: complaint case uses the complaint vision prompt (AC-17)', async () => {
    const jpeg = (await compressForModel(await examplePhoto('phone-1.jpg'))).jpeg;
    h.replay.enqueue(await capture('vision-complaint-phone-1'));
    const result = await h.steps.imageAnalysis.analyse(complaintForm, jpeg);
    expect(result.usable).toBe(true);
    expect(system(0)).toBe(prompts.systemPrompt('vision', 'COMPLAINT'));
  });

  it('replays vision-return-phone-2-as-tv: unusable analysis with reason is returned as is', async () => {
    h.replay.enqueue(await capture('vision-return-phone-2-as-tv'));
    const result = await h.steps.imageAnalysis.analyse(returnForm, Buffer.from([0xff, 0xd8]));
    expect(result).toMatchObject({ usable: false, unusableReason: 'CATEGORY_MISMATCH' });
  });

  it('repair: derived (usable=false without unusableReason) then original capture -> success, exactly 2 requests; repair carries output + errors', async () => {
    const original = await capture('vision-return-phone-2-as-tv');
    // Derived variant (ADR-002 D6 b): vision-return-phone-2-as-tv with unusableReason -> null while usable=false.
    h.replay.enqueue(withContent(original, 'unusableReason -> null', (c) => { c.unusableReason = null; }));
    h.replay.enqueue(original);
    const result = await h.steps.imageAnalysis.analyse(returnForm, Buffer.from([0xff, 0xd8]));
    expect(result.unusableReason).toBe('CATEGORY_MISMATCH');
    expect(h.replay.requests).toHaveLength(2);
    const second = body(1).messages;
    expect(second.slice(0, body(0).messages.length)).toEqual(body(0).messages);
    expect(second.at(-2)!.role).toBe('assistant');
    expect(String(second.at(-2)!.content)).toContain('unusableReason');
    expect(second.at(-1)!.role).toBe('user');
    expect(String(second.at(-1)!.content)).toContain('unusableReason: required when usable=false');
  });

  it('both responses invalid -> LlmInvalidOutputError after exactly 2 requests', async () => {
    const original = await capture('vision-return-laptop-1');
    // Derived variant (D6 b): vision-return-laptop-1 with confidence -> "MAYBE", queued twice.
    const broken = withContent(original, 'confidence -> "MAYBE"', (c) => { c.confidence = 'MAYBE'; });
    h.replay.enqueue(broken);
    h.replay.enqueue(broken);
    await expect(h.steps.imageAnalysis.analyse(returnForm, Buffer.from([0xff, 0xd8]))).rejects.toBeInstanceOf(LlmInvalidOutputError);
    expect(h.replay.requests).toHaveLength(2);
  });
});

describe('decision.decide', () => {
  async function analysisFrom(name: string): Promise<ImageAnalysis> {
    const c = await capture(name);
    return JSON.parse(JSON.parse(c.body.toString('utf8').trim()).choices[0].message.content) as ImageAnalysis;
  }

  it('replays decision-return: guarded Assessment (source DECISION, previousCategory null); return policy', async () => {
    h.replay.enqueue(await capture('decision-return'));
    const result = await h.steps.decision.decide(returnForm, await analysisFrom('vision-return-laptop-1'), TODAY);
    expect(result).toMatchObject({ category: 'REJECT', source: 'DECISION', previousCategory: null });
    expect(result.justification.map((p) => p.ruleId)).toEqual(expect.arrayContaining(['Z-3.1', 'Z-3.2']));
    expect(h.replay.requests[0]!.path).toBe('/api/v1/chat/completions');
    expect(system(0)).toContain(prompts.policy('RETURN'));
    expect(system(0)).not.toContain(prompts.policy('COMPLAINT'));
    expect(system(0)).toContain(TODAY);
  });

  it('replays decision-complaint: NEEDS_REVIEW kept; complaint policy only (AC-17)', async () => {
    h.replay.enqueue(await capture('decision-complaint'));
    const result = await h.steps.decision.decide(complaintForm, await analysisFrom('vision-complaint-phone-1'), TODAY);
    expect(result.category).toBe('NEEDS_REVIEW');
    expect(result.contradictions.length).toBeGreaterThan(0);
    expect(system(0)).toContain(prompts.policy('COMPLAINT'));
    expect(system(0)).not.toContain(prompts.policy('RETURN'));
  });

  it('guard on a derived decision-return (category -> ACCEPT) with purchase date beyond the limit: never ACCEPT (G1)', async () => {
    // Derived variant (D6 b): decision-return with category REJECT -> ACCEPT; the form's purchase date is 86 days old.
    h.replay.enqueue(withContent(await capture('decision-return'), 'category -> ACCEPT', (c) => { c.category = 'ACCEPT'; }));
    const result = await h.steps.decision.decide({ ...returnForm, purchaseDate: '2026-09-01' }, makeAnalysis(), TODAY);
    expect(result.category).toBe('REJECT');
    expect(result.guardApplied).toContain('G1');
    expect(result.justification.some((p) => p.ruleId === 'Z-2.1')).toBe(true);
  });

  it('repair: derived decision-return (category -> "MAYBE") then original -> success, exactly 2 requests', async () => {
    const original = await capture('decision-return');
    h.replay.enqueue(withContent(original, 'category -> "MAYBE"', (c) => { c.category = 'MAYBE'; }));
    h.replay.enqueue(original);
    const result = await h.steps.decision.decide(returnForm, await analysisFrom('vision-return-laptop-1'), TODAY);
    expect(result.category).toBe('REJECT');
    expect(h.replay.requests).toHaveLength(2);
    expect(String(body(1).messages.at(-1)!.content)).toContain('category');
  });

  it('GuardInvalidOutputError (no justification cites a policy rule) is repaired once, then LlmInvalidOutputError', async () => {
    // Derived variant (D6 b): decision-return with every justification ruleId -> "X-9.9", queued twice.
    const bad = withContent(await capture('decision-return'), 'justification ruleIds -> X-9.9', (c) => {
      c.justification = (c.justification as Array<{ ruleId: string }>).map((p) => ({ ...p, ruleId: 'X-9.9' }));
    });
    h.replay.enqueue(bad);
    h.replay.enqueue(bad);
    await expect(h.steps.decision.decide(returnForm, makeAnalysis(), TODAY)).rejects.toBeInstanceOf(LlmInvalidOutputError);
    expect(h.replay.requests).toHaveLength(2);
  });
});

describe('chatEvaluate.evaluate', () => {
  it('replays chat-evaluate-neutral: unchanged evaluation; shared chat-evaluate prompt', async () => {
    h.replay.enqueue(await capture('chat-evaluate-neutral'));
    const result = await h.steps.chatEvaluate.evaluate(chatCtx(), 'Ile trwa rozpatrzenie zgłoszenia?');
    expect(result).toMatchObject({ categoryChanged: false, newCategory: null, offTopic: false, guardApplied: [] });
    expect(system(0)).toContain(prompts.policy('RETURN'));
    expect(body(0).messages.at(-1)).toEqual({ role: 'user', content: 'Ile trwa rozpatrzenie zgłoszenia?' });
  });

  it('replays chat-evaluate-physical-store: category stays, contradiction kept', async () => {
    h.replay.enqueue(await capture('chat-evaluate-physical-store'));
    const result = await h.steps.chatEvaluate.evaluate(chatCtx(), 'Chcę doprecyzować: kupiłem ten laptop w sklepie stacjonarnym, nie przez internet.');
    expect(result.categoryChanged).toBe(false);
    expect(result.contradictions).toHaveLength(1);
  });

  it('guard applied on a derived evaluation (changed to ACCEPT with a purchase date beyond the limit) -> not ACCEPT', async () => {
    // Derived variant (D6 b): chat-evaluate-neutral with categoryChanged=true, newCategory=ACCEPT, a valid justification and nextSteps.
    h.replay.enqueue(withContent(await capture('chat-evaluate-neutral'), 'changed to ACCEPT with Z-7.1 point + one next step', (c) => {
      c.categoryChanged = true;
      c.newCategory = 'ACCEPT';
      c.justification = [{ ruleId: 'Z-7.1', text: 'Warunki polityki są spełnione.' }];
      c.nextSteps = ['Odeślij urządzenie na wskazany adres.'];
    }));
    const ctx = chatCtx({ ...returnForm, purchaseDate: '2026-09-01' }, 'NEEDS_REVIEW');
    const result = await h.steps.chatEvaluate.evaluate(ctx, 'Mam dowód zakupu.');
    expect(result.newCategory).toBe('REJECT');
    expect(result.guardApplied).toContain('G1');
  });

  it('repair: derived chat-evaluate-neutral (categoryChanged=true without newCategory) then original -> success, 2 requests', async () => {
    const original = await capture('chat-evaluate-neutral');
    h.replay.enqueue(withContent(original, 'categoryChanged -> true (newCategory stays null)', (c) => { c.categoryChanged = true; }));
    h.replay.enqueue(original);
    const result = await h.steps.chatEvaluate.evaluate(chatCtx(), 'Ile trwa rozpatrzenie zgłoszenia?');
    expect(result.categoryChanged).toBe(false);
    expect(h.replay.requests).toHaveLength(2);
  });

  it('both invalid -> LlmInvalidOutputError', async () => {
    const bad = withContent(await capture('chat-evaluate-neutral'), 'offTopic -> "yes"', (c) => { c.offTopic = 'yes'; });
    h.replay.enqueue(bad);
    h.replay.enqueue(bad);
    await expect(h.steps.chatEvaluate.evaluate(chatCtx(), 'x')).rejects.toBeInstanceOf(LlmInvalidOutputError);
    expect(h.replay.requests).toHaveLength(2);
  });
});

describe('errors -> LlmUnavailableError (all non-streaming steps share the mapping)', () => {
  const call = () => h.steps.chatEvaluate.evaluate(chatCtx(), 'x');

  it('real 401 capture (error-401-invalid-key)', async () => {
    h.replay.enqueue(await capture('error-401-invalid-key'));
    await expect(call()).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(h.replay.requests).toHaveLength(1); // no retries (AC-30)
  });

  it('real 400 capture (error-unknown-model)', async () => {
    h.replay.enqueue(await capture('error-unknown-model'));
    await expect(call()).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it.each([429, 500, 503])('error-401-invalid-key with status/code changed to %i (D6 b)', async (status) => {
    h.replay.enqueue(withStatus(await capture('error-401-invalid-key'), status));
    await expect(call()).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(h.replay.requests).toHaveLength(1);
  });

  it('timeout: chat-evaluate-neutral replayed with delay > LLM_TIMEOUT_SECONDS=1 (D6 c)', async () => {
    await h.close();
    h = await startHarness(1);
    h.replay.enqueue(await capture('chat-evaluate-neutral'), { delayMs: 1600 });
    await expect(call()).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('repair call failing with an HTTP error is LlmUnavailableError', async () => {
    h.replay.enqueue(withContent(await capture('chat-evaluate-neutral'), 'offTopic -> "yes"', (c) => { c.offTopic = 'yes'; }));
    h.replay.enqueue(await capture('error-401-invalid-key'));
    await expect(call()).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('caller abort rejects the step', async () => {
    h.replay.enqueue(await capture('chat-evaluate-neutral'), { delayMs: 800 });
    const ac = new AbortController();
    const p = h.steps.chatEvaluate.evaluate(chatCtx(), 'x', ac.signal);
    setTimeout(() => ac.abort(), 100);
    await expect(p).rejects.toBeDefined();
  });
});

describe('chatReply.stream', () => {
  const evaluation = { categoryChanged: false, newCategory: null, justification: [], nextSteps: [], contradictions: [], offTopic: false, guardApplied: [], unclearPoints: [] };
  const run = (tokens: string[], signal?: AbortSignal) =>
    h.steps.chatReply.stream(chatCtx(), 'Ile trwa rozpatrzenie zgłoszenia?', evaluation, (t) => tokens.push(t), signal);

  it('replays chat-reply-stream: tokens in order, full text = concatenation = recorded text; stream:true, no response_format', async () => {
    const cap = await capture('chat-reply-stream');
    h.replay.enqueue(cap);
    const tokens: string[] = [];
    const full = await run(tokens);
    expect(tokens.length).toBeGreaterThan(5);
    expect(tokens.join('')).toBe(full);
    expect(full).toBe(streamText(cap));
    expect(h.replay.requests[0]!.path).toBe('/api/v1/chat/completions');
    expect(body(0).stream).toBe(true);
    expect(body(0)).not.toHaveProperty('response_format');
    expect(system(0)).toContain(prompts.policy('RETURN'));
  });

  it('chunkDelayMs: tokens arrive incrementally, before the stream ends', async () => {
    h.replay.enqueue(await capture('chat-reply-stream'), { chunkDelayMs: 40 });
    const stamps: number[] = [];
    const start = Date.now();
    await h.steps.chatReply.stream(chatCtx(), 'q', evaluation, () => stamps.push(Date.now() - start));
    expect(stamps.length).toBeGreaterThan(5);
    expect(stamps.at(-1)! - stamps[0]!).toBeGreaterThan(200);
  });

  it('truncation mid-stream (truncateAfterBytes) -> LlmUnavailableError', async () => {
    h.replay.enqueue(await capture('chat-reply-stream'), { truncateAfterBytes: 3000 });
    const tokens: string[] = [];
    await expect(run(tokens)).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('last chunk finish_reason "stop" -> "error" (derived, D6 b) -> LlmUnavailableError', async () => {
    h.replay.enqueue(withFinishReason(await capture('chat-reply-stream'), 'error'));
    await expect(run([])).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('real 401 capture on a stream request -> LlmUnavailableError', async () => {
    h.replay.enqueue(await capture('error-401-invalid-key'));
    await expect(run([])).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('inactivity: chunkDelayMs (1.4 s) > LLM_TIMEOUT_SECONDS=1 -> LlmUnavailableError', async () => {
    await h.close();
    h = await startHarness(1);
    h.replay.enqueue(await capture('chat-reply-stream'), { chunkDelayMs: 1400 });
    await expect(run([])).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('no first chunk within the timeout (delayMs 1.6 s, timeout 1 s) -> LlmUnavailableError', async () => {
    await h.close();
    h = await startHarness(1);
    h.replay.enqueue(await capture('chat-reply-stream'), { delayMs: 1600 });
    await expect(run([])).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('caller abort mid-stream stops the request: rejects, no further tokens delivered', async () => {
    h.replay.enqueue(await capture('chat-reply-stream'), { chunkDelayMs: 80 });
    const ac = new AbortController();
    const tokens: string[] = [];
    const p = run(tokens, ac.signal);
    while (tokens.length < 2) await new Promise((r) => setTimeout(r, 10));
    ac.abort();
    await expect(p).rejects.toBeDefined();
    const seen = tokens.length;
    await new Promise((r) => setTimeout(r, 400));
    expect(tokens.length).toBe(seen);
  });
});
