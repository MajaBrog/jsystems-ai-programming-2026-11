import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPromptRepository } from '../../../src/ai/prompt/promptRepository.ts';
import { parsePolicyLimits, parseRuleIds } from '../../../src/ai/prompt/policyLimits.ts';
import { GUARD_RULE_IDS } from '../../../src/ai/guard/policyGuard.ts';

const repo = loadPromptRepository();

describe('promptRepository', () => {
  it('selects instructions by step and case type', () => {
    expect(repo.systemPrompt('vision', 'RETURN')).toBe(repo.systemPrompt('vision', 'RETURN'));
    expect(repo.systemPrompt('vision', 'RETURN')).not.toBe(repo.systemPrompt('vision', 'COMPLAINT'));
    expect(repo.systemPrompt('decision', 'RETURN')).toContain('RETURN');
    expect(repo.systemPrompt('chat-reply', 'COMPLAINT')).not.toBe(repo.systemPrompt('chat-reply', 'RETURN'));
  });

  it('uses one chat-evaluate prompt for both case types', () => {
    expect(repo.systemPrompt('chat-evaluate', 'RETURN')).toBe(repo.systemPrompt('chat-evaluate', 'COMPLAINT'));
  });

  it('returns exactly one policy per case type (AC-17)', () => {
    expect(repo.policy('RETURN')).toContain('# Regulamin zwrotów');
    expect(repo.policy('RETURN')).not.toContain('# Regulamin reklamacji');
    expect(repo.policy('COMPLAINT')).toContain('# Regulamin reklamacji');
    expect(repo.policy('COMPLAINT')).not.toContain('# Regulamin zwrotów');
  });

  it('parses non-empty unique rule ids per policy', () => {
    const r = repo.ruleIds('RETURN');
    const c = repo.ruleIds('COMPLAINT');
    expect(r.size).toBeGreaterThan(5);
    expect([...r].every((id) => id.startsWith('Z-'))).toBe(true);
    expect([...c].every((id) => id.startsWith('R-'))).toBe(true);
  });

  it('knows every rule id the guard cites', () => {
    for (const id of GUARD_RULE_IDS.RETURN) expect(repo.ruleIds('RETURN').has(id)).toBe(true);
    for (const id of GUARD_RULE_IDS.COMPLAINT) expect(repo.ruleIds('COMPLAINT').has(id)).toBe(true);
  });

  it('exposes limits parsed from the policy text', () => {
    expect(repo.limits).toEqual({ returnDays: 14, complaintYears: 2 });
  });

  it('fails at load when a resource file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'res-'));
    mkdirSync(join(dir, 'prompts'));
    mkdirSync(join(dir, 'policies'));
    expect(() => loadPromptRepository(dir)).toThrow(/vision-return|missing|ENOENT/i);
  });

  it('fails at load when a policy lacks the limit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'res-'));
    cpSync(new URL('../../../resources/', import.meta.url), dir, { recursive: true });
    writeFileSync(join(dir, 'policies', 'return-policy.pl.md'), '**Z-2.1** Termin jest dowolny.\n');
    expect(() => loadPromptRepository(dir)).toThrow(/Z-2\.1/);
  });
});

describe('policyLimits', () => {
  const ret = '**Z-2.1** Klient może zwrócić urządzenie w terminie 7 dni od otrzymania.\n';
  const comp = '**R-2.1** Odpowiedzialność trwa 3 lata od dostarczenia.\n';
  it('parses days and years from the rule text', () => {
    expect(parsePolicyLimits(ret, comp)).toEqual({ returnDays: 7, complaintYears: 3 });
  });
  it('accepts "2 lat"', () => {
    expect(parsePolicyLimits(ret, '**R-2.1** W ciągu 2 lat od dostarczenia.').complaintYears).toBe(2);
  });
  it('throws when R-2.1 is missing', () => {
    expect(() => parsePolicyLimits(ret, '**R-2.2** Brak.')).toThrow(/R-2\.1/);
  });
  it('throws on duplicate rule ids', () => {
    expect(() => parseRuleIds('**Z-1.1** a\n**Z-1.1** b')).toThrow(/Z-1\.1/);
  });
});
