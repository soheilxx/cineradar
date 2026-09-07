import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { config } from '@/lib/config';
import { isLocale } from '@/i18n/config';
import { Analytics } from '@/ui/analytics';
import { AnalyticsConsent } from '@/ui/analytics-consent';
import './globals.css';
import './experience.css';
import './editorial.css';
import './analytics.css';
export const metadata: Metadata = {
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  title: 'Cineradar · Find your next movie night',
  description:
    'Find where to stream films and TV shows. Your language. Your country. Your subscriptions.',
  robots: { index: false, follow: true },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const languageHeader = h.get('x-cineradar-locale') || 'en';
  const language = isLocale(languageHeader) ? languageHeader : 'en';
  const c = config();
  return (
    <html lang={language} className="dark">
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" />
        <link
          rel="preload"
          href="/fonts/manrope-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {children}
        <Suspense fallback={null}>
          <Analytics
            enabled={c.analyticsEnabled}
            nonce={h.get('x-nonce') || undefined}
            debug={c.GA4_DEBUG === 'true' && c.DEPLOYMENT_ENV === 'local'}
          />
          <AnalyticsConsent
            initialLocale={language}
            enabled={c.analyticsEnabled}
          />
        </Suspense>
      </body>
    </html>
  );
}
