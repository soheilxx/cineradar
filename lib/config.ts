import { z } from 'zod';
const envSchema = z.object({
  APP_MODE: z.enum(['unconfigured', 'fixture', 'live']).default('unconfigured'),
  DEPLOYMENT_ENV: z.enum(['local', 'preview', 'production']).default('local'),
  SITE_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  DATABASE_DRIVER: z.enum(['pg', 'neon']).default('pg'),
  TMDB_READ_ACCESS_TOKEN: z.string().optional(),
  SAA_ACCESS_MODE: z.enum(['direct', 'rapidapi']).default('direct'),
  SAA_API_KEY: z.string().optional(),
  RAPIDAPI_KEY: z.string().optional(),
  ENABLED_MARKETS: z.string().default('de,fr,it,es,us'),
  SUPPORTED_LOCALES: z.literal('de,fr,it,es,en').default('de,fr,it,es,en'),
  SAA_DAILY_BUDGET: z.coerce.number().int().nonnegative().default(0),
  SAA_MONTHLY_BUDGET: z.coerce.number().int().nonnegative().default(0),
  TMDB_DAILY_BUDGET: z.coerce.number().int().positive().default(500),
  SAA_ENDPOINT_WEIGHT: z.coerce.number().int().positive().default(1),
  BUDGET_BUFFER: z.coerce.number().min(0).max(0.9).default(0.2),
  SYNC_ENABLED: z.enum(['true', 'false']).default('false'),
  GA4_ENABLED: z.enum(['true', 'false']).default('false'),
  GA4_DEBUG: z.enum(['true', 'false']).default('false'),
  ADMIN_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  OPERATOR_NAME: z.string().optional(),
  OPERATOR_ADDRESS: z.string().optional(),
  CONTACT_EMAIL: z.email().optional(),
  LEGAL_APPROVED: z.enum(['true', 'false']).default('false'),
  LICENSES_CONFIRMED: z.enum(['true', 'false']).default('false'),
  STALE_HOURS: z.coerce.number().min(36).default(72),
  TRANSLATION_URL: z.url().optional(),
  TRANSLATION_KEY: z.string().optional(),
  TRANSLATION_RIGHTS_CONFIRMED: z.enum(['true', 'false']).default('false'),
});
export function config(
  source: Record<string, string | undefined> = process.env,
) {
  const result = envSchema.safeParse(
    Object.fromEntries(
      Object.entries(source).filter(([, value]) => value !== ''),
    ),
  );
  if (!result.success)
    throw new Error(
      'Invalid configuration: ' +
        result.error.issues.map((x) => x.path.join('.')).join(', '),
    );
  const c = result.data;
  const missing: string[] = [];
  if (
    c.APP_MODE === 'fixture' &&
    (c.DEPLOYMENT_ENV !== 'local' ||
      !['localhost', '127.0.0.1'].includes(new URL(c.SITE_URL).hostname))
  )
    throw new Error(
      'Fixture mode requires local deployment and loopback SITE_URL',
    );
  if (c.APP_MODE === 'live') {
    if (!c.SESSION_SECRET || c.SESSION_SECRET.length < 32)
      missing.push('SESSION_SECRET (32+)');
    for (const k of ['DATABASE_URL', 'TMDB_READ_ACCESS_TOKEN'] as const)
      if (!c[k]) missing.push(k);
    if (!c[c.SAA_ACCESS_MODE === 'direct' ? 'SAA_API_KEY' : 'RAPIDAPI_KEY'])
      missing.push(
        c.SAA_ACCESS_MODE === 'direct' ? 'SAA_API_KEY' : 'RAPIDAPI_KEY',
      );
  }
  if (c.DEPLOYMENT_ENV === 'production') {
    for (const k of [
      'OPERATOR_NAME',
      'OPERATOR_ADDRESS',
      'CONTACT_EMAIL',
      'ADMIN_KEY',
      'SESSION_SECRET',
    ] as const)
      if (!c[k]) missing.push(k);
    if (
      c.APP_MODE !== 'live' ||
      c.LEGAL_APPROVED !== 'true' ||
      c.LICENSES_CONFIRMED !== 'true'
    )
      missing.push('APP_MODE, LEGAL_APPROVED, LICENSES_CONFIRMED');
    if (new URL(c.SITE_URL).protocol !== 'https:') missing.push('SITE_URL');
  }
  if (
    c.ADMIN_KEY &&
    (c.ADMIN_KEY.length < 24 ||
      !c.SESSION_SECRET ||
      c.SESSION_SECRET.length < 32)
  )
    missing.push('ADMIN_KEY (24+), SESSION_SECRET (32+)');
  if (
    c.SYNC_ENABLED === 'true' &&
    (c.SAA_DAILY_BUDGET === 0 ||
      c.SAA_MONTHLY_BUDGET === 0 ||
      c.APP_MODE !== 'live')
  )
    missing.push('SAA_DAILY_BUDGET, SAA_MONTHLY_BUDGET, APP_MODE');
  if (missing.length)
    throw new Error('Missing configuration: ' + missing.join(', '));
  return {
    ...c,
    analyticsEnabled:
      (c.GA4_ENABLED === 'true' &&
        c.APP_MODE === 'live' &&
        c.DEPLOYMENT_ENV === 'production') ||
      (c.GA4_DEBUG === 'true' &&
        c.DEPLOYMENT_ENV === 'local' &&
        ['localhost', '127.0.0.1'].includes(new URL(c.SITE_URL).hostname)),
    markets: c.ENABLED_MARKETS.toLowerCase()
      .split(',')
      .filter((x) => /^[a-z]{2}$/.test(x)),
  };
}
