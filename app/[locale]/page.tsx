import { redirect, notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { headers, cookies } from 'next/headers';
import { config } from '@/lib/config';
import { visitorContext } from '@/lib/visitor-context';
import { comparisonRoute } from '@/content/comparisons/routes';
import { ComparisonPage } from '@/ui/comparison-page';
import { comparisonMetadata } from '@/seo/comparisons';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const route = comparisonRoute('/' + (await params).locale);
  return route ? comparisonMetadata(route.locale, route.id) : {};
}
export default async function LocalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const editorial = comparisonRoute('/' + locale);
  if (editorial) return <ComparisonPage {...editorial} />;
  if (!isLocale(locale)) notFound();
  const h = await headers();
  const context = visitorContext({
    locale,
    markets: config().markets,
    saved: (await cookies()).get('cr_context')?.value,
    languages: h.get('accept-language'),
    country:
      process.env.VERCEL === '1'
        ? h.get('x-vercel-ip-country')
        : h.get('cf-ipcountry'),
  });
  redirect(`/${locale}/${context.market}/`);
}
