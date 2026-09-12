import { config } from '@/lib/config';
import { equal, json } from '@/lib/security';
import { db } from '@/data/db';
import { runTvmazeBatch } from '@/jobs/tvmaze';
import { runOmdbBatch } from '@/jobs/omdb';
import { runProviderDiscovery } from '@/jobs/provider-discovery';

export const runtime = 'nodejs';
export const maxDuration = 180;
function authorized(req: Request) {
  const key = config().CRON_SECRET;
  return (
    !!key && equal(req.headers.get('authorization') || '', 'Bearer ' + key)
  );
}
export async function GET(req: Request) {
  if (!authorized(req)) return json({}, 401);
  const database = await db();
  const rows = (
    await database.query(
      `SELECT (SELECT count(*)::int FROM tvmaze_shows) AS shows,(SELECT count(*)::int FROM tvmaze_episodes) AS episodes,(SELECT count(*)::int FROM tvmaze_title_map) AS linked,(SELECT count(*)::int FROM omdb_enrichments WHERE fetched_at IS NOT NULL) AS enriched`,
    )
  ).rows;
  return json({
    tvmazeEnabled: config().tvmazeEnabled,
    omdbEnabled: config().omdbEnabled,
    ...rows[0],
  });
}
export async function POST(req: Request) {
  if (!authorized(req)) return json({}, 401);
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return json({}, 400);
  }
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !('source' in input) ||
    typeof input.source !== 'string' ||
    !['tvmaze', 'omdb', 'discovery'].includes(input.source)
  )
    return json({}, 400);
  const result =
    input.source === 'tvmaze'
      ? await runTvmazeBatch({
          maxDurationMs: 60000,
          maxRequests: 50,
          maxPages: 12,
          maxShows: 6,
        })
      : input.source === 'omdb'
        ? await runOmdbBatch({ maxDurationMs: 60000, maxJobs: 50 })
        : await runProviderDiscovery({
            maxDurationMs: 60000,
            maxTitles: 60,
            maxDiscoveries: 5,
          });
  return json(result);
}
