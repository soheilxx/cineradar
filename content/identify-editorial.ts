import { locales, type Locale } from '../i18n/config';
import { l } from './comparisons/copy';

export const IDENTIFY_EDITORIAL_UPDATED = '2026-09-08';
const copy = {
  nav: l(
    'KI-Titelfinder',
    'Recherche IA',
    'Trova titoli con l’IA',
    'Buscador IA',
    'AI title finder',
  ),
  eyebrow: l(
    'Deine Erinnerung. Die nächste Spur.',
    'Un souvenir. Une nouvelle piste.',
    'Un ricordo. Una nuova pista.',
    'Un recuerdo. Una nueva pista.',
    'Your memory. Your next clue.',
  ),
  headline: l(
    'Film oder Serie anhand der Handlung finden',
    'Retrouver un film ou une série grâce à son histoire',
    'Trova un film o una serie dalla trama',
    'Encuentra una película o serie por su trama',
    'Find a movie or TV series from its plot',
  ),
  introduction: l(
    'Du erinnerst dich an eine Szene, aber nicht an den Titel? Beschreibe Handlung, Figuren oder einen besonderen Ort. Cineradar sucht passende Filme und Serien im Katalog. Anschließend kannst du die Streamingangebote für dein Land prüfen.',
    'Vous vous souvenez d’une scène, mais pas du titre ? Décrivez l’histoire, les personnages ou un lieu marquant. Cineradar recherche des films et séries correspondants dans son catalogue. Vous pourrez ensuite consulter les offres de streaming de votre pays.',
    'Ricordi una scena, ma non il titolo? Descrivi la trama, i personaggi o un luogo particolare. Cineradar cerca film e serie compatibili nel catalogo. Poi puoi verificare le offerte streaming nel tuo paese.',
    '¿Recuerdas una escena, pero no el título? Describe la trama, los personajes o un lugar especial. Cineradar busca películas y series compatibles en su catálogo. Después puedes consultar las ofertas de streaming de tu país.',
    'Remember a scene but not the title? Describe the plot, characters or a distinctive location. Cineradar searches its catalogue for matching movies and series. You can then check streaming offers in your country.',
  ),
  seoTitle: l(
    'KI-Titelfinder: Filme & Serien wiederfinden | Cineradar',
    'Recherche IA de films et séries | Cineradar',
    'Trova titoli con l’IA: film e serie | Cineradar',
    'Buscador de títulos con IA: películas y series | Cineradar',
    'AI Title Finder: Find Movies & TV Series | Cineradar',
  ),
  metaDescription: l(
    'KI-Titelfinder: Beschreibe oder diktiere eine Szene. Finde passende Filme und Serien und prüfe die Streamingangebote in deinem Land.',
    'Retrouvez un film ou une série avec l’IA. Décrivez ou dictez une scène, comparez les titres proposés et consultez les offres de streaming.',
    'Trova titoli di film e serie con l’IA. Descrivi o detta una scena, confronta i suggerimenti e controlla dove guardarli in streaming.',
    'Buscador de títulos con IA para películas y series. Describe o dicta una escena, compara resultados y consulta dónde verlos en streaming.',
    'AI title finder for movies and series. Describe or dictate a scene, compare possible matches and check where to stream them.',
  ),
  stepsHeading: l(
    'So wird aus einer Erinnerung ein Titel',
    'Du souvenir au titre',
    'Dal ricordo al titolo',
    'Del recuerdo al título',
    'From a memory to a title',
  ),
  faqHeading: l(
    'Hilfe bei der Suche nach einem vergessenen Titel',
    'Retrouver un titre oublié : vos questions',
    'Come ritrovare un titolo dimenticato',
    'Ayuda para encontrar un título olvidado',
    'Help finding a forgotten title',
  ),
  privacyHeading: l(
    'Deine Eingabe und Spracheingabe',
    'Votre description et la saisie vocale',
    'La descrizione e l’input vocale',
    'Tu descripción y la entrada de voz',
    'Your description and voice input',
  ),
  privacyNotice: l(
    'Beschreibe den Film oder die Serie ohne Namen, Kontaktdaten oder andere private Angaben über dich oder Dritte. Deine Beschreibung wird erst beim Absenden zur Suche übertragen. Cineradar legt dafür kein persönliches Sucharchiv an; Eingaben und Transkripte werden nicht an Google Analytics gesendet.',
    'Décrivez le film ou la série sans noms, coordonnées ni autres informations privées sur vous ou autrui. La description est transmise à la recherche uniquement à l’envoi. Cineradar ne crée pas d’historique personnel de ces recherches et n’envoie ni descriptions ni transcriptions à Google Analytics.',
    'Descrivi il film o la serie senza nomi, contatti o altre informazioni private su di te o altre persone. La descrizione viene trasmessa alla ricerca solo quando la invii. Cineradar non crea un archivio personale di queste ricerche e non invia descrizioni o trascrizioni a Google Analytics.',
    'Describe la película o serie sin nombres, datos de contacto ni información privada tuya o de otras personas. La descripción se transmite a la búsqueda solo al enviarla. Cineradar no crea un historial personal de estas búsquedas ni envía descripciones o transcripciones a Google Analytics.',
    'Describe the movie or series without names, contact details or other private information about yourself or others. Your description is sent for searching only when you submit it. Cineradar does not create a personal archive of these searches or send descriptions or transcripts to Google Analytics.',
  ),
  browserVoiceNotice: l(
    'Diktat startet nur mit deiner Aktion. Die Spracherkennung deines Browsers kann Audio an einen externen Browserdienst übertragen; dessen Verarbeitung hängt vom Browser ab. Der erkannte Text bleibt vor der Suche bearbeitbar. Tippen ist immer möglich.',
    'La dictée démarre uniquement à votre demande. La reconnaissance vocale du navigateur peut transmettre l’audio à un service externe ; son traitement dépend du navigateur. Vous pouvez modifier le texte reconnu avant la recherche. La saisie au clavier reste disponible.',
    'La dettatura parte solo quando la avvii. Il riconoscimento vocale del browser può trasmettere l’audio a un servizio esterno; il trattamento dipende dal browser. Puoi modificare il testo riconosciuto prima della ricerca. Puoi sempre scrivere.',
    'El dictado solo empieza cuando lo activas. El reconocimiento de voz del navegador puede transmitir audio a un servicio externo; el tratamiento depende del navegador. Puedes editar el texto antes de buscar. Siempre puedes escribir.',
    'Dictation starts only when you choose to start it. Your browser’s speech recognition may send audio to an external browser service; processing depends on the browser. You can edit the recognised text before searching. Typing is always available.',
  ),
  aiNotice: l(
    'Wenn die KI-Unterstützung eingerichtet ist, wird deine Beschreibung mit einem begrenzten Katalogausschnitt an OpenAI gesendet. Die optionale OpenAI-Transkription überträgt eine bewusst gestartete Aufnahme. Cineradar speichert Audio nicht dauerhaft. Für OpenAI können eigene Aufbewahrungsregeln gelten; die deaktivierte Antwortspeicherung ist keine Zusage vollständiger Nullspeicherung.',
    'Lorsque l’assistance IA est configurée, votre description et un extrait limité du catalogue sont transmis à OpenAI. La transcription OpenAI optionnelle transmet un enregistrement que vous avez explicitement démarré. Cineradar ne conserve pas durablement l’audio. Les règles de conservation d’OpenAI peuvent s’appliquer ; la désactivation du stockage des réponses ne garantit pas une absence totale de conservation.',
    'Quando l’assistenza IA è configurata, la descrizione e una parte limitata del catalogo vengono inviati a OpenAI. La trascrizione OpenAI facoltativa trasmette una registrazione avviata esplicitamente. Cineradar non conserva l’audio in modo permanente. Possono applicarsi le regole di conservazione di OpenAI; disattivare il salvataggio delle risposte non garantisce l’assenza di qualsiasi conservazione.',
    'Cuando la asistencia de IA está configurada, la descripción y un fragmento limitado del catálogo se envían a OpenAI. La transcripción opcional de OpenAI transmite una grabación iniciada expresamente por ti. Cineradar no conserva el audio de forma permanente. Pueden aplicarse las reglas de conservación de OpenAI; desactivar el almacenamiento de respuestas no garantiza que no exista ninguna retención.',
    'When AI assistance is configured, your description and a limited catalogue excerpt are sent to OpenAI. Optional OpenAI transcription sends a recording you explicitly started. Cineradar does not keep a permanent audio archive. OpenAI’s own retention rules may apply; disabling response storage does not guarantee zero retention.',
  ),
};
const steps = [
  {
    title: l(
      'Erinnerung beschreiben',
      'Décrivez votre souvenir',
      'Descrivi il ricordo',
      'Describe tu recuerdo',
      'Describe your memory',
    ),
    body: l(
      'Eine auffällige Szene, ein Ziel der Hauptfigur oder eine ungewöhnliche Umgebung helfen mehr als „ein spannender Film“. Wenn du kannst, ergänze Film oder Serie und einen ungefähren Zeitraum.',
      'Une scène marquante, l’objectif d’un personnage ou un cadre inhabituel sont plus utiles que « un film passionnant ». Ajoutez si possible film ou série et une période approximative.',
      'Una scena particolare, l’obiettivo del protagonista o un ambiente insolito aiutano più di «un film avvincente». Se puoi, indica film o serie e un periodo approssimativo.',
      'Una escena llamativa, el objetivo de un personaje o un entorno singular ayudan más que «una película emocionante». Si puedes, indica película o serie y una época aproximada.',
      'A distinctive scene, a character’s goal or an unusual setting helps more than “an exciting movie”. If you can, add whether it was a movie or a series and an approximate period.',
    ),
  },
  {
    title: l(
      'Vorschläge vergleichen',
      'Comparez les propositions',
      'Confronta i suggerimenti',
      'Compara las propuestas',
      'Compare the suggestions',
    ),
    body: l(
      'Prüfe Handlungshinweise, Erscheinungsjahr und Figuren. Ähnliche Geschichten können zu mehreren Vorschlägen führen. Schließe falsche Titel aus und ergänze eine weitere Erinnerung, wenn noch nichts passt.',
      'Comparez les indices de l’histoire, l’année et les personnages. Des histoires proches peuvent donner plusieurs suggestions. Écartez les mauvais titres et ajoutez un autre souvenir si nécessaire.',
      'Confronta gli indizi della trama, l’anno e i personaggi. Storie simili possono produrre diversi suggerimenti. Escludi i titoli sbagliati e aggiungi un altro ricordo se serve.',
      'Compara las pistas de la trama, el año y los personajes. Las historias parecidas pueden generar varias propuestas. Descarta títulos incorrectos y añade otro recuerdo si hace falta.',
      'Compare plot clues, the release year and characters. Similar stories can produce several suggestions. Exclude incorrect titles and add another detail if nothing fits yet.',
    ),
  },
  {
    title: l(
      'Streamingangebote prüfen',
      'Consultez les offres',
      'Controlla lo streaming',
      'Consulta dónde verlo',
      'Check where to watch',
    ),
    body: l(
      'Öffne die passende Titelseite für Angebote in deinem gewählten Land. Ob Abo, Leihe oder Kauf verfügbar sind, wird dort anhand der gespeicherten Streamingdaten angezeigt. Ein gefundener Titel bedeutet nicht automatisch ein verfügbares Angebot.',
      'Ouvrez la fiche pour consulter les offres du pays sélectionné. Abonnement, location et achat dépendent des données de streaming enregistrées. Un titre retrouvé n’est pas forcément disponible.',
      'Apri la scheda per le offerte nel paese selezionato. Abbonamento, noleggio e acquisto vengono mostrati in base ai dati streaming disponibili. Un titolo trovato non implica che ci sia un’offerta.',
      'Abre la ficha para consultar las ofertas del país elegido. Suscripción, alquiler y compra se muestran según los datos de streaming guardados. Encontrar un título no significa que esté disponible.',
      'Open the title page for offers in your selected country. Subscription, rental and purchase options use the stored streaming data. Finding a title does not automatically mean it is available to watch.',
    ),
  },
];
const faq = [
  {
    question: l(
      'Wie finde ich einen Film, dessen Namen ich vergessen habe?',
      'Comment retrouver un film dont j’ai oublié le titre ?',
      'Come trovo un film se ho dimenticato il titolo?',
      '¿Cómo encuentro una película si olvidé el título?',
      'How do I find a movie when I have forgotten its name?',
    ),
    answer: l(
      'Beschreibe konkrete Ereignisse: Wer macht was, an welchem Ort und mit welchem Problem? Auch das Ende oder eine ungewöhnliche Szene können helfen. Deine Formulierung muss nicht mit der offiziellen Inhaltsangabe übereinstimmen; fehlende Katalogdetails können die Suche dennoch begrenzen.',
      'Décrivez des événements précis : qui fait quoi, où et face à quel problème ? La fin ou une scène inhabituelle peut aider. Votre formulation peut différer du synopsis officiel, mais des détails absents du catalogue limitent la recherche.',
      'Descrivi eventi concreti: chi fa cosa, dove e con quale problema? Anche il finale o una scena insolita possono aiutare. Non serve copiare la sinossi ufficiale, ma i dettagli assenti dal catalogo possono limitare la ricerca.',
      'Describe hechos concretos: quién hace qué, dónde y con qué problema. El final o una escena poco común también pueden ayudar. No necesitas copiar la sinopsis oficial, aunque los detalles ausentes del catálogo pueden limitar la búsqueda.',
      'Describe specific events: who does what, where, and what problem do they face? An ending or an unusual scene may help. You do not need to reproduce the official synopsis, although missing catalogue details can still limit the search.',
    ),
  },
  {
    question: l(
      'Kann ich auch eine Serie nach einer Szene suchen?',
      'Puis-je retrouver une série grâce à une scène ?',
      'Posso cercare una serie partendo da una scena?',
      '¿Puedo buscar una serie a partir de una escena?',
      'Can I find a TV series from a scene?',
    ),
    answer: l(
      'Ja. Wähle Serie, wenn du das sicher weißt. Wiederkehrende Figuren, Schauplatz und zentrale Handlung sind hilfreiche Hinweise. Nicht jede einzelne Episode oder Szene ist im Katalog beschrieben.',
      'Oui. Choisissez série si vous en êtes certain. Les personnages récurrents, le lieu et l’intrigue principale sont utiles. Toutes les scènes ou tous les épisodes ne sont pas décrits dans le catalogue.',
      'Sì. Se ne sei sicuro, scegli serie. Personaggi ricorrenti, ambientazione e trama principale sono indizi utili. Il catalogo non descrive ogni singolo episodio o scena.',
      'Sí. Selecciona serie si lo sabes con seguridad. Los personajes recurrentes, el lugar y la trama principal son pistas útiles. El catálogo no describe todos los episodios o escenas.',
      'Yes. Choose TV series if you are sure. Recurring characters, the setting and the main storyline are useful clues. Not every individual episode or scene is described in the catalogue.',
    ),
  },
  {
    question: l(
      'Ist jeder Vorschlag ein sicherer Treffer?',
      'Chaque proposition est-elle certaine ?',
      'Ogni suggerimento è una risposta certa?',
      '¿Cada propuesta es un acierto seguro?',
      'Is every suggestion a confirmed match?',
    ),
    answer: l(
      'Nein. Die Suche schlägt mögliche Übereinstimmungen vor. Erinnerungen können unvollständig sein, und mehrere Titel können ähnliche Handlungen haben. Ohne belastbaren Vorschlag ist eine weitere Rückfrage hilfreicher als eine erfundene Antwort.',
      'Non. La recherche propose des correspondances possibles. Les souvenirs peuvent être incomplets et plusieurs titres peuvent partager une intrigue proche. Sans proposition solide, mieux vaut demander un indice que donner une réponse inventée.',
      'No. La ricerca propone possibili corrispondenze. I ricordi possono essere incompleti e più titoli possono avere trame simili. Senza un suggerimento credibile è meglio chiedere un altro indizio che inventare una risposta.',
      'No. La búsqueda ofrece coincidencias posibles. Los recuerdos pueden ser incompletos y varios títulos pueden tener tramas similares. Sin una propuesta sólida, pedir otra pista es más útil que inventar una respuesta.',
      'No. The search suggests possible matches. Memories can be incomplete, and several titles may share a similar plot. When there is no strong suggestion, asking for another clue is more useful than inventing an answer.',
    ),
  },
  {
    question: l(
      'Erkennt Cineradar einen laufenden Filmton?',
      'Cineradar reconnaît-il le son d’un film ?',
      'Cineradar riconosce l’audio di un film?',
      '¿Cineradar reconoce el audio de una película?',
      'Can Cineradar recognise audio from a movie?',
    ),
    answer: l(
      'Diese Funktion verarbeitet deine Beschreibung. Mit dem Mikrofon diktierst du deine Erinnerung als Text; es werden keine Filmszenen, Soundtracks oder hochgeladenen Videos erkannt.',
      'Cette fonction utilise votre description. Le microphone sert à dicter votre souvenir sous forme de texte ; elle ne reconnaît pas les scènes, bandes originales ou vidéos importées.',
      'Questa funzione usa la tua descrizione. Il microfono serve a dettare il ricordo come testo; non riconosce scene, colonne sonore o video caricati.',
      'Esta función utiliza tu descripción. El micrófono sirve para dictar tu recuerdo como texto; no reconoce escenas, bandas sonoras ni vídeos subidos.',
      'This feature uses your description. The microphone lets you dictate your memory as text; it does not identify movie clips, soundtracks or uploaded videos.',
    ),
  },
  {
    question: l(
      'Warum finde ich einen Titel, aber kein Streamingangebot?',
      'Pourquoi un titre n’a-t-il pas d’offre de streaming ?',
      'Perché trovo un titolo ma nessuna offerta streaming?',
      '¿Por qué aparece un título sin ofertas de streaming?',
      'Why can I find a title but no streaming offer?',
    ),
    answer: l(
      'Die Identität eines Films oder einer Serie ist unabhängig von der Verfügbarkeit in deinem Land. Rechte und Angebote unterscheiden sich je nach Markt und Zeitpunkt. Auf der Titelseite siehst du den vorhandenen Prüfstand und kannst ein anderes Streaming-Land wählen.',
      'L’identité du film ou de la série ne dépend pas de sa disponibilité dans votre pays. Les droits et les offres varient selon le marché et la date. La fiche indique l’état des données et permet de choisir un autre pays.',
      'L’identità di un film o una serie non dipende dalla disponibilità nel tuo paese. Diritti e offerte cambiano in base al mercato e al momento. La scheda mostra lo stato dei dati e permette di scegliere un altro paese.',
      'La identidad de una película o serie no depende de su disponibilidad en tu país. Los derechos y las ofertas varían según el mercado y la fecha. La ficha muestra el estado de los datos y permite elegir otro país.',
      'The identity of a movie or series does not depend on availability in your country. Rights and offers vary by market and over time. The title page shows the available checking status and lets you choose another streaming country.',
    ),
  },
];
const examples = [
  l(
    'Ein Dieb betreibt Gedankendiebstahl und entlockt Schlafenden Geheimnisse aus ihrem Unterbewusstsein. Ein Industrieller bietet ihm einen gefährlichen Auftrag an.',
    'Un voleur pratique l’espionnage industriel en volant des secrets dans le subconscient pendant les rêves. Une mission pourrait lui rendre sa vie d’avant.',
    'Un ladro entra nei sogni per rubare i segreti nel subconscio. Un industriale gli chiede invece di inserire un’idea nella mente di un’altra persona.',
    'Un ladrón roba secretos del subconsciente durante los sueños para el espionaje corporativo. Un último trabajo podría devolverle su vida anterior.',
    'A thief uses corporate espionage to steal secrets from the subconscious. His next task is to implant an idea in someone else’s mind.',
  ),
  l(
    'Ein Kind verschwindet. Vier Familien suchen Antworten auf ein Rätsel, das drei Generationen miteinander verbindet.',
    'Un enfant disparaît. Quatre familles cherchent à comprendre un mystère qui relie trois générations.',
    'Un bambino scompare. Quattro famiglie cercano risposte a un mistero che attraversa tre generazioni.',
    'Desaparece un niño. Cuatro familias buscan respuestas a un misterio que conecta sus vidas a lo largo de tres décadas.',
    'A child goes missing. Four families search for answers to a mystery that connects three generations.',
  ),
  l(
    'Der Teufel verlässt die Hölle, betreibt einen Nachtclub in Los Angeles und hilft einer Polizistin bei Mordfällen.',
    'Le diable quitte l’enfer, tient une boîte de nuit à Los Angeles et aide une policière à résoudre des meurtres.',
    'Il diavolo lascia l’inferno, gestisce un locale a Los Angeles e aiuta una detective a risolvere omicidi.',
    'El diablo abandona el infierno, dirige un club nocturno en Los Ángeles y ayuda a una detective a resolver asesinatos.',
    'The devil leaves hell, runs a nightclub in Los Angeles and helps a detective solve murders.',
  ),
];

export const identifyEditorial = Object.fromEntries(
  locales.map((locale) => [
    locale,
    {
      ...Object.fromEntries(
        Object.entries(copy).map(([key, value]) => [key, value[locale]]),
      ),
      steps: steps.map((step) => ({
        title: step.title[locale],
        body: step.body[locale],
      })),
      faq: faq.map((item) => ({
        question: item.question[locale],
        answer: item.answer[locale],
      })),
      examples: examples.map((example) => example[locale]),
    },
  ]),
) as Record<
  Locale,
  Record<keyof typeof copy, string> & {
    steps: { title: string; body: string }[];
    faq: { question: string; answer: string }[];
    examples: string[];
  }
>;

export const identifyPrivacyParagraphs = locales.map(
  (locale) =>
    `${copy.privacyNotice[locale]} ${copy.browserVoiceNotice[locale]} ${copy.aiNotice[locale]}`,
) as [string, string, string, string, string];
