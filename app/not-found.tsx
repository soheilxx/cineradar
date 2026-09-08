import { headers } from 'next/headers';
import { isLocale, defaultMarkets } from '@/i18n/config';
import { t } from '@/i18n/messages';
import { Brand } from '@/ui/brand';
import { fallbackMetadata } from '@/seo/fallback';
export async function generateMetadata() {
  const raw = (await headers()).get('x-cineradar-locale') || 'en';
  return fallbackMetadata(isLocale(raw) ? raw : 'en', true);
}
export default async function NotFound() {
  const h = await headers();
  const l = h.get('x-cineradar-locale') || 'en';
  const locale = isLocale(l) ? l : 'en';
  return (
    <main className="container not-found">
      <Brand />
      <span className="huge-404">404</span>
      <h1>{t(locale, 'notFound')}</h1>
      <p>{t(locale, 'notFoundText')}</p>
      <a
        href={`/${locale}/${h.get('x-cineradar-market') || defaultMarkets[locale]}/`}
        className="button primary"
      >
        {t(locale, 'backHome')}
      </a>
    </main>
  );
}
