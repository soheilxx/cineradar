import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { locales, markets } from '../../i18n/config';
import { t } from '../../i18n/messages';
import { path } from '../../i18n/routes';
test('five languages × four countries render complete, isolated contexts', async ({
  page,
}) => {
  for (const locale of locales)
    for (const market of markets) {
      await page.goto(path(locale, market));
      await expect(page.locator('h1')).toHaveText(t(locale, 'headline'));
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(
        page.getByRole('combobox', { name: t(locale, 'searchHint') }),
      ).toBeVisible();
      await expect(
        page
          .locator('.header-controls')
          .getByRole('combobox', { name: t(locale, 'market') }),
      ).toBeVisible();
    }
});
test('exact search to a film provider within three interactions after typing', async ({
  page,
  request,
}) => {
  await page.goto('/de/de/');
  await page
    .getByRole('combobox', { name: t('de', 'searchHint') })
    .fill('Inception');
  await page.getByRole('button', { name: 'Suchen', exact: true }).click();
  await expect(page).toHaveURL(/suche.*q=Inception/);
  await page.locator('.poster-link').click();
  await expect(page.locator('h1')).toHaveText('Inception');
  const link = page
    .getByRole('link', { name: 'Zum Anbieter', exact: false })
    .first();
  const href = await link.getAttribute('href');
  const r = await request.get(href!, { maxRedirects: 0 });
  expect(r.status()).toBe(302);
  expect(r.headers().location).toMatch(/^https:\/\//);
});
test('language changes retain country and title; market changes retain language', async ({
  page,
}) => {
  await page.goto('/de/de/film/inception-27205/');
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/de\/movie\/inception-27205/);
  await page
    .getByRole('combobox', { name: 'Streaming country', exact: true })
    .click();
  await page.getByRole('option', { name: 'France', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/fr\/movie\/inception-27205/);
  await expect(page.locator('h1')).toHaveText('Inception');
});
test('watchlist persists reload and can remove the saved title', async ({
  page,
}) => {
  await page.goto('/en/de/movie/inception-27205/');
  await page
    .getByRole('button', { name: 'Add to watchlist', exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Remove', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/en/de/watchlist/');
  await expect(page.locator('.poster-card h3')).toHaveText('Inception');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('.poster-card')).toHaveCount(0);
});
test('provider selection and add-on are independent and persist', async ({
  page,
}) => {
  await page.goto('/en/de/my-providers/');
  await page
    .getByRole('checkbox', { name: 'Prime Video', exact: true })
    .check();
  await expect(page.getByRole('checkbox', { name: /MUBI/ })).not.toBeChecked();
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'Prime Video', exact: true }),
  ).toBeChecked();
  await page.getByRole('checkbox', { name: /MUBI/ }).check();
  await expect(page.getByRole('checkbox', { name: /MUBI/ })).toBeChecked();
});
test('series warns about incomplete availability and exposes known seasons', async ({
  page,
}) => {
  await page.goto('/en/de/show/dark-70523/');
  await expect(page.locator('h1')).toHaveText('Dark');
  await expect(
    page.getByText(t('en', 'partial'), { exact: true }),
  ).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Season 3' }).click();
  await expect(
    page
      .locator('details[open]')
      .getByText('No confirmed offers for this season.', { exact: true }),
  ).toBeVisible();
});
test('unknown slug and entity are actual 404s; raw HTML has canonical and JSON-LD', async ({
  request,
}) => {
  const wrong = await request.get('/en/de/movie/nonsense-27205/');
  expect(wrong.status()).toBe(404);
  const missing = await request.get('/en/de/movie/nothing-999999999/');
  expect(missing.status()).toBe(404);
  const ok = await request.get('/en/de/movie/inception-27205/');
  const html = await ok.text();
  expect(html).toContain('application/ld+json');
  expect(html).toContain('og:title');
  expect(html).toContain('name="robots"');
  expect(html).toContain('rel="canonical"');
  expect(html).toContain('Inception');
});
test('mobile search, layout widths, long locales, keyboard and accessibility', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/fr/de/');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.locator('.poster-card').last().scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('.poster-link img')).every(
        (x) => (x as HTMLImageElement).complete,
      ),
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      animations: 'disabled',
      path: `docs/evidence/home-${info.project.name}-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/de/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState === 'finished' ||
          a.effect?.getTiming().iterations === Infinity,
      ),
  );
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    scan.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact || ''),
    ),
  ).toEqual([]);
});
test('localized social image is an actual 1200×630 PNG', async ({
  request,
}) => {
  const r = await request.get('/api/og?locale=fr&market=de&id=movie:27205');
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toContain('image/png');
  const b = await r.body();
  expect(b.readUInt32BE(16)).toBe(1200);
  expect(b.readUInt32BE(20)).toBe(630);
  expect(b.length).toBeLessThan(1024 * 1024);
});
test('private APIs reject forged origins and unsupported mutations', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/reports', {
        headers: { Origin: 'https://evil.example' },
        data: { message: 'No side effect' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/admin/action', {
        headers: { Origin: 'http://localhost:3000' },
        form: { action: 'pause' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.get('/api/out/not-an-offer/', { maxRedirects: 0 })).status(),
  ).toBe(404);
});

test('mobile title discovery reaches an offer and image failures have a usable fallback',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/en/de/');await page.getByRole('combobox',{name:t('en','searchHint')}).fill('Inception');await page.keyboard.press('Enter');
 await page.locator('.poster-link').click();await expect(page.locator('h1')).toHaveText('Inception');await expect(page.getByRole('link',{name:t('en','openProvider'),exact:false}).first()).toBeVisible();
 await page.route('https://image.tmdb.org/**',route=>route.abort());await page.goto(path('en','de','movies'));await page.locator('.poster-link').first().scrollIntoViewIfNeeded();await expect(page.locator('.artwork-fallback').first()).toBeVisible();
});

test('finder filters survive navigation and reduced motion keeps controls usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/en/de/tonight/?maxMinutes=120');
 await expect(page.locator('.poster-card')).toHaveCount(1);await expect(page.locator('.card-meta')).toContainText('100 min');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/en/de/');await page.setViewportSize({width:640,height:900});await expect(page.getByRole('combobox',{name:'Streaming country',exact:true})).toBeVisible();
});
