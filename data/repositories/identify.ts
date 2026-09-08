import { db, type Database } from '../db';
import { config } from '../../lib/config';
import { emptySnapshot, freshness } from '../../domain/offers';
import type { Title, Snapshot } from '../../domain/types';
import type { IdentifyRequest } from '../../domain/identify';
import {
  identifyQueryTerms,
  identifyPhrases,
  rankIdentifyCorpus,
  executeIdentify,
  type IdentifyCandidate,
  type IdentifyRetrievalHints,
} from '../../domain/identify-search';
import {
  interpretDescription,
  rankIdentifyCandidates,
} from '../providers/openai';

interface CandidateRow {
  data: Title;
  score: number | string;
  coverage: number | string;
  matched: string[];
  hypothesis: boolean;
  overview: string;
  english_overview: string;
  availability: Snapshot['availability'] | null;
  checked_at: string | null;
  attempt_at: string | null;
  error_code: string | null;
  revision: string | null;
  offers: Snapshot['offers'];
}

// GIN narrows each distinct stem before document frequency is counted. A match
// needs coverage of several clues, not a high OR rank from a single common word.
const candidateSql = `WITH raw_terms AS (
  SELECT DISTINCT value AS term FROM jsonb_array_elements_text($2::jsonb)
), stemmed_terms AS (
  SELECT term, plainto_tsquery(identify_language($1),identify_normalize(term)) AS local_query,
    plainto_tsquery('english',identify_normalize(term)) AS english_query, plainto_tsquery('simple',identify_normalize(term)) AS people_query
  FROM raw_terms
), terms AS MATERIALIZED (
  SELECT DISTINCT ON(local_query::text,english_query::text) * FROM stemmed_terms
  ORDER BY local_query::text,english_query::text,term
), hits AS MATERIALIZED (
  SELECT terms.term, found.title_id FROM terms CROSS JOIN LATERAL (
    SELECT l.title_id FROM localizations l WHERE l.locale=$1 AND l.identify_document @@ terms.local_query
    UNION SELECT l.title_id FROM localizations l WHERE l.locale='en' AND l.identify_document @@ terms.english_query
    UNION SELECT t.id FROM titles t WHERE t.identify_people @@ terms.people_query
  ) found
), weights AS MATERIALIZED (
  SELECT terms.term, least(6.0,1.0+ln(1.0+(SELECT count(*) FROM titles)::numeric/greatest(1,count(hits.title_id)))) AS weight
  FROM terms LEFT JOIN hits USING(term) GROUP BY terms.term
), scored AS (
  SELECT hits.title_id, sum(weights.weight) AS covered_weight,
    sum(weights.weight)/greatest(1,(SELECT sum(weight) FROM weights)) AS coverage,
    array_agg(hits.term ORDER BY weights.weight DESC,hits.term) AS matched
  FROM hits JOIN weights USING(term) GROUP BY hits.title_id
), phrase_hits AS (
  SELECT p.phrase, found.title_id FROM jsonb_array_elements_text($8::jsonb) AS p(phrase)
  CROSS JOIN LATERAL (
    SELECT l.title_id FROM localizations l WHERE l.locale=$1 AND numnode(phraseto_tsquery(identify_language($1),identify_normalize(p.phrase)))>=3 AND l.identify_document @@ phraseto_tsquery(identify_language($1),identify_normalize(p.phrase))
    UNION SELECT l.title_id FROM localizations l WHERE l.locale='en' AND numnode(phraseto_tsquery('english',identify_normalize(p.phrase)))>=3 AND l.identify_document @@ phraseto_tsquery('english',identify_normalize(p.phrase))
  ) found
), phrase_scores AS (
  SELECT title_id, least(2,count(*)) AS matches FROM phrase_hits GROUP BY title_id
), hypotheses AS (
  SELECT DISTINCT t.id FROM titles t CROSS JOIN jsonb_to_recordset($3::jsonb) AS h(title text,type text,year int)
  WHERE (h.type='unknown' OR t.media_type=h.type) AND (h.year IS NULL OR (t.data->>'year')::int=h.year)
    AND (trim(regexp_replace(unaccent(lower(t.data->>'originalTitle')),'[^[:alnum:]]+',' ','g'))=h.title
      OR EXISTS(SELECT 1 FROM localizations l WHERE l.title_id=t.id AND trim(regexp_replace(unaccent(lower(l.title)),'[^[:alnum:]]+',' ','g'))=h.title))
), selected AS (
  SELECT t.id, coalesce(scored.covered_weight*scored.coverage,0)*(1+0.75*coalesce(phrase_scores.matches,0)) AS score,
    coalesce(scored.coverage,0) AS coverage, coalesce(scored.matched,ARRAY[]::text[]) AS matched,
    hypotheses.id IS NOT NULL AS hypothesis
  FROM titles t LEFT JOIN scored ON scored.title_id=t.id LEFT JOIN hypotheses ON hypotheses.id=t.id LEFT JOIN phrase_scores ON phrase_scores.title_id=t.id
  WHERE (scored.title_id IS NOT NULL OR hypotheses.id IS NOT NULL)
    AND ($4='all' OR t.media_type=$4)
    AND ($5::int IS NULL OR (t.data->>'year')::int BETWEEN $5::int AND $5::int+9)
    AND NOT(t.id=ANY($6::text[]))
    AND EXISTS(SELECT 1 FROM localizations l WHERE l.title_id=t.id AND l.locale=$1)
  ORDER BY hypothesis DESC,score DESC,coalesce((t.data->>'votes')::int,0) DESC,t.id LIMIT 24
)
SELECT t.data,selected.score,selected.coverage,selected.matched,selected.hypothesis,
  l.overview,coalesce(en.overview,'') AS english_overview,s.availability,s.checked_at,s.attempt_at,s.error_code,s.revision,
  coalesce((SELECT jsonb_agg(o.data) FROM offers o WHERE o.title_id=t.id AND o.market=$7 AND (o.expires_at IS NULL OR o.expires_at>=now())),'[]'::jsonb) AS offers
FROM selected JOIN titles t ON t.id=selected.id JOIN localizations l ON l.title_id=t.id AND l.locale=$1
LEFT JOIN localizations en ON en.title_id=t.id AND en.locale='en'
LEFT JOIN snapshots s ON s.title_id=t.id AND s.market=$7
ORDER BY selected.hypothesis DESC,selected.score DESC,coalesce((t.data->>'votes')::int,0) DESC,t.id`;

