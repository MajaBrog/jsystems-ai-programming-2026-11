/**
 * T05 — OpenRouter capture spike (ADR-002 D6, ADR-005). LIVE: calls the real OpenRouter.
 * Run from app/backend:  bash ../scripts/with-env.sh npm run test:live
 *
 * Every exchange goes through the recording proxy, so status, headers (no Authorization) and the raw
 * body / SSE bytes are saved verbatim to test/captures/openrouter/. Inputs: real photos from
 * assets/example-images/ (never described to the model) and invented form data.
 * Assertions here are about the wire format only — never about what the model sees in a photo.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLlmClient } from '../../src/ai/client/llm-client.ts';
import type { Assessment, CaseForm, ChatContext, ChatEvaluation, ImageAnalysis } from '../../src/ai/domain/types.ts';
import { loadPromptRepository } from '../../src/ai/prompt/promptRepository.ts';
import {
  buildDecisionRequest,
  buildEvaluateRequest,
  buildReplyRequest,
  buildVisionRequest,
  type WireRequest,
} from '../../src/ai/steps/requests.ts';
import { systemClock } from '../../src/config/clock.ts';
import { loadConfig, type AppConfig } from '../../src/config/config.ts';
import { compressForModel } from '../../src/imaging/image-compressor.ts';
import { startRecordingProxy, type RecordingProxy } from '../support/recording-proxy.ts';

const CAPTURE_DIR = fileURLToPath(new URL('../captures/openrouter/', import.meta.url));
const IMAGES = fileURLToPath(new URL('../../../../assets/example-images/', import.meta.url));
const prompts = loadPromptRepository();
const today = systemClock.today();

function daysAgo(n: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

let proxy: RecordingProxy;
let config: AppConfig;
let client: OpenAI;
const findings: Record<string, unknown> = { capturedOn: today };
const analyses: Record<string, ImageAnalysis> = {};
const assessments: Record<string, Assessment> = {};

async function call(name: string, req: WireRequest, note?: string): Promise<unknown> {
  proxy.nextCaptureName(name, note);
  // `reasoning` is an OpenRouter body field the SDK does not model; it is sent as-is.
  const res = await client.chat.completions.create(req as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming);
  await proxy.flush();
  const content = res.choices[0]?.message.content ?? '';
  return JSON.parse(content);
}

async function photo(file: string): Promise<Buffer> {
  return (await compressForModel(await readFile(IMAGES + file))).jpeg;
}

beforeAll(async () => {
  proxy = await startRecordingProxy({ upstream: 'https://openrouter.ai', captureDir: CAPTURE_DIR });
  config = loadConfig({ ...process.env, OPENROUTER_BASE_URL: `${proxy.url}/api/v1` });
  client = createLlmClient(config);
  findings['model'] = config.llmModel;
  findings['visionModel'] = config.llmVisionModel;
});

afterAll(async () => {
  await proxy?.close();
  await writeFile(`${CAPTURE_DIR}spike-findings.json`, JSON.stringify(findings, null, 2) + '\n');
});

describe('OpenRouter capture spike', () => {
  const laptopReturn: CaseForm = { caseType: 'RETURN', deviceCategory: 'LAPTOP', modelName: 'Testowy Laptop 14', purchaseDate: daysAgo(3), description: null };
  const phoneComplaint: CaseForm = {
    caseType: 'COMPLAINT', deviceCategory: 'SMARTPHONE', modelName: 'Testowy Telefon X', purchaseDate: daysAgo(200),
    description: 'Urządzenie przestało działać poprawnie podczas normalnego użytkowania.',
  };

  it('1a vision usable — laptop photo, RETURN (image + json_schema in one call)', async () => {
    analyses['laptopReturn'] = (await call('vision-return-laptop-1', buildVisionRequest({ config, prompts, form: laptopReturn, jpeg: await photo('laptop-1.png') }))) as ImageAnalysis;
    expect(typeof analyses['laptopReturn'].usable).toBe('boolean');
  });

  it('1b vision usable — phone photo, COMPLAINT', async () => {
    analyses['phoneComplaint'] = (await call('vision-complaint-phone-1', buildVisionRequest({ config, prompts, form: phoneComplaint, jpeg: await photo('phone-1.jpg') }))) as ImageAnalysis;
    expect(typeof analyses['phoneComplaint'].usable).toBe('boolean');
  });

  it('2 vision category mismatch — phone photo submitted as TV', async () => {
    const form: CaseForm = { ...laptopReturn, deviceCategory: 'TV', modelName: 'Testowy Telewizor 55' };
    const a = (await call('vision-return-phone-2-as-tv', buildVisionRequest({ config, prompts, form, jpeg: await photo('phone-2.jpeg') }), 'phone photo submitted as category TV')) as ImageAnalysis;
    findings['mismatchResult'] = { usable: a.usable, unusableReason: a.unusableReason, matchesCategory: a.matchesCategory };
    expect(typeof a.matchesCategory).toBe('boolean');
  });

  it('3a decision — RETURN', async () => {
    const p = await call('decision-return', buildDecisionRequest({ config, prompts, form: laptopReturn, analysis: analyses['laptopReturn']!, today }));
    assessments['return'] = { ...(p as Assessment), source: 'DECISION', previousCategory: null, guardApplied: [] };
    expect(['ACCEPT', 'REJECT', 'NEEDS_REVIEW']).toContain((p as Assessment).category);
  });

  it('3b decision — COMPLAINT', async () => {
    const p = await call('decision-complaint', buildDecisionRequest({ config, prompts, form: phoneComplaint, analysis: analyses['phoneComplaint']!, today }));
    assessments['complaint'] = { ...(p as Assessment), source: 'DECISION', previousCategory: null, guardApplied: [] };
    expect(['ACCEPT', 'REJECT', 'NEEDS_REVIEW']).toContain((p as Assessment).category);
  });

  const returnCtx = (): ChatContext => ({
    form: laptopReturn, analysis: analyses['laptopReturn']!, currentAssessment: assessments['return']!,
    messages: [{ author: 'AGENT', text: 'Wstępna ocena została przygotowana na podstawie formularza i zdjęcia.' }], today,
  });

  let unchangedEval: ChatEvaluation;
  it('4a chat-evaluate — neutral question', async () => {
    unchangedEval = (await call('chat-evaluate-neutral', buildEvaluateRequest({ config, prompts, ctx: returnCtx(), customerText: 'Ile trwa rozpatrzenie zgłoszenia?' }))) as ChatEvaluation;
    findings['evaluateNeutral'] = { categoryChanged: unchangedEval.categoryChanged };
    expect(typeof unchangedEval.categoryChanged).toBe('boolean');
  });

  it('4b chat-evaluate — physical-store purchase statement', async () => {
    const e = (await call('chat-evaluate-physical-store', buildEvaluateRequest({ config, prompts, ctx: returnCtx(), customerText: 'Chcę doprecyzować: kupiłem ten laptop w sklepie stacjonarnym, nie przez internet.' }))) as ChatEvaluation;
    findings['evaluatePhysicalStore'] = { categoryChanged: e.categoryChanged, newCategory: e.newCategory, ruleIds: e.justification.map((j) => j.ruleId) };
    expect(typeof e.categoryChanged).toBe('boolean');
  });

  it('5 streaming chat reply', async () => {
    proxy.nextCaptureName('chat-reply-stream');
    const req = buildReplyRequest({ config, prompts, ctx: returnCtx(), customerText: 'Ile trwa rozpatrzenie zgłoszenia?', evaluation: unchangedEval });
    const started = Date.now();
    let firstTokenMs: number | null = null;
    let text = '';
    let chunks = 0;
    const stream = await client.chat.completions.create(req as unknown as OpenAI.ChatCompletionCreateParamsStreaming);
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta && firstTokenMs === null) firstTokenMs = Date.now() - started;
      text += delta;
      chunks++;
    }
    await proxy.flush();
    const raw = await readFile(`${CAPTURE_DIR}chat-reply-stream.body`, 'utf8');
    findings['stream'] = {
      chunks, firstTokenMs, textLength: text.length,
      keepAliveCommentSeen: raw.includes(': OPENROUTER PROCESSING'),
      endsWithDone: raw.trimEnd().endsWith('data: [DONE]'),
      sdkIgnoredKeepAlive: true,
    };
    expect(text.length).toBeGreaterThan(0);
  });

  it('6a HTTP 401 — invalid key', async () => {
    const bad = createLlmClient({ ...config, openRouterApiKey: 'sk-or-v1-invalid-key-for-capture' });
    proxy.nextCaptureName('error-401-invalid-key');
    const err = await bad.chat.completions.create({ model: config.llmModel, messages: [{ role: 'user', content: 'test' }] }).catch((e: unknown) => e);
    await proxy.flush();
    findings['error401'] = { sdkErrorClass: (err as Error).constructor.name, status: (err as { status?: number }).status };
    expect((err as { status?: number }).status).toBe(401);
  });

  it('6b HTTP 400/404 — unknown model id', async () => {
    proxy.nextCaptureName('error-unknown-model');
    const err = await client.chat.completions.create({ model: 'nonexistent-vendor/nonexistent-model-xyz', messages: [{ role: 'user', content: 'test' }] }).catch((e: unknown) => e);
    await proxy.flush();
    findings['errorUnknownModel'] = { sdkErrorClass: (err as Error).constructor.name, status: (err as { status?: number }).status };
    expect([400, 404]).toContain((err as { status?: number }).status);
  });

  it('base URL join: requests went to /api/v1/chat/completions', async () => {
    const meta = JSON.parse(await readFile(`${CAPTURE_DIR}decision-return.meta.json`, 'utf8'));
    findings['requestPath'] = meta.request.path;
    findings['attributionHeadersSent'] = Object.keys(meta.request.headers).filter((h: string) => h.includes('title'));
    expect(meta.request.path).toBe('/api/v1/chat/completions');
  });
});
