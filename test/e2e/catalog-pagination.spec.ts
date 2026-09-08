import { test, expect, type Page } from '@playwright/test';
import type { CardItem } from '../../domain/cards';
import { t } from '../../i18n/messages';

const localTarget = process.env.TEST_BASE_URL;
test.skip(
  !localTarget ||
    !['localhost', '127.0.0.1'].includes(new URL(localTarget).hostname),
  'Requires TEST_BASE_URL for a local server with the populated catalogue.',
);

function cards(page: number, count = 24): CardItem[] {
  return Array.from({ length: count }, (_, index) => {
    const id = (page - 1) * 24 + index;
    return {
      id: `movie:pagination-${id}`,
      slug: `fixture-${id}`,
      title: `Pagination film ${id}`,
      type: 'movie',
      year: 2026,
      runtime: null,
      poster: null,
      rating: null,
      providers: [],
      availability: 'empty',
    };
  });
}

const catalogueCards = (page: Page) =>
  page.locator('.poster-grid .poster-card');
const displayedIds = (page: Page) =>
  page
    .locator('.poster-grid .poster-link')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute('data-analytics-title-id')),
    );

async function openCatalogue(page: Page) {
  await page.goto('/de/de/filme/');
  await expect(catalogueCards(page)).toHaveCount(24);
  await expect(page.locator('.load-more')).toHaveAttribute(
    'data-catalog-state',
    'idle',
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'cr:analytics-consent:v1',
      JSON.stringify({ version: 1, value: 'denied', at: Date.now() }),
    );
  });
});

test('mobile scrolling loads more than three following pages without pressing load more', async ({
  page,
}) => {
  const requestedPages: number[] = [];
  await page.route('**/api/catalog/**', async (route) => {
    const requested = Number(
      new URL(route.request().url()).searchParams.get('page'),
    );
    requestedPages.push(requested);
    await route.fulfill({
      json: { items: cards(requested), page: requested, total: 1920 },
    });
  });
  await openCatalogue(page);
  const initialIds = await displayedIds(page);
  for (let nextPage = 2; nextPage <= 6; nextPage++) {
    await page.locator('.load-more').scrollIntoViewIfNeeded();
    await expect
      .poll(() => catalogueCards(page).count())
      .toBeGreaterThanOrEqual(nextPage * 24);
  }
  expect(requestedPages).toEqual(expect.arrayContaining([2, 3, 4, 5, 6]));
  const ids = await displayedIds(page);
  expect(ids.slice(0, 24)).toEqual(initialIds);
  expect(new Set(ids).size).toBe(ids.length);
  await expect(page.locator('.load-more')).not.toHaveAttribute(
    'data-catalog-state',
    'error',
  );
});

test('a failed next page can be retried without losing the existing cards', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/catalog/**', async (route) => {
    requests++;
    if (requests === 1) {
      await route.fulfill({ status: 503, json: { error: 'unavailable' } });
      return;
    }
    const requested = Number(
      new URL(route.request().url()).searchParams.get('page'),
    );
    await route.fulfill({
      json: { items: cards(requested), page: requested, total: 48 },
    });
  });
  await openCatalogue(page);
  const initialIds = await displayedIds(page);
  const footer = page.locator('.load-more');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toHaveAttribute('data-catalog-state', 'error');
  await expect(catalogueCards(page)).toHaveCount(24);
  await footer
    .getByRole('button', { name: t('de', 'retry'), exact: true })
    .click();
  await expect(catalogueCards(page)).toHaveCount(48);
  await expect(footer).toHaveAttribute('data-catalog-state', 'complete');
  expect((await displayedIds(page)).slice(0, 24)).toEqual(initialIds);
  expect(requests).toBe(2);
});

test('a successful empty last page ends scrolling without an error or retry loop', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/catalog/**', async (route) => {
    requests++;
    const requested = Number(
      new URL(route.request().url()).searchParams.get('page'),
    );
    await route.fulfill({ json: { items: [], page: requested, total: 0 } });
  });
  await openCatalogue(page);
  const initialIds = await displayedIds(page);
  const footer = page.locator('.load-more');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toHaveAttribute('data-catalog-state', 'complete');
  await expect(footer.getByRole('button')).toHaveCount(0);
  await expect(footer.getByRole('status')).not.toContainText(
    t('de', 'loadFailed'),
  );
  expect(await displayedIds(page)).toEqual(initialIds);
  await page.evaluate(() => window.scrollTo(0, 0));
  await footer.scrollIntoViewIfNeeded();
  expect(requests).toBe(1);
});

test('the mobile page picker opens and its links remain distinct within the viewport', async ({
  page,
}) => {
  await page.route('**/api/catalog/**', (route) =>
    route.fulfill({ status: 503, json: { error: 'unavailable' } }),
  );
  await openCatalogue(page);
  const details = page.locator('.catalog-pagination-toggle');
  await expect(details).not.toHaveAttribute('open', '');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  const navigation = details.locator('.catalog-pagination');
  await expect(navigation).toBeVisible();
  await expect(navigation.locator('a[href*="page=2"]').first()).toBeVisible();
  const rectangles = await navigation
    .locator('a, .catalog-page-count')
    .evaluateAll((links) =>
      links.map((link) => {
        const box = link.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        };
      }),
    );
  expect(rectangles.length).toBeGreaterThan(1);
  for (const box of rectangles) {
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(375);
  }
  for (let first = 0; first < rectangles.length; first++) {
    for (let second = first + 1; second < rectangles.length; second++) {
      const a = rectangles[first];
      const b = rectangles[second];
      const overlapWidth =
        Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapHeight =
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      expect(overlapWidth > 1 && overlapHeight > 1).toBe(false);
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('a short final page deduplicates a boundary title while retaining all existing cards', async ({
  page,
}) => {
  let duplicateId: string | null = null;
  let requests = 0;
  await page.route('**/api/catalog/**', async (route) => {
    requests++;
    const requested = Number(
      new URL(route.request().url()).searchParams.get('page'),
    );
    const incoming = cards(requested, 6);
    incoming[0].id = duplicateId!;
    await route.fulfill({
      json: { items: incoming, page: requested, total: 30 },
    });
  });
  await openCatalogue(page);
  const initialIds = await displayedIds(page);
  duplicateId = initialIds.at(-1)!;
  const footer = page.locator('.load-more');
  await footer.scrollIntoViewIfNeeded();
  await expect(catalogueCards(page)).toHaveCount(29);
  await expect(footer).toHaveAttribute('data-catalog-state', 'complete');
  await expect(footer.getByRole('button')).toHaveCount(0);
  const ids = await displayedIds(page);
  expect(ids.slice(0, 24)).toEqual(initialIds);
  expect(new Set(ids).size).toBe(ids.length);
  expect(requests).toBe(1);
});
