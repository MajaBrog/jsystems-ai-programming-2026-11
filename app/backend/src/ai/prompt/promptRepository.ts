import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { CaseType, PolicyLimits } from '../domain/types.ts';
import { parsePolicyLimits, parseRuleIds } from './policyLimits.ts';

export type PromptStep = 'vision' | 'decision' | 'chat-reply' | 'chat-evaluate';

export type PromptRepository = {
  /** Instruction markdown for a step; `chat-evaluate` is shared by both case types. */
  systemPrompt(step: PromptStep, caseType: CaseType): string;
  /** The single policy document of a case type (AC-17). */
  policy(caseType: CaseType): string;
  ruleIds(caseType: CaseType): ReadonlySet<string>;
  limits: PolicyLimits;
};

const DEFAULT_DIR = new URL('../../../resources/', import.meta.url);

function read(root: URL, relative: string): string {
  try {
    return readFileSync(new URL(relative, root), 'utf8');
  } catch (cause) {
    throw new Error(`Missing resource file ${relative}`, { cause });
  }
}

/** Loads all prompts and policies once; throws if any is missing or a policy is malformed. */
export function loadPromptRepository(dir: URL | string = DEFAULT_DIR): PromptRepository {
  const root = typeof dir === 'string' ? pathToFileURL(dir.endsWith('/') ? dir : `${dir}/`) : dir;
  const suffix = (t: CaseType) => t.toLowerCase();

  const prompts = new Map<string, string>();
  for (const step of ['vision', 'decision', 'chat-reply'] as const) {
    for (const type of ['RETURN', 'COMPLAINT'] as const) {
      prompts.set(`${step}:${type}`, read(root, `prompts/${step}-${suffix(type)}.md`));
    }
  }
  prompts.set('chat-evaluate', read(root, 'prompts/chat-evaluate.md'));

  const policies = {
    RETURN: read(root, 'policies/return-policy.pl.md'),
    COMPLAINT: read(root, 'policies/complaint-policy.pl.md'),
  };
  const limits = parsePolicyLimits(policies.RETURN, policies.COMPLAINT);
  const ids = { RETURN: parseRuleIds(policies.RETURN), COMPLAINT: parseRuleIds(policies.COMPLAINT) };

  return {
    systemPrompt: (step, caseType) =>
      step === 'chat-evaluate' ? (prompts.get('chat-evaluate') as string) : (prompts.get(`${step}:${caseType}`) as string),
    policy: (caseType) => policies[caseType],
    ruleIds: (caseType) => ids[caseType],
    limits,
  };
}
