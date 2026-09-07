import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import './experience.css';
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
  const language = (await headers()).get('x-cineradar-locale') || 'en';
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
      <body>{children}</body>
    </html>
  );
}
