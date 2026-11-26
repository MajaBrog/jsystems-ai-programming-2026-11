/** Injectable "today" in Europe/Warsaw (ADR-001 §3 orchestration rules). */
export type Clock = {
  /** Current calendar date in Europe/Warsaw as ISO `YYYY-MM-DD`. */
  today(): string;
  /** Current instant as ISO-8601 timestamp. */
  now(): string;
};

const warsawDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const systemClock: Clock = {
  today: () => warsawDate.format(new Date()),
  now: () => new Date().toISOString(),
};

export function fixedClock(today: string, now = `${today}T10:00:00.000Z`): Clock {
  return { today: () => today, now: () => now };
}
