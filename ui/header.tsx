'use client';
import { useState } from 'react';
import { Bookmark, Menu, X, Globe2 } from 'lucide-react';
import { Brand } from './brand';
import { Choice } from './select';
import {
  locales,
  languageNames,
  countryName,
  type Locale,
} from '@/i18n/config';
import { path, type RouteKey } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
export function Header({
  locale,
  market,
  route = 'home',
  languageLinks,
  countryLinks,
  markets,
}: {
  locale: Locale;
  market: string;
  route?: RouteKey;
  languageLinks: Record<string, string>;
  countryLinks: Record<string, string>;
  markets: string[];
}) {
  const [open, setOpen] = useState(false);
  function navigate(url: string, l: string, m: string) {
    try {
      localStorage.setItem(
        'cineradar:context',
        JSON.stringify({ locale: l, market: m }),
      );
    } catch {}
    window.location.assign(url + window.location.search);
  }
  const nav = (['home', 'movies', 'series', 'providers'] as const).map(
    (key) => (
      <a
        key={key}
        href={path(locale, market, key)}
        aria-current={route === key ? 'page' : undefined}
      >
        {t(locale, key)}
      </a>
    ),
  );
  return (
    <>
      <a className="skip" href="#main" tabIndex={0}>
        {t(locale, 'skip')}
      </a>
      <header className="site-header">
        <div className="container header-main">
          <Brand href={path(locale, market)} />
          <nav className="desktop-nav">{nav}</nav>
          <div className="header-controls">
            <div className="market-control">
              <Globe2 size={16} />
              <Choice
                label={t(locale, 'market')}
                value={market}
                options={markets.map((value) => ({
                  value,
                  label: countryName(locale, value),
                }))}
                onChange={(v) =>
                  navigate(countryLinks[v] || path(locale, v), locale, v)
                }
              />
            </div>
            <Choice
              label={t(locale, 'language')}
              value={locale}
              options={locales.map((value) => ({
                value,
                label: languageNames[value],
              }))}
              onChange={(v) => navigate(languageLinks[v], v, market)}
            />
            <a
              className="nav-watch"
              aria-label={t(locale, 'watchlist')}
              href={path(locale, market, 'watchlist')}
            >
              <Bookmark size={20} />
              <span>{t(locale, 'watchlist')}</span>
            </a>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                className="mobile-menu button"
                aria-label={t(locale, 'home')}
              >
                <Menu size={21} />
              </DialogTrigger>
              <DialogContent showCloseButton={false} className="menu-dialog">
                <DialogTitle>{t(locale, 'home')}</DialogTitle>
                <DialogClose
                  className="dialog-close"
                  aria-label={t(locale, 'close')}
                >
                  <X />
                </DialogClose>
                <nav>
                  {nav}
                  <a href={path(locale, market, 'finder')}>
                    {t(locale, 'finder')}
                  </a>
                  <a href={path(locale, market, 'watchlist')}>
                    {t(locale, 'watchlist')}
                  </a>
                </nav>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
    </>
  );
}
