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
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.goBack();
  await expect(page).toHaveURL(/\/de\/de\/filme\/\?genre=drama&sort=year$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.goForward();
  await expect(page).toHaveURL(/\/fr\/de\/films\/\?genre=drama&sort=year$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});
