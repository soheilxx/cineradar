import type {
  IdentifyRequest,
  IdentifyResponse,
  IdentifyItem,
} from './identify';
import type { CatalogItem } from './types';
import { catalogCard } from './cards';
import { fold } from './search';
import type { Locale } from '../i18n/config';
import type {
  IdentifyInterpretation,
  IdentifyRanking,
} from '../data/providers/openai';

// Conversational scaffolding is unhelpful even when a language's FTS dictionary
// retains it. Distinctive nouns, names and actions remain eligible.
const sharedStopWords = new Set(
  'film films movie movies serie series show shows television tv'.split(' '),
);
const languageStopWords: Record<Locale, Set<string>> = {
  de: new Set(
    fold(
      'ich suche such gesuchte gesucht erinnere erinnerung einen einem einer eine ein der die das den dem des und oder aber mit ohne von vom im in ins auf aus als ist sind war waren wird werden wo wie was wer geht handelt man menschen mann frau junge altes alten alter hilft verlasst reist',
    ).split(' '),
  ),
  en: new Set(
    'remember remembered looking search searching someone something story the a an and or but with without from into in on of is are was were where what who there it its his her their they he she that this my i me we you about young old helps leaves travels through beyond'.split(
      ' ',
    ),
  ),
  fr: new Set(
    fold(
      'je cherche souviens une un des du de le la les et ou avec sans dans sur est sont était histoire homme femme',
    ).split(' '),
  ),
  it: new Set(
    fold(
      'ricordo cerco una uno un il lo la le gli di del della dei e o con senza nel nella è sono storia uomo donna',
    ).split(' '),
  ),
  es: new Set(
    fold(
      'recuerdo busco pelicula una uno un el la los las de del y o con sin en es son historia hombre mujer',
    ).split(' '),
  ),
};

export function identifyTerms(text: string, locale: Locale = 'en'): string[] {
  return [
    ...new Set(
      fold(text)
        .split(' ')
        .filter(
          (word) =>
            word.length >= 3 &&
            word.length <= 60 &&
            !sharedStopWords.has(word) &&
            !languageStopWords[locale].has(word),
        ),
    ),
  ].slice(0, 28);
}

export function identifyPhrases(request: IdentifyRequest): string[] {
  const allowed = new Set(identifyTerms(request.description, request.locale));
  const words = fold(request.description).split(' ');
  return [
    ...new Set(
      words
        .slice(0, -1)
        .flatMap((word, index) =>
          allowed.has(word) && allowed.has(words[index + 1])
            ? [word + ' ' + words[index + 1]]
            : [],
        ),
    ),
  ].slice(0, 8);
}

export interface IdentifyCandidate {
  item: CatalogItem;
  score: number;
  coverage: number;
  matched: string[];
  hypothesis: boolean;
  overview: string;
  cast: string[];
}
export interface IdentifyRetrievalHints {
  clues: string[];
  englishClues: string[];
  hypotheses: IdentifyInterpretation['hypotheses'];
}

export function identifyQueryTerms(
  request: IdentifyRequest,
  hints?: IdentifyRetrievalHints,
) {
  if (!hints) return identifyTerms(request.description, request.locale);
  return [
    ...new Set([
      ...identifyTerms(hints.clues.join(' '), request.locale).slice(0, 10),
      ...identifyTerms(hints.englishClues.join(' '), 'en').slice(0, 10),
      ...identifyTerms(request.description, request.locale),
    ]),
  ].slice(0, 28);
}

export function passesIdentifyFilters(
  item: CatalogItem,
  request: IdentifyRequest,
) {
  return (
    (!request.mediaType ||
      request.mediaType === 'all' ||
      item.title.type === request.mediaType) &&
    (!request.decade ||
      (item.title.year !== null &&
        item.title.year >= request.decade &&
        item.title.year < request.decade + 10)) &&
    !request.excludedIds?.includes(item.title.id)
  );
}

