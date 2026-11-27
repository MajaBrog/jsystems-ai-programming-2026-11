import { expect, test as base, type Page } from '@playwright/test';
import path from 'node:path';

export const IMAGES = path.resolve(import.meta.dirname, '../../../assets/example-images');
export const PHOTOS = ['laptop-1.png', 'laptop-2.webp', 'phone-1.jpg', 'phone-2.jpeg', 'phone-3.jpeg'] as const;
export const SHOTS = path.resolve(import.meta.dirname, '../screenshots');
export const NOTICE = 'To jest wstępna ocena. Ostateczną decyzję podejmie zespół serwisowy po otrzymaniu i sprawdzeniu urządzenia.';
export const BADGES = ['Przyjęte wstępnie', 'Odrzucone wstępnie', 'Wymaga weryfikacji'] as const;

/** TAC-004-06: every test fails on any console error or uncaught page error. */
export const test = base.extend<{ consoleErrors: string[]; allowedConsole: RegExp[] }>({
  /** Expected, documented browser-logged errors (e.g. the 404 the browser logs for an unknown case URL). */
  allowedConsole: [[], { option: true }],
  consoleErrors: [
    async ({ page, allowedConsole }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' && !allowedConsole.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await use(errors);
      expect(errors, 'browser console errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export function daysAgo(n: number, years = 0): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - n);
  return d;
}
const p2 = (n: number) => String(n).padStart(2, '0');
export const plDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;

export interface FormInput {
  type: 'Zwrot' | 'Reklamacja';
  category: string;
  model: string;
  date: Date;
  description?: string;
  photo: string;
}

export async function fillForm(page: Page, f: FormInput) {
  await page.goto('/');
  await page.getByRole('radio', { name: f.type }).or(page.getByRole('button', { name: f.type, exact: true })).first().click();
  // Keyboard-open: at 360 px the click is intercepted by the sticky header / floating label (reported to the orchestrator).
  const select = page.getByRole('combobox', { name: /Kategoria urządzenia/ });
  await select.focus();
  await select.press('Enter');
  await page.getByRole('option', { name: f.category, exact: true }).click();
  await page.getByLabel('Nazwa modelu').fill(f.model);
  await page.getByLabel('Data zakupu').fill(plDate(f.date));
  if (f.description) await page.locator('textarea').first().fill(f.description);
  await page.locator('input[type=file]').setInputFiles(path.join(IMAGES, f.photo));
  await expect(page.getByText(f.photo.replace(/^/, ''), { exact: true })).toBeVisible();
}

export type Outcome = 'chat' | 'unusable';

/** Submits and waits for the real model: either the chat opens or the unusable-photo state shows. */
export async function submit(page: Page): Promise<Outcome> {
  await page.getByRole('button', { name: 'Wyślij zgłoszenie' }).click();
  const chat = page.waitForURL(/\/case\/[0-9a-f-]{36}$/, { timeout: 120_000 }).then(() => 'chat' as const);
  const unusable = page
    .getByTestId('photo-unusable')
    .waitFor({ state: 'visible', timeout: 120_000 })
    .then(() => 'unusable' as const);
  const serviceError = page
    .getByTestId('service-error')
    .waitFor({ state: 'visible', timeout: 120_000 })
    .then(async () => {
      throw new Error(`Service error shown on submit: ${(await page.getByTestId('service-error').innerText()).trim()}`);
    });
  // Swallow the losers' rejections (their waits end when the page closes) so no promise dangles.
  const racers = [chat, unusable, serviceError];
  try {
    return await Promise.race(racers);
  } finally {
    racers.forEach((r) => r.catch(() => undefined));
  }
}

export const firstAgent = (page: Page) => page.locator('[data-role=AGENT]').first();

export async function badgeText(page: Page): Promise<string> {
  const t = (await page.locator('app-case-summary-panel dl app-assessment-badge').innerText()).trim();
  const hit = BADGES.find((b) => t.includes(b));
  expect(hit, `badge text "${t}"`).toBeTruthy();
  return hit!;
}

/** Submits a return/complaint; if the model calls the photo unusable, tries the next photo. */
export async function reachChat(page: Page, base: Omit<FormInput, 'photo'>, photos: readonly string[] = PHOTOS) {
  for (const photo of photos) {
    await fillForm(page, { ...base, photo });
    if ((await submit(page)) === 'chat') {
      await expect(firstAgent(page)).toContainText(NOTICE);
      return photo;
    }
  }
  throw new Error('Every example photo was judged unusable by the real model; cannot reach the chat');
}

/** Waits until the streamed agent reply has stopped changing (SSE has no DOM completion marker). */
async function settled(page: Page, locator: ReturnType<Page['locator']>) {
  let last = '';
  let stable = 0;
  await expect
    .poll(async () => {
      const t = (await locator.innerText()).trim();
      const busy = (await page.getByTestId('typing').count()) > 0;
      stable = t === last && t.length > 0 && !busy ? stable + 1 : 0;
      last = t;
      return stable;
    }, { intervals: [500], timeout: 120_000 })
    .toBeGreaterThanOrEqual(6); // 3 s without change
}

export async function sendMessage(page: Page, text: string) {
  const before = await page.locator('[data-role=AGENT]').count();
  await page.getByLabel('Napisz wiadomość').fill(text);
  await page.getByTestId('send').click();
  await expect(page.locator('[data-role=AGENT]')).toHaveCount(before + 1);
  const reply = page.locator('[data-role=AGENT]').last();
  await settled(page, reply);
  return reply;
}