export async function identifyCandidates(
  request: IdentifyRequest,
  hints?: IdentifyRetrievalHints,
  database?: Database,
): Promise<IdentifyCandidate[]> {
  const c = config();
  if (c.APP_MODE === 'fixture' && !database) {
    const items = (await import('../../test/fixtures/catalog'))
      .fixtureCatalog()
      .filter((item) => item.snapshot.market === request.market);
    return rankIdentifyCorpus(items, request, hints);
  }
  if (!database && !c.DATABASE_URL)
    throw new Error('identify_catalog_unavailable');
  const { fold } = await import('../../domain/search');
  const terms = identifyQueryTerms(request, hints);
  const hypotheses = (hints?.hypotheses ?? []).map((name) => ({
    ...name,
    title: fold(name.title),
  }));
  if (!terms.length && !hypotheses.length) return [];
  const result = await (database ?? (await db())).query<CandidateRow>(
    candidateSql,
    [
      request.locale,
      JSON.stringify(terms),
      JSON.stringify(hypotheses),
      request.mediaType ?? 'all',
      request.decade ?? null,
      request.excludedIds ?? [],
      request.market,
      JSON.stringify(identifyPhrases(request)),
    ],
  );
  return result.rows.map((row) => ({
    item: {
      title: row.data,
      snapshot: {
        ...emptySnapshot(row.data.id, request.market),
        availability: row.availability ?? 'unchecked',
        checkedAt: row.checked_at,
        attemptAt: row.attempt_at,
        errorCode: row.error_code,
        revision: String(row.revision ?? 0),
        offers: row.offers ?? [],
        freshness: freshness(row.checked_at, Date.now(), 36, c.STALE_HOURS),
      },
    },
    score: Number(row.score),
    coverage: Number(row.coverage),
    matched: row.matched,
    hypothesis: row.hypothesis,
    overview:
      row.overview && row.english_overview && request.locale !== 'en'
        ? row.overview.slice(0, 850) + '\n' + row.english_overview.slice(0, 349)
        : (row.overview || row.english_overview).slice(0, 1200),
    cast: row.data.cast.slice(0, 8),
  }));
}

export function runIdentify(
  request: IdentifyRequest,
  signal?: AbortSignal,
  database?: Database,
) {
  return executeIdentify(request, {
    enabled: config().identifyAiEnabled,
    signal,
    retrieve: (input, hints) => identifyCandidates(input, hints, database),
    interpret: (input, callSignal) =>
      interpretDescription(input, { signal: callSignal, database }),
    rank: (input, callSignal) =>
      rankIdentifyCandidates(input, { signal: callSignal, database }),
  });
}
