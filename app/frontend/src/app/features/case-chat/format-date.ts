/** yyyy-MM-dd -> dd.MM.yyyy (Polish display format, ADR-004 D4). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}
