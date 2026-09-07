import type { Database } from '../data/db';
import { db } from '../data/db';
import { hash } from '../data/providers/tmdb';
import type { Locale } from '../i18n/config';

export type SearchState =
  | 'queued'
  | 'running'
  | 'complete'
  | 'deferred'
  | 'failed';
export function normalizeTitleQuery(query: string) {
  return query
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export async function requestTitleSearch(
  query: string,
  locale: Locale,
  market: string,
  injected?: Database,
) {
  const database = injected || (await db());
  const key = `search:${await hash(`${locale}:${market}:${normalizeTitleQuery(query)}`)}:${new Date().toISOString().slice(0, 10)}`;
  await database.query(
    `INSERT INTO jobs(key,kind,payload,priority) VALUES($1,'search',$2,100)
    ON CONFLICT(key) DO UPDATE SET priority=100`,
    [key, JSON.stringify({ query, locale, market, source: 'search' })],
  );
  return titleSearchStatus(key, database);
}
export async function titleSearchStatus(
  key: string,
  injected?: Database,
): Promise<{
  state: SearchState;
  statusKey: string;
  retryAt?: string;
  resultsAvailable?: boolean;
} | null> {
  const database = injected || (await db());
  const job = (
    await database.query<{
      state: string;
      error_code: string | null;
      run_at: string;
      payload: { imports?: string[]; titleIds?: string[] };
    }>(
      "SELECT state,error_code,run_at,payload FROM jobs WHERE key=$1 AND kind='search'",
      [key],
    )
  ).rows[0];
  if (!job) return null;
  const pending =
    job.state === 'done'
      ? (
          await database.query<{
            state: string;
            error_code: string | null;
            run_at: string;
          }>(
            'SELECT state,error_code,run_at FROM jobs WHERE key=ANY($1::text[])',
            [job.payload.imports || []],
          )
        ).rows
      : [job];
  const resultsAvailable = !!(
    job.payload.titleIds?.length &&
    (
      await database.query(
        'SELECT id FROM titles WHERE id=ANY($1::text[]) LIMIT 1',
        [job.payload.titleIds],
      )
    ).rows.length
  );
  const base = { statusKey: key, resultsAvailable };
  if (job.state === 'dead') return { ...base, state: 'failed' };
  const waiting = pending.filter(
    (x) =>
      x.state === 'queued' || x.state === 'running' || x.state === 'paused',
  );
  if (!waiting.length)
    return {
      ...base,
      state:
        pending.length &&
        pending.every((x) => x.state === 'dead') &&
        !resultsAvailable
          ? 'failed'
          : 'complete',
    };
  if (waiting.some((x) => x.state === 'running'))
    return { ...base, state: 'running' };
  const deferred = waiting.filter(
    (x) =>
      x.state === 'paused' ||
      (['budget', 'quota'].includes(x.error_code || '') &&
        new Date(x.run_at).getTime() > Date.now()),
  );
  if (deferred.length === waiting.length)
    return {
      ...base,
      state: 'deferred',
      retryAt: deferred
        .filter((x) => x.state !== 'paused')
        .map((x) => new Date(x.run_at).toISOString())
        .sort()[0],
    };
  return { ...base, state: 'queued' };
}
