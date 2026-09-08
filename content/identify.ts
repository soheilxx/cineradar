import type { Locale } from '@/i18n/config';

interface IdentifyCopy {
  promo: string;
  tagline: string;
  promoDetail: string;
  label: string;
  placeholder: string;
  examples: string;
  filters: string;
  all: string;
  movie: string;
  tv: string;
  type: string;
  decade: string;
  anyDecade: string;
  submit: string;
  loading: string;
  cancel: string;
  reset: string;
  results: string;
  strong: string;
  possible: string;
  why: string;
  notThis: string;
  found: string;
  confirmed: string;
  details: string;
  catalog: string;
  ai: string;
  unavailable: string;
  empty: string;
  tooShort: string;
  error: string;
  limit: string;
  excluded: string;
  refine: string;
  followUp: Record<'scene' | 'person' | 'setting' | 'detail', string>;
}
export const identifyCopy: Record<Locale, IdentifyCopy> = {
  de: {
    promo: 'KI-Titelfinder',
    tagline: 'Filme & Serien per Text oder Stimme finden.',
    promoDetail: 'Beschreibe eine Szene. Finde den Film oder die Serie.',
    label: 'Woran erinnerst du dich?',
    placeholder: 'Ein Mann betritt fremde Träume. Er dreht einen Kreisel …',
    examples: 'Zum Ausprobieren',
    filters: 'Suche eingrenzen',
    all: 'Nicht sicher',
    movie: 'Film',
    tv: 'Serie',
    type: 'Was suchst du?',
    decade: 'Ungefähres Erscheinungsjahr',
    anyDecade: 'Weiß ich nicht',
    submit: 'Titel finden',
    loading: 'Wir gleichen deine Hinweise ab …',
    cancel: 'Abbrechen',
    reset: 'Neu anfangen',
    results: 'Kommt dir das bekannt vor?',
    strong: 'Mehrere passende Hinweise',
    possible: 'Möglicher Treffer',
    why: 'Hinweise aus der Handlung',
    notThis: 'Das ist es nicht',
    found: 'Das ist es!',
    confirmed: 'Wiedergefunden.',
    details: 'Titel & Streamingangebote',
    catalog: 'Katalogsuche',
    ai: 'KI-Suche',
    unavailable:
      'KI vorübergehend nicht verfügbar. Ergebnisse aus der Katalogsuche.',
    empty: 'Noch kein überzeugender Treffer.',
    tooShort: 'Beschreibe deine Erinnerung bitte mit mindestens 15 Zeichen.',
    error:
      'Der Abgleich konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    limit:
      'Für den Moment sind zu viele Anfragen eingegangen. Bitte versuche es etwas später erneut.',
    excluded: 'Vorschläge ausgeschlossen',
    refine: 'Hinweise ergänzen & erneut suchen',
    followUp: {
      scene: 'Welche konkrete Szene ist dir im Kopf geblieben?',
      person:
        'Weißt du etwas über eine Figur, einen Schauspieler oder einen Namen?',
      setting: 'Wo und ungefähr wann spielt die Geschichte?',
      detail:
        'Ergänze ein ungewöhnliches Detail: einen Gegenstand, einen Beruf, einen Ort oder das Ende.',
    },
  },
  en: {
    promo: 'AI title finder',
    tagline: 'Find movies & shows by text or voice.',
    promoDetail: 'Describe a scene. Find the movie or show.',
    label: 'What do you remember?',
    placeholder: 'A man enters other people’s dreams. He spins a small top …',
    examples: 'Try an example',
    filters: 'Narrow your search',
    all: 'Not sure',
    movie: 'Movie',
    tv: 'TV show',
    type: 'What are you looking for?',
    decade: 'Approximate release period',
    anyDecade: 'I don’t know',
    submit: 'Find the title',
    loading: 'Matching your clues …',
    cancel: 'Cancel',
    reset: 'Start again',
    results: 'Does this look familiar?',
    strong: 'Several clues match',
    possible: 'Possible match',
    why: 'Clues from the plot',
    notThis: 'Not this one',
    found: 'That’s it!',
    confirmed: 'Found it.',
    details: 'Title & streaming options',
    catalog: 'Catalog search',
    ai: 'AI search',
    unavailable: 'AI temporarily unavailable. Showing catalog results.',
    empty: 'No convincing match yet.',
    tooShort: 'Please describe your memory in at least 15 characters.',
    error: 'We couldn’t complete the search. Please try again.',
    limit: 'Too many requests right now. Please try again a little later.',
    excluded: 'suggestions excluded',
    refine: 'Add clues & search again',
    followUp: {
      scene: 'Which specific scene has stayed with you?',
      person: 'Can you remember a character, actor or name?',
      setting: 'Where and roughly when does the story take place?',
      detail: 'Add an unusual detail: an object, job, location or the ending.',
    },
  },
  fr: {
    promo: 'Recherche IA',
    tagline: 'Films et séries : décrivez ou dictez.',
    promoDetail: 'Décrivez une scène. Retrouvez le film ou la série.',
    label: 'De quoi vous souvenez-vous ?',
    placeholder:
      'Un homme entre dans les rêves des autres et fait tourner une toupie…',
    examples: 'Essayez un exemple',
    filters: 'Affiner la recherche',
    all: 'Pas sûr',
    movie: 'Film',
    tv: 'Série',
    type: 'Que cherchez-vous ?',
    decade: 'Période de sortie approximative',
    anyDecade: 'Je ne sais pas',
    submit: 'Retrouver le titre',
    loading: 'Nous comparons vos indices…',
    cancel: 'Annuler',
    reset: 'Recommencer',
    results: 'Cela vous rappelle quelque chose ?',
    strong: 'Plusieurs indices concordent',
    possible: 'Correspondance possible',
    why: 'Indices dans le résumé',
    notThis: 'Ce n’est pas ça',
    found: 'C’est ça !',
    confirmed: 'Retrouvé.',
    details: 'Titre et offres de streaming',
    catalog: 'Recherche dans le catalogue',
    ai: 'Recherche avec IA',
    unavailable: 'IA momentanément indisponible. Résultats du catalogue.',
    empty: 'Pas encore de résultat convaincant.',
    tooShort: 'Décrivez votre souvenir avec au moins 15 caractères.',
    error: 'La recherche n’a pas abouti. Veuillez réessayer.',
    limit:
      'Trop de demandes pour le moment. Veuillez réessayer un peu plus tard.',
    excluded: 'suggestions exclues',
    refine: 'Ajouter des indices et relancer',
    followUp: {
      scene: 'Quelle scène précise vous a marqué ?',
      person: 'Vous souvenez-vous d’un personnage, d’un acteur ou d’un nom ?',
      setting: 'Où et à quelle époque se déroule l’histoire ?',
      detail:
        'Ajoutez un détail inhabituel : un objet, un métier, un lieu ou la fin.',
    },
  },
  it: {
    promo: 'Trova titoli con l’IA',
    tagline: 'Trova film e serie con il testo o la voce.',
    promoDetail: 'Descrivi una scena. Ritrova il film o la serie.',
    label: 'Che cosa ricordi?',
    placeholder:
      'Un uomo entra nei sogni degli altri e fa girare una trottola…',
    examples: 'Prova un esempio',
    filters: 'Affina la ricerca',
    all: 'Non sono sicuro',
    movie: 'Film',
    tv: 'Serie',
    type: 'Che cosa cerchi?',
    decade: 'Periodo di uscita indicativo',
    anyDecade: 'Non lo so',
    submit: 'Trova il titolo',
    loading: 'Stiamo confrontando i tuoi indizi…',
    cancel: 'Annulla',
    reset: 'Ricomincia',
    results: 'Ti sembra familiare?',
    strong: 'Più indizi corrispondono',
    possible: 'Possibile corrispondenza',
    why: 'Indizi nella trama',
    notThis: 'Non è questo',
    found: 'È proprio questo!',
    confirmed: 'Ritrovato.',
    details: 'Titolo e offerte streaming',
    catalog: 'Ricerca nel catalogo',
    ai: 'Ricerca con IA',
    unavailable: 'IA momentaneamente non disponibile. Risultati dal catalogo.',
    empty: 'Ancora nessuna corrispondenza convincente.',
    tooShort: 'Descrivi il tuo ricordo con almeno 15 caratteri.',
    error: 'Non siamo riusciti a completare la ricerca. Riprova.',
    limit: 'Troppe richieste al momento. Riprova più tardi.',
    excluded: 'suggerimenti esclusi',
    refine: 'Aggiungi indizi e cerca ancora',
    followUp: {
      scene: 'Quale scena precisa ti è rimasta impressa?',
      person: 'Ricordi un personaggio, un attore o un nome?',
      setting: 'Dove e in quale epoca si svolge la storia?',
      detail:
        'Aggiungi un dettaglio insolito: un oggetto, un mestiere, un luogo o il finale.',
    },
  },
  es: {
    promo: 'Buscador IA',
    tagline: 'Encuentra películas y series con texto o voz.',
    promoDetail: 'Describe una escena. Encuentra la película o serie.',
    label: '¿Qué recuerdas?',
    placeholder: 'Un hombre entra en sueños ajenos y hace girar una peonza…',
    examples: 'Prueba un ejemplo',
    filters: 'Afinar la búsqueda',
    all: 'No estoy seguro',
    movie: 'Película',
    tv: 'Serie',
    type: '¿Qué buscas?',
    decade: 'Época de estreno aproximada',
    anyDecade: 'No lo sé',
    submit: 'Encontrar el título',
    loading: 'Estamos comparando tus pistas…',
    cancel: 'Cancelar',
    reset: 'Empezar de nuevo',
    results: '¿Te resulta familiar?',
    strong: 'Coinciden varias pistas',
    possible: 'Posible coincidencia',
    why: 'Pistas de la trama',
    notThis: 'No es este',
    found: '¡Es este!',
    confirmed: 'Encontrado.',
    details: 'Título y opciones de streaming',
    catalog: 'Búsqueda en el catálogo',
    ai: 'Búsqueda con IA',
    unavailable: 'IA no disponible temporalmente. Resultados del catálogo.',
    empty: 'Todavía no hay una coincidencia convincente.',
    tooShort: 'Describe tu recuerdo con al menos 15 caracteres.',
    error: 'No pudimos completar la búsqueda. Inténtalo de nuevo.',
    limit: 'Hay demasiadas solicitudes. Inténtalo un poco más tarde.',
    excluded: 'sugerencias excluidas',
    refine: 'Añadir pistas y volver a buscar',
    followUp: {
      scene: '¿Qué escena concreta se te quedó grabada?',
      person: '¿Recuerdas algún personaje, actor o nombre?',
      setting: '¿Dónde y en qué época transcurre la historia?',
      detail:
        'Añade un detalle inusual: un objeto, una profesión, un lugar o el final.',
    },
  },
};

export const identifyExampleLabels: Record<
  Locale,
  readonly [string, string, string]
> = {
  de: [
    'In fremde Träume eintauchen',
    'Zeitreisen in einer Kleinstadt',
    'Der Teufel in Los Angeles',
  ],
  en: [
    'Entering other people’s dreams',
    'Time travel in a small town',
    'The devil in Los Angeles',
  ],
  fr: [
    'Entrer dans les rêves des autres',
    'Voyager dans le temps',
    'Le diable à Los Angeles',
  ],
  it: [
    'Entrare nei sogni degli altri',
    'Viaggi nel tempo',
    'Il diavolo a Los Angeles',
  ],
  es: [
    'Entrar en sueños ajenos',
    'Viajes en el tiempo',
    'El diablo en Los Ángeles',
  ],
};
export const identifyClearExclusions: Record<Locale, string> = {
  de: 'Ausschlüsse zurücksetzen',
  en: 'Clear excluded titles',
  fr: 'Réinitialiser les exclusions',
  it: 'Annulla le esclusioni',
  es: 'Restablecer exclusiones',
};
