import type { Title, Snapshot } from '../domain/types';
import { locales, type Locale } from '../i18n/config';
import { path } from '../i18n/routes';
import { readableTitle } from './content';

export interface IndexingSnapshot {
  market: string;
  availability: Snapshot['availability'];
  checkedAt: string | null;
  hasOffers: boolean;
}

export function titleEligibility(
  title: Title,
  locale: Locale,
  snapshot: IndexingSnapshot,
) {
  if (title.fixture)
    return { indexable: false, sitemapEligible: false, reason: 'fixture' };
  if (!readableTitle(title, locale, snapshot.hasOffers))
    return {
      indexable: false,
      sitemapEligible: false,
      reason: 'missing_localized_content',
    };
  // A failed refresh retains checkedAt from the last successful reconciliation.
  // Keep that established page eligible while the UI reports the stale status.
  if (
    !snapshot.checkedAt ||
    !['available', 'empty', 'error'].includes(snapshot.availability)
  )
    return {
      indexable: false,
      sitemapEligible: false,
      reason: 'unchecked_market',
    };
  return { indexable: true, sitemapEligible: true, reason: null };
}

export function titleAlternates(
  title: Title,
  snapshots: IndexingSnapshot[],
  origin: string,
) {
  return Object.fromEntries(
    snapshots.flatMap((snapshot) =>
      locales
        .filter((locale) => titleEligibility(title, locale, snapshot).indexable)
        .map((locale) => [
          `${locale}-${snapshot.market.toUpperCase()}`,
          new URL(
            path(
              locale,
              snapshot.market,
              title.type,
              title.localizations[locale].slug,
            ),
            origin,
          ).href,
        ]),
    ),
  );
}