/** Fixture/local reference scorer: rarity and multi-clue coverage beat popularity. */
export function rankIdentifyCorpus(
  items: CatalogItem[],
  request: IdentifyRequest,
  hints?: IdentifyRetrievalHints,
): IdentifyCandidate[] {
  const terms = identifyQueryTerms(request, hints);
  const corpus = items.map((item) => ({
    item,
    text:
      ' ' +
      fold(
        [
          item.title.originalTitle,
          item.title.localizations[request.locale]?.title,
          item.title.localizations[request.locale]?.overview,
          item.title.localizations.en?.overview,
          ...item.title.cast,
        ]
          .filter(Boolean)
          .join(' '),
      ) +
      ' ',
  }));
  const weights = terms.map((term) =>
    Math.min(
      6,
      1 +
        Math.log(
          1 +
            corpus.length /
              Math.max(
                1,
                corpus.filter((doc) => doc.text.includes(' ' + term + ' '))
                  .length,
              ),
        ),
    ),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return corpus
    .filter(({ item }) => passesIdentifyFilters(item, request))
    .map(({ item, text }) => {
      const matched = terms.filter((term) => text.includes(' ' + term + ' '));
      const coveredWeight = terms.reduce(
        (sum, term, index) =>
          sum + (matched.includes(term) ? weights[index] : 0),
        0,
      );
      const coverage = coveredWeight / totalWeight;
      const hypothesis = (hints?.hypotheses ?? []).some(
        (name) =>
          (name.type === 'unknown' || name.type === item.title.type) &&
          (name.year === null || name.year === item.title.year) &&
          [
            item.title.originalTitle,
            ...Object.values(item.title.localizations).map((l) => l.title),
          ].some((title) => fold(title) === fold(name.title)),
      );
      return {
        item,
        matched,
        coverage,
        hypothesis,
        score:
          coveredWeight *
          coverage *
          (1 +
            0.75 *
              Math.min(
                2,
                identifyPhrases(request).filter((phrase) =>
                  text.includes(' ' + phrase + ' '),
                ).length,
              )),
        overview: (
          item.title.localizations[request.locale]?.overview ||
          item.title.localizations.en?.overview ||
          ''
        ).slice(0, 1200),
        cast: item.title.cast.slice(0, 8),
      };
    })
    .filter((candidate) => candidate.matched.length > 0 || candidate.hypothesis)
    .sort(
      (a, b) =>
        Number(b.hypothesis) - Number(a.hypothesis) ||
        b.score - a.score ||
        b.item.title.votes - a.item.title.votes ||
        a.item.title.id.localeCompare(b.item.title.id),
    )
    .slice(0, 24);
}

function excerpt(candidate: IdentifyCandidate): string[] {
  const sentences = candidate.overview.match(/[^.!?]+[.!?]?/g) ?? [];
  const matching = sentences.find((sentence) =>
    candidate.matched.some((term) => fold(sentence).includes(term)),
  );
  if (matching)
    return [
      matching.trim().slice(0, 157) + (matching.trim().length > 157 ? '…' : ''),
    ];
  const cast = candidate.cast.filter((name) =>
    candidate.matched.some((term) => fold(name).split(' ').includes(term)),
  );
  return cast.slice(0, 2);
}

export function catalogIdentifyResponse(
  candidates: IdentifyCandidate[],
  request: IdentifyRequest,
  notice: IdentifyResponse['notice'] = 'catalog_only',
): IdentifyResponse {
  const qualified = candidates.filter(
    (candidate) => candidate.matched.length >= 2 && candidate.coverage >= 0.2,
  );
  const items: IdentifyItem[] = qualified.slice(0, 6).map((candidate) => ({
    card: catalogCard(candidate.item, request.locale),
    reasons: excerpt(candidate),
    match: 'possible',
  }));
  return {
    mode: 'catalog',
    status: items.length
      ? 'matches'
      : candidates.length
        ? 'needs_clues'
        : 'no_match',
    items,
    followUp: items.length ? 'detail' : 'scene',
    notice,
  };
}

export function verifiedRanking(
  ranking: IdentifyRanking,
  candidates: IdentifyCandidate[],
  request: IdentifyRequest,
): IdentifyResponse {
  const byId = new Map(
    candidates
      .filter((candidate) => passesIdentifyFilters(candidate.item, request))
      .map((candidate) => [candidate.item.title.id, candidate]),
  );
  const seen = new Set<string>();
  const items: IdentifyItem[] = [];
  for (const match of ranking.items) {
    const candidate = byId.get(match.id);
    if (!candidate || seen.has(match.id)) continue;
    seen.add(match.id);
    const reasons = [
      ...new Set(
        match.evidence
          .filter((evidence) =>
            evidence.source === 'overview'
              ? candidate.overview.includes(evidence.quote)
              : candidate.cast.some((name) => name.includes(evidence.quote)),
          )
          .map((evidence) => evidence.quote),
      ),
    ].slice(0, 2);
    // Unsupported generated explanations cannot turn a guess into a result.
    if (!reasons.length) continue;
    items.push({
      card: catalogCard(candidate.item, request.locale),
      reasons,
      match: match.match,
    });
  }
  return {
    mode: 'ai',
    status: items.length ? 'matches' : 'needs_clues',
    items: items.slice(0, 6),
    followUp:
      ranking.followUp ??
      (items.some((item) => item.match === 'strong') ? null : 'scene'),
  };
}

export interface IdentifyDependencies {
  enabled: boolean;
  signal?: AbortSignal;
  retrieve: (
    request: IdentifyRequest,
    hints?: IdentifyRetrievalHints,
  ) => Promise<IdentifyCandidate[]>;
  interpret: (
    input: unknown,
    signal: AbortSignal,
  ) => Promise<IdentifyInterpretation>;
  rank: (input: unknown, signal: AbortSignal) => Promise<IdentifyRanking>;
}

export async function withinIdentifyDeadline<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => undefined);
    throw signal.reason;
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function executeIdentify(
  request: IdentifyRequest,
  dependencies: IdentifyDependencies,
): Promise<IdentifyResponse> {
  dependencies.signal?.throwIfAborted();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('identify_timeout')),
    25_000,
  );
  const signal = dependencies.signal
    ? AbortSignal.any([dependencies.signal, controller.signal])
    : controller.signal;
  let baseline: IdentifyCandidate[] = [];
  let baselineAvailable = false;
  const baselinePromise = withinIdentifyDeadline(
    dependencies.retrieve(request),
    signal,
  )
    .then((items) => {
      baseline = items;
      baselineAvailable = true;
      return items;
    })
    .catch(() => [] as IdentifyCandidate[]);
  try {
    if (!dependencies.enabled) {
      await baselinePromise;
      if (!baselineAvailable) throw new Error('identify_catalog_unavailable');
      return catalogIdentifyResponse(await baselinePromise, request);
    }
    const interpretationSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(9_000),
    ]);
    const interpretation = await withinIdentifyDeadline(
      dependencies.interpret(
        {
          description: request.description,
          locale: request.locale,
          mediaType: request.mediaType ?? 'all',
          decade: request.decade ?? null,
        },
        interpretationSignal,
      ),
      interpretationSignal,
    );
    const candidates = (
      await withinIdentifyDeadline(
        dependencies.retrieve(request, interpretation),
        signal,
      )
    ).slice(0, 24);
    if (!candidates.length)
      return {
        mode: 'ai',
        status: 'no_match',
        items: [],
        followUp: interpretation.followUp ?? 'scene',
        notice: 'limited_catalog',
      };
    const ranking = await withinIdentifyDeadline(
      dependencies.rank(
        {
          description: request.description,
          locale: request.locale,
          mediaType: request.mediaType ?? 'all',
          decade: request.decade ?? null,
          candidates: candidates.map((candidate) => ({
            id: candidate.item.title.id,
            title: candidate.item.title.localizations[request.locale].title,
            originalTitle: candidate.item.title.originalTitle,
            type: candidate.item.title.type,
            year: candidate.item.title.year,
            overview: candidate.overview.slice(0, 1200),
            cast: candidate.cast.slice(0, 8),
          })),
        },
        signal,
      ),
      signal,
    );
    return verifiedRanking(ranking, candidates, request);
  } catch {
    if (dependencies.signal?.aborted) throw dependencies.signal.reason;
    if (!signal.aborted) await baselinePromise;
    if (!baselineAvailable) throw new Error('identify_catalog_unavailable');
    return catalogIdentifyResponse(baseline, request, 'ai_unavailable');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
