'use client';
import { useEffect, useState } from 'react';
import {
  defaultMarkets,
  locales,
  type Locale,
  countryName,
} from '@/i18n/config';
import {
  comparisonPath,
  type ComparisonId,
} from '@/content/comparisons/routes';
import { copy } from '@/content/comparisons/copy';
import { Search } from './search';
import { Header } from './header';
import { Choice } from './select';
import { trackEvent } from '@/lib/analytics';
function useMarket(locale: Locale, markets: string[]) {
  const [market, setMarket] = useState(defaultMarkets[locale]);
  useEffect(() => {
    const update = () => {
      const saved = document.cookie
        .split('; ')
        .find((c) => c.startsWith('cr_context='))
        ?.split('=')[1]
        ?.split('.')[1];
      if (saved && markets.includes(saved)) setMarket(saved);
    };
    update();
    window.addEventListener('cineradar:context', update);
    return () => window.removeEventListener('cineradar:context', update);
  }, [markets]);
  return { market, setMarket };
}
export function ComparisonHeader({
  locale,
  id,
  markets,
}: {
  locale: Locale;
  id?: ComparisonId;
  markets: string[];
}) {
  const { market } = useMarket(locale, markets);
  return (
    <Header
      locale={locale}
      market={market}
      markets={markets}
      route="comparison"
      languageLinks={Object.fromEntries(
        locales.map((l) => [l, comparisonPath(l, id)]),
      )}
      countryLinks={Object.fromEntries(
        markets.map((m) => [m, comparisonPath(locale, id)]),
      )}
    />
  );
}
export function ComparisonSearch({
  locale,
  id,
  markets,
}: {
  locale: Locale;
  id?: ComparisonId;
  markets: string[];
}) {
  const { market, setMarket } = useMarket(locale, markets);
  return (
    <div className="comparison-search" id="title-search">
      <label className="comparison-search-label" htmlFor="comparison-title">
        {copy.searchLabel[locale]}
      </label>
      <Search
        locale={locale}
        market={market}
        inputId="comparison-title"
        buttonLabel={copy.searchButton[locale]}
        onSearch={() => {
          trackEvent('comparison_search_submit', {
            comparison_id: id || 'hub',
            market,
          });
        }}
      />
      <Choice
        label={copy.searchCountry[locale]}
        value={market}
        options={markets.map((value) => ({
          value,
          label: countryName(locale, value),
        }))}
        onChange={(value) => {
          setMarket(value);
          trackEvent('context_change', {
            filter_name: 'market',
            filter_value: value,
            source: 'comparison',
          });
          document.cookie = `cr_context=${locale}.${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
          window.dispatchEvent(new Event('cineradar:context'));
        }}
      />
    </div>
  );
}
