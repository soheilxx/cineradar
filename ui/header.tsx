'use client';
import { useState } from 'react';
import { Bookmark, Menu, X, Globe2, Search, ArrowUpRight } from 'lucide-react';
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
import { comparisonPath } from '@/content/comparisons/routes';
import { copy } from '@/content/comparisons/copy';
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
  route?: RouteKey | 'comparison';
  languageLinks: Record<string, string>;
  countryLinks: Record<string, string>;
  markets: string[];
}) {
  const [open, setOpen] = useState(false);
  function navigate(url: string, l: string, m: string) {
    document.cookie = `cr_context=${l}.${m}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    try {
      localStorage.setItem(
        'cineradar:context',
        JSON.stringify({ locale: l, market: m }),
      );
    } catch {}
    window.location.assign(url + window.location.search);
  }
  const menuLabel = {
    de: 'Menü',
    fr: 'Menu',
    it: 'Menu',
    es: 'Menú',
    en: 'Menu',
  }[locale];
  const settings = () => (
    <>
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
      <Choice
        label={t(locale, 'language')}
        value={locale}
        options={locales.map((value) => ({
          value,
          label: languageNames[value],
        }))}
        onChange={(v) => {
          const nextMarket =
            v === 'en' && markets.includes('us') ? 'us' : market;
          navigate(
            languageLinks[v].replace(
              /^\/[a-z]{2}\/[a-z]{2}\//,
              `/${v}/${nextMarket}/`,
            ),
            v,
            nextMarket,
          );
        }}
      />
    </>
  );
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
            <Globe2 size={16} />
            {settings()}
            <a
              className="nav-watch"
              aria-label={t(locale, 'watchlist')}
              href={path(locale, market, 'watchlist')}
            >
              <Bookmark size={20} />
              <span>{t(locale, 'watchlist')}</span>
            </a>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <div className="mobile-header-actions">
              <a
                className="mobile-icon"
                href={path(locale, market, 'search')}
                aria-label={t(locale, 'search')}
              >
                <Search size={21} />
              </a>
              <DialogTrigger
                className="mobile-nav-trigger"
                aria-label={menuLabel}
              >
                <span>
                  {market.toUpperCase()} · {locale.toUpperCase()}
                </span>
                <Menu size={22} />
              </DialogTrigger>
            </div>
            <DialogContent
              showCloseButton={false}
              className="mobile-nav-panel"
              style={{ translate: 'none', transform: 'none' }}
            >
              <div className="mobile-nav-top">
                <DialogTitle>{menuLabel}</DialogTitle>
                <DialogClose
                  className="mobile-icon"
                  aria-label={t(locale, 'close')}
                >
                  <X size={24} />
                </DialogClose>
              </div>
              <nav className="mobile-primary-nav" aria-label={menuLabel}>
                {nav}
                {(['finder', 'watchlist'] as const).map((k) => (
                  <a
                    key={k}
                    href={path(locale, market, k)}
                    aria-current={route === k ? 'page' : undefined}
                  >
                    {t(locale, k)}
                    <ArrowUpRight size={19} />
                  </a>
                ))}
              </nav>
              <div className="mobile-context">
                <Globe2 size={20} />
                <div className="mobile-context-choices">{settings()}</div>
              </div>
              <nav className="mobile-support-nav">
                <a href={comparisonPath(locale)}>{copy.hub[locale]}</a>
                {(['help', 'contact', 'about'] as const).map((k) => (
                  <a key={k} href={path(locale, market, k)}>
                    {t(locale, k)}
                  </a>
                ))}
              </nav>
              <Brand href={path(locale, market)} />
            </DialogContent>
          </Dialog>
        </div>
      </header>
    </>
  );
}
