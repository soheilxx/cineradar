import { ArrowRight, AudioLines, ScanSearch } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { countryName } from '@/i18n/config';
import { path } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import { identifyEditorial } from '@/content/identify-editorial';
import { IdentifyExperience } from './identify-experience';
import { AppLink } from './app-link';

export function TitleIdentify({
  locale,
  market,
  aiEnabled,
}: {
  locale: Locale;
  market: string;
  aiEnabled: boolean;
}) {
  const copy = identifyEditorial[locale];
  return (
    <div className="identify-page">
      <header className="identify-hero">
        <div className="identify-hero-copy">
          <p className="eyebrow gold">
            <ScanSearch size={17} /> {copy.eyebrow}
          </p>
          <h1>{copy.headline}</h1>
          <p className="identify-intro">{copy.introduction}</p>
          <span className="identify-market">
            {countryName(locale, market)} <span aria-hidden="true">·</span>{' '}
            {t(locale, 'movie')} & {t(locale, 'tv')}
          </span>
        </div>
        <div className="identify-orbit" aria-hidden="true">
          <div className="identify-orbit-ring" />
          <div className="identify-orbit-ring" />
          <span className="identify-orbit-center">
            <AudioLines size={48} strokeWidth={1.3} />
          </span>
          <span className="identify-orbit-dot" />
          <span className="identify-orbit-dot" />
          <span className="identify-orbit-label">
            CINE<span>RADAR</span>
          </span>
        </div>
      </header>
      <IdentifyExperience
        key={`${locale}:${market}`}
        {...{ locale, market, aiEnabled }}
        examples={copy.examples}
      />
      <section
        className="identify-method"
        aria-labelledby="identify-method-heading"
      >
        <p className="eyebrow gold">01 — 02 — 03</p>
        <h2 id="identify-method-heading">{copy.stepsHeading}</h2>
        <div className="identify-steps">
          {copy.steps.map((step, i) => (
            <article key={step.title}>
              <span className="identify-step-number">0{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="identify-faq" aria-labelledby="identify-faq-heading">
        <h2 id="identify-faq-heading">{copy.faqHeading}</h2>
        <div>
          {copy.faq.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <aside className="identify-privacy">
        <h2>{copy.privacyHeading}</h2>
        <p>{copy.privacyNotice}</p>
        <p>{copy.browserVoiceNotice}</p>
        {aiEnabled && <p>{copy.aiNotice}</p>}
        <AppLink href={path(locale, market, 'privacy')}>
          {t(locale, 'privacy')} <ArrowRight size={16} />
        </AppLink>
      </aside>
      <nav className="identify-explore" aria-label="Cineradar">
        {(['movies', 'series', 'new', 'finder'] as const).map((key) => (
          <AppLink key={key} href={path(locale, market, key)}>
            {t(locale, key)}
            <ArrowRight size={16} />
          </AppLink>
        ))}
      </nav>
    </div>
  );
}
