import type { PolicyLimits } from '../domain/types.ts';

const RULE_ID = /\*\*([ZR]-\d+\.\d+)\*\*/g;

/** All rule ids (`**Z-2.1**`) of a policy document; fails on duplicates. */
export function parseRuleIds(policyText: string): Set<string> {
  const ids = new Set<string>();
  for (const match of policyText.matchAll(RULE_ID)) {
    const id = match[1] as string;
    if (ids.has(id)) throw new Error(`Duplicate rule id ${id} in policy`);
    ids.add(id);
  }
  return ids;
}

function ruleLine(policyText: string, ruleId: string): string {
  const line = policyText.split('\n').find((l) => l.startsWith(`**${ruleId}**`));
  if (!line) throw new Error(`Policy rule ${ruleId} not found`);
  return line;
}

/** Reads `Z-2.1` (N dni) and `R-2.1` (N lat/lata) from the policy text; fails when missing. */
export function parsePolicyLimits(returnPolicy: string, complaintPolicy: string): PolicyLimits {
  const days = /(\d+)\s+dni\b/.exec(ruleLine(returnPolicy, 'Z-2.1'));
  if (!days) throw new Error('Policy rule Z-2.1 does not state the return period in days ("N dni")');
  const years = /(\d+)\s+(?:lat|lata)\b/.exec(ruleLine(complaintPolicy, 'R-2.1'));
  if (!years) throw new Error('Policy rule R-2.1 does not state the liability period in years ("N lat")');
  return { returnDays: Number(days[1]), complaintYears: Number(years[1]) };
}
