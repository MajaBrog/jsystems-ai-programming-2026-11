import { expect, test, daysAgo, firstAgent, badgeText, reachChat, sendMessage, NOTICE, SHOTS } from './helpers';

test('Late return (today-30d) is never accepted and cites Z-2.1 (AC-18)', async ({ page }) => {
  await reachChat(page, { type: 'Zwrot', category: 'Smartfon', model: 'Model testowy E2E', date: daysAgo(30) });
  expect(await badgeText(page)).not.toBe('Przyjęte wstępnie');
  await expect(firstAgent(page)).toContainText('Z-2.1');
});

test('Old complaint (today-3y) is never accepted and cites R-2.1 (AC-20)', async ({ page }) => {
  await reachChat(page, {
    type: 'Reklamacja', category: 'Smartfon', model: 'Model testowy E2E', date: daysAgo(3, 3),
    description: 'Urządzenie przestało się włączać, ekran pozostaje czarny po naciśnięciu przycisku zasilania.',
  });
  expect(await badgeText(page)).not.toBe('Przyjęte wstępnie');
  await expect(firstAgent(page)).toContainText('R-2.1');
});

test('Physical-store revision changes the assessment with a notice (AC-28)', async ({ page }) => {
  // Start from a non-REJECT assessment so that a change to REJECT is observable.
  const order = ['phone-3.jpeg', 'phone-1.jpg', 'phone-2.jpeg', 'laptop-2.webp', 'laptop-1.png'];
  let started: string | null = null;
  const tried: string[] = [];
  for (const photo of order) {
    await reachChat(page, { type: 'Zwrot', category: photo.startsWith('laptop') ? 'Laptop' : 'Smartfon', model: 'Model testowy E2E', date: daysAgo(3) }, [photo]).catch(() => null);
    if (!/\/case\//.test(page.url())) { tried.push(`${photo}: unusable`); continue; }
    const b = await badgeText(page);
    tried.push(`${photo}: ${b}`);
    if (b !== 'Odrzucone wstępnie') { started = b; break; }
  }
  if (!started) throw new Error(`No example photo produced a non-REJECT initial assessment, cannot test AC-28. Tried: ${tried.join('; ')}`);

  const reply = await sendMessage(page, 'Kupiłem to urządzenie w sklepie stacjonarnym, nie przez internet.');
  await expect(reply).toContainText(/^\s*Wstępna ocena zmieniona:/);
  expect((await reply.innerText()).trim().startsWith('Wstępna ocena zmieniona:')).toBe(true);
  await expect(page.locator('app-case-summary-panel dl app-assessment-badge')).toContainText('Odrzucone wstępnie');
  await page.screenshot({ path: `${SHOTS}/chat-revised.png`, fullPage: true });
  expect(NOTICE.length).toBeGreaterThan(0);
});
