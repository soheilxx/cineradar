import { db } from '../data/db';
import { TMDB } from '../data/providers/tmdb';
import {
  SAA,
  normalizeShow,
  providerFrom,
  showSchema,
} from '../data/providers/saa';
import { config } from '../lib/config';
import { enqueue, reserve, type Job } from './queue';
import { ProviderError } from '../data/providers/http';
import type { Title, MediaType } from '../domain/types';
import { getTitle } from '../data/repositories/catalog';
import { translateMissing } from '../data/providers/translation';
export function importMarkets(
  job: Pick<Job, 'kind' | 'payload'>,
  enabled: string[],
) {
  if (job.kind !== 'catalog-title') return enabled;
  const market = String(job.payload.market);
  if (!enabled.includes(market)) throw new ProviderError('schema');
  return [market];
}
export async function handle(job: Job) {
  const c = config();
  const database = await db();
  const tmdb = new TMDB(reserve);
  const saa = new SAA(reserve);
  if (job.kind === 'countries') {
    const countries = await saa.countries();
    for (const market of c.markets) {
      const country = countries[market];
      await database.query(
        'INSERT INTO markets(code,verified_at,supported) VALUES($1,now(),$2) ON CONFLICT(code) DO UPDATE SET verified_at=now(),supported=EXCLUDED.supported',
        [market, !!country],
      );
      if (country)
        for (const p of country.services) {
          await database.query(
            'INSERT INTO providers(market,id,data) VALUES($1,$2,$3) ON CONFLICT(market,id) DO UPDATE SET data=EXCLUDED.data',
            [
              market,
              p.id,
              JSON.stringify({
                ...providerFrom(p),
                types: Object.entries(p.streamingOptionTypes)
                  .filter(([, v]) => v)
                  .map(([k]) => k),
                addons: p.addons.map((a) => ({
                  id: a.id,
                  name: a.name,
                  logo: a.imageSet.darkThemeImage,
                })),
              }),
            ],
          );
        }
    }
    return;
  }
  if (job.kind === 'bootstrap' || job.kind === 'search') {
    const list =
      job.kind === 'search'
        ? await tmdb.search(
            String(job.payload.query),
            job.payload.locale as import('../i18n/config').Locale,
          )
        : await tmdb.trending();
    for (const result of list.results
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 10)) {
      await enqueue(
        'import:' +
          result.media_type +
          ':' +
          result.id +
          ':' +
          new Date().toISOString().slice(0, 10),
        'import',
        { type: result.media_type, id: result.id },
      );
    }
    return;
  }
  if (job.kind === 'catalog-page') {
    const market = String(job.payload.market);
    const type = job.payload.type as MediaType;
    const page = Number(job.payload.page);
    const maxPages = Number(job.payload.maxPages);
    const batch = String(job.payload.batch);
    const cursor =
      typeof job.payload.cursor === 'string' ? job.payload.cursor : undefined;
    const seen = Array.isArray(job.payload.seen)
      ? job.payload.seen.map(String)
      : [];
    if (
      !c.markets.includes(market) ||
      !['movie', 'tv'].includes(type) ||
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(maxPages) ||
      maxPages < 1 ||
      maxPages > 500 ||
      page > maxPages
    )
      throw new ProviderError('schema');
    const order = (job.payload.order || 'popularity_1year') as
      | 'popularity_1year'
      | 'popularity_1week'
      | 'release_date';
    if (
      !['popularity_1year', 'popularity_1week', 'release_date'].includes(order)
    )
      throw new ProviderError('schema');
    const result = await saa.catalog(market, type, cursor, order);
    if (
      result.hasMore &&
      (!result.nextCursor ||
        seen.includes(result.nextCursor) ||
        result.nextCursor === cursor)
    )
      throw new ProviderError('schema');
    for (const show of result.shows) {
      const id = Number(show.tmdbId.split('/').at(-1));
      // Validate the mapping before making a durable import job.
      normalizeShow(show, type, id, market);
      await enqueue(
        `catalog-title:${batch}:${market}:${type}:${id}`,
        'catalog-title',
        {
          type,
          id,
          market,
          show,
        },
      );
    }
    if (result.hasMore && page < maxPages) {
      await enqueue(
        `catalog-page:${batch}:${market}:${type}:${page + 1}`,
        'catalog-page',
        {
          market,
          type,
          page: page + 1,
          maxPages,
          batch,
          order,
          cursor: result.nextCursor,
          seen: [...seen, ...(cursor ? [cursor] : [])],
        },
      );
    }
    await database.query(
      'INSERT INTO operations(key,data) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()',
      [
        `ranking:${market}:${type}:${order}:${page}`,
        JSON.stringify({
          page,
          ids: result.shows.map(
            (show) => `${type}:${show.tmdbId.split('/').at(-1)}`,
          ),
        }),
      ],
    );
    await database.query(
      'INSERT INTO operations(key,data) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()',
      [
        `catalog:${batch}:${market}:${type}`,
        JSON.stringify({
          page,
          maxPages,
          hasMore: result.hasMore,
          discoveryComplete: !result.hasMore || page === maxPages,
        }),
      ],
    );
    return;
  }
  if (
    job.kind === 'import' ||
    job.kind === 'reconcile' ||
    job.kind === 'catalog-title'
  ) {
    const type = job.payload.type as MediaType;
    const id = Number(job.payload.id);
    if (!['movie', 'tv'].includes(type) || !Number.isSafeInteger(id) || id <= 0)
      throw new ProviderError('schema');
    const previous = (await getTitle(type + ':' + id, c.markets[0]))?.title;
    const markets = importMarkets(job, c.markets);
    const inlineShow =
      job.kind === 'catalog-title' ? showSchema.parse(job.payload.show) : null;
    // Filter search results only cover their requested country. Never mark
    // unreturned countries empty or replace their existing offers.
    let title: Title;
    if (job.kind === 'import' || !previous) {
      title = await tmdb.title(type, id, previous);
      await database.query('SELECT save_job_title($1,$2,$3)', [
        JSON.stringify(title),
        job.id,
        job.lock_token,
      ]);
      title = await translateMissing(title, database);
      title.indexable =
        Object.values(title.localizations).every(
          (l) => l.title && l.overview,
        ) && !!title.year;
      await database.query('SELECT save_job_title($1,$2,$3)', [
        JSON.stringify(title),
        job.id,
        job.lock_token,
      ]);
    } else title = previous;
    try {
      const show = inlineShow || (await saa.show(type, id));
      for (const market of markets) {
        const result = normalizeShow(show, type, id, market);
        const supported =
          (
            await database.query<{ supported: boolean }>(
              'SELECT supported FROM markets WHERE code=$1',
              [market],
            )
          ).rows[0]?.supported || false;
        await database.query(
          'SELECT reconcile_job_offers($1,$2,$3,$4,$5,$6,$7)',
          [
            title.id,
            market,
            JSON.stringify(result.offers),
            job.key + ':' + market,
            supported,
            job.id,
            job.lock_token,
          ],
        );
      }
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'upstream';
      // A local budget pause made no provider request. Preserve the last
      // checked snapshot while the worker defers this job.
      if (code === 'budget') throw e;
      for (const market of markets) {
        await database.query(
          'INSERT INTO markets(code) VALUES($1) ON CONFLICT DO NOTHING',
          [market],
        );
        await database.query(
          "INSERT INTO snapshots(title_id,market,availability,attempt_at,error_code) VALUES($1,$2,'error',now(),$3) ON CONFLICT(title_id,market) DO UPDATE SET availability='error',attempt_at=now(),error_code=EXCLUDED.error_code",
          [title.id, market, code],
        );
      }
      throw e;
    }
    return;
  }
  if (job.kind === 'changes') {
    const market = String(job.payload.market),
      kind = job.payload.changeType as 'new' | 'updated' | 'removed';
    const itemType = (job.payload.itemType || 'show') as
      | 'show'
      | 'season'
      | 'episode';
    if (
      !c.markets.includes(market) ||
      !['new', 'updated', 'removed'].includes(kind) ||
      !['show', 'season', 'episode'].includes(itemType)
    )
      throw new ProviderError('schema');
    const scope = market + ':' + kind + ':' + itemType;
    const end = Number(job.payload.to);
    const existing = (
      await database.query<{ timestamp: string }>(
        'SELECT timestamp FROM watermarks WHERE scope=$1',
        [scope],
      )
    ).rows[0];
    const start = Math.max(
      end - 30 * 86400,
      job.payload.from !== undefined
        ? Number(job.payload.from)
        : Number(existing?.timestamp || end - 21600) - 300,
    );
    const cursor =
      typeof job.payload.cursor === 'string' ? job.payload.cursor : undefined;
    const seen = Array.isArray(job.payload.seen)
      ? job.payload.seen.map(String)
      : [];
    const page = Number(job.payload.page || 1);
    if (
      !Number.isSafeInteger(end) ||
      !Number.isSafeInteger(start) ||
      start > end ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000
    )
      throw new ProviderError('schema');
    const result = await saa.changes(
      market,
      start,
      end,
      kind,
      cursor,
      itemType,
    );
    if (
      result.hasMore &&
      (!result.nextCursor ||
        result.nextCursor === cursor ||
        seen.includes(result.nextCursor) ||
        page === 1000)
    )
      throw new ProviderError('schema');
    const jobs = Object.values(result.shows).map((show) => {
      const type = show.showType === 'series' ? 'tv' : 'movie';
      const id = Number(show.tmdbId.split('/').at(-1));
      return {
        key: `reconcile:${type}:${id}:${Math.floor(end / 21600)}`,
        kind: 'reconcile',
        payload: { type, id },
      };
    });
    await database.query(
      `INSERT INTO jobs(key,kind,payload) SELECT key,kind,payload FROM jsonb_to_recordset($1::jsonb) AS changes(key text,kind text,payload jsonb) ON CONFLICT(key) DO NOTHING`,
      [JSON.stringify(jobs)],
    );
    // One source page per leased job keeps large change windows bounded on
    // serverless. A watermark advances only after the final page is durable.
    if (result.hasMore) {
      const rootKey = String(job.payload.rootKey || job.key);
      await enqueue(`${rootKey}:page:${page + 1}`, 'changes', {
        market,
        changeType: kind,
        itemType,
        from: start,
        to: end,
        cursor: result.nextCursor,
        seen: [...seen, ...(cursor ? [cursor] : [])],
        page: page + 1,
        rootKey,
      });
    } else
      await database.query(
        'INSERT INTO watermarks(scope,timestamp) VALUES($1,$2) ON CONFLICT(scope) DO UPDATE SET timestamp=GREATEST(watermarks.timestamp,EXCLUDED.timestamp)',
        [scope, end],
      );
    return;
  }
  if (job.kind === 'maintenance') {
    await database.query(
      "DELETE FROM reports WHERE created_at<now()-interval '90 days'",
    );
    await database.query('DELETE FROM rate_limits WHERE expires_at<now()');
    await database.query(
      "DELETE FROM budget_reservations WHERE at<now()-interval '90 days'",
    );
    await database.query(
      "UPDATE jobs SET state='dead',error_code='attempts_exhausted' WHERE state='running' AND attempts>=6 AND lock_until<now()",
    );
    return;
  }
  throw new ProviderError('schema');
}
