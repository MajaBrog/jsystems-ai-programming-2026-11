import { expect, test, BADGES, NOTICE, PHOTOS, SHOTS, badgeText, daysAgo, fillForm, firstAgent, plDate, submit } from './helpers';

test.describe('Full return flow (AC-23/24/29, AC-14)', () => {
  for (const photo of PHOTOS) {
    test(`return with ${photo}`, async ({ page }) => {
      const date = daysAgo(3);
      await fillForm(page, { type: 'Zwrot', category: photo.startsWith('laptop') ? 'Laptop' : 'Smartfon', model: 'Model testowy E2E', date, photo });
      if (photo === PHOTOS[0]) await page.screenshot({ path: `${SHOTS}/form-filled.png`, fullPage: true });
      const outcomePromise = submit(page);
      await expect(page.getByText(/Analizujemy zdjęcie…|Przygotowujemy ocenę…/)).toBeVisible();
      if (photo === PHOTOS[0]) await page.screenshot({ path: `${SHOTS}/form-submitting.png`, fullPage: true });
      const outcome = await outcomePromise;

      if (outcome === 'unusable') {
        // AC-14: values kept, photo cleared, reason + tips shown, no assessment
        await page.screenshot({ path: `${SHOTS}/form-unusable-${photo}.png`, fullPage: true });
        await expect(page.getByLabel('Nazwa modelu')).toHaveValue('Model testowy E2E');
        await expect(page.getByLabel('Data zakupu')).toHaveValue(plDate(date));
        await expect(page.locator('app-photo-drop-zone .file-name')).toHaveCount(0);
        await expect(page).toHaveURL(/\/$/);
        return;
      }

      await expect(page).toHaveURL(/\/case\/[0-9a-f-]{36}$/);
      const msg = firstAgent(page);
      await expect(msg).toContainText('Dzień dobry');
      await expect(msg).toContainText('Wstępna ocena');
      await expect(msg.getByRole('heading', { name: 'Uzasadnienie' })).toBeVisible();
      await expect(msg.getByRole('heading', { name: 'Następne kroki' })).toBeVisible();
      expect((await msg.innerText()).trim().endsWith(NOTICE)).toBe(true);
      // AC-29: no raw markdown
      expect(await msg.innerText()).not.toMatch(/###|\*\*/);
      expect(BADGES).toContain(await badgeText(page));
      const panel = page.locator('app-case-summary-panel');
      await expect(panel).toContainText('Zwrot');
      await expect(panel).toContainText('Model testowy E2E');
      await expect(panel).toContainText(plDate(date));
      await expect(panel).toContainText(photo.startsWith('laptop') ? 'Laptop' : 'Smartfon');
      await expect(panel.getByRole('img', { name: 'Zdjęcie urządzenia' })).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/chat-${photo}.png`, fullPage: true });
    });
  }
});
