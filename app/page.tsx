import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from '@/lib/config';
import { visitorContext } from '@/lib/visitor-context';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const h = await headers();
  const context = visitorContext({
    saved: (await cookies()).get('cr_context')?.value,
    languages: h.get('accept-language'),
    country:
      process.env.VERCEL === '1'
        ? h.get('x-vercel-ip-country')
        : h.get('cf-ipcountry'),
    markets: config().markets,
  });
  redirect(`/${context.locale}/${context.market}/`);
}
