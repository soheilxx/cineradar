import type { CatalogItem, OfferType } from '../domain/types';
import { activeOffers } from '../domain/offers';
import { t } from '../i18n/messages';
import { countryName, type Locale } from '../i18n/config';

export function streamingDescription(
  item: CatalogItem,
  locale: Locale,
  market: string,
) {
  const offers = activeOffers(item.snapshot.offers).filter(
    (offer) => offer.market === market,
  );
  const providers = [...new Set(offers.map((offer) => offer.provider.name))];
  const names = new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  }).format(providers.slice(0, 3));
  const values = { title: item.title.localizations[locale].title };
  const prefix = `${t(locale, 'watchTitle', values)}${item.title.year ? ` (${item.title.year})` : ''} · ${countryName(locale, market)}.`;
  if (!providers.length) {
    const status =
      item.snapshot.availability === 'empty'
        ? 'noOffers'
        : item.snapshot.availability === 'unsupported'
          ? 'unsupported'
          : item.snapshot.availability === 'error'
            ? 'failed'
            : 'unchecked';
    return `${prefix} ${t(locale, status)}`;
  }
  const stored =
    item.snapshot.availability !== 'available' ||
    item.snapshot.freshness !== 'fresh';
  const labels = {
    de: stored
      ? `Zuletzt gespeicherte Angebote bei ${names}.`
      : `Streamingangebote bei ${names}.`,
    fr: stored
      ? `Dernières offres enregistrées sur ${names}.`
      : `Offres de streaming sur ${names}.`,
    it: stored
      ? `Ultime offerte registrate su ${names}.`
      : `Offerte streaming su ${names}.`,
    es: stored
      ? `Últimas ofertas guardadas en ${names}.`
      : `Ofertas de streaming en ${names}.`,
    en: stored
      ? `Last recorded offers from ${names}.`
      : `Streaming offers from ${names}.`,
  };
  const more = {
    de: ' Weitere Anbieter und Optionen auf Cineradar.',
    fr: ' Autres plateformes et options sur Cineradar.',
    it: ' Altre piattaforme e opzioni su Cineradar.',
    es: ' Más plataformas y opciones en Cineradar.',
    en: ' More providers and viewing options on Cineradar.',
  };
  return `${prefix} ${labels[locale]}${providers.length > 3 ? more[locale] : ''}`;
}

export function streamingContent(
  item: CatalogItem,
  locale: Locale,
  market: string,
) {
  const title = item.title.localizations[locale].title;
  const country = countryName(locale, market);
  const values = {
    title,
    country,
    year: item.title.year ? ` (${item.title.year})` : '',
  };
  const offers = activeOffers(item.snapshot.offers).filter(
    (o) => o.market === market,
  );
  const names = (type: OfferType) => [
    ...new Set(
      offers
        .filter((o) => o.type === type)
        .map((o) =>
          o.addon ? `${o.provider.name} + ${o.addon.name}` : o.provider.name,
        ),
    ),
  ];
  const list = (items: string[]) =>
    new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
      items,
    );
  const answers = (['subscription', 'rent', 'buy', 'addon'] as const).flatMap(
    (type) => {
      const providers = names(type);
      return providers.length
        ? [
            t(locale, `${type}Answer`, {
              ...values,
              providers: list(providers),
            }),
          ]
        : [];
    },
  );
  const uncertain = !['available', 'empty'].includes(
    item.snapshot.availability,
  );
  const status = t(
    locale,
    item.snapshot.availability === 'empty'
      ? 'noOffers'
      : item.snapshot.availability === 'error'
        ? 'failed'
        : item.snapshot.availability === 'unsupported'
          ? 'unsupported'
          : 'unchecked',
  );
  let answer =
    answers.join(' ') ||
    (names('free').length
      ? t(locale, 'freeAnswer', { ...values, providers: list(names('free')) })
      : status);
  if (offers.length && (uncertain || item.snapshot.freshness !== 'fresh'))
    answer = t(locale, 'storedOffers', { answer });
  const qualities = [
    ...new Set(
      offers.flatMap((o) =>
        o.quality ? [o.quality === 'uhd' ? '4K' : o.quality.toUpperCase()] : [],
      ),
    ),
  ];
  const seasons = [
    ...new Set(offers.flatMap((o) => (o.season !== null ? [o.season] : []))),
  ].sort((a, b) => a - b);
  const questions = [
    {
      heading: t(locale, 'freeQuestion', values),
      body: uncertain
        ? status
        : names('free').length
          ? t(locale, 'freeAnswer', {
              ...values,
              providers: list(names('free')),
            })
          : t(locale, 'noFreeAnswer', values),
    },
    {
      heading: t(locale, 'optionsQuestion'),
      body: qualities.length
        ? t(locale, 'optionsAnswer', { qualities: list(qualities) })
        : t(locale, 'optionsProvider'),
    },
    ...(item.title.type === 'tv'
      ? [
          {
            heading: t(locale, 'seasonQuestion', values),
            body: seasons.length
              ? t(locale, 'seasonAnswer', {
                  ...values,
                  seasons: seasons.join(', '),
                })
              : t(locale, 'partial'),
          },
        ]
      : []),
  ];
  return {
    heading: t(locale, 'whereTitle', values),
    intro: t(locale, 'watchIntro', values),
    answer,
    questions,
    providers: [
      ...new Map(offers.map((o) => [o.provider.id, o.provider])).values(),
    ],
    description: `${t(locale, 'watchTitle', values)}${values.year} · ${country}. ${answer}`,
  };
}

export function readableTitle(
  title: CatalogItem['title'],
  locale: Locale,
  hasOffers: boolean,
) {
  const l = title.localizations[locale];
  return !!(
    l?.title &&
    title.year &&
    (l.overview.trim() || (title.cast.length && hasOffers))
  );
}
export function meaningfulTitle(item: CatalogItem, locale: Locale) {
  return readableTitle(
    item.title,
    locale,
    activeOffers(item.snapshot.offers).some(
      (o) => o.market === item.snapshot.market,
    ),
  );
}
