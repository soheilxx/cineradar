import { ImageResponse } from 'next/og';

import { isLocale, countryName } from '@/i18n/config';
import { t } from '@/i18n/messages';
import { getTitle } from '@/data/repositories/catalog';
import { config } from '@/lib/config';
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('locale') || 'en';
  const locale = isLocale(raw) ? raw : 'en';
  const market = new URL(req.url).searchParams.get('market') || 'de';
  if (!config().markets.includes(market))
    return new Response(null, { status: 404 });
  const id = new URL(req.url).searchParams.get('id');
  if (id && !/^(movie|tv):\d+$/.test(id))
    return new Response(null, { status: 404 });
  const item = id ? await getTitle(id, market) : null;
  if (id && !item) return new Response(null, { status: 404 });
  const title =
    item?.title.localizations[locale].title || t(locale, 'headline');
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
      }}
    >
      <div style={{ display: 'flex', fontSize: 38, fontWeight: 700 }}>
        cine<span style={{ color: '#f6c76b' }}>radar</span>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: title.length > 60 ? 48 : 72,
          fontWeight: 700,
          lineHeight: 1.1,
          maxWidth: 1050,
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
        }}
      >
        <span>
          {countryName(locale, market)}{' '}
          {item?.title.year ? ' · ' + item.title.year : ''}
        </span>
        <span>{t(locale, 'offers')}</span>
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
