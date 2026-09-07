# Cineradar: Masterplan für einen vollständigen öffentlichen Auftritt

Stand: 7. September 2026. Betreiber: Wiresoft AG. Ziel: cineradar.tv.

Die Prüfung des aktuellen Umsetzungspakets ist im [Prüfprotokoll](release-check-2026-09-07.md) dokumentiert.

Die Domain ist bereits öffentlich erreichbar. Das ist die technische Grundlage; ein vollständiger Auftritt braucht zusätzlich verständliche Inhalte, belastbare Kontaktwege, gepflegte Streamingdaten und eine konsistente Gestaltung. Dieser Plan unterscheidet die aktuelle Umsetzung von den noch offenen Arbeiten. Eine erfolgreiche Veröffentlichung ist keine Zusage über eine Google-Indexierung oder Platzierung.

## 1. Ziel und Reihenfolge

Cineradar soll die Frage „Wo kann ich diesen Film oder diese Serie in meinem Land sehen?“ zuverlässig beantworten und beim Entscheiden helfen. Der Mehrwert entsteht durch verständliche Angebotsarten, sichtbare Länder, nachvollziehbare Datenstände und gute Orientierung. Unbelegte Aussagen wie „vollständigster Katalog“ oder „besser als alle Konkurrenten“ gehören nicht auf die Seite.

| Priorität                      | Ergebnis                                                                                             | Abnahme                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| P0: Orientierung und Vertrauen | Mobile Navigation, geordneter Footer, vollständiges Kontaktformular, korrekte Betreiberinformationen | Bei schmalen Displays bedienbar; Pflichtangaben client- und serverseitig geprüft; Ansprechpartner und tatsächlicher Kontaktweg verständlich |
| P0: Auffindbarkeit und Teilen  | Individuelle Metadaten, passende Share-Bilder, funktionierende interne Links                         | Öffentliches HTML und Bildantworten geprüft; Canonicals und Sprachversionen konsistent                                                      |
| P1: Substanz jeder Seite       | Eigene Inhalte für Informationsseiten, Anbieter, Genres und Titel                                    | Jede Seite beantwortet eine konkrete Nutzerfrage; keine austauschbaren Fülltexte oder erfundenen Angaben                                    |
| P1: Vergleichsseiten           | Zehn belegte Vergleiche plus Übersicht in fünf Sprachen                                              | 55 kurze URLs, vollständiges HTML, Quellen, funktionierende Suche und Sitemap                                                               |
| P1: Katalogqualität            | Neuheiten und wichtige ältere Titel auffindbar                                                       | Definierte Stichprobe je Land umfasst Filme, Serien, Klassiker und aktuelle Veröffentlichungen; leere Treffer werden untersucht             |
| P2: Laufender Betrieb          | Supportbearbeitung, Qualitätskontrolle und Erfolgsmessung                                            | Zuständigkeiten, überprüfte Wiederherstellung und regelmäßig ausgewertete Berichte                                                          |

## 2. In diesem Änderungspaket

