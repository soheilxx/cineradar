# Abnahme: Titel vergessen?

Stand: 8. September 2026. Plan und Masterprompt wurden vor der Implementierung erstellt und anschließend umgesetzt.

## Geprüfter Stand

- Eigene Oberfläche mit editierbarer Beschreibung, Diktat, Film-/Serienfilter, Jahrzehnt, Ergebnissen, Bestätigung und rücksetzbaren Ausschlüssen. Alle fünf Sprachen, 25 Sprach-/Länderrouten.
- Getrennte Beschreibungsindizes und Migration `008_identify.sql` in der vorhandenen Datenbank erfolgreich angewendet. Bestehende Titel-, Trend- und Ländersuche bestehen ihre Regressionen.
- Alle 15 redaktionellen Beispielbeschreibungen liefern im tatsächlichen Katalog den erwarteten Titel: 14-mal Platz 1, einmal Platz 2. Das ist eine gezielte Stichprobe, keine allgemeine Erkennungsquote. Es gibt keine Sonderregeln für diese Titel.
- OpenAI-Textpfad nach Aktivierung im [Produktionsdeployment cineradar-8i3llxpir-modernice](https://cineradar-8i3llxpir-modernice.vercel.app/) mit zwei synthetischen deutschen Beschreibungen live geprüft: Inception (`movie:27205`) auf Platz 1 in 7,63 Sekunden, Lucifer (`tv:63174`) auf Platz 1 in 3,87 Sekunden. Beide Antworten enthielten `mode: ai`. Dies waren echte Provideraufrufe, getrennt von den Katalog- und Mocktests.
- Zusätzlich direkt im Codex-Browser auf `cineradar.tv`: Oberfläche zeigt nach Neuladen „KI-Suche“. Eine dritte Beschreibung (Chemielehrer mit Krebs, ehemaliger Schüler) liefert Breaking Bad als ersten Treffer mit dem korrekten deutschen Detailziel. Poster geladen, kein horizontaler Überlauf; Testeingabe anschließend zurückgesetzt.
- Produktive Audiotranskription mit kontrollierter synthetischer englischer Sprache geprüft: ein POST an `/api/identify/transcribe`, HTTP 200 in 1,34 Sekunden, korrekte Transkription eines Hinweises über Träume und einen Kreisel. Antwort mit `private, no-store`. Keine physische Mikrofonaufnahme und keine privaten Sprachdaten verwendet.
- Fachliche Begrenzung live geprüft: eine allgemeine Wissensfrage und eine Aufforderung, Regeln zu ignorieren und ein Rezept zu schreiben, liefern beide `mode: ai`, `status: needs_clues`, `items: []` und ausschließlich einen fest vorgegebenen Rückfragetyp. Keine allgemeine Antwort, kein Rezept. Die Ausgabestruktur enthält ohnehin keine freie Chatantwort: Karten stammen aus geprüften Katalog-IDs und Begründungen müssen wörtliche öffentliche Metadaten belegen.
- Codex-Browser: echtes Formular, Suchergebnisse, Ausschließen/Wiederherstellen ohne Textverlust, Bestätigung und Navigation zu Inception-Streamingdetails geprüft. Kein horizontaler Überlauf bei schmaler mobiler Ansicht (320 CSS-Pixel) und Desktop-/Tabletansicht; französische Navigation bei 1.024 CSS-Pixeln ohne Überlappung.
- HTTP: alle 25 Landingpages mit korrektem H1, Canonical, fünf Sprachverweisen, Description und OG-Verweis; fünf Queryvarianten noindex und ohne sichtbaren Eingabetext. Alle fünf Datenschutzerklärungen enthalten die neue Verarbeitung. OG-Bild liefert HTTP 200 und gültiges PNG.
- Tatsächliches React-SSR-Formular in allen fünf Sprachen geprüft: POST, unbenannte und vor Hydration gesperrte Texteingabe, gesperrte Such-/Mikrofonschaltflächen. Eine ausgefallene JavaScript-Hydration darf Beschreibungen nicht als GET-Parameter versenden.
- GA4 im lokalen Debugmodus nach Einwilligung: `identify_submit` und `identify_results` mit kontrollierten Parametern, Länge, Anzahl und Modus beobachtet. Keine Beschreibung oder Transkription in Analytics-Anfragen. Vorheriger Einwilligungszustand nach der Prüfung wiederhergestellt.
- Gesamtsuite: **122 Tests bestanden**, kein übersprungener Test. Typecheck, Lint und `VERCEL=1 npm run build:node` erfolgreich. Darunter isolierte PostgreSQL-, Quoten-, Provider-, Datenschutz- und Diktat-Lifecycletests.

## Überarbeiteter mobiler Einstieg: KI-Titelfinder

- Startseite enthält eine eigene, direkt bedienbare Beschreibungs- und Spracheingabe neben der normalen Titelsuche auf Desktop und darunter auf Mobilgeräten. Getrennte Formulare und Zustände; keine zusätzliche Navigation nötig.
- Die Funktionsseite beginnt mit kurzer Überschrift und Eingabe. Bestehende Einführung, Anleitung, FAQ und interne Verweise bleiben darunter im serverseitigen HTML erhalten. Die Bezeichnung und SEO-Metadaten decken Filme und Serien in allen fünf Sprachen ab; der Share-Bild-Verweis bekommt bei geänderter Beschriftung eine neue Revision.
- „Titel finden“ steht direkt nach der Eingabe, vor den standardmäßig geschlossenen Filtern und horizontal bedienbaren Beispielen. Lange Texte scrollen innerhalb des Eingabefelds. Nach abgeschlossenem Diktat wird die Hauptaktion bei Bedarf ins Sichtfeld gebracht, ohne die Bildschirmtastatur durch einen Fokuswechsel zu öffnen.
- Codex-Browser: Startseite und Funktionsseite in allen fünf Sprachen bei 320 CSS-Pixeln geprüft, zusätzlich 390 Pixel und Desktop mit 1.440 Pixeln. Kein horizontaler Seitenüberlauf, ein H1, genau ein Identifikationsformular je Seite und erreichbarer Datenschutzlink. Die lokale Fixture-Kennzeichnung wurde bei der Messung der Produktionsgeometrie abgezogen. Längere französische Texte wurden in der kompakten Ansicht gesondert geprüft.
- Kontrolliertes Browser-Diktat mit 1.199 Zeichen: Text übernommen, Feldhöhe unverändert, Submit danach aktiv und innerhalb der sichtbaren 568 Pixel. Keine physische Aufnahme; Test-Doppelung durch Neuladen entfernt.
- 30 gezielte Regressionstests bestanden, einschließlich erweiterter SSR-Prüfung beider Formularvarianten in fünf Sprachen, eindeutiger IDs und auflösbarer ARIA-Verweise. Lint, Typecheck, Sprachprüfung und Produktionsbuild erfolgreich; die vier SEO-Tests nach der neuen Share-Bild-Revision erneut bestanden.

## Grenzen der Geräteprüfung

Der produktive OpenAI-Textpfad und die serverseitige Audiotranskription sind für die oben genannten Stichproben belegt. Synthetische Sprache und Mikrofon-Doubles ersetzen keinen Test mit einem physischen Gerät und seiner Berechtigung. Die erfolgreichen Anfragen beweisen keine allgemeine Erkennungsquote oder vollständige KI-Abdeckung aller fünf Sprachen.

Die Aktivierung erfolgte in Vercel-Projekt `cineradar` → Settings → Environment Variables → Production mit `OPENAI_API_KEY` als **Secret** und `IDENTIFY_AI_ENABLED=true` als **Config**, anschließendem Deployment und Liveprüfung. Modellnamen und Grenzen sind optionale Config-Werte mit Defaults; Einzelheiten stehen in [identify-setup.md](identify-setup.md). Ohne Aktivierung bleibt der ausdrücklich bezeichnete Katalogabgleich nutzbar. Freie Umschreibungen außerhalb der vorhandenen Handlungsdaten bleiben dabei eine bekannte Grenze.

Das oben bezeichnete Produktionsdeployment war zum angegebenen Prüfzeitpunkt live. Weitere Browser- und Audioprüfungen werden separat dokumentiert.
