import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from '@/lib/config';
import { visitorContext, visitorCountry } from '@/lib/visitor-context';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const h = await headers();
  const context = visitorContext({
    saved: (await cookies()).get('cr_context')?.value,
    languages: h.get('accept-language'),
    country: visitorCountry(
      h,
      process.env.VERCEL === '1'
        ? 'vercel'
        : process.env.CF_PAGES === '1'
          ? 'cloudflare'
          : 'other',
    ),
    markets: config().markets,
  });
  redirect(`/${context.locale}/${context.market}/`);
}
