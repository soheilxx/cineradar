import { Brand } from './brand';
import { path } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
import { l } from '@/content/comparisons/copy';
import { comparisonPath } from '@/content/comparisons/routes';
import { config } from '@/lib/config';
import { ConsentSettingsButton } from './analytics-consent';
export function Footer({ locale, market }: { locale: Locale; market: string }) {
  const analyticsEnabled = config().analyticsEnabled;
  const labels = {
    discover: l('Entdecken', 'Découvrir', 'Scopri', 'Descubrir', 'Discover'),
    service: l(
      'Service & Hilfe',
      'Service et aide',
      'Servizio e aiuto',
      'Servicio y ayuda',
      'Service & help',
    ),
    allComparisons: l(
      'Alle Vergleiche',
      'Tous les comparatifs',
      'Tutti i confronti',
      'Todas las comparativas',
      'All comparisons',
    ),
    comparisons: l(
      'Vergleiche',
      'Comparatifs',
      'Confronti',
      'Comparativas',
      'Comparisons',
    ),
  };
  return (
    <footer className="site-footer organized-footer">
      <div className="container">
        <div className="footer-intro">
          <Brand href={path(locale, market)} />
          <p>{t(locale, 'subheadline')}</p>
        </div>
        <div className="footer-link-groups">
          <nav aria-label={labels.discover[locale]}>
            <h2>{labels.discover[locale]}</h2>
            {(['movies', 'series', 'providers', 'new', 'free'] as const).map(
              (k) => (
                <a key={k} href={path(locale, market, k)}>
                  {t(locale, k)}
                </a>
              ),
            )}
          </nav>
          <nav aria-label={labels.service[locale]}>
            <h2>{labels.service[locale]}</h2>
            {(['help', 'data', 'contact', 'watchlist'] as const).map((k) => (
              <a key={k} href={path(locale, market, k)}>
                {t(locale, k)}
              </a>
            ))}
          </nav>
          <nav aria-label={labels.comparisons[locale]}>
            <h2>{labels.comparisons[locale]}</h2>
            <a href={comparisonPath(locale)}>{labels.allComparisons[locale]}</a>
            <a href={comparisonPath(locale, 'wer-streamt-es')}>WerStreamt.es</a>
            <a href={comparisonPath(locale, 'justwatch')}>JustWatch</a>
            <a href={comparisonPath(locale, 'playpilot')}>PlayPilot</a>
          </nav>
          <nav aria-label="Cineradar">
            <h2>Cineradar</h2>
            {(['about', 'legal', 'privacy', 'credits'] as const).map((k) => (
              <a key={k} href={path(locale, market, k)}>
                {t(locale, k)}
              </a>
            ))}
            {analyticsEnabled && <ConsentSettingsButton locale={locale} />}
          </nav>
        </div>
        <div className="footer-colophon">
          <p>© {new Date().getUTCFullYear()} Cineradar · Wiresoft AG</p>
          <div>
            <a href="https://www.themoviedb.org/">TMDB</a>
            <a href="https://docs.movieofthenight.com/">
              Streaming Availability API by Movie of the Night
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
