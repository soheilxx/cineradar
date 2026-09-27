import type { Locale } from '@/i18n/config';
import { t } from '@/i18n/messages';

export function NavigationPending({ locale }: { locale: Locale }) {
  return (
    <span
      className="cr-load-progress"
      role="status"
      aria-label={t(locale, 'loading')}
    >
      <span />
    </span>
  );
}

export function CatalogPending({
  locale,
  variant = 'cards',
}: {
  locale: Locale;
  variant?: 'cards' | 'feature' | 'providers' | 'identify';
}) {
  return (
    <div
      className={`cr-load-pending cr-load-${variant}`}
      role="status"
      aria-label={t(locale, 'loading')}
    >
      {Array.from(
        { length: variant === 'feature' || variant === 'identify' ? 1 : 6 },
        (_, index) => (
          <span key={index} aria-hidden="true" />
        ),
      )}
    </div>
  );
}
