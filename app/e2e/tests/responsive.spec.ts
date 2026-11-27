import { expect, test, daysAgo, reachChat, SHOTS } from './helpers';

test.use({ viewport: { width: 360, height: 740 } });

const noHScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('no horizontal scroll at 360x740 on form and chat (AC-37)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Wyślij zgłoszenie' })).toBeVisible();
  expect(await noHScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/form-360.png`, fullPage: true });

  await reachChat(page, { type: 'Zwrot', category: 'Smartfon', model: 'Model testowy E2E', date: daysAgo(3) });
  expect(await noHScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/chat-360.png`, fullPage: true });
});
