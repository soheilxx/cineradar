import { locales, type Locale } from './config';
const paths = {
  home: ['', '', '', '', ''],
  search: ['suche', 'recherche', 'cerca', 'buscar', 'search'],
  movies: ['filme', 'films', 'film', 'peliculas', 'films'],
  series: ['serien', 'series', 'serie', 'series', 'shows'],
  movie: ['film', 'film', 'film', 'pelicula', 'movie'],
  tv: ['serie', 'serie', 'serie', 'serie', 'show'],
  providers: [
    'anbieter',
    'plateformes',
    'piattaforme',
    'plataformas',
    'providers',
  ],
  watchlist: ['merkliste', 'ma-liste', 'lista', 'mi-lista', 'watchlist'],
  myProviders: [
    'meine-anbieter',
    'mes-plateformes',
    'mie-piattaforme',
    'mis-plataformas',
    'my-providers',
  ],
  finder: ['heute-abend', 'ce-soir', 'stasera', 'esta-noche', 'tonight'],
  new: ['neu', 'nouveautes', 'novita', 'novedades', 'new'],
  leaving: [
    'laeuft-aus',
    'derniere-chance',
    'in-scadenza',
    'ultimos-dias',
    'leaving',
  ],
  free: ['kostenlos', 'gratuit', 'gratis', 'gratis', 'free'],
  topics: ['themen', 'themes', 'temi', 'temas', 'collections'],
  about: ['ueber-uns', 'a-propos', 'chi-siamo', 'sobre-nosotros', 'about'],
  data: ['daten', 'donnees', 'dati', 'datos', 'data'],
  help: ['hilfe', 'aide', 'aiuto', 'ayuda', 'help'],
  contact: ['kontakt', 'contact', 'contatti', 'contacto', 'contact'],
  report: ['fehler-melden', 'signaler', 'segnala', 'informar', 'report'],
  legal: [
    'impressum',
    'mentions-legales',
    'note-legali',
    'aviso-legal',
    'legal',
  ],
  privacy: [
    'datenschutz',
    'confidentialite',
    'privacy',
    'privacidad',
    'privacy',
  ],
  credits: ['credits', 'credits', 'crediti', 'creditos', 'credits'],
  ops: ['betrieb', 'exploitation', 'gestione', 'operaciones', 'operations'],
} as const;
export type RouteKey = keyof typeof paths;
export function path(
  locale: Locale,
  market: string,
  key: RouteKey = 'home',
  tail = '',
) {
  const p = paths[key][locales.indexOf(locale)];
  return `/${locale}/${market}/${p ? p + '/' : ''}${tail ? tail + '/' : ''}`;
}
export function routeFor(
  locale: Locale,
  segment: string,
  hasDetailSegment = false,
): RouteKey | undefined {
  if (hasDetailSegment) {
    const detail = (['movie', 'tv'] as const).find(
      (key) => paths[key][locales.indexOf(locale)] === segment,
    );
    if (detail) return detail;
  }
  return (Object.keys(paths) as RouteKey[]).find(
    (k) => paths[k][locales.indexOf(locale)] === segment,
  );
}
export function slugify(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 150) || 'title'
  );
}
