'use client';
import { AppLink } from './app-link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { BarChart3, Check, Settings2, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { analyticsCopy as copy } from '@/content/analytics';
import { comparisonRoute } from '@/content/comparisons/routes';
import { defaultMarkets, isLocale, type Locale } from '@/i18n/config';
import { path } from '@/i18n/routes';
import {
  getConsent,
  openConsentSettings,
  setConsent,
  subscribeConsent,
} from '@/lib/analytics';

const serverConsent = () => null;

export function ConsentSettingsButton({ locale }: { locale: Locale }) {
  return (
    <button
      type="button"
      className="analytics-settings-link"
      onClick={openConsentSettings}
    >
      {copy.settings[locale]}
    </button>
  );
}

export function AnalyticsConsent({
  initialLocale,
  enabled,
}: {
  initialLocale: Locale;
  enabled: boolean;
}) {
  const pathname = usePathname();
  const languageSegment = pathname.split('/')[1] || '';
  const locale = isLocale(languageSegment)
    ? languageSegment
    : comparisonRoute(pathname)?.locale || initialLocale;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsent,
    serverConsent,
  );
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    setHydrated(true);
    if (!enabled) return;
    const open = () => setSettingsOpen(true);
    window.addEventListener('cr:analytics-settings', open);
    return () => window.removeEventListener('cr:analytics-settings', open);
  }, [enabled]);
  if (!enabled || !hydrated) return null;
  const privacyHref = path(locale, defaultMarkets[locale], 'privacy');
  const choose = (granted: boolean) => {
    setConsent(granted);
    setSettingsOpen(false);
  };
  return (
    <>
      {consent === null && !settingsOpen && (
        <section
          className="analytics-consent-banner analytics-consent"
          aria-labelledby="analytics-consent-heading"
          data-analytics-ignore="true"
        >
          <div className="analytics-consent-heading">
            <span className="analytics-consent-icon">
              <BarChart3 size={20} />
            </span>
            <div className="analytics-consent-title">
              <span className="analytics-consent-brand">Cineradar</span>
              <h2 id="analytics-consent-heading">{copy.title[locale]}</h2>
            </div>
            <button
              type="button"
              className="analytics-consent-close analytics-consent-banner-dismiss"
              aria-label={copy.closeWithoutAnalytics[locale]}
              title={copy.closeWithoutAnalytics[locale]}
              onClick={() => choose(false)}
            >
              <X size={19} />
            </button>
          </div>
          <p className="analytics-consent-intro">{copy.bannerIntro[locale]}</p>
          <div className="analytics-consent-actions">
            <button type="button" onClick={() => choose(false)}>
              {copy.decline[locale]}
            </button>
            <button type="button" onClick={() => choose(true)}>
              {copy.accept[locale]}
            </button>
          </div>
          <div className="analytics-consent-links">
            <button type="button" onClick={() => setSettingsOpen(true)}>
              {copy.more[locale]}
            </button>
            <AppLink href={privacyHref}>{copy.privacy[locale]}</AppLink>
          </div>
          <p className="analytics-consent-storage">
            {copy.bannerStorage[locale]}
          </p>
        </section>
      )}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          className="analytics-consent-dialog analytics-consent"
          showCloseButton={false}
          data-analytics-ignore="true"
        >
          <div className="analytics-consent-heading">
            <span className="analytics-consent-icon">
              <Settings2 size={21} />
            </span>
            <DialogTitle>{copy.settings[locale]}</DialogTitle>
            <DialogClose
              className="analytics-consent-close"
              aria-label={copy.close[locale]}
            >
              <X size={20} />
            </DialogClose>
          </div>
          <DialogDescription>{copy.intro[locale]}</DialogDescription>
          <div className="analytics-consent-options">
            <div className="analytics-consent-option">
              <strong>{copy.necessary[locale]}</strong>
              <span className="analytics-consent-always">
                <Check size={14} />
                {copy.alwaysOn[locale]}
              </span>
            </div>
            <div className="analytics-consent-option">
              <strong>{copy.statistics[locale]}</strong>
              <span>{copy.optional[locale]}</span>
            </div>
          </div>
          <p className="analytics-consent-details">{copy.details[locale]}</p>
          <p className="analytics-consent-status" role="status">
            {consent === 'granted'
              ? copy.enabled[locale]
              : consent === 'denied'
                ? copy.disabled[locale]
                : copy.noChoice[locale]}
          </p>
          <div className="analytics-consent-actions">
            <button type="button" onClick={() => choose(false)}>
              {consent === 'granted'
                ? copy.withdraw[locale]
                : copy.decline[locale]}
            </button>
            <button type="button" onClick={() => choose(true)}>
              {copy.allow[locale]}
            </button>
          </div>
          <p className="analytics-consent-storage">{copy.storage[locale]}</p>
          <AppLink className="analytics-consent-privacy" href={privacyHref}>
            {copy.privacy[locale]}
          </AppLink>
        </DialogContent>
      </Dialog>
    </>
  );
}
