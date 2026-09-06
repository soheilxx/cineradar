import { permanentRedirect, notFound } from 'next/navigation';
import { isLocale, defaultMarkets } from '@/i18n/config';
export default async function LocalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  permanentRedirect(`/${locale}/${defaultMarkets[locale]}/`);
}
