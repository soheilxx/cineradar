# Abnahme: Titel vergessen?

Stand: 8. September 2026. Plan und Masterprompt wurden vor der Implementierung erstellt und anschließend umgesetzt.

## Geprüfter Stand

- Eigene Oberfläche mit editierbarer Beschreibung, Diktat, Film-/Serienfilter, Jahrzehnt, Ergebnissen, Bestätigung und rücksetzbaren Ausschlüssen. Alle fünf Sprachen, 25 Sprach-/Länderrouten.
- Getrennte Beschreibungsindizes und Migration `008_identify.sql` in der vorhandenen Datenbank erfolgreich angewendet. Bestehende Titel-, Trend- und Ländersuche bestehen ihre Regressionen.
- Alle 15 redaktionellen Beispielbeschreibungen liefern im tatsächlichen Katalog den erwarteten Titel: 14-mal Platz 1, einmal Platz 2. Das ist eine gezielte Stichprobe, keine allgemeine Erkennungsquote. Es gibt keine Sonderregeln für diese Titel.
- Codex-Browser: echtes Formular, Suchergebnisse, Ausschließen/Wiederherstellen ohne Textverlust, Bestätigung und Navigation zu Inception-Streamingdetails geprüft. Kein horizontaler Überlauf bei schmaler mobiler Ansicht (320 CSS-Pixel) und Desktop-/Tabletansicht; französische Navigation bei 1.024 CSS-Pixeln ohne Überlappung.
- HTTP: alle 25 Landingpages mit korrektem H1, Canonical, fünf Sprachverweisen, Description und OG-Verweis; fünf Queryvarianten noindex und ohne sichtbaren Eingabetext. Alle fünf Datenschutzerklärungen enthalten die neue Verarbeitung. OG-Bild liefert HTTP 200 und gültiges PNG.
- Tatsächliches React-SSR-Formular in allen fünf Sprachen geprüft: POST, unbenannte und vor Hydration gesperrte Texteingabe, gesperrte Such-/Mikrofonschaltflächen. Eine ausgefallene JavaScript-Hydration darf Beschreibungen nicht als GET-Parameter versenden.
- GA4 im lokalen Debugmodus nach Einwilligung: `identify_submit` und `identify_results` mit kontrollierten Parametern, Länge, Anzahl und Modus beobachtet. Keine Beschreibung oder Transkription in Analytics-Anfragen. Vorheriger Einwilligungszustand nach der Prüfung wiederhergestellt.
- Gesamtsuite: **122 Tests bestanden**, kein übersprungener Test. Typecheck, Lint und `VERCEL=1 npm run build:node` erfolgreich. Darunter isolierte PostgreSQL-, Quoten-, Provider-, Datenschutz- und Diktat-Lifecycletests.

## Noch separat zu verifizieren

Beim Abschluss der Implementierungsprüfung war kein OpenAI-Schlüssel in der lokalen Konfiguration oder der Vercel-Variablenliste vorhanden. Die Integration ist vorbereitet und mit kontrollierten Providerantworten geprüft. Ein echter OpenAI-Erkennungsaufruf und eine echte Audiotranskription sind dadurch **noch nicht belegt**. Ebenso ersetzen die Mikrofon-Doubles keinen Test mit einem realen Gerät und seiner Berechtigung.

Zur Aktivierung: Vercel-Projekt `cineradar` → Settings → Environment Variables → Production: `OPENAI_API_KEY` sicher hinterlegen und `IDENTIFY_AI_ENABLED=true` setzen. Danach neu deployen. Modelle und Grenzen sind im Code vorbelegt; Einzelheiten stehen in [identify-setup.md](identify-setup.md). Ohne Aktivierung ist die Seite mit ausdrücklich bezeichnetem Katalogabgleich nutzbar. Freie Umschreibungen außerhalb der vorhandenen Handlungsdaten bleiben dabei eine bekannte Grenze.

Die Veröffentlichung wird erst nach den bestandenen Prüfungen ausgelöst; der endgültige Deploymentstatus wird im Abschlussbericht der Aufgabe bestätigt.
