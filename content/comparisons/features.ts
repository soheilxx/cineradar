import { l, type Localized } from './copy';
const implementedFeatures = {
  offers: {
    label: l(
      'Angebotsarten',
      'Types d’offres',
      'Tipi di offerta',
      'Tipos de oferta',
      'Offer types',
    ),
    value: l(
      'Abo, Zusatzkanal, Leihe, Kauf und kostenlose Angebote werden getrennt ausgewiesen, soweit gemeldet.',
      'Abonnement, chaîne supplémentaire, location, achat et gratuité sont distingués selon les données reçues.',
      'Abbonamento, canale aggiuntivo, noleggio, acquisto e offerte gratuite sono distinti quando segnalati.',
      'Distingue suscripción, canal adicional, alquiler, compra y ofertas gratuitas según los datos recibidos.',
      'Subscription, add-on, rental, purchase and free offers are distinguished where reported.',
    ),
    implementation: 'ui/offer-list.tsx; domain/offers.ts',
  },
  watchlist: {
    label: l(
      'Merkliste',
      'Liste à voir',
      'Lista da vedere',
      'Lista de seguimiento',
      'Watchlist',
    ),
    value: l(
      'Lokale Merkliste in diesem Browser. Keine gemeinsamen Kontolisten und keine Synchronisierung zwischen Geräten.',
      'Liste locale dans ce navigateur. Pas de liste de compte partagée ni de synchronisation entre appareils.',
      'Lista locale in questo browser. Nessuna lista condivisa tramite account o sincronizzazione tra dispositivi.',
      'Lista local en este navegador. Sin listas de cuenta compartidas ni sincronización entre dispositivos.',
      'Local watchlist in this browser. No shared account lists or cross-device synchronization.',
    ),
    implementation: 'ui/preferences.ts; ui/watchlist.tsx',
  },
  tracking: {
    label: l(
      'Fortschritt & Benachrichtigungen',
      'Progression et alertes',
      'Progressi e notifiche',
      'Progreso y avisos',
      'Progress & alerts',
    ),
    value: l(
      'Änderungen beim Öffnen der Merkliste. Kein automatisches Episoden-Tracking, keine E-Mail- oder Push-Benachrichtigungen.',
      'Changements visibles à l’ouverture de la liste. Pas de suivi automatique des épisodes ni d’alertes e-mail ou push.',
      'Novità visibili aprendo la lista. Nessun tracciamento automatico degli episodi né notifiche e-mail o push.',
      'Cambios visibles al abrir la lista. Sin seguimiento automático de episodios ni avisos por correo o push.',
      'Changes appear when opening the watchlist. No automatic episode tracking, email alerts or push notifications.',
    ),
    implementation: 'ui/watchlist.tsx; app/api/watchlist/route.ts',
  },
  discover: {
    label: l(
      'Entdecken',
      'Découverte',
      'Scoperta',
      'Descubrimiento',
      'Discovery',
    ),
    value: l(
      'Neuheiten, Genres und Filter nach Anbietern helfen bei der Auswahl. Keine persönlichen Community-Empfehlungen.',
      'Nouveautés, genres et filtres par plateforme. Pas de recommandations personnelles issues d’une communauté.',
      'Novità, generi e filtri per piattaforma. Nessun consiglio personale da una community.',
      'Novedades, géneros y filtros por plataforma. Sin recomendaciones personales de una comunidad.',
      'New releases, genres and provider filters help you choose. No personalized community recommendations.',
    ),
    implementation: 'ui/pages.tsx; ui/filters.tsx',
  },
  countries: {
    label: l(
      'Länder & Sprache',
      'Pays et langue',
      'Paesi e lingua',
      'Países e idioma',
      'Countries & language',
    ),
    value: l(
      'Deutschland, Frankreich, Italien, Spanien und USA. Oberfläche in Deutsch, Französisch, Italienisch, Spanisch und Englisch. Englisch startet mit USA; das Land lässt sich ändern.',
      'Allemagne, France, Italie, Espagne et États-Unis. Interface en allemand, français, italien, espagnol et anglais. L’anglais démarre aux États-Unis ; le pays reste modifiable.',
      'Germania, Francia, Italia, Spagna e Stati Uniti. Interfaccia in tedesco, francese, italiano, spagnolo e inglese. L’inglese parte dagli USA; il paese resta modificabile.',
      'Alemania, Francia, Italia, España y Estados Unidos. Interfaz en alemán, francés, italiano, español e inglés. El inglés empieza con EE. UU.; puedes cambiar el país.',
      'Germany, France, Italy, Spain and the US. Interface in German, French, Italian, Spanish and English. English defaults to the US; the country can be changed.',
    ),
    implementation: 'i18n/config.ts; lib/visitor-context.ts; ui/header.tsx',
  },
  cost: {
    label: l(
      'Kosten & Zugang',
      'Coût et accès',
      'Costi e accesso',
      'Coste y acceso',
      'Cost & access',
    ),
    value: l(
      'Kostenlose Websuche ohne Benutzerkonto. Die Preise und Abonnements der Streamingdienste sind davon unabhängig.',
      'Recherche web gratuite sans compte. Les tarifs et abonnements des plateformes sont indépendants.',
      'Ricerca web gratuita senza account. Prezzi e abbonamenti delle piattaforme sono separati.',
      'Búsqueda web gratuita sin cuenta. Precios y suscripciones de las plataformas son independientes.',
      'Free web search without an account. Provider charges and subscriptions are separate.',
    ),
    implementation: 'ui/search.tsx; ui/offer-list.tsx',
  },
  media: {
    label: l(
      'Eigene Medien',
      'Médias personnels',
      'Media personali',
      'Archivos propios',
      'Personal media',
    ),
    value: l(
      'Cineradar verwaltet keine privaten Medienbibliotheken und betreibt keinen Medienserver.',
      'Cineradar ne gère pas de bibliothèque personnelle ni de serveur multimédia.',
      'Cineradar non gestisce librerie personali né server multimediali.',
      'Cineradar no gestiona bibliotecas personales ni servidores multimedia.',
      'Cineradar does not manage personal media libraries or run a media server.',
    ),
    implementation: 'app routes; domain/types.ts',
  },
  data: {
    label: l(
      'Streamingdaten',
      'Données de streaming',
      'Dati streaming',
      'Datos de streaming',
      'Streaming data',
    ),
    value: l(
      'Streaming Availability API von Movie of the Night; Filminformationen und Bilder von TMDB. Gleiche Quellen bedeuten keine identischen Katalogstände.',
      'Streaming Availability API de Movie of the Night ; informations et images de TMDB. Une source commune ne garantit pas des catalogues identiques.',
      'Streaming Availability API di Movie of the Night; informazioni e immagini da TMDB. Fonti comuni non garantiscono cataloghi identici.',
      'Streaming Availability API de Movie of the Night; información e imágenes de TMDB. Compartir fuentes no garantiza catálogos idénticos.',
      'Streaming Availability API by Movie of the Night; title information and imagery from TMDB. Shared sources do not guarantee identical catalog snapshots.',
    ),
    implementation: 'data/providers/saa.ts; data/providers/tmdb.ts',
  },
};
export type FeatureKey = keyof typeof implementedFeatures;
const webScope = l(
  'Websuche · Deutschland, Frankreich, Italien, Spanien, USA · kostenlos',
  'Recherche web · Allemagne, France, Italie, Espagne, États-Unis · gratuite',
  'Ricerca web · Germania, Francia, Italia, Spagna, USA · gratuita',
  'Búsqueda web · Alemania, Francia, Italia, España, EE. UU. · gratuita',
  'Web search · Germany, France, Italy, Spain, US · free',
);
export const features = Object.fromEntries(
  Object.entries(implementedFeatures).map(([key, feature]) => [
    key,
    {
      ...feature,
      status: 'belegt' as const,
      scope: webScope,
      checkedAt: '2026-09-07',
    },
  ]),
) as {
  [K in FeatureKey]: (typeof implementedFeatures)[K] & {
    status: 'belegt';
    scope: Localized;
    checkedAt: string;
  };
};
