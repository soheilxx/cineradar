import { countryName, type Locale } from '../i18n/config';
import type { RouteKey } from '../i18n/routes';
import { t } from '../i18n/messages';

const l = (
  de: string,
  fr: string,
  it: string,
  es: string,
  en: string,
): Record<Locale, string> => ({ de, fr, it, es, en });
const homeTitle = l(
  'Filme und Serien finden – Streamingguide für {country}',
  'Films et séries : votre guide streaming en {country}',
  'Trova film e serie: guida streaming in {country}',
  'Encuentra películas y series: guía de streaming en {country}',
  'Find movies and series – streaming guide for {country}',
);
const descriptions = {
  home: l(
    'Finde Filme und Serien, vergleiche Streamingangebote in {country} und entdecke neue Titel. Der KI-Titelfinder hilft dir, vergessene Titel wiederzufinden.',
    'Trouvez des films et séries, comparez les offres de streaming en {country} et découvrez de nouveaux titres. Retrouvez aussi un titre oublié grâce à une description.',
    'Trova film e serie, confronta le offerte streaming in {country} e scopri nuovi titoli. Ritrova anche un titolo dimenticato descrivendo una scena.',
    'Encuentra películas y series, compara ofertas de streaming en {country} y descubre nuevos títulos. Recupera un título olvidado describiendo una escena.',
    'Find movies and series, compare streaming options in {country} and discover new titles. Describe a remembered scene to help find a forgotten title.',
  ),
  movies: l(
    'Entdecke Filme und ihre Streamingangebote in {country}. Vergleiche Abos, Leih- und Kaufoptionen und finde den passenden Film für deinen nächsten Filmabend.',
    'Découvrez des films et leurs offres de streaming en {country}. Comparez abonnements, locations et achats pour préparer votre prochaine soirée cinéma.',
    'Scopri film e offerte streaming in {country}. Confronta abbonamenti, noleggi e acquisti e trova il film per la tua prossima serata cinema.',
    'Descubre películas y ofertas de streaming en {country}. Compara suscripciones, alquileres y compras para tu próxima noche de cine.',
    'Explore movies and their streaming options in {country}. Compare subscription, rental and purchase offers to choose your next movie night.',
  ),
  series: l(
    'Entdecke Serien und ihre Streaminganbieter in {country}. Vergleiche verfügbare Angebote und informiere dich auf den Titelseiten über Staffeln und Optionen.',
    'Découvrez des séries et leurs plateformes en {country}. Comparez les offres disponibles et consultez les fiches pour les saisons et les options.',
    'Scopri serie e piattaforme streaming in {country}. Confronta le offerte disponibili e consulta le schede per informazioni su stagioni e opzioni.',
    'Descubre series y plataformas en {country}. Compara las ofertas disponibles y consulta las fichas para ver temporadas y opciones.',
    'Discover TV series and their streaming providers in {country}. Compare available offers and check title pages for season details and viewing options.',
  ),
  providers: l(
    'Vergleiche Streaminganbieter in {country} und entdecke ihre Filme und Serien. Öffne einen Anbieter, um passende Titel und verfügbare Angebote zu sehen.',
    'Comparez les plateformes de streaming en {country} et découvrez leurs films et séries. Choisissez une plateforme pour consulter ses titres et ses offres.',
    'Confronta piattaforme streaming in {country} e scopri film e serie. Scegli una piattaforma per consultare i titoli e le offerte disponibili.',
    'Compara plataformas de streaming en {country} y descubre sus películas y series. Elige una plataforma para consultar títulos y ofertas disponibles.',
    'Compare streaming providers in {country} and explore their movies and series. Open a provider to see matching titles and available offers.',
  ),
  search: l(
    'Suche Filme und Serien im Cineradar-Katalog und prüfe Streamingangebote in {country}. Grenze Ergebnisse nach Anbieter, Genre und weiteren Filtern ein.',
    'Recherchez films et séries dans le catalogue Cineradar et consultez les offres en {country}. Filtrez par plateforme, genre et autres critères.',
    'Cerca film e serie nel catalogo Cineradar e consulta le offerte in {country}. Filtra per piattaforma, genere e altri criteri.',
    'Busca películas y series en Cineradar y consulta las ofertas en {country}. Filtra por plataforma, género y otros criterios.',
    'Search the Cineradar catalogue for movies and series and check streaming offers in {country}. Filter results by provider, genre and other preferences.',
  ),
  watchlist: l(
    'Deine gemerkten Filme und Serien an einem Ort. Öffne Titel aus deiner Merkliste und prüfe ihre Streamingangebote in {country}.',
    'Vos films et séries enregistrés au même endroit. Ouvrez un titre de votre liste et consultez ses offres de streaming en {country}.',
    'I tuoi film e serie salvati in un unico posto. Apri un titolo della lista e consulta le offerte streaming in {country}.',
    'Tus películas y series guardadas en un solo lugar. Abre un título de tu lista y consulta sus ofertas de streaming en {country}.',
    'Keep saved movies and series in one place. Open a title from your watchlist and check its streaming options in {country}.',
  ),
  myProviders: l(
    'Wähle deine Streaminganbieter für {country}. Cineradar speichert deine Auswahl auf diesem Gerät und hilft dir, passende Angebote zu finden.',
    'Choisissez vos plateformes pour {country}. Cineradar conserve votre sélection sur cet appareil pour vous aider à trouver des offres adaptées.',
    'Scegli le tue piattaforme per {country}. Cineradar salva la selezione su questo dispositivo per aiutarti a trovare offerte adatte.',
    'Elige tus plataformas para {country}. Cineradar guarda tu selección en este dispositivo para ayudarte a encontrar ofertas adecuadas.',
    'Choose your streaming providers for {country}. Cineradar saves your selection on this device to help you find relevant viewing options.',
  ),
  finder: l(
    'Was schaust du heute Abend? Entdecke verfügbare Filme und Serien in {country} und grenze die Auswahl nach deinen Streaminganbietern und Vorlieben ein.',
    'Que regarder ce soir ? Découvrez les films et séries disponibles en {country} et affinez la sélection selon vos plateformes et vos envies.',
    'Cosa guardare stasera? Scopri film e serie disponibili in {country} e restringi la scelta in base alle tue piattaforme e preferenze.',
    '¿Qué ver esta noche? Descubre películas y series disponibles en {country} y filtra según tus plataformas y preferencias.',
    'What will you watch tonight? Explore movies and series available in {country} and narrow the selection by your providers and preferences.',
  ),
  new: l(
    'Entdecke neu verfügbare Streamingangebote in {country}. Diese Übersicht zeigt Filme und Serien mit gemeldetem Angebotsbeginn in den letzten sieben Tagen.',
    'Découvrez les nouvelles offres en {country} : films et séries dont la disponibilité annoncée a commencé au cours des sept derniers jours.',
    'Scopri nuove offerte streaming in {country}: film e serie con disponibilità segnalata iniziata negli ultimi sette giorni.',
    'Descubre nuevas ofertas en {country}: películas y series cuya disponibilidad indicada comenzó en los últimos siete días.',
    'Discover new streaming offers in {country}: movies and series with a reported availability start within the last seven days.',
  ),
  leaving: l(
    'Diese Streamingangebote in {country} laufen laut gemeldetem Enddatum in den nächsten 30 Tagen aus. Prüfe Filme, Serien und Details beim Anbieter.',
    'Ces offres en {country} expirent dans les 30 prochains jours selon leur date de fin annoncée. Consultez les titres et vérifiez les détails sur la plateforme.',
    'Queste offerte in {country} scadono nei prossimi 30 giorni secondo la data segnalata. Consulta i titoli e verifica i dettagli sulla piattaforma.',
    'Estas ofertas en {country} caducan en los próximos 30 días según la fecha indicada. Consulta los títulos y comprueba los detalles en la plataforma.',
    'These streaming offers in {country} have a reported end date within the next 30 days. Explore the titles and confirm details with the provider.',
  ),
  free: l(
    'Entdecke Filme und Serien mit als kostenlos gemeldeten Streamingangeboten in {country}. Prüfe Werbung, Anmeldung und weitere Bedingungen beim Anbieter.',
    'Découvrez des films et séries proposés gratuitement en {country}. Vérifiez la publicité, les conditions et la nécessité d’un compte sur la plateforme.',
    'Scopri film e serie con offerte indicate come gratuite in {country}. Verifica pubblicità, registrazione e condizioni sulla piattaforma.',
    'Descubre películas y series con ofertas indicadas como gratuitas en {country}. Comprueba publicidad, registro y condiciones en la plataforma.',
    'Explore movies and series with offers listed as free in {country}. Check advertising, registration and other conditions with the provider.',
  ),
  topics: l(
    'Entdecke Filme und Serien nach Genre und prüfe Streamingangebote in {country}. Finde passende Titel für deine Interessen und deinen nächsten Filmabend.',
    'Explorez films et séries par genre et consultez les offres en {country}. Trouvez des titres adaptés à vos envies pour votre prochaine soirée cinéma.',
    'Esplora film e serie per genere e consulta le offerte in {country}. Trova titoli adatti ai tuoi interessi per la prossima serata cinema.',
    'Explora películas y series por género y consulta las ofertas en {country}. Encuentra títulos para tus intereses y tu próxima noche de cine.',
    'Explore movies and series by genre and check streaming offers in {country}. Find titles that match your interests for your next movie night.',
  ),
  ops: l(
    'Geschützter Betriebsbereich von Cineradar für Datenprüfungen, Synchronisierung und eingegangene Meldungen.',
    'Espace protégé Cineradar pour le contrôle des données, la synchronisation et les signalements reçus.',
    'Area protetta Cineradar per controlli dei dati, sincronizzazione e segnalazioni ricevute.',
    'Área protegida de Cineradar para revisar datos, sincronización y avisos recibidos.',
    'Protected Cineradar operations area for data checks, synchronisation and received reports.',
  ),
};
const collectionTitle = l(
  '{label}: Filme und Serien',
  '{label} : films et séries',
  '{label}: film e serie',
  '{label}: películas y series',
  '{label}: movies and series',
);
const collectionDescription = l(
  'Entdecke {label} und passende Filme und Serien in {country}. Prüfe Streaminganbieter und verfügbare Abo-, Leih- und Kaufangebote bei Cineradar.',
  'Explorez {label} et les films et séries correspondants en {country}. Consultez les plateformes et les offres d’abonnement, de location et d’achat.',
  'Esplora {label} e i film e serie corrispondenti in {country}. Consulta piattaforme e offerte in abbonamento, a noleggio e in acquisto.',
  'Explora {label} y las películas y series correspondientes en {country}. Consulta plataformas y ofertas de suscripción, alquiler y compra.',
  'Explore {label} and matching movies and series in {country}. Check streaming providers and available subscription, rental and purchase offers on Cineradar.',
);
const pageLabels = l(
  'Seite {page}',
  'Page {page}',
  'Pagina {page}',
  'Página {page}',
  'Page {page}',
);
export function pageLabel(locale: Locale, page: number) {
  return pageLabels[locale].replace('{page}', String(page));
}
export function pageCopy(
  locale: Locale,
  country: string,
  key: RouteKey,
  label?: string,
) {
  const us = country === countryName(locale, 'us');
  const location = {
    de: us ? 'in den Vereinigten Staaten' : `in ${country}`,
    fr: `${us ? 'aux' : 'en'} ${country}`,
    it: `${us ? 'negli' : 'in'} ${country}`,
    es: `en ${country}`,
    en: `in ${us ? 'the ' : ''}${country}`,
  }[locale];
  const frenchArticle = ['de', 'it', 'es'].some(
    (market) => country === countryName(locale, market),
  )
    ? 'l’'
    : 'la ';
  const italianArticle = country === countryName(locale, 'it') ? 'l’' : 'la ';
  const purpose = {
    de: us ? 'für die Vereinigten Staaten' : `für ${country}`,
    fr: `pour ${us ? 'les ' : frenchArticle}${country}`,
    it: `per ${us ? 'gli ' : italianArticle}${country}`,
    es: `para ${country}`,
    en: `for ${us ? 'the ' : ''}${country}`,
  }[locale];
  const replace = (text: string) =>
    text
      .replaceAll(/(?:in|en) \{country\}/g, location)
      .replaceAll(/(?:für|pour|per|para|for) \{country\}/g, purpose)
      .replaceAll('{country}', country)
      .replaceAll('{label}', label || '');
  const collection = label && (key === 'providers' || key === 'topics');
  return {
    title: replace(
      key === 'home'
        ? homeTitle[locale]
        : collection
          ? collectionTitle[locale]
          : t(locale, key),
    ),
    description: collection
      ? replace(collectionDescription[locale])
      : key in descriptions
        ? replace(descriptions[key as keyof typeof descriptions][locale])
        : undefined,
  };
}

export function conciseDescription(value: string, max = 200) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const boundary = text.lastIndexOf(' ', max - 1);
  return (
    text
      .slice(0, boundary > max / 2 ? boundary : max - 1)
      .replace(/[\s,;:·]+$/, '') + '…'
  );
}
