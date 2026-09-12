# Kalender und Quellenlinks – 12. September 2026

Der öffentliche Serienkalender verwendet eine kompakte mobile Darstellung, eine Tagesnavigation, Episodenkarten und reguläre Staffelstart-Markierungen. Vorhandene Cover stammen aus dem Cineradar-Katalog. Gemappte Serien führen auf eigene Titelseiten; ungemappte Titel bleiben lesbarer Text.

Redaktionelle Absätze und FAQs stehen unter dem Kalender. Titel, Beschreibungen und Share-Bilder sind für Deutsch, Französisch, Italienisch, Spanisch und Englisch angepasst. Die Texte beschreiben eine Auswahl angekündigter Originalsendetermine und versprechen keine vollständige regionale Streamingverfügbarkeit.

## Dauerhafte Vorgabe für Quellen

Keine öffentlichen Backlinks zu API-Datenanbietern: TVmaze, OMDb, TMDB und Streaming Availability/Movie of the Night werden als Text genannt. Das gilt auch für dynamisch gerenderte Vergleichsquellen und Episodenführer. Auch ausgeschriebene Anbieter-URLs erscheinen nicht in der öffentlichen Oberfläche. Herkunfts-URIs bleiben ausschließlich in den internen Daten erhalten. Lizenzverweise und interne Cineradar-Navigation bleiben erhalten. API-Aufrufe, serverseitige URLs, gespeicherte Provenienz und echte Streamingangebotslinks werden dadurch nicht verändert.

## Prüfung

- 26 bestehende Kalender-, Datums- und Metadatentests erfolgreich.
- Vier neue Render-Regressionen: alle Sprachen ohne Anbieterlinks, interne Titellinks und Tagesanker, reguläre Staffelstarts, datumgenaue Termine ohne erfundene Uhrzeit, lokales Heute in Deutschland und den USA.
- Lokale Mobile- und Desktopansicht im Codex-Browser geprüft; keine horizontale Seitenüberbreite, Tagesnavigation horizontal scrollbar, Desktopkarten in zwei Spalten.
