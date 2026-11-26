import { expect, test } from '@playwright/test';

test('app shell loads and the backend is healthy through the dev proxy', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(await health.json()).toEqual({ status: 'UP' });
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'DevPowers' })).toBeVisible();
});
