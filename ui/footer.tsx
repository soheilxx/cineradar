import { Brand } from './brand';
import { path } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
export function Footer({ locale, market }: { locale: Locale; market: string }) {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Brand href={path(locale, market)} />
          <p>{t(locale, 'subheadline')}</p>
        </div>
        <nav>
          {(
            [
              'about',
              'data',
              'help',
              'contact',
              'legal',
              'privacy',
              'credits',
            ] as const
          ).map((k) => (
            <a key={k} href={path(locale, market, k)}>
              {t(locale, k)}
            </a>
          ))}
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getUTCFullYear()} Cineradar</span>
        <span>
          <a href="https://www.themoviedb.org/">TMDb</a> ·{' '}
          <a href="https://www.movieofthenight.com/about/api">
            Streaming Availability API by Movie of the Night
          </a>
        </span>
      </div>
    </footer>
  );
}
