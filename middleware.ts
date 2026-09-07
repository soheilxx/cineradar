import { NextRequest, NextResponse } from 'next/server';
import { comparisonRoute, comparisonPath } from './content/comparisons/routes';
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const editorial = comparisonRoute(pathname);
  const normalized = editorial
    ? comparisonPath(editorial.locale, editorial.id)
    : !pathname.endsWith('/') &&
        !/^\/(api|_next)(\/|$)/.test(pathname) &&
        !/\.[^/]+$/.test(pathname)
      ? pathname + '/'
      : pathname;
  if (normalized !== pathname) {
    const url = new URL(request.url);
    url.pathname = normalized;
    return NextResponse.redirect(url, 308);
  }
  const p = request.nextUrl.pathname.split('/');
  const h = new Headers(request.headers);
  h.set(
    'x-cineradar-locale',
    editorial?.locale ||
      (['de', 'fr', 'it', 'es', 'en'].includes(p[1]) ? p[1] : 'en'),
  );
  h.set('x-cineradar-market', /^[a-z]{2}$/.test(p[2] || '') ? p[2] : 'de');
  const nonce = btoa(crypto.randomUUID());
  h.set('x-nonce', nonce);
  const dev = process.env.DEPLOYMENT_ENV !== 'production';
  const csp = `default-src 'self'; script-src 'self' ${dev ? "'unsafe-inline' 'unsafe-eval'" : `'nonce-${nonce}' 'strict-dynamic'`}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self' ${dev ? 'ws: wss:' : ''}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';`;
  h.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: h } });
  if (/^\/(?:[a-z]{2}\/?)?$/.test(request.nextUrl.pathname)) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Vary', 'Accept-Language, Cookie');
  }
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  if (!dev)
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  if (dev) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    /(merkliste|watchlist|ma-liste|mi-lista|operations|betrieb|exploitation|gestione|operaciones)/.test(
      request.nextUrl.pathname,
    )
  )
    response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|assets|favicon.ico|cinema.webp).*)'],
};
