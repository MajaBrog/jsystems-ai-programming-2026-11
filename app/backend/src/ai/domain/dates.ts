import type { IsoDate } from './types.ts';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: IsoDate): { y: number; m: number; d: number } {
  const match = ISO.exec(date);
  if (!match) throw new Error(`Invalid ISO date: ${date}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  return { y, m, d };
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Calendar addition; 29 Feb clamps to 28 Feb in non-leap target years. */
export function addYears(date: IsoDate, years: number): IsoDate {
  const { y, m, d } = parse(date);
  const ty = y + years;
  const lastDay = new Date(Date.UTC(ty, m, 0)).getUTCDate();
  return `${pad(ty, 4)}-${pad(m, 2)}-${pad(Math.min(d, lastDay), 2)}`;
}
