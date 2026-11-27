import { join } from 'node:path';
import { createLlmClient } from '../../../src/ai/client/llm-client.ts';
import { loadPromptRepository } from '../../../src/ai/prompt/promptRepository.ts';
import { createAiSteps } from '../../../src/ai/steps/ai-steps.ts';
import type { AiSteps } from '../../../src/ai/steps/types.ts';
import type { Capture } from '../../support/capture-store.ts';
import { loadCapture } from '../../support/capture-store.ts';
import { startReplayServer, type ReplayServer } from '../../support/replay-server.ts';
import { testConfig } from '../../support/test-config.ts';

const CAPTURE_DIR = join(import.meta.dirname, '../../captures/openrouter');
export const prompts = loadPromptRepository();

export const capture = (name: string) => loadCapture(CAPTURE_DIR, name);

export type Harness = { replay: ReplayServer; steps: AiSteps; close(): Promise<void> };

/** Real AI steps (real OpenAI SDK client) pointed at the replay server. */
export async function startHarness(timeoutSeconds = 5): Promise<Harness> {
  const replay = await startReplayServer();
  const config = testConfig({ OPENROUTER_BASE_URL: `${replay.url}/api/v1`, LLM_TIMEOUT_SECONDS: String(timeoutSeconds) });
  const steps = createAiSteps({ client: createLlmClient(config), config, prompts });
  return { replay, steps, close: () => replay.close() };
}

function note(base: Capture, name: string, change: string, body: Buffer, status = base.meta.response.status): Capture {
  return {
    meta: {
      ...base.meta,
      name,
      derivedFrom: base.meta.name,
      changes: [...(base.meta.changes ?? []), change],
      response: { ...base.meta.response, status },
    },
    body,
  };
}

/** ADR-002 D6 (b): derive a variant of a non-streaming capture by editing fields of the assistant JSON content. */
export function withContent(base: Capture, change: string, edit: (content: Record<string, unknown>) => void): Capture {
  const envelope = JSON.parse(base.body.toString('utf8').trim());
  const content = JSON.parse(envelope.choices[0].message.content);
  edit(content);
  envelope.choices[0].message.content = JSON.stringify(content);
  return note(base, `${base.meta.name}+derived`, change, Buffer.from(JSON.stringify(envelope)));
}

/** ADR-002 D6 (b): an error capture with another status and `error.code`. */
export function withStatus(base: Capture, status: number): Capture {
  const body = JSON.parse(base.body.toString('utf8'));
  body.error.code = status;
  return note(base, `${base.meta.name}+status-${status}`, `status and error.code changed to ${status}`, Buffer.from(JSON.stringify(body)), status);
}

/** ADR-002 D6 (b): the stream capture with the final chunk's finish_reason changed. */
export function withFinishReason(base: Capture, reason: string): Capture {
  const text = base.body.toString('utf8');
  const changed = text.replace('"finish_reason":"stop"', `"finish_reason":"${reason}"`);
  if (changed === text) throw new Error('capture has no finish_reason "stop" to change');
  return note(base, `${base.meta.name}+finish-${reason}`, `last chunk finish_reason "stop" -> "${reason}"`, Buffer.from(changed));
}

/** Concatenated delta.content of a recorded SSE stream (the expected reply text). */
export function streamText(base: Capture): string {
  let out = '';
  for (const line of base.body.toString('utf8').split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    out += JSON.parse(line.slice(6)).choices[0]?.delta?.content ?? '';
  }
  return out;
}
