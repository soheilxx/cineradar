import { ImageResponse } from 'next/og';
import sharp from 'sharp';

import { isLocale, countryName, defaultMarkets } from '@/i18n/config';
import { t } from '@/i18n/messages';
import { getTitle, providers } from '@/data/repositories/catalog';
import { config } from '@/lib/config';
import { getComparison } from '@/content/comparisons';
import { copy } from '@/content/comparisons/copy';
import { infoDescriptions } from '@/content/info';
import type { MessageKey } from '@/i18n/messages';
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('locale') || 'en';
  const locale = isLocale(raw) ? raw : 'en';
  const market =
    new URL(req.url).searchParams.get('market') || defaultMarkets[locale];
  if (!config().markets.includes(market))
    return new Response(null, { status: 404 });
  const id = new URL(req.url).searchParams.get('id');
  if (id && !/^(movie|tv):\d+$/.test(id))
    return new Response(null, { status: 404 });
  const item = id ? await getTitle(id, market) : null;
  if (id && !item) return new Response(null, { status: 404 });
  const params = new URL(req.url).searchParams;
  const comparison = params.get('comparison');
  const guide = comparison ? getComparison(comparison) : undefined;
  if (comparison && comparison !== 'hub' && !guide)
    return new Response(null, { status: 404 });
  const page = params.get('page') || '';
  const tail = params.get('tail') || '';
  const info = Object.hasOwn(infoDescriptions, page);
  const genericPages = [
    'movies',
    'series',
    'providers',
    'new',
    'leaving',
    'free',
    'topics',
  ];
  let pageTitle =
    info || genericPages.includes(page)
      ? t(locale, page as MessageKey)
      : t(locale, 'headline');
  if (page === 'providers' && tail) {
    const provider = (await providers(market)).find((p) => p.id === tail);
    if (!provider) return new Response(null, { status: 404 });
    pageTitle = provider.name;
  }
  if (page === 'topics' && tail) {
    if (
      ![
        'action',
        'adventure',
        'animation',
        'comedy',
        'crime',
        'documentary',
        'drama',
        'family',
        'fantasy',
        'horror',
        'mystery',
        'romance',
        'scifi',
        'thriller',
      ].includes(tail)
    )
      return new Response(null, { status: 404 });
    pageTitle = t(locale, tail as MessageKey);
  }
  const title =
    item?.title.localizations[locale].title ||
    (guide
      ? `${guide.brand} ${copy.versus[locale]}`
      : comparison === 'hub'
        ? copy.hub[locale]
        : pageTitle);
  const subtitle = guide
    ? guide.focus[locale]
    : comparison === 'hub'
      ? copy.compare[locale]
      : info
        ? 'Cineradar · Wiresoft AG'
        : countryName(locale, market) +
          (item?.title.year ? ' · ' + item.title.year : '');
  let artwork: string | undefined;
  const imageSource =
    item?.title.backdrop ||
    item?.title.poster ||
    new URL('/cinema.webp', config().SITE_URL).href;
  try {
    const r = await fetch(imageSource, { signal: AbortSignal.timeout(3500) });
    if (r.ok && (r.headers.get('content-type') || '').startsWith('image/')) {
      const png = await sharp(Buffer.from(await r.arrayBuffer()))
        .resize(1200, 630, { fit: 'cover' })
        .png()
        .toBuffer();
      artwork = `data:image/png;base64,${png.toString('base64')}`;
    }
  } catch {}
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#090b10',
        color: '#f5f5f1',
        padding: '70px',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      {artwork && (
        <img
          src={artwork}
          alt=""
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 1200,
            height: 630,
            objectFit: 'cover',
            opacity: 0.72,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          background:
            'linear-gradient(90deg, #090b10 5%, rgba(9,11,16,0.72) 45%, rgba(9,11,16,0.1))',
          display: 'flex',
        }}
      />
      <div
        style={{
          display: 'flex',
          fontSize: 38,
          fontWeight: 700,
          position: 'relative',
        }}
      >
        cine<span style={{ color: '#f6c76b' }}>radar</span>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: title.length > 60 ? 48 : 72,
          fontWeight: 700,
          lineHeight: 1.1,
          maxWidth: 1050,
          position: 'relative',
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          borderTop: '2px solid #f6c76b',
          paddingTop: 25,
          justifyContent: 'space-between',
          fontSize: 26,
          color: '#f6c76b',
          position: 'relative',
        }}
      >
        <span>{subtitle}</span>
        <span>{info || comparison ? 'cineradar.tv' : t(locale, 'offers')}</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control':
          config().APP_MODE === 'fixture'
            ? 'private, no-store'
            : 'public, max-age=3600, stale-while-revalidate=86400',
      },
    },
  );
}
