import { test, expect } from '@playwright/test';

test('context changes respond immediately and retain filters and browser history', async ({
  page,
}) => {
  await page.goto('/de/de/filme/?genre=drama&sort=year');
  const header = page.locator('.header-controls');
  let releaseNavigation!: () => void;
  const navigation = new Promise<void>((resolve) => {
    releaseNavigation = resolve;
  });
  // Delay only the chosen destination, including any intentional prefetch.
  await page.route('**/fr/de/films/**', async (route) => {
    await navigation;
    await route.continue();
  });
  try {
    await header
      .getByRole('combobox', { name: 'Sprache', exact: true })
      .click();
    await page.getByRole('option', { name: 'Français', exact: true }).click();
    await expect(page.locator('.site-header')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await expect(
      page.locator('.site-header').getByRole('status'),
    ).toBeVisible();
    await expect(
      header.getByRole('combobox', { name: 'Sprache', exact: true }),
    ).toContainText('Français');
    await expect(
      header.getByRole('combobox', { name: 'Sprache', exact: true }),
    ).toBeDisabled();
  } finally {
    releaseNavigation();
  }
  await expect(page).toHaveURL(/\/fr\/de\/films\/\?genre=drama&sort=year$/);
  await expect(page.locator('.site-header')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await expect(page.locator('.site-header').getByRole('status')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.goBack();
  await expect(page).toHaveURL(/\/de\/de\/filme\/\?genre=drama&sort=year$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.goForward();
  await expect(page).toHaveURL(/\/fr\/de\/films\/\?genre=drama&sort=year$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('home retains both searches and returns real 404s for missing titles', async ({
  page,
  request,
}) => {
  await page.goto('/de/de/');
  await expect(page.locator('#home-title-search')).toBeEnabled();
  await expect(page.locator('.feature-grid')).toBeVisible();
  await expect(page.locator('.home-shelf').first()).toBeVisible();
  await page.getByRole('tab', { name: /KI/ }).click();
  await expect(page.locator('#home-scene-description')).toBeEnabled();
  await page
    .locator('#home-scene-description')
    .fill('Eine Gruppe reist durch ein Wurmloch ins Weltall.');
  await page.getByRole('tab', { name: 'Titelsuche', exact: true }).click();
  await expect(page.locator('#home-title-search')).toBeEnabled();

  const missing = await request.get('/de/de/film/nonexistent-987654321/');
  expect(missing.status()).toBe(404);
  const missingPage = await request.get('/de/de/filme/?page=1000');
  expect(missingPage.status()).toBe(404);
});