- Neuer kompakter mobiler Kopfbereich mit eigener Suche und großem Navigationsmenü. Sprache und Angebotsland stehen im Menü; Englisch behält USA als Vorgabe.
- Kontaktseite mit vollständigem Namen, E-Mail-Adresse, Betreff und Nachricht als Pflichtfeldern. Speicherung der neuen Felder und Anzeige im geschützten Betriebsbereich. Keine fingierte Bestätigung einer E-Mail-Zustellung.
- Footer mit vier geordneten Bereichen: Entdecken, Service, Vergleiche und Cineradar/Rechtliches.
- Informationsseiten mit eigener Einleitung, Abschnittsüberschriften, Inhaltsnavigation und weiterführenden Links. Eigene Meta-Beschreibungen ersetzen die bisher unpassenden Katalogtexte.
- Impressum mit den im Schweizer UID-Register überprüften Nummern CHE-112.097.691 und CH-170.3.027.782-3. Die Betreiberadresse bleibt die vom Auftraggeber genannte Adresse in Baar. [Amtlicher Registereintrag](https://www.uid.admin.ch/Detail.aspx?uid_id=CHE112097691).
- Zehn Wettbewerbervergleiche und Vergleichshub in Deutsch, Französisch, Italienisch, Spanisch und Englisch. Jeder Vergleich hat einen eigenen Schwerpunkt, eine Entscheidungshilfe, Quellen und eine funktionierende Suche.
- Share-Karten mit erkennbarer Seite beziehungsweise Vergleich und vorhandener Cineradar-Bildwelt; Titelseiten verwenden vorhandene Titelmotive, soweit verfügbar.

Der Abschluss der technischen Abnahme wird im Veröffentlichungsbericht dokumentiert. Die nachfolgenden vertiefenden Inhalte und externen Voraussetzungen sind damit nicht automatisch erledigt.

## 3. Inhaltlicher Auftrag pro Seitentyp

| Seite                            | Benötigter Inhalt und Gestaltung                                                                                                                                                                                                                                                                                    | Sinnvolle nächste Schritte                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Über Cineradar                   | Wer betreibt die Seite? Welches Problem löst sie? Wie unterscheidet sich die Suche vom Streamingdienst? Welche Funktionen bestehen tatsächlich? Klare Einordnung lokaler Merklisten, fehlender Kontosynchronisierung und laufender Katalogerweiterung. Keine erfundenen Teamprofile, Nutzerzahlen oder Bewertungen. | Suche, Datenmethodik, Kontakt, Vergleiche                     |
| Hilfe                            | Konkrete Anleitungen für Titelsuche, Jahr/Remake, Länderwechsel, Basisabo versus Channel, Staffelabdeckung, Merkliste und fehlende Treffer. Antworten als eigene Abschnitte, gut überfliegbar und ohne verpflichtende lange Einführung.                                                                             | Passende Suchansicht, Anbieterauswahl, Fehlermeldung          |
| Daten & Aktualität               | TMDB und Streaming Availability API erklären; Prüfzeitpunkt, Aktualisierungsintervall, abgelaufene Angebote, unbekannte Qualität und unvollständige Staffeln unterscheiden. Erklären, warum eine fehlende Quelle keine weltweite Nichtverfügbarkeit beweist.                                                        | Beispiel einer Detailseite, Hilfe, Korrekturformular, Quellen |
| Kontakt                          | Name, E-Mail, Betreff und Nachricht; Zweck der Angaben, konkrete Hilfe beim Beschreiben eines Problems, Datenschutzlink. Zuständigkeit des Streaminganbieters bei Rechnung, Wiedergabe oder Kündigung. Erfolg bedeutet erst einmal gespeicherte Anfrage.                                                            | Hilfe und Betreiberangaben                                    |
| Impressum                        | Firmenname, ladungsfähige Anschrift, tatsächlich erreichbarer Kontakt, Registerangaben. Vertretungsangaben und gegebenenfalls weitere einschlägige Pflichtangaben anhand der realen Betreiberkonstellation prüfen. Keine erfundene Geschäftsführung und keine unnötigen Standardklauseln.                           | Kontakt, Datenschutz, Datenquellen                            |
| Datenschutz                      | Tatsächliche Datenflüsse und Zwecke, Verantwortlicher, Empfänger, Verarbeitungsländer, Schutzmechanismen, Aufbewahrung und Rechte. Änderungen am Formular und an eventueller Analyse müssen hier nachvollzogen werden.                                                                                              | Kontaktformular, postalische Adresse, zuständige Aufsicht     |
| Quellen & Credits                | Herkunft von Beschreibungen, Bildern und Streaminginformationen; erforderliche TMDB-Kennzeichnung; Rolle von Movie of the Night. Keine unbelegte Partnerschaft.                                                                                                                                                     | Datenmethodik, Originalquellen                                |
| Anbieterübersicht                | Orientierung nach Angebotsart; Erklärung von Abo, Shop und Zusatzkanal. Anbieternamen und Länderbezug vor optisch dominanten Logoansammlungen.                                                                                                                                                                      | Anbieterdetail, kostenlose Angebote, Hilfe                    |
| Anbieterdetail                   | Was lässt sich im gewählten Land finden? Was gehört zum Basisangebot und was zu Channels? Aktuelle Filme und Serien plus verständliche Filter. Keine ungeprüften monatlichen Abopreise aus dauerhaftem Text.                                                                                                        | Titel, ähnliche Anbieter, Angebotsarten                       |
| Genre/Thema                      | Kurze eigene Einordnung, Auswahlkriterien, echte passende Titel, sinnvolle Unterthemen. Inhalte sollen eine Auswahl erleichtern. Keine massenhaft umbenannten Listen.                                                                                                                                               | Titel, verwandte Genres, Anbieter                             |
| Film                             | Exakter Titel und Jahr, natürliche Inhaltsbeschreibung, Besetzung/Genre soweit belegt, Angebote im Land, Preis-/Aboeinordnung, Datenstand, passende ähnliche Titel. „Wo läuft …?“ natürlich beantworten, ohne Keyword-Wiederholungen.                                                                               | Anbieter, Genre, ähnliche Filme, Fehlermeldung                |
| Serie                            | Zusätzlich Staffel- und Folgenabdeckung, Unterschiede zwischen Serien- und Staffelangeboten, unvollständige Daten sichtbar erklären. Keine Behauptung „alle Staffeln“, wenn nur Einzelangebote vorliegen.                                                                                                           | Staffelangebote, Anbieter, ähnliche Serien                    |
| Neu / läuft aus / kostenlos      | Definition der Auswahl direkt erklären. „Neu auf einer Plattform“ von „neu produziert“ unterscheiden. Kostenlos kann werbefinanziert sein; Preisbedingungen beim Dienst prüfen.                                                                                                                                     | Titel und passender Anbieter                                  |
| Suche / Merkliste / Fehlerseiten | Leere Zustände mit brauchbaren nächsten Schritten; Schreibvarianten, Land und Filter prüfen. Suchbegriff erhalten. Private Listen nicht indexieren. Echte unbekannte URLs liefern 404.                                                                                                                              | Erneute Suche, Filter zurücksetzen, Hilfe                     |

Keine Mindestwortzahl festlegen. Ein Impressum benötigt richtige Angaben; eine Entscheidungshilfe benötigt Begründungen. Mehr Text allein schafft keinen Mehrwert.

## 4. Datenschutz und Betreiber: bekannte Fakten, offene Fakten

**Bestätigt:** Wiresoft AG, Oberneuhofstr. 5, 6340 Baar, Schweiz; gewünschte Kontaktadresse support@cineradar.tv; kommerzielle TMDB-Nutzung und bestehende Veröffentlichung sind autorisiert. Vercel betreibt die Website, Neon die Anwendungsdatenbank in Frankfurt. Es bestehen lokale Merklisten und Anbieterpräferenzen. Das Kontextcookie speichert Sprache/Land. Kontaktanfragen werden in der Datenbank gespeichert; bestehende Bereinigung sieht höchstens 90 Tage vor.

**Vom Auftraggeber ausdrücklich vertagt:** Das Postfach support@cineradar.tv ist noch nicht eingerichtet. Kein erneutes Einrichtungsmandat und keine Behauptung, es sei bereits erreichbar. Bis zur Einrichtung sind gespeicherte Anfragen im Betriebsbereich zugänglich; eine belastbare Antwortbearbeitung ist noch zu organisieren.

**Vor dem vollständigen Servicestart klären:** Verantwortliche Person für eingehende Anfragen, erreichbarer Antwortkanal, realistische Bearbeitungszeiten, Vertretungsangaben der Gesellschaft, tatsächliche Protokoll-Aufbewahrung bei Dienstleistern, gültige Auftragsverarbeitungsvereinbarungen und konkrete Grundlagen internationaler Verarbeitung. Der Standort Frankfurt allein belegt nicht, dass sämtliche Verarbeitung in Deutschland stattfindet.

Die Datenschutzerklärung muss die tatsächliche Verarbeitung beschreiben. Besonders zu prüfen: IP-/Verbindungsdaten bei Vercel, Datenbankzugriffe, direkte Bildabrufe bei TMDB, ausgehende Anbieterlinks, Kontaktfelder, lokale Speicherung und notwendiges Administrationscookie. Angaben zu Rechtsgrundlagen und Auslandstransfers fachlich anhand dieser Datenflüsse präzisieren. [EDÖB: Datenschutzerklärungen im Internet](https://www.edoeb.admin.ch/de/datenschutzerklaerungen-im-internet), [EDÖB: Informationspflicht](https://www.edoeb.admin.ch/de/informationspflicht).

Das Kontaktformular braucht kein zusätzliches Werbeeinverständnis, um eine normale Anfrage entgegenzunehmen. Eine spätere Newsletter- oder Marketingfunktion wäre ein eigener Zweck. Keine Telefonnummer, Firmenadresse oder weiteren personenbezogenen Pflichtangaben sammeln, wenn sie für die Anfrage nicht benötigt werden.

## 5. SEO: Regeln und Beispiele

Jede indexierbare Seite braucht eine erkennbare Suchabsicht, einen präzisen Titel, eine individuelle Beschreibung, eine H1 und inhaltlich passende Links. Keine `meta keywords`, Keyword-Dichte-Vorgaben oder automatisch wiederholten Städtenamen. Google kann Titel und Snippets umschreiben; starre Zeichenlimits garantieren keine Darstellung. [Google: Titellinks](https://developers.google.com/search/docs/appearance/title-link), [Google: Snippets](https://developers.google.com/search/docs/appearance/snippet).

Beispiele für die redaktionelle Ausrichtung:

- Film: „Dune (2021) streamen: Anbieter in Deutschland | Cineradar“. Beschreibung: konkrete Suchabsicht, Abo/Leihe/Kauf und Land; Anbieter nur nennen, wenn die zugehörige Datenbasis das trägt.
- Serie: „Reacher streamen: Staffeln und Anbieter in Deutschland | Cineradar“. Inhalt muss die Staffelabdeckung tatsächlich beantworten.
- Vergleich: „JustWatch Alternative: Länder, Anbieter & Angebotsarten | Cineradar“. Kein unbelegter Testsieger.
- Kontakt: „Kontakt | Cineradar“. Beschreibung erklärt Anfragen und Fehlerberichte; keine Aufforderung, nach Filmen auf der Datenschutzseite zu filtern.

**URL- und Indexregeln:** Film- und Angebotsseiten behalten eindeutige Sprach-/Länderadressen. Englischer Einstieg verwendet USA; eine bewusste Länderwahl bleibt möglich. Vergleichsseiten sind redaktionell: `/wer-streamt-es`, `/fr/wer-streamt-es`, `/it/wer-streamt-es`, `/es/wer-streamt-es`, `/en/wer-streamt-es`. Jede Übersetzung hat einen eigenen Canonical und wechselseitige Sprachverweise. Keine automatische Länderänderung innerhalb redaktioneller Aussagen.

Suchzustände, persönliche Listen und Betriebsseiten nicht indexieren. Ausreichend ausgearbeitete Anbieter- und Themenseiten aufnehmen; leere Standardseiten nicht wegen eines attraktiven Keywords freigeben. Für marktunabhängige Infoseiten im nächsten SEO-Schritt je Sprache eine bevorzugte Fassung definieren, bevor alle 25 Länder-/Sprachkopien indexiert werden. Unterschiedliche landesspezifische Filmangebote dagegen nicht auf eine deutsche Fassung kanonisieren.

Die Sitemap enthält nur tatsächlich erreichbare kanonische Seiten. `lastmod` bezeichnet eine Inhaltsänderung, nicht den Zeitpunkt eines Seitenabrufs. 404-Status, Meta-Robots, HTTP-Header und robots.txt gemeinsam prüfen. [Google: internationale Websites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [Google: Canonicals](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## 6. Interne Verlinkung und Vergleichsseiten

Der Footer erschließt die wichtigsten Bereiche. Kontextlinks führen vom Film zum Anbieter und Genre, vom Anbieter zu passenden Titeln, von der Hilfe zur konkreten Funktion und vom Vergleichshub zu allen zehn Vergleichen. Jede wichtige Seite soll über normale HTML-Links erreichbar sein. Linktexte beschreiben das Ziel; nicht jedes Ziel heißt „Mehr“. [Google: crawlbare Links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

Die Vergleiche behandeln unterschiedliche Bedürfnisse: WerStreamt.es für Suche und Listen; JustWatch für Länder und Angebotsarten; PlayPilot für Entdeckung; Moviepilot für Community und Redaktion; TV Movie für den Streaming-Finder im Medienportal; Movie of the Night für Empfehlungen und gemeinsame Datenquelle; Reelgood für regionale Nutzbarkeit; Yidio für Suche und Erinnerungen; Plex ausschließlich für Discover/Watchlist; Trakt für Tracking gegenüber Angebotssuche.

Quellen und Prüfdatum werden je Aussage gepflegt. Preise, Regionen und Tarifgrenzen ändern sich nur nach erneuter Prüfung. Keine erneute Wettbewerbsrecherche beim Seitenabruf. Keine Serie bezahlter Datenabrufe allein wegen eines Vergleichsbesuchs. Cineradars lokale Liste, synchronisierte Kontoliste und automatische Benachrichtigungen bleiben drei unterschiedliche Dinge.

## 7. Linkvorschauen

| Seitentyp         | Bild und Text                                                        | Prüfung                                                             |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Startseite        | Vorhandene Kino-Bildwelt, Marke, kurze Aussage zur Suche             | Root-Weiterleitung und Ziel-URL bei Social-Crawlern nachvollziehbar |
| Film / Serie      | Tatsächliches Titelmotiv, lokaler Titel, Jahr und Land               | Zwei reale Titel, lange Titel und fehlendes Motiv testen            |
| Vergleich         | Cineradar-Bildwelt, konkrete Marke im Vergleich, eigener Schwerpunkt | Deutsch und Englisch sowie langer Markenname prüfen                 |
| Informationsseite | Seriöse Markenkarte mit korrektem Seitennamen                        | Datenschutz darf kein Film- oder Preisversprechen zeigen            |
| Anbieter / Thema  | Passende Seite erkennbar, kein erfundenes Anbieterlogo               | Anbietername beziehungsweise Genre und Land in der Karte prüfen     |

Open Graph und X benötigen zusammenpassende Titel, Beschreibung, URL und absolute öffentliche Bildadresse. Karten im Format 1200 × 630; Text darf am Rand nicht abgeschnitten werden. Bildantworten müssen ohne Anmeldung erreichbar sein. Bildfehler müssen aufgefangen werden. Externe Messenger können ältere Vorschauen zwischenspeichern; eine erfolgreiche Bildantwort allein belegt noch keine Cache-Aktualisierung in WhatsApp, LinkedIn oder Facebook. [Open Graph Protocol](https://ogp.me/).

## 8. Mobile Gestaltung und Bedienung

Einzeiliger Kopfbereich; mindestens 44 px große Hauptaktionen. Menü mit klarer Reihenfolge, sichtbarer Schließen-Aktion, Tastaturfokus, Escape und ausreichender Scrollhöhe. Länderwahl und Sprache dürfen nicht über das Logo oder die Suche rutschen. Footer-Gruppen behalten auf schmalen Displays ihre Hierarchie.

Informationsseiten verwenden ruhige Typografie, kurze Einleitungen, lesbare Zeilenlängen und echte Abschnitte. Kontaktfelder stehen mobil untereinander, mit mindestens 16 px Eingabeschrift. Tabellen erhalten einen begrenzten horizontalen Scrollbereich; die gesamte Seite darf dadurch nicht breiter werden. Kontraste und Fokuszustände prüfen. Bewegung respektiert reduzierte Animationen. Verifizieren bei 320, 390, 768 und Desktopbreite sowie vergrößertem Text; keine abgeschnittenen Formular- oder Menüaktionen.

## 9. Datenqualität und Betrieb

Der laufende Import ersetzt keine Qualitätsstichprobe. Aktuelle Titel sind nur ein Teil des Katalogs: Bei dieser Prüfung fehlten beispielsweise Inception und die konkrete Serie Dark in der bestehenden Titelsuche. Daher einen priorisierten Rückbestand für häufig gesuchte ältere Titel aufbauen; nicht nur neueste Veröffentlichungsjahre importieren. Die Beispielsuche der Vergleichsseiten verwendet vorhandene Titel.

Täglich überwachen: erfolgreiche Aktualisierungen je Markt, alternde Datenstände, fehlerhafte Jobs, ungültige Anbieterlinks, leere Suchergebnisse und Budgetverbrauch. Der gebuchte API-Tarif umfasst 100.000 monatliche Requests; bestehende Tagesgrenzen und Puffer bleiben wirksam. Seitenaufrufe sollen vorwiegend den eigenen Katalog lesen. Datenprüfung und Neuimport müssen sich das Budget geplant teilen.

Backups benötigen einen dokumentierten Wiederherstellungstest. Administrationszugang, Geheimnisse und interne Berichte bleiben geschützt. Ansprechpartner und Handlungsweg für Ausfälle festlegen. Keine vermeintliche Dauerüberwachung durch Codex zusagen; die bestehenden Hintergrundaufgaben laufen über den Hostingbetrieb.

## 10. Erfolgsmessung und Freigabe

Search Console nach dem Start für Impressionen, Klicks und Suchanfragen je Seitentyp nutzen. Bei Vergleichen Markensuche, Alternative und direkten Vergleich getrennt auswerten. Keine Rankinggarantie ableiten. Im aktuellen Projekt existiert keine eingerichtete Produktanalyse mit Consent-Verwaltung. Die Vergleichsseiten stellen lokale Ereignisse für Seitenaufruf und Suchstart bereit; diese sind noch kein ausgewerteter Conversion-Funnel. Einen späteren Empfänger samt Rechtsgrundlage, Datenschutztext und gegebenenfalls Einwilligung festlegen. Freitextsuchanfragen nicht an zusätzliche Analyseanbieter übertragen.

Ein vollständiger Start ist abgenommen, wenn:

1. Alle fünf Sprachen und unterstützten Länder funktionieren; englischer Einstieg zeigt USA.
2. Name, E-Mail, Betreff und Nachricht sind Pflichtfelder; ungültige Direktanfragen werden abgewiesen; vollständige Anfragen werden gespeichert.
3. Ein tatsächlich erreichbarer Kontaktkanal und eine zuständige Person sind eingerichtet. Dieser Punkt bleibt auf Wunsch des Auftraggebers vorerst offen.
4. Informationsseiten beantworten ihre Fragen und enthalten korrekte Betreiber- und Verarbeitungsangaben.
5. Alle 55 Vergleichs-URLs liefern den richtigen Inhalt, Status, Canonical, Sprachverweise und Share-Karten. Unbekannte URLs liefern 404.
6. Auf WerStreamt.es- und JustWatch-Vergleich ist die Suche über Film beziehungsweise Serie bis zum korrekten Anbieterlink geprüft.
7. Die mobile Ansicht hat keine Überläufe; Menü, Suchfeld, Tabelle, Formular und Footer sind bedienbar.
8. Titel- und Angebotsdaten bestehen die Marktstichprobe, einschließlich wichtiger älterer Titel.
9. Sitemap, interne Links, öffentliche Domain und Produktionsversion sind überprüft. Google-Indexierung wird später in Search Console bestätigt, nicht vorausgesetzt.

Die Reihenfolge ist verbindlich für die weitere Arbeit: erst verlässliche Nutzerwege und Inhalte, anschließend kontrolliert mehr Seiten und Messung. Ein optisch gefüllter Bildschirm ersetzt keinen beantworteten Nutzerbedarf.
