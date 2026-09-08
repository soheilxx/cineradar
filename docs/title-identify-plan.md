# Cineradar: Titel aus Erinnerungen finden

Stand: 8. September 2026. Reihenfolge des Auftrags: Plan → ausführbarer Masterprompt → Umsetzung und Abnahme. OpenAI-Anbindung wurde vom Nutzer als vorzubereitender Anbieter gewählt.

## Produktentscheidung

Ein eigener Bereich **„Titel vergessen?“** hilft beim Wiederfinden eines Films oder einer Serie anhand von Handlung, Figuren, Orten oder einer einzelnen Szene. Die Erinnerung kann getippt oder bewusst diktiert, anschließend bearbeitet und abgeschickt werden. Die Ergebnisse führen zu den vorhandenen Titelseiten und den tatsächlichen Streamingangeboten im gewählten Land.

Die Metapher „Shazam für Filme“ beschreibt das Wiedererkennen. Diese Version erkennt weder laufende Filmaudios noch hochgeladene Ausschnitte oder Gesichter. Beschreibungssuchen existieren bereits, etwa [What is my movie](https://www.whatismymovie.com/). Cineradars Differenzierung liegt in der Kombination aus verständlicher Eingabe, Rückfragen, fünf Sprachen und belegten Streamingangeboten; keine unbelegte Alleinstellungsbehauptung.

## Befund und Architekturentscheidung

Der geprüfte Bestand enthält 6.722 Titel. Deutsche Synopsen mit mindestens 80 Zeichen decken 69,2 %, englische 96,7 % ab. Der vorhandene Suchindex umfasst Titel, keine Szenen. Drei reine OR-Volltextproben verfehlten bekannte erwartete Titel in den ersten fünf Treffern. Deshalb darf eine einfache Stichwortsuche nicht als vollständige KI-Erkennung verkauft werden.

Die erste Version kombiniert einen getrennten Beschreibungsindex mit einer vorbereiteten OpenAI-Erkennung. Ein strukturiert antwortendes Modell kann Hinweise sowie mögliche Titelnamen vorschlagen; Namen werden gegen den tatsächlichen Bestand aufgelöst. Anschließend bewertet das Modell ausschließlich geprüfte Kandidaten. Ergebnisse, IDs, Bilder, URLs und Streaminganbieter stammen aus dem eigenen TMDB-/Streaming-Datenbestand. Unbekannte Modell-IDs oder erfundene Links werden verworfen.

Ohne konfigurierten KI-Zugang bleibt eine echte, ausdrücklich als Katalogabgleich bezeichnete Beschreibungssuche verfügbar. Sie nutzt aussagekräftige Begriffe, sprachabhängige Wortformen und englische Beschreibungen als ergänzende Quelle. Sie behauptet keine semantische Gleichwertigkeit zur KI-Stufe. Nicht vorhandene Titel werden nicht als vermeintlich vollständige Ergebnisse erfunden.

## Nutzerablauf

1. Einstieg direkt unter der Startseitensuche, im Menü und im Footer; eigener übersetzter RouteKey `identify`.
2. Großes Textfeld mit Beispielerinnerungen. Optionale Hinweise: Film/Serie/unbekannt und ungefährer Erscheinungszeitraum. Kein Pflichtkonto.
3. Mikrofon nur nach aktivem Start. Sichtbarer Zustand, Stopp und Abbrechen; maximal 60 Sekunden. Browser-Diktat als verfügbare Basis; vorbereitete OpenAI-Transkription für eine breitere Browserabdeckung, sobald konfiguriert. Text bleibt immer möglich.
4. Diktat landet bearbeitbar im Formular. Die Titelsuche startet erst mit der Suchschaltfläche.
5. Höchstens sechs Kandidaten mit Poster, Titel, Jahr, Medientyp, nachvollziehbaren Hinweisen und Link zur Streamingseite. Keine erfundenen Trefferwahrscheinlichkeiten.
6. Bei wenig Information oder keinem belastbaren Treffer: hilfreiche Rückfrage, weitere Hinweise ergänzen, einzelne falsche Vorschläge ausschließen. „Das ist der Titel“ als freiwillige Rückmeldung mit anschließendem Weg zu den Angeboten.

## Gestaltung

Dunkle Cineradar-Flächen, warme Goldakzente, klare Typografie und eine eigenständige Erinnerungs-/Wellenformgrafik in CSS/SVG. Keine austauschbare Chatbot-Kachel. Die Eingabe steht im ersten Bildschirm; Aufnahmezustände bewegen sich dezent und respektieren `prefers-reduced-motion`. Auf Mobilgeräten klare vertikale Reihenfolge, große Bedienelemente, keine überlaufenden Chips oder versteckten Aktionen. Tastaturbedienung, Labels und höfliche Statusansagen sind Pflicht.

## Technischer Umfang dieser Umsetzung

- Eigenes `POST /api/identify`, strikte Validierung, maximal 1.600 Zeichen und begrenzte JSON-Größe. Keine Beschreibung in URL, Logs oder Analytics.
- Eigener suchbarer Beschreibungsbestand; normale Titelsuche, Trends und Nachladefunktion bleiben erhalten.
- Serveradapter für die OpenAI Responses API mit Structured Outputs und `store:false`; konfigurierbares Modell, zunächst `gpt-5.4-mini`. Maximal zwei begrenzte Modellaufrufe pro Suche, begrenzter Kandidatenkontext, keine Werkzeuge oder vom Modell gesteuerten URLs.
- Eingabe wird als untrusted Daten behandelt. Modellantworten werden zusätzlich lokal validiert. Prompt-Injection, erfundene IDs, fehlende Antworten, Verweigerungen, Zeitüberschreitungen und Quotenfehler erhalten kontrollierte Fallbacks.
- Eigene atomare Tages-/Monatskontingente für KI-Aufrufe, unabhängig vom Streaming-API-Budget. Keine neuen Streaming-API-Anfragen pro Identifikation.
- Optionaler `POST /api/identify/transcribe` für eine explizit gestartete, kurze Aufnahme: begrenzte Dateigröße, erlaubte Formate, Transkriptlänge und eigene Rate-Limits. Keine dauerhafte Audiodatei bei Cineradar.
- Mikrofonzugriff für die eigene Herkunft erlauben. Wegen interner Navigation gilt die Policy schon auf dem Einstiegsdokument. Kein automatischer Mikrofonzugriff.
- Fünf vollständige Sprachfassungen und alle bestehenden Länder-/Sprachkontexte. Englisch wählt weiterhin USA; Aufnahme- bzw. Diktatsprache folgt der Oberflächensprache.
- Öffentliche redaktionelle Landingpage mit Canonical, Sprachverweisen, Metadaten, OG-Karte und Sitemap-Einträgen. Persönliche Eingaben und Ergebnisse werden nicht indexiert.
- GA4 misst ausschließlich Ereignistyp, Ergebniszahl, öffentliche Titelkennung, Dauer und Textlänge nach bestehender Einwilligung. Keine Beschreibungen, Transkripte oder Audiodaten.
- Datenschutzhinweise erklären Browser-Spracherkennung und die tatsächliche optionale OpenAI-Verarbeitung. `store:false` wird nicht als vollständige Nullspeicherung bei OpenAI ausgegeben.

## Abnahme und Betrieb

Prüfen: bekannte Handlungserinnerungen, Umschreibungen, mehrdeutige und unlösbare Anfragen, Film/Serie/Zeitraum, falscher Vorschlag, Fehler und Ratenbegrenzung. Provider-Tests nutzen injizierte Antworten und verwerfen erfundene IDs. Datenbanktests belegen Index-/Budgetverhalten; vorhandene Tests für Lucifer, Länder und Sitemap müssen grün bleiben.

Voice-Steuerung wird mit kontrollierten Browser-/Recorder-Doubles geprüft: Start, Stopp, Abbruch, Ablehnung, Fehler, verspätete Ereignisse, Navigation und Textübernahme. Das ist kein Ersatz für einen realen Mikrofontest. Browser-QA erfolgt im Codex-Browser, auf Mobil- und Desktopbreite, einschließlich Tastatur, Sprachwechsel und Analytics-Datenvertrag.

Die Seite und alle Adapter werden fertig gebaut. Ein echter OpenAI-End-to-End-Test und die Aktivierung der KI-Stufe benötigen `OPENAI_API_KEY` im Projekt. Der Schlüssel wird weder im Chat angefordert noch in Git gespeichert. Vorhandene Veröffentlichungsautorisierung wird genutzt; fehlende Live-Verifikation wird klar ausgewiesen.

Ein späterer Ausbau kann lizenzierte zusätzliche Szenen-/Keyworddaten, mehrsprachige Embeddings, einen größeren Evaluationssatz und kontrollierte Audio-/Videofingerabdrücke ergänzen. Diese Punkte werden nicht als Bestandteil der ersten fertiggestellten Erkennung behauptet.

## Technische Quellen

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [OpenAI Transkription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI Datenverarbeitung](https://developers.openai.com/api/docs/guides/your-data)
- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [TMDB Suche und Details](https://developer.themoviedb.org/docs/search-and-query-for-details)
