import { AppLink } from './app-link';
import { ArrowUpRight, CircleHelp, Building2 } from 'lucide-react';
import { ContactForm } from './contact';
import { contactCopy as copy } from '@/content/contact';
import { path } from '@/i18n/routes';
import { t } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
import { config } from '@/lib/config';
export function ContactPage({
  locale,
  market,
  titleId,
  report = false,
}: {
  locale: Locale;
  market: string;
  titleId?: string;
  report?: boolean;
}) {
  const c = config();
  return (
    <article className="contact-page">
      <div className="contact-page-head">
        <p className="eyebrow">Cineradar / {t(locale, 'contact')}</p>
        <h1>{t(locale, report ? 'report' : 'contact')}</h1>
        <p className="editorial-lead">{copy.intro[locale]}</p>
      </div>
      <div className="contact-layout">
        <ContactForm
          locale={locale}
          market={market}
          titleId={titleId}
          enabled={!!c.DATABASE_URL}
        />
        <aside className="contact-aside">
          <section>
            <CircleHelp size={25} />
            <h2>{copy.service[locale]}</h2>
            <p>{copy.help[locale]}</p>
            <AppLink className="text-link" href={path(locale, market, 'help')}>
              {t(locale, 'help')} <ArrowUpRight size={18} />
            </AppLink>
          </section>
          <section>
            <h2>{copy.provider[locale]}</h2>
            <p>{copy.providerText[locale]}</p>
          </section>
          <section>
            <Building2 size={25} />
            <h2>{copy.operator[locale]}</h2>
            <address>
              <strong>{c.OPERATOR_NAME}</strong>
              <br />
              {c.OPERATOR_ADDRESS}
            </address>
            <AppLink className="text-link" href={path(locale, market, 'legal')}>
              {t(locale, 'legal')} <ArrowUpRight size={18} />
            </AppLink>
          </section>
        </aside>
      </div>
    </article>
  );
}
