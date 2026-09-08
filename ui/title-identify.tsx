import { ArrowRight, ScanSearch } from 'lucide-react';
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
        <div className="identify-hero-meta">
          <p className="eyebrow gold">
            <ScanSearch size={17} /> {copy.nav}
          </p>
          <span className="identify-market">{countryName(locale, market)}</span>
        </div>
        <h1>{copy.headline}</h1>
      </header>
      <IdentifyExperience
        key={`${locale}:${market}`}
        {...{ locale, market, aiEnabled }}
        examples={copy.examples}
      />
      <div className="identify-context">
        <p className="eyebrow gold">{copy.eyebrow}</p>
        <p className="identify-intro">{copy.introduction}</p>
      </div>
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
