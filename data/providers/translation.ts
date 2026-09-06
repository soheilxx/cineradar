import { config } from '../../lib/config';
import { hash } from './tmdb';
import type { Title } from '../../domain/types';
import type { Database } from '../db';
import { locales } from '../../i18n/config';
import { z } from 'zod';
export async function translateMissing(title: Title, database: Database) {
  const c = config();
  const source = title.localizations.en.overview;
  if (
    !source ||
    !c.TRANSLATION_URL ||
    !c.TRANSLATION_KEY ||
    c.TRANSLATION_RIGHTS_CONFIRMED !== 'true'
  )
    return title;
  const sourceHash = await hash(source);
  for (const locale of locales) {
    if (title.localizations[locale].overview || locale === 'en') continue;
    let text = (
      await database.query<{ content: string }>(
        'SELECT content FROM translations WHERE title_id=$1 AND locale=$2 AND source_hash=$3',
        [title.id, locale, sourceHash],
      )
    ).rows[0]?.content;
    if (!text) {
      const r = await fetch(c.TRANSLATION_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + c.TRANSLATION_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: source, source: 'en', target: locale }),
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      if (!r.ok) continue;
      const result = z
        .object({ text: z.string().trim().min(1).max(20000) })
        .safeParse(await r.json());
      if (!result.success) continue;
      text = result.data.text;
      await database.query(
        'INSERT INTO translations(title_id,locale,source_hash,content) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [title.id, locale, sourceHash, text],
      );
    }
    title.localizations[locale] = {
      ...title.localizations[locale],
      overview: text,
      source: 'translation',
      sourceHash,
    };
  }
  title.revision = await hash(JSON.stringify(title.localizations));
  return title;
}
