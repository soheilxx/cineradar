import { messages, t } from '../i18n/messages';
import { locales } from '../i18n/config';
import { path } from '../i18n/routes';
for (const [key, values] of Object.entries(messages)) {
  if (values.length !== 5 || values.some((v) => !v.trim()))
    throw new Error('Missing translation: ' + key);
  for (const locale of locales)
    t(locale, key as keyof typeof messages, {
      count: 2,
      number: 1,
      date: '2026-09-06',
      title: 'Cineradar',
      type: 'Film',
      year: 2026,
    });
}
for (const locale of locales)
  for (const market of ['de', 'fr', 'it', 'es'])
    if (!path(locale, market).startsWith(`/${locale}/${market}/`))
      throw new Error('Context routing mismatch');
console.log(
  `${Object.keys(messages).length} complete message keys; 5 languages; 20 routing contexts.`,
);
