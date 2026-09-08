import type { Locale } from '@/i18n/config';

const l = (
  de: string,
  fr: string,
  it: string,
  es: string,
  en: string,
): Record<Locale, string> => ({ de, fr, it, es, en });

export const homeSearchCopy = {
  modes: l(
    'Suchmodus',
    'Mode de recherche',
    'Modalità di ricerca',
    'Modo de búsqueda',
    'Search mode',
  ),
  titleSearch: l(
    'Titelsuche',
    'Recherche de titre',
    'Cerca titolo',
    'Buscar título',
    'Title search',
  ),
  titleLabel: l(
    'Film oder Serie suchen',
    'Rechercher un film ou une série',
    'Cerca un film o una serie',
    'Buscar película o serie',
    'Search for a film or TV show',
  ),
  placeholder: l(
    'Titel eingeben …',
    'Saisir un titre…',
    'Inserisci un titolo…',
    'Escribe un título…',
    'Enter a title…',
  ),
};
