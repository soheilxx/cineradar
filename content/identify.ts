import type { Locale } from '@/i18n/config';

interface IdentifyCopy {
  promo: string;
  promoDetail: string;
  label: string;
  placeholder: string;
  hint: string;
  examples: string;
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
  noProvider: string;
  catalog: string;
  ai: string;
  unavailable: string;
  empty: string;
  tooShort: string;
  error: string;
  limit: string;
  excluded: string;
  refine: string;
  noGuarantee: string;
  followUp: Record<'scene' | 'person' | 'setting' | 'detail', string>;
}
export const identifyCopy: Record<Locale, IdentifyCopy> = {
  de: {
    promo: 'Titel vergessen?',
    promoDetail: 'Beschreibe eine Szene. Finde den Film oder die Serie.',
    label: 'Woran erinnerst du dich?',
    placeholder:
      'Ein Mann betritt die Träume anderer Menschen. Er hat einen kleinen Kreisel, mit dem er prüft, ob er wach ist …',
    hint: 'Eine markante Szene, eine Figur oder ein ungewöhnliches Detail hilft am meisten. Bitte keine persönlichen Angaben.',
    examples: 'Zum Ausprobieren',
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
    noProvider: 'Verfügbarkeit auf der Titelseite prüfen',
    catalog:
      'Katalogabgleich: Deine Hinweise werden in den vorhandenen Inhaltsbeschreibungen gesucht. Die KI-Erkennung ist noch nicht aktiviert.',
    ai: 'KI unterstützt den Abgleich. Alle angezeigten Titel stammen aus dem Cineradar-Katalog.',
    unavailable:
      'Die KI-Erkennung ist gerade nicht verfügbar. Diese Vorschläge stammen aus dem Katalogabgleich.',
    empty: 'Noch kein überzeugender Treffer.',
    tooShort: 'Beschreibe deine Erinnerung bitte mit mindestens 15 Zeichen.',
    error:
      'Der Abgleich konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    limit:
      'Für den Moment sind zu viele Anfragen eingegangen. Bitte versuche es etwas später erneut.',
    excluded: 'Vorschläge ausgeschlossen',
    refine: 'Hinweise ergänzen & erneut suchen',
    noGuarantee:
      'Erinnerungen können ungenau sein, und der Katalog ist nicht vollständig. Prüfe Handlung und Titel, bevor du dich entscheidest.',
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
    promo: 'Forgot the title?',
    promoDetail: 'Describe a scene. Find the movie or show.',
    label: 'What do you remember?',
    placeholder:
      'A man enters other people’s dreams. He uses a small spinning top to check whether he is awake …',
    hint: 'A distinctive scene, character or unusual detail helps most. Please leave out personal information.',
    examples: 'Try an example',
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
    noProvider: 'Check availability on the title page',
    catalog:
      'Catalog matching: we search existing plot descriptions for your clues. AI identification has not been activated yet.',
    ai: 'AI helps match your clues. Every result is verified against the Cineradar catalog.',
    unavailable:
      'AI identification is temporarily unavailable. These suggestions use catalog matching.',
    empty: 'No convincing match yet.',
    tooShort: 'Please describe your memory in at least 15 characters.',
    error: 'We couldn’t complete the search. Please try again.',
    limit: 'Too many requests right now. Please try again a little later.',
    excluded: 'suggestions excluded',
    refine: 'Add clues & search again',
    noGuarantee:
      'Memories can be imprecise and the catalog is not complete. Check the plot and title before deciding.',
    followUp: {
      scene: 'Which specific scene has stayed with you?',
      person: 'Can you remember a character, actor or name?',
      setting: 'Where and roughly when does the story take place?',
      detail: 'Add an unusual detail: an object, job, location or the ending.',
    },
  },
  fr: {
    promo: 'Titre oublié ?',
    promoDetail: 'Décrivez une scène. Retrouvez le film ou la série.',
    label: 'De quoi vous souvenez-vous ?',
    placeholder:
      'Un homme entre dans les rêves des autres. Il utilise une petite toupie pour savoir s’il est éveillé…',
    hint: 'Une scène marquante, un personnage ou un détail inhabituel aide le plus. Évitez les données personnelles.',
    examples: 'Essayez un exemple',
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
    noProvider: 'Vérifier la disponibilité sur la fiche',
    catalog:
      'Recherche dans le catalogue : vos indices sont comparés aux résumés existants. L’identification par IA n’est pas encore activée.',
    ai: 'L’IA aide à comparer vos indices. Tous les résultats existent dans le catalogue Cineradar.',
    unavailable:
      'L’identification par IA est momentanément indisponible. Ces suggestions proviennent du catalogue.',
    empty: 'Pas encore de résultat convaincant.',
    tooShort: 'Décrivez votre souvenir avec au moins 15 caractères.',
    error: 'La recherche n’a pas abouti. Veuillez réessayer.',
    limit:
      'Trop de demandes pour le moment. Veuillez réessayer un peu plus tard.',
    excluded: 'suggestions exclues',
    refine: 'Ajouter des indices et relancer',
    noGuarantee:
      'Les souvenirs peuvent être imprécis et le catalogue est incomplet. Vérifiez le résumé et le titre avant de choisir.',
    followUp: {
      scene: 'Quelle scène précise vous a marqué ?',
      person: 'Vous souvenez-vous d’un personnage, d’un acteur ou d’un nom ?',
      setting: 'Où et à quelle époque se déroule l’histoire ?',
      detail:
        'Ajoutez un détail inhabituel : un objet, un métier, un lieu ou la fin.',
    },
  },
  it: {
    promo: 'Hai dimenticato il titolo?',
    promoDetail: 'Descrivi una scena. Ritrova il film o la serie.',
    label: 'Che cosa ricordi?',
    placeholder:
      'Un uomo entra nei sogni degli altri. Usa una piccola trottola per capire se è sveglio…',
    hint: 'Una scena particolare, un personaggio o un dettaglio insolito sono gli indizi migliori. Evita dati personali.',
    examples: 'Prova un esempio',
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
    noProvider: 'Verifica la disponibilità nella scheda',
    catalog:
      'Ricerca nel catalogo: cerchiamo i tuoi indizi nelle trame disponibili. Il riconoscimento con IA non è ancora attivo.',
    ai: 'L’IA aiuta a confrontare gli indizi. Tutti i titoli sono verificati nel catalogo Cineradar.',
    unavailable:
      'Il riconoscimento con IA non è disponibile al momento. Questi suggerimenti provengono dal catalogo.',
    empty: 'Ancora nessuna corrispondenza convincente.',
    tooShort: 'Descrivi il tuo ricordo con almeno 15 caratteri.',
    error: 'Non siamo riusciti a completare la ricerca. Riprova.',
    limit: 'Troppe richieste al momento. Riprova più tardi.',
    excluded: 'suggerimenti esclusi',
    refine: 'Aggiungi indizi e cerca ancora',
    noGuarantee:
      'I ricordi possono essere imprecisi e il catalogo non è completo. Controlla trama e titolo prima di scegliere.',
    followUp: {
      scene: 'Quale scena precisa ti è rimasta impressa?',
      person: 'Ricordi un personaggio, un attore o un nome?',
      setting: 'Dove e in quale epoca si svolge la storia?',
      detail:
        'Aggiungi un dettaglio insolito: un oggetto, un mestiere, un luogo o il finale.',
    },
  },
  es: {
    promo: '¿Olvidaste el título?',
    promoDetail: 'Describe una escena. Encuentra la película o serie.',
    label: '¿Qué recuerdas?',
    placeholder:
      'Un hombre entra en los sueños de otras personas. Usa una pequeña peonza para comprobar si está despierto…',
    hint: 'Una escena concreta, un personaje o un detalle inusual ayudan más. Evita datos personales.',
    examples: 'Prueba un ejemplo',
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
    noProvider: 'Consulta la disponibilidad en la ficha',
    catalog:
      'Búsqueda en el catálogo: buscamos tus pistas en las sinopsis disponibles. La identificación con IA aún no está activada.',
    ai: 'La IA ayuda a comparar tus pistas. Todos los resultados existen en el catálogo Cineradar.',
    unavailable:
      'La identificación con IA no está disponible temporalmente. Estas sugerencias proceden del catálogo.',
    empty: 'Todavía no hay una coincidencia convincente.',
    tooShort: 'Describe tu recuerdo con al menos 15 caracteres.',
    error: 'No pudimos completar la búsqueda. Inténtalo de nuevo.',
    limit: 'Hay demasiadas solicitudes. Inténtalo un poco más tarde.',
    excluded: 'sugerencias excluidas',
    refine: 'Añadir pistas y volver a buscar',
    noGuarantee:
      'Los recuerdos pueden ser imprecisos y el catálogo no está completo. Revisa la trama y el título antes de decidir.',
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
