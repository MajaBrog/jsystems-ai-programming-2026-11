import { expect, test, daysAgo, firstAgent, plDate, reachChat, sendMessage, SHOTS } from './helpers';

const MONTHS = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];

test.describe.serial('Chat context and session (AC-26, AC-33/34/35, AC-36)', () => {
  const date = daysAgo(3);
  let url = '';
  let historyText = '';

  test('chat answers from form data (AC-26) and agent text is Polish (AC-36)', async ({ page }) => {
    await reachChat(page, { type: 'Zwrot', category: 'Smartfon', model: 'Model testowy E2E', date });
    const first = await firstAgent(page).innerText();
    for (const en of ['Justification', 'Next steps', 'Assessment:', 'Preliminary assessment', 'Hello,']) expect(first).not.toContain(en);
    expect(first).toContain('Uzasadnienie');
    expect(first).toContain('Następne kroki');

    const reply = await sendMessage(page, 'Jaką datę zakupu podałem?');
    const text = await reply.innerText();
    const d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const variants = [
      plDate(date), `${d}.${p2(m)}.${y}`, `${d}.${m}.${y}`, `${y}-${p2(m)}-${p2(d)}`, `${p2(d)}/${p2(m)}/${y}`,
      `${d} ${MONTHS[m - 1]} ${y}`, `${p2(d)} ${MONTHS[m - 1]} ${y}`,
    ];
    expect(variants.some((v) => text.includes(v)), `reply "${text}" should contain the form date`).toBe(true);
    expect(text).not.toMatch(/\b(Justification|Next steps|Preliminary assessment)\b/);
    await page.screenshot({ path: `${SHOTS}/chat-with-reply.png`, fullPage: true });
    url = page.url();
    historyText = await page.locator('[data-role]').allInnerTexts().then((a) => a.join('\n---\n'));
  });

  test('reload and a fresh page show identical history (AC-33/34)', async ({ page, context }) => {
    await page.goto(url);
    await expect(firstAgent(page)).toBeVisible();
    await expect(page.locator('[data-role]')).toHaveCount(historyText.split('\n---\n').length);
    expect((await page.locator('[data-role]').allInnerTexts()).join('\n---\n')).toBe(historyText);
    await page.reload();
    await expect(page.locator('[data-role]')).toHaveCount(historyText.split('\n---\n').length);
    expect((await page.locator('[data-role]').allInnerTexts()).join('\n---\n')).toBe(historyText);
    const other = await context.newPage();
    await other.goto(url);
    await expect(other.locator('[data-role]')).toHaveCount(historyText.split('\n---\n').length);
    expect((await other.locator('[data-role]').allInnerTexts()).join('\n---\n')).toBe(historyText);
  });

  test('"Nowe zgłoszenie" opens an empty form and leaves the old case unchanged (AC-35)', async ({ page }) => {
    await page.goto(url);
    await expect(firstAgent(page)).toBeVisible();
    await page.getByRole('link', { name: 'Nowe zgłoszenie' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel('Nazwa modelu')).toHaveValue('');
    await expect(page.getByLabel('Data zakupu')).toHaveValue('');
    await expect(page.locator('app-photo-drop-zone .file-name')).toHaveCount(0);
    await page.goto(url);
    await expect(page.locator('[data-role]')).toHaveCount(historyText.split('\n---\n').length);
    expect((await page.locator('[data-role]').allInnerTexts()).join('\n---\n')).toBe(historyText);
  });
});

test.describe('not found', () => {
  // The browser itself logs the API's 404 as a console error; that is the expected response here.
  test.use({ allowedConsole: [/Failed to load resource: the server responded with a status of 404/] });
  test('unknown case UUID shows "Nie znaleziono zgłoszenia" (AC-34)', async ({ page }) => {
  await page.goto('/case/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: 'Nie znaleziono zgłoszenia' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/not-found.png`, fullPage: true });
  await page.getByRole('link', { name: 'Nowe zgłoszenie' }).last().click();
  await expect(page).toHaveURL(/\/$/);
});
});
