# Cineradar.tv — Masterprompt für ChatGPT Codex

**Projekt:** Cineradar · **Produktionsdomain:** https://cineradar.tv · **GitHub:** https://github.com/soheilxx/cineradar  
**Pflichtsprachen:** Deutsch, Französisch, Italienisch, Spanisch, Englisch · **Stand der Recherche:** 6. September 2026

## Verwendung

Verwende den gesamten Inhalt dieser Datei als Arbeitsauftrag für ChatGPT Codex im Repository `cineradar`. Die folgenden Abschnitte sind verbindliche Produkt-, Design-, Architektur- und Qualitätsanforderungen. Implementiere die Anwendung; liefere nicht nur einen Plan oder eine optische Demo. Die Quellen am Ende unterstützen die Umsetzung. Prüfe versionsabhängige Details bei Arbeitsbeginn erneut.

## 1. Deine Rolle und dein Auftrag

Du arbeitest als erfahrener Full-Stack-Engineer, UX/UI-Designer, technischer SEO-Spezialist und Verantwortlicher für Datenqualität und Betrieb. Entwickle Cineradar zu einer produktionsfähigen Plattform, die Menschen schnell beantwortet:

> Wo kann ich diesen Film oder diese Serie in meinem Land legal ansehen — mit meinen Abos, in meiner Sprache und zu welchen Konditionen?

Cineradar vergleicht Streamingangebote und führt zu den jeweiligen Anbietern. Cineradar hostet keine Filme. Verwende ausschließlich **Streaming Availability API von Movie of the Night** für Streamingangebote und **TMDb API** für Film- und Serienmetadaten. Zusätzliche Infrastruktur für Datenbank, Hosting oder Nachrichten ist erlaubt, soweit erforderlich und eingerichtet; weitere Inhalts- oder Streamingdatenanbieter dürfen nicht stillschweigend eingeführt werden.

Das Produkt soll durch verständliche Angebote, schnelle Suche, nützliche Filter, klare Länderzuordnung und erkennbare Aktualität einen messbaren Mehrwert gegenüber gewöhnlichen Streaming-Suchmaschinen bieten. Verwende werstreamt.es als funktionale Referenz für die Nutzeraufgabe. Kopiere weder dessen Gestaltung noch Texte, Datenbestand oder Marke. Behaupte keine objektive Überlegenheit ohne Untersuchung.

„Perfekt“ bedeutet hier: vollständig umgesetzte Kernabläufe, belastbare Datenverarbeitung, hochwertige Gestaltung, zugängliche Bedienung und nachgewiesene Abnahmekriterien. Erfinde keine Garantien für Rankings, API-Vollständigkeit, jedes denkbare Gerät oder die Darstellung durch fremde Messenger.

## 2. Arbeitsweise im Repository

1. Prüfe Repository, Branch, Arbeitsbaum, vorhandene Dateien, `AGENTS.md`, Projektanweisungen, Hosting und bestehende Geheimnisverwaltung. Das Zielrepository wurde bei Erstellung dieses Auftrags als `soheilxx/cineradar`, Standardbranch `main`, ohne Codebestand gemeldet. Prüfe den tatsächlichen Zustand erneut.
2. Bewahre bestehende Arbeit. Verwende den vorgesehenen Entwicklungsbranch beziehungsweise einen geeigneten Featurebranch. Keine destruktiven Resets, Force-Pushes, fremden Änderungen oder ungefragten Produktionsmigrationen.
3. Erstelle eine kompakte Umsetzungsplanung und eine Anforderungsmatrix mit den Kennungen aus Abschnitt 24. Beginne danach unmittelbar mit der Implementierung.
4. Entscheide reversible technische Details selbst und dokumentiere wesentliche Entscheidungen. Frage nicht wegen jeder Bibliothek, Komponente oder Farbe nach.
5. Arbeite bis zur getesteten, überprüfbaren Anwendung. Beende die Arbeit nicht nach Gerüst, Startseite, Mockdaten oder einzelnen Sprachversionen. Teilphasen sind Arbeitsschritte, keine stillschweigende Verkleinerung des Auftrags.
6. Wenn echte Zugangsdaten fehlen, vervollständige trotzdem Architektur, Migrationen, Adapter, Bedienoberfläche, Hintergrundjobs und Tests. Verwende klar getrennte lokale Testfixtures. Markiere Live-Integrationen und Veröffentlichung als noch nicht verifiziert, bis sie tatsächlich geprüft wurden.
7. Nenne unvermeidbare externe Voraussetzungen gesammelt und konkret: benötigtes Secret, zuständiger Dienst, Zweck und Einrichtungsweg. Niemals Schlüssel im Chat, in Screenshots, Logs oder Git anfordern beziehungsweise veröffentlichen.
8. Bereite eine ausführbare Vorschau und alle Deployment-Artefakte vor. Nutze bestehende Veröffentlichungsautorisierung; andernfalls ist die konkrete Produktionsveröffentlichung der letzte Freigabeschritt. Kaufe keine Domains, Tarife oder sonstigen Leistungen ohne entsprechende Autorisierung.
9. Pflege bei längerer Arbeit `docs/task-state.md` mit erledigten Anforderungen, offenen Punkten, Entscheidungen und nächstem konkreten Schritt. Setze nach einer Kontextunterbrechung dort fort.

## 3. Produktversprechen und messbarer Mehrwert

Die Kernaufgabe muss ohne Konto lösbar sein: suchen, passenden Titel erkennen, Angebote verstehen, Anbieter öffnen. Ein Konto darf zusätzliche Bequemlichkeit schaffen, aber den Vergleich nicht blockieren.

| Nutzerproblem | Verbindliche Lösung von Cineradar |
| --- | --- |
| „Ist der Titel in meinen Abos enthalten?“ | Persönliche Anbieterauswahl; Filter „In meinen Abos“; Zusatzkanäle werden gesondert behandelt. |
| „Warum steht hier kostenlos, obwohl ich zahlen muss?“ | Klare Trennung von Abo, Zusatzabo, kostenlos, Leihen und Kaufen; keine Gleichsetzung von Abo und gratis. |
| „Wo ist er am günstigsten?“ | Vergleich tatsächlich vergleichbarer Angebote nach Kaufart, Qualität, Währung und Film/Staffel/Folge. |
| „Welche Staffel ist verfügbar?“ | Staffelübersicht mit belegter Granularität; fehlende Episodeninformationen bleiben erkennbar. |
| „Kann ich auf Französisch schauen?“ | Filter für vorhandene Audio- und Untertitelinformationen, unabhängig von Sprache der Website. |
| „Lohnt sich die Suche heute?“ | Verständliche Aktualitätsangabe und Unterscheidung zwischen keinen Angeboten und unbekanntem Datenstand. |
| „Was schaue ich heute Abend?“ | Kurzer Entdeckungsablauf nach vorhandenen Abos, Film/Serie, Genre und verfügbarer Zeit. |
| „Wann kommt der Titel zu meinem Anbieter?“ | Merkliste mit Änderungen im gewählten Markt; Benachrichtigungen beruhen auf bestätigten Daten. |
| „Warum sieht mein geteilter Link falsch aus?“ | Titelbezogene, lokalisierte Vorschau mit eindeutigem Streaming-Land. |

Ziel für den Kernablauf: Von einer exakten Suche bis zum passenden Anbieterlink höchstens drei bewusste Interaktionen nach der Texteingabe. Überprüfe das an Film und Serie auf Mobilgerät und Desktop.

## 4. Sprachen, Streaming-Länder und Inhaltsgarantie

### 4.1 Sprache ist kein Verfügbarkeitsland

Implementiere zwei unabhängige Einstellungen:

- **Website-Sprache:** `de`, `fr`, `it`, `es`, `en`.
- **Streaming-Land:** standardmäßig Deutschland `DE`, Frankreich `FR`, Italien `IT`, Spanien `ES`, jeweils nach Prüfung der tatsächlichen API-Abdeckung und des Tarifs.

Diese vier Startmärkte sind eine begründete Projektvorgabe, da bislang keine separaten Zielländer genannt wurden. Weitere Länder wie Österreich und Schweiz müssen ohne Umbau des Datenmodells konfigurierbar sein. Aktiviere sie nach überprüfter Abdeckung und Kostenplanung; bewirb keine ungeprüften Länder.

Alle fünf Website-Sprachen müssen für jeden aktivierten Markt funktionieren. Französisch mit Deutschland als Markt zeigt deutsche Streamingangebote und französische Bedienung. Ein Sprachwechsel darf das Land nicht verändern. Ein Länderwechsel darf die Website-Sprache nicht verändern. Mache beide Einstellungen gut sichtbar und merke explizite Nutzerentscheidungen. Flaggen dürfen nicht allein als Sprachkennzeichnung dienen.

### 4.2 URL-Modell

Verwende als Standard `/{language}/{country}/...`, beide Segmente kleingeschrieben. Beispielsweise:

```text
/de/de/film/inception-27205/
/fr/de/film/inception-27205/
/fr/fr/film/inception-27205/
/it/it/film/inception-27205/
/es/es/pelicula/origen-27205/
/en/de/movie/inception-27205/
```

Slugs in Beispielen sind illustrativ; leite echte Titel und Slugs aus verifizierten Metadaten ab. Die ID und der Medientyp identifizieren die Entität dauerhaft. Ein geänderter lokalisierter Titel erhält eine gezielte permanente Weiterleitung vom alten Slug. Ein reiner Zufallstitel mit angehängter existierender ID darf keine zusätzliche indexierbare URL erzeugen.

Lege eine zentrale übersetzte Routenregistrierung an. Übersetze URL-Pfade kontrolliert, nicht bei jedem Rendern neu. Stelle unter `/` eine stabile internationale Einstiegsseite mit Sprach-/Länderwahl bereit. Kurze Sprachpfade wie `/de/` leiten eindeutig auf den dokumentierten Standardmarkt weiter. Vermeide automatische, erzwungene IP- oder Browser-Sprachweiterleitungen. Eine freiwillige Empfehlung ist erlaubt.

Ein öffentlicher URL muss für Nutzer und Crawler dieselbe Sprache und denselben Markt bestimmen. Cookies oder IP-Adresse dürfen keine abweichenden öffentlichen Angebote unter unverändertem URL erzeugen. Details zu internationalem SEO: [Google: mehrsprachige und regionale Websites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites).

### 4.3 Wirklich vollständige Lokalisierung

Übersetze Navigation, Suche, Filter, Schaltflächen, Dialoge, Fehler, Leerzustände, Statusmeldungen, Hilfe, rechtliche Seiten, redaktionelle Inhalte, Metadaten, OG-Texte, Bildalternativen, E-Mails und barrierefreie Beschriftungen. Kein pauschaler englischer Fallback für normale Inhaltsabschnitte.

Verwende typisierte Übersetzungsschlüssel, ICU-Pluralformen und `Intl` für Zahlen, Geld, Datum und Zeit. Originaltitel, Personennamen, Markennamen und verbindliche Lizenzhinweise sind legitime Ausnahmen. Verwende weder erfundene offizielle Titel noch automatische Umbenennungen von Streamingdiensten.

Für Film- und Serienbeschreibungen gilt diese Kette:

1. Passende TMDb-Übersetzung abrufen und validieren.
2. Fehlt sie, vorhandene, rechtmäßig nutzbare Beschreibung über einen konfigurierten Übersetzungsadapter übersetzen; Ergebnis einmalig speichern und bei Quellenänderung invalidieren. Keine Übersetzung bei jedem Seitenaufruf.
3. Ist kein Übersetzungsdienst eingerichtet oder sind Nutzungsrechte unklar, liefere eine natürliche, lokalisierte Faktenzusammenfassung aus gesicherten Daten und einen verständlichen Hinweis zur fehlenden Inhaltsbeschreibung. Erfinde keine Handlung.

Damit bleibt jeder Titel in jeder Sprache nutzbar. Indexierbarkeit wird davon getrennt nach tatsächlichem Seitenwert bewertet. Redaktionelle Artikel werden erst öffentlich veröffentlicht, wenn alle fünf Sprachfassungen vollständig vorliegen. Fehlende normale UI-Schlüssel müssen den Build beziehungsweise die CI-Prüfung fehlschlagen lassen. Die Lokalisierungsmöglichkeiten von TMDb weisen Lücken auf; berücksichtige diese ausdrücklich. [TMDb: Sprachen](https://developer.themoviedb.org/docs/languages).

## 5. Informationsarchitektur und vollständige Seiten

Implementiere mindestens die folgenden Seitentypen inklusive Lade-, Fehler-, Leer- und Erfolgszuständen:

| Seitentyp | Inhalt und Hauptaktion |
| --- | --- |
| Internationale Einstiegsseite | Land und Sprache auswählen, direkt zur passenden Startseite gelangen. |
| Lokalisierte Startseite | Prominente Suche, eigene Anbieter, passende Entdeckungen, neue und auslaufende Angebote. |
| Suche | Filme/Serien erkennen, Originaltitel und alternative Titel finden, relevante Ergebnisse filtern. |
| Filmübersicht / Serienübersicht | Nutzbare Filter, klare Sortierung, serverseitig paginierte Ergebnisse. |
| Filmdetail | Sofortige Streamingantwort und verständlicher Angebotsvergleich. |
| Seriendetail | Serieninformationen und Verfügbarkeit nach Staffel, soweit belegt nach Episode. |
| Anbieterübersicht / Anbieterdetail | Anbieter im gewählten Land, dessen verfügbare Titel und belegte Angebotsarten. |
| Themen- und Genreseiten | Hilfreiche, bewusst kuratierte Einstiege mit realem Angebot. |
| Neu verfügbar / Läuft bald aus / Kostenlos | Datenbasierte Listen mit klarer Definition der jeweiligen Eigenschaft. |
| Heute-Abend-Finder | Kurzer Filterablauf, wenige passende Titel, nachvollziehbare Empfehlung. |
| Merkliste / Meine Anbieter | Lokal nutzbare Speicherung, Sortierung, Verfügbarkeitsänderungen. |
| Über Cineradar / Daten und Aktualität | Funktionsweise, Quellen, Abdeckung, Bewertung und Grenzen. |
| Hilfe / Kontakt / Fehler melden | Funktionierender Kontakt- oder Meldeweg, keine Erfolgsmeldung ohne Speicherung. |
| Impressum / Datenschutz / Credits | Tatsächliche Betreiberangaben und passende Hinweise in allen Sprachen. |
| 404 / vorübergehender Fehler | Lokalisierte Erklärung und sinnvoller Weg zurück. |
| Geschützter Betriebsbereich | Jobs, API-Budget, Datenzustand, Meldungen und gezielte Korrekturen. |

Personen-, Einzel-Episoden-, News- und endlose Kombinationsseiten sind keine automatische Pflicht. Erzeuge sie erst, wenn sie eine eigenständige Nutzeraufgabe erfüllen und das Qualitätsverfahren bestehen. Die Kernseiten dürfen dadurch nicht verzögert werden.

## 6. UX der wichtigsten Abläufe

### 6.1 Startseite

Auf einem typischen mobilen ersten Bildschirm müssen Marke, Suche und aktuelles Streaming-Land erkennbar sein. Ein riesiges Poster oder ein Werbebanner darf die Suche nicht verdrängen.

Reihenfolge: kompakter Header; prägnanter Nutzen; großes Suchfeld; leicht verständliche Anbieterwahl; erste passende Titel; anschließend weitere Entdeckungsbereiche. Verwende echte Daten, sinnvolle Gruppierungen und wenige klar benannte Abschnitte. Keine austauschbare Marketingseite mit langen Featuretexten.

Beispieltexte, sprachlich bei der Umsetzung zu verfeinern:

| Sprache | Leitgedanke | Suchfeld |
| --- | --- | --- |
| DE | Dein nächster Filmabend beginnt hier. | Film oder Serie suchen |
| FR | Votre prochaine soirée cinéma commence ici. | Rechercher un film ou une série |
| IT | La tua prossima serata cinema inizia qui. | Cerca un film o una serie |
| ES | Tu próxima noche de cine empieza aquí. | Buscar película o serie |
| EN | Your next movie night starts here. | Search for a movie or TV series |

Anbieterauswahl ist optional. Ohne Auswahl gibt es eine überzeugende allgemeine Startseite. Kennzeichne „beliebt auf TMDb“, „Topliste eines Anbieters“ und „häufig auf Cineradar geöffnet“ eindeutig, falls diese unterschiedlichen Daten tatsächlich verwendet werden. Keine erfundenen Nutzerzahlen oder Beliebtheitssignale.

### 6.2 Suche

Unterstütze lokalisierte Titel, Originaltitel, alternative Titel, Jahreszahlen, Akzente und tolerante Schreibfehler. Priorisiere exakte Titel, dann Alternativtitel, dann unscharfe Treffer. Zeige Poster, Titel, Jahr, Film/Serie und belastbare Anbieterhinweise. Trenne gleichnamige Filme, Remakes und Serien.

Autocomplete muss mit Tastatur, Touch und Screenreader funktionieren. Nutze sinnvolles Debouncing, abbrechbare Anfragen und Schutz vor veralteten Antworten. Enter öffnet eine echte, teilbare Suchergebnisseite; Zurück erhält Suchzustand und Scrollposition. Suchbegriffe sind keine URL-Pfade für beliebig erzeugte SEO-Seiten.

### 6.3 Film- und Seriendetail

Die obere Inhaltszone beantwortet Titel, Jahr, Streaming-Land und Angebotslage. Der Angebotsblock steht vor langen Handlungstexten, Cast und Empfehlungen. Auf Mobilgeräten helfen Anker wie „Angebote“, „Staffeln“, „Infos“; feste Elemente dürfen Inhalte und Fokus nicht verdecken.

Angebotskarten zeigen Anbietername und echtes Logo, Angebotsart, Zusatzkanal, verfügbaren Preis mit Währung, belegte Qualität und verfügbare Sprachinformationen. Ein klarer Link führt zum konkreten Angebot. Verwende „Zum Anbieter“ oder eine lokalisierte präzise Aktion. Behaupte keinen kostenlosen Direktstart oder vorhandenen Nutzervertrag.

Nutze spezifische App-Deep-Links nur, wenn die Quelle und das Zielgerät sie nachweislich unterstützen; erhalte immer einen funktionierenden HTTPS-Weg. Kennzeichne das Verlassen von Cineradar verständlich. Ein verschachtelter Merklisten-Button darf keine ungültige interaktive Kartenstruktur erzeugen.

Bei Serien werden Staffel- und Episodenangaben nur so genau dargestellt, wie die Quelle sie belegt. Eine Serienverfügbarkeit beweist nicht, dass sämtliche Staffeln enthalten sind. Staffelpreise sind keine Episodenpreise. Ein Fernsehausstrahlungsdatum ist keine bestätigte Streamingveröffentlichung.

### 6.4 Merkliste und Entdecken

Die Merkliste funktioniert zunächst ohne Anmeldung auf dem aktuellen Gerät. Weise verständlich auf diese Reichweite hin. Speichere Titelidentität, Datum, ausgewählten Markt und optionale Zielanbieter. Biete Entfernen, Sortieren, leere Zustände und Anzeige aktueller Änderungen.

Der Heute-Abend-Finder verwendet vorhandene Anbieter, Medientyp, Laufzeit und Genres. Empfehlungen müssen zu den ausgewählten Kriterien passen; erklärbare Regeln reichen aus. Verwende keine angeblich KI-generierten Präferenzen ohne Grundlage. Wenn nichts passt, zeige nachvollziehbare Möglichkeiten zur Lockerung der Filter.

Implementiere eine kontounabhängige Ansicht der Änderungen für gespeicherte Titel. Geräteübergreifende Konten und E-Mail-Benachrichtigungen sind Erweiterungen mit realer Authentifizierung und Zustellung, falls die dafür nötigen Dienste eingerichtet werden. Bewirb diese Erweiterungen erst, wenn sie tatsächlich funktionieren. Der gesamte Such- und Vergleichsdienst bleibt ohne sie vollständig.

## 7. Verbindliches UX/UI-Design: modernes Kinogefühl

Entwickle ein eigenständiges, hochwertiges Erscheinungsbild: dunkler Kinosaal, Licht auf der Leinwand, starke Filmkunst und ruhige Informationshierarchie. Die Oberfläche muss bei Tageslicht und auf kleinen Displays lesbar bleiben.

### 7.1 Designsystem

| Element | Vorgabe |
| --- | --- |
| Hintergrund | Tiefes, leicht bläuliches Anthrazit, Ausgangspunkt `#090B10`. |
| Flächen | Abgestufte Oberflächen, Ausgangspunkte `#121720` und `#1A2130`. |
| Primärtext | Warmes Weiß, Ausgangspunkt `#F5F5F1`. |
| Sekundärtext | Helles, gut lesbares Grau; tatsächliche Kontraste prüfen. |
| Hauptakzent | Warmes Kinogold, Ausgangspunkt `#F6C76B`, für zentrale Aktionen mit dunkler Schrift. |
| Statusfarben | Sparsame, unterscheidbare Farben; Bedeutung zusätzlich durch Text oder Symbol. |
| Typografie | Gut lesbare Sans-Serif, maximal zwei lizenzierte, möglichst selbst gehostete Schriftfamilien. |
| Abstände | Konsistentes Raster; fließende Abstände; ausreichend Luft im Angebotsvergleich. |
| Formen | Dezente Rundungen und Konturen; keine übermäßig großen Pillen für alle Inhalte. |
| Bewegung | Kurze Übergänge von ungefähr 160–240 ms; reduzierte Bewegung vollständig respektieren. |

Diese Farben sind Startwerte, keine ungeprüfte Kontrastgarantie. Lege Design-Tokens für Farben, Typografie, Abstände, Ebenen, Fokus, Radien und Schatten an. Verwende sie konsistent in allen Komponenten.

Entwirf eine klare Wortmarke „Cineradar“ und ein einfaches, auch als Favicon erkennbares Zeichen mit Bezug zu Film und Entdeckung. Verwende für das Zeichen vorzugsweise eigenes SVG. Vermeide Kopien fremder Logos. Anbieterlogos werden hingegen unverfälscht und aus erlaubten Quellen verwendet.

### 7.2 Layout und Bildsprache

Nutze Filmplakate im passenden Seitenverhältnis, große Backdrops nur dort, wo sie Orientierung und Stimmung schaffen, sowie dunkle Verläufe als Lesbarkeitshilfe. Texte dürfen nie von der Helligkeit eines zufälligen Bildes abhängig sein. Zeige keine sinnlosen dekorativen Charts, animierten Radarflächen oder automatisch laufenden Trailer.

Detailseiten dürfen eine atmosphärische Bildfläche haben, müssen aber Titel und Angebote schnell sichtbar machen. Poster bleiben erkennbar. Fehlende Bilder erhalten einen gestalteten Ersatz mit Titel oder Markenzeichen; niemals ein kaputtes Bildsymbol. Passe Bildausschnitte und OG-Kompositionen an lange französische, italienische, deutsche und englische Titel an.

Mobile zuerst entwickeln, dann gezielt erweitern. Prüfe mindestens 320, 360, 390, 768, 1024, 1440 und 1920 CSS-Pixel Breite. Verwende flexible Grids, sinnvolle maximale Inhaltsbreiten und Container Queries, wo sie helfen. Kein horizontaler Seitenüberlauf. Angebotsvergleiche werden mobil zu verständlichen Karten; Staffeltabellen dürfen kontrolliert scrollen und benötigen erkennbare Beschriftungen.

Desktop kann Filter seitlich anzeigen. Mobil sind zugängliche Filterdialoge mit sichtbarer Trefferzahl, Zurücksetzen und Übernehmen sinnvoll. Sticky-Navigation berücksichtigt Safe Areas, Bildschirmtastatur und Fokus. Keine wesentliche Funktion darf ausschließlich per Hover erreichbar sein.

### 7.3 Barrierefreiheit

Ziel ist **WCAG 2.2 AA**. Setze semantische Elemente, sinnvolle Überschriften, Skip-Link, sichtbaren Tastaturfokus, beschriftete Formulare und verständliche Fehlermeldungen um. Dialoge benötigen Fokusmanagement, Escape und korrekte Rückgabe des Fokus. Screenreader erhalten sinnvolle Statusmeldungen ohne ständige Unterbrechungen.

Prüfe normalen Text auf mindestens 4,5:1 und großen Text auf mindestens 3:1 Kontrast. Bedienelemente und Fokuszustände müssen ebenfalls die jeweils geltenden Anforderungen erfüllen. Verwende als ergonomisches Produktziel möglichst mindestens 44 × 44 CSS-Pixel für Touchflächen; verwechsle dies nicht mit dem allgemeinen Mindestmaß der AA-Regel. Prüfe 200 % Zoom und Reflow. [W3C: WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/).

## 8. Technische Architektur

Wenn das Repository noch keine tragfähige Architektur enthält, verwende diesen Standard:

- Aktuell unterstütztes, stabiles **Next.js mit TypeScript im Strict-Modus**, App Router, serverseitiger Ausgabe der öffentlichen Inhalte und gezielter inkrementeller Aktualisierung.
- `next-intl` oder eine gleichwertige, nachweislich kompatible i18n-Lösung; zentrale Routen- und Metadatenfunktionen.
- CSS-Design-Tokens mit Tailwind CSS oder einer konsistenten, schlanken CSS-Struktur. Zugängliche Komponentenprimitive statt selbst erfundener problematischer Dialogsteuerung.
- **PostgreSQL** als dauerhafter Datenspeicher, mit migrationsfähigem ORM beziehungsweise Query-Builder. Wähle eine Lösung und begründe sie knapp.
- Dauerhafte Jobqueue und echter Scheduler. Bevorzuge eine PostgreSQL-basierte Queue, wenn dadurch zusätzliche Infrastruktur entfällt; Redis ist bei begründetem Bedarf möglich.
- Ein serverseitiger Zugriffslayer für beide externen APIs, ein normalisiertes internes Modell und eine davon getrennte Darstellung.
- Suchindex zunächst auf PostgreSQL mit geeigneter Volltext-/Trigrammsuche; separate Suchinfrastruktur erst bei nachgewiesenem Bedarf.

Prüfe vor Installation aktuelle offizielle Framework-Dokumentation, Sicherheitsmeldungen und Kompatibilität. Pinne reproduzierbare Versionen über Lockfile und dokumentiere Runtime und Paketmanager. Verwende vorhandene geeignete Infrastruktur weiter. Keine Microservices ohne konkreten Nutzen und kein ausschließlich clientseitiges SPA für indexierbare Inhalte.

Trenne mindestens `domain`, `data/providers`, `data/repositories`, `jobs`, `i18n`, `seo`, `ui` und `observability` logisch. Ein externer API-Wechsel darf keine komplette UI-Umschreibung erfordern. Die öffentliche Seite liest normalerweise aus dem normalisierten Datenbestand; ein Besucher löst nicht unkontrolliert kostenpflichtige Abfragen aus.

## 9. Die beiden APIs korrekt anbinden

### 9.1 Streaming Availability API

Bei Recherche beschreibt die offizielle OpenAPI-Datei Version **4.1.0**. Für direkte Schlüssel nennt sie `https://api.movieofthenight.com/v4` und den Header `X-API-Key`. RapidAPI hat einen eigenen Zugang. Wähle anhand der tatsächlich bereitgestellten Zugangsdaten den passenden Modus; vermische Hosts und Authentifizierung nicht. Prüfe beim Start den aktuellen Vertrag.

Die dokumentierten Ressourcen umfassen `GET /countries`, `/countries/{country-code}`, `/genres`, `/shows/{id}`, `/shows/search/title`, `/shows/search/filters`, `/shows/top` und `/changes`. Externe TMDb-Identitäten werden mit `movie/{id}` beziehungsweise `tv/{id}` unterschieden. Nutze generierte oder sauber typisierte Clients und korrekte Pfadbehandlung, statt Endpunkte zu erraten.

**Wichtig:** Die geprüfte Spezifikation erlaubt für `output_language` `en`, `es`, `tr`, `fr`; Deutsch und Italienisch stehen dort nicht. Verwende die API primär für strukturierte Angebote und lokalisiere Labels selbst. Seriengranularität und Suchparameter müssen zum jeweiligen Endpunkt passen. [Offizielle OpenAPI-Spezifikation](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml).

Die dokumentierten Fähigkeiten umfassen Abo, kostenlos, Kauf, Leihe, Zusatzkanäle, Deep Links, Qualitäts-/Sprachinformationen und Veränderungen an Katalogen. Nicht jedes Feld ist für jedes Angebot vorhanden. Prüfe die reale Unterstützung für Länder, Dienste, kommende Titel und Serienebenen. Übernimm keine feste Anbieterzahl aus Marketingtexten. [Offizielle Funktionsbeschreibung](https://github.com/movieofthenight/streaming-availability-api).

Erstelle `docs/api-contract.md`: verwendete Version, Dokumentationsdatum, Zugangstyp, Endpunkte, Parameter, nullable Felder, Pagination, Tarifgrenzen, tatsächliche Abdeckung und bekannte Einschränkungen. Ergänze anonymisierte, lizenzkonforme Testfixtures für die verwendeten Antwortformen. Eine erfolgreiche HTTP-Antwort genügt nicht als Validierung ihres Inhalts.

### 9.2 TMDb

Nutze TMDb für Titel, Originaltitel, Übersetzungen, Beschreibungen, Poster/Backdrops, Genres, Laufzeiten, Veröffentlichungsangaben, Cast, Crew, Staffel-/Episodenstruktur und externe IDs, jeweils soweit vorhanden. Konfiguriere Sprachparameter explizit; trenne sie vom Streaming-Land. Hole nur tatsächlich benötigte Felder und Detailtiefe.

Bilde Bild-URLs anhand der TMDb-Konfiguration und erlaubter Bildgrößen. Nutze passende responsive Varianten, sichere Ursprünge und lokalisierte Bilder, wo vorhanden. Originalsprachige oder sprachneutrale Artwork-Fallbacks sind möglich; sie ersetzen keine übersetzten Bedientexte. [TMDb: Einstieg](https://developer.themoviedb.org/docs/getting-started), [Bild-URLs](https://developer.themoviedb.org/docs/image-basics).

TMDb-Veröffentlichungsregion, Filmoriginalsprache und Streamingverfügbarkeit sind unterschiedliche Eigenschaften. Nutze TMDb nicht stillschweigend als zweite Quelle für Streamingangebote. Stelle TMDb-Bewertungen immer als externe Bewertungen dar, inklusive nachvollziehbarer Skala und Stimmenzahl. Erfinde keine Cineradar-Rezensionen.

## 10. Datenmodell und Regeln für Wahrheit

Lege ein explizites, normalisiertes Datenmodell mit Migrationen, Indizes und referenzieller Integrität an. Mindestens erforderlich sind:

| Bereich | Wesentliche Daten |
| --- | --- |
| Titel | Interne ID, Medientyp, TMDb-ID, Streaming-API-ID, IMDb-ID falls vorhanden, Fakten. |
| Lokalisierung | Titel-ID, Sprache, lokalisierter Titel, Beschreibung, Slug, Übersetzungsquelle/-status, Quellenhash. |
| Serie | Staffeln und gegebenenfalls Episoden, jeweils mit stabiler Identität. |
| Land und Anbieter | ISO-Land, Dienst-ID, lokalisierbare Darstellung, unterstützte Angebotsarten und Zusatzkanäle. |
| Angebot | Titel/Staffel/Episode, Land, Anbieter, Zusatzkanal, Typ, Link, Qualität, Audio, Untertitel, Preis, Währung. |
| Datenstand | Quelle, zuletzt erfolgreich geprüft, Quellenzeit falls geliefert, Ablaufdatum falls belegt, Validierungsstatus. |
| Änderung | Belegter Angebotswechsel, betroffene Entität, Zeitpunkt, Ereigniskennung für Deduplizierung. |
| Betrieb | Job, Cursor, Synchronisationslauf, Budgetverbrauch, Fehler, Heartbeat, Audit-Ereignis. |
| Eigene Inhalte | Fünf Sprachfassungen, Autor/Verantwortung, Revision, Veröffentlichungs- und Aktualisierungsstatus. |

Der eindeutige Schlüssel für TMDb-Entitäten ist **Medientyp plus ID**, niemals die Zahl allein. Mappe `series` und `tv` ausdrücklich. Titelähnlichkeit darf ohne eindeutigen Beleg keine automatische Zusammenführung auslösen. Bei fehlender externer Zuordnung bleibt ein Datensatz aus indexierbaren Titelzusammenführungen ausgeschlossen und wird überprüfbar protokolliert.

Behandle auch Anbieter-, Genre-, Staffel- und Episodenkennungen als quellenspezifisch. Gleiche Zahlen oder ähnlich geschriebene Labels aus unterschiedlichen APIs sind keine automatische Identitätsgarantie. Dokumentiere explizite Zuordnungen und verwende dafür stabile interne Kennungen.

Verfügbarkeitszustand und Aktualitätszustand sind getrennte Dimensionen. Unterscheide mindestens: bestätigte Angebote; erfolgreiche Prüfung ohne Angebote bei den erfassten Diensten; Markt/Dienst nicht unterstützt; noch nicht geprüft; Fehler bei letzter Prüfung. Zusätzlich kann der letzte bestätigte Datenbestand frisch oder veraltet sein.

Verwende bei einer erfolgreichen leeren Antwort beispielsweise „Bei den von uns erfassten Anbietern derzeit kein Angebot gefunden“. Bei Ausfall passt „Die Verfügbarkeit konnte zuletzt nicht aktualisiert werden“. Ein Timeout, fehlender Datensatz oder eine unvollständige Antwort ist kein Beweis für Nichtverfügbarkeit.

Preise werden als Decimal oder in geeigneten kleinsten Währungseinheiten gespeichert, nicht als unpräzise Gleitkommazahlen. Vergleiche nur gleiche Länder, Währungen, Angebotsarten und Einheiten. Unbekannter Preis bleibt unbekannt. Eine Abo-Verfügbarkeit erhält keinen erfundenen Einzelpreis von null. Ein Zusatzkanal zählt nur dann zu „meinen Abos“, wenn der Nutzer ihn tatsächlich ausgewählt hat.

Speichere beobachtete Erfassung und behaupteten Angebotsbeginn separat. Bekannte künftige Start-/Endzeitpunkte benötigen Quelle und Genauigkeit. Keine sekundengenauen Countdowns aus bloßen Tagesangaben. Binde bekannte abgelaufene Angebote nach Ablauf nicht weiter als aktuell ein; behalte einen nachvollziehbaren Status bis zur erneuten Prüfung.

## 11. Auto-Mode: dauerhafter, kontrollierter Datenbetrieb

„Auto-Mode“ bedeutet: Nach einmaliger Einrichtung von Zugangsdaten, Tarif, Hosting und Scheduler aktualisiert sich das System ohne tägliche manuelle Eingriffe. Es bedeutet keine unbegrenzten API-Kosten und keine ungeprüfte automatische Veröffentlichung beliebiger Inhalte.

### 11.1 Bootstrap und laufende Aktualisierung

Implementiere einen wiederholbar ausführbaren Initialimport für einen sinnvollen Bestand populärer Filme, Serien und Anbieter in den Startmärkten. Importiere in begrenzten Batches und erweitere den Katalog kontrolliert über Trends, Änderungen und tatsächlich nachgefragte Titel. Lade nicht pauschal den gesamten TMDb-Bestand samt Episoden.

| Job | Ausgangstakt; am realen Tarif und an der Quellenaktualität ausrichten |
| --- | --- |
| Länder-/Anbieterkonfiguration | Täglich prüfen; erfolgreiche Ergebnisse zwischenspeichern. |
| Angebotsänderungen | Alle 6 Stunden, sofern unterstützte Endpunkte und Budget dies sinnvoll erlauben. |
| Vollständiger Abgleich wichtiger Titel | Täglich; Priorität für gefragte Titel und bekannte Ablaufereignisse. |
| Weniger nachgefragter Katalog | Rollierend nach Priorität und verfügbarem Budget. |
| TMDb-Trends / Kandidaten | Täglich in begrenzten Batches. |
| Stabile Metadaten | Wöchentlich oder nach überprüften Änderungssignalen; aktive Serien gezielter. |
| Lokalisierungen | Bei neuen/geänderten Quellen, mit Warteschlange und Inhalts-Hash. |
| Abgeleitete Seiten / Cache / OG | Nach relevanter erfolgreicher Änderung gezielt invalidieren. |
| Betriebsprüfung | Regelmäßig Job-Heartbeat, Queue, Budget und Alter der Daten prüfen. |

Die Takte sind konfigurierbare Projektdefaults und keine Zusicherung der Datenquelle. Häufigere Abfragen machen upstream unveränderte Daten nicht aktueller. Dokumentiere erwartete Frische je Titelklasse; weise beispielsweise nach 36 Stunden auf einen überfälligen täglichen Abgleich hin. Definiere einen zusätzlichen, konfigurierbaren Grenzwert, ab dem Angebote deutlich als veraltet erscheinen. Länger getaktete Katalogklassen benötigen passende eigene Grenzwerte.

### 11.2 Robuste Synchronisation

Jobs müssen idempotent, wiederaufnehmbar, zeitlich begrenzt und gegen parallele Doppelverarbeitung geschützt sein. Verwende eindeutige Jobschlüssel, Locks mit Ablauf, Heartbeats, begrenzte Wiederholungen, exponentiellen Backoff mit Jitter und eine Fehlerwarteschlange. Respektiere `Retry-After`; unterscheide 401/403, 404, 429, 5xx, Timeouts und Schemafehler.

Arbeite Cursor-Pagination vollständig ab. Fixiere Zeitfenster, verwende einen kleinen Überlappungsbereich und dedupliziere Ereignisse. Speichere Watermarks erst, wenn die zugehörigen Daten erfolgreich verarbeitet und committed sind. Ein abgebrochener Lauf darf keinen Datenverlust und keine unendliche Rückschleife verursachen.

Entferne Angebote nur aufgrund eindeutiger Löschereignisse oder eines nachweislich vollständigen, erfolgreichen Abgleichs desselben Bereichs. Eine fehlende Zeile auf Seite eins oder ein einzelner fehlgeschlagener Abruf darf keine Massenlöschung auslösen. Überprüfe auffällige plötzliche Einbrüche und quarantäniere fragliche Änderungen. Ungültige Datensätze dürfen gute, zuletzt bestätigte Daten nicht überschreiben.

### 11.3 Kosten und Kapazität

Lege je Dienst ein Budgetmodell mit Tages-/Monatskontingent, Abrechnungsperiode, Reset-Zeit, Parallelitätsgrenze und gewichteten Kosten je Endpunkt an. Nicht jede Anfrage kostet zwingend eine Einheit. Berücksichtige auch Pagination, Erstimport, Metadaten in fünf Sprachen, Übersetzungen und Bild-/Hostingkosten.

Berechne vor Aktivierung:

```text
Monatliche Einheiten = Summe über alle Jobs:
  Läufe pro Monat × erwartete Seiten/Anfragen pro Lauf × Tarifgewicht
  + Initialimport + bedarfsabhängige Abrufe + begrenzte Wiederholungen
```

Implementiere einen konfigurierbaren Sicherheitspuffer, zum Beispiel 20 %. Reserviere Budget atomar vor dem Abruf, damit parallele Worker es nicht überschreiten. Bei knappen Kontingenten werden unwichtige Jobs gedrosselt oder pausiert; die Website bleibt mit kenntlich gemachtem Datenstand nutzbar. Kein automatisches kostenpflichtiges Tarifupgrade.

Vermeide fünf identische Angebotsabfragen für fünf Website-Sprachen. Länderspezifische Angebote und sprachabhängige Metadaten werden getrennt gespeichert. Wenn ein dokumentierter Abruf mehrere relevante Länder enthält, verwende diese Daten sinnvoll, statt identische Abrufe zu vervielfachen.

Liefere `budget:estimate` beziehungsweise ein gleichwertiges ausführbares Verfahren, einen Dry-Run des Imports und eine Übersicht der realen Kostenannahmen. Ist das Kontingent unbekannt, aktiviere einen konservativen begrenzten Entwicklungsmodus und kennzeichne den Produktions-Auto-Mode als noch nicht konfiguriert.

## 12. Serverausgabe, Suche und Caching

Öffentliche Titel- und Übersichtsseiten liefern Hauptinhalt, Angebote beziehungsweise ehrlichen Status, Metadaten und strukturierte Daten bereits als serverseitig erzeugtes HTML. Verlasse dich für SEO oder Linkvorschauen nicht auf nachträgliches Browser-JavaScript.

Cache-Schlüssel berücksichtigen mindestens Entität, Sprache, Streaming-Land, relevante Filter, Datenrevision und Berechtigungsbereich. Persönliche Abos und Merklisten dürfen niemals in einen öffentlichen CDN-Cache oder ein öffentliches OG-Bild geraten. Die öffentliche Grundseite bleibt stabil; persönliche Sortierung kann in einem privaten Bereich beziehungsweise nachgelagert im Browser erfolgen.

Nutze gezieltes Caching mit Hintergrundaktualisierung, Request-Zusammenfassung für denselben Titel, Schutz vor gleichzeitigen Cache-Neuberechnungen und begrenztes negatives Caching. Cache-Invalidierung folgt Änderungen an Angeboten, Übersetzungen und Slugs. Alte URLs werden nicht durch stale Cache-Inhalte dauerhaft wiederbelebt.

Suche primär im eigenen Index. Für noch nicht importierte Titel ergänze eine kontrollierte serverseitige Suche über die freigegebenen APIs mit Rate Limit, Timeout, Cache und Budgetprüfung. Verwechsle „im lokalen Index nicht vorhanden“ nicht mit „existiert nicht“. Importiere bestätigte neue Treffer asynchron; liefere bis zur vollständigen Aufbereitung einen transparenten Zustand. Keine unbeschränkte externe Suche je Tastendruck und keine API-Fan-outs je Posterkarte.

Die Kernseite muss bei Ausfall einer Quelle mit zuletzt bestätigten Daten sinnvoll funktionieren. Wenn keine belastbaren Daten existieren, erkläre die Einschränkung. Weder Marketingtexte noch strukturierte Daten dürfen in diesem Zustand Aktualität vortäuschen.

## 13. SEO-Strategie und Suchintentionen in fünf Sprachen

Organischer Traffic entsteht durch richtige Antworten und gute Auffindbarkeit. Behandle die folgenden Begriffe als **zu validierende Suchintentionen**, nicht als gemessene Suchvolumina. Erfinde weder Keywordzahlen noch Rankingversprechen. Nutze nach Launch echte Search-Console-Daten zur Priorisierung.

| Suchintention | DE | FR | IT | ES |
| --- | --- | --- | --- | --- |
| Konkreten Film finden | wo läuft [Titel]; [Titel] streamen | où regarder [titre]; [titre] en streaming | dove vedere [titolo]; [titolo] in streaming | dónde ver [título]; [título] en streaming |
| Anbieterfrage | wer streamt [Titel]; [Titel] auf [Anbieter] | [titre] sur quelle plateforme | [titolo] su quale piattaforma | en qué plataforma está [título] |
| Serie / Staffel | [Serie] Staffel [N] streamen | où regarder [série] saison [N] | dove vedere [serie] stagione [N] | dónde ver [serie] temporada [N] |
| Im eigenen Abo | Filme in meinem Abo | films inclus dans mon abonnement | film inclusi nel mio abbonamento | películas incluidas en mi suscripción |
| Leihen | [Titel] online leihen | louer [titre] en ligne | noleggiare [titolo] online | alquilar [título] online |
| Kaufen | [Titel] digital kaufen | acheter [titre] en VOD | acquistare [titolo] in digitale | comprar [título] en digital |
| Legal kostenlos | [Titel] legal kostenlos streamen | regarder [titre] gratuitement et légalement | vedere [titolo] gratis legalmente | ver [título] gratis y legalmente |
| Neu verfügbar | neu bei [Anbieter] | nouveautés sur [plateforme] | novità su [piattaforma] | novedades en [plataforma] |
| Bald weg | verlässt [Anbieter] bald | quitte bientôt [plateforme] | in scadenza su [piattaforma] | sale pronto de [plataforma] |
| Qualität / Sprache | [Titel] 4K; auf Deutsch | [titre] en 4K; en VF; en VOSTFR | [titolo] in 4K; in italiano | [título] en 4K; en español; subtitulado |
| Inspiration | was heute streamen; gute Thriller | que regarder ce soir; meilleurs thrillers | cosa vedere stasera; migliori thriller | qué ver esta noche; mejores thrillers |

Bediene verwandte Titel-Suchanfragen auf einer starken Film- oder Seriendetailseite pro Sprache und Markt. Erzeuge nicht für „wo läuft“, „wer streamt“, „online sehen“ und jeden einzelnen Anbieter nahezu identische Titelseiten. Ein negativer Netflix-Status kann auf der normalen Titelansicht sachlich beantwortet werden; er benötigt keine eigene dünne Landingpage.

Anbieter-, Genre- und sorgfältig ausgewählte Kombinationsseiten erhalten eigenständigen Mehrwert: passende aktuelle Angebote, verständliche Auswahl, Filter, Kontext und interne Verlinkung. Definiere eine überprüfte Liste indexierbarer Landingpages. Keine automatische Veröffentlichung aller kombinatorisch möglichen Genres, Jahre, Länder und Anbieter.

Setze natürliche Texte ein, die zuerst die Frage beantworten. Wiederhole Keywords nicht mechanisch. Verwende Titel, Jahr, Markt und Angebotsart nur, wenn sie passen. Vermeide falsche „kostenlos“-Versprechen und veraltete Jahreszahlen in automatisch fortgeschriebenen Überschriften.

Erstelle eine interne Verlinkungsstruktur von Startseiten über Anbieter/Themen zu Titeln und zurück, dazu Breadcrumbs und kontextuell passende ähnliche Titel. Nutze echte HTML-Links. Keine gekauften Linkpakete, versteckten Texte, künstlichen Bewertungen oder massenhaft veröffentlichten KI-Seiten ohne zusätzlichen Nutzen. [Google: Spam-Richtlinien](https://developers.google.com/search/docs/essentials/spam-policies).

## 14. Technisches SEO und Indexierungsregeln

### 14.1 Seitenmetadaten und internationale Zuordnung

Jede indexierbare Seite braucht einen passenden HTML-Titel, eine eigene aussagekräftige Meta-Description, eine klare Hauptüberschrift, korrektes `html lang` und eine absolute kanonische HTTPS-URL. Formuliere für Suchergebnisse, ohne starre Zeichenzahlen als Google-Regel auszugeben. Ein deutscher Titel könnte lauten: `[Titel] ([Jahr]) streamen: Anbieter & Angebote | Cineradar`.

Lokalisierte und regional sinnvolle Seiten sind grundsätzlich selbstkanonisch. Verweise nicht alle Sprachversionen auf Deutsch. Erzeuge `hreflang` aus einer zentralen Zuordnung mit gültigen Sprach-/Ländercodes, Selbstreferenz und wechselseitigen Rückverweisen, ausschließlich auf existente, kanonische und indexierbare Entsprechungen. Beispielsweise verweist `fr-DE` auf französischen Inhalt für Deutschland. Ergänze sprachweite Fallbacks gezielt, wenn sinnvoll.

Verwende `x-default` für die internationale Startauswahl. Verlinke nicht pauschal jede Filmdetailseite per `x-default` auf die Startseite; dafür wäre eine passende titelbezogene Auswahlseite nötig. Entscheide dich für eine konsistente primäre Ausgabe der Sprachverweise. Falls HTML und Sitemap beide Alternativen ausgeben, müssen sie dieselbe Datenquelle verwenden. [Google: lokalisierte Seitenversionen](https://developers.google.com/search/docs/specialty/international/localized-versions).

### 14.2 Crawl-Steuerung

| URL-Typ | Vorgabe |
| --- | --- |
| Nützlicher, vollständiger Titel oder freigegebene Themenseite | HTTP 200, indexierbar, kanonisch, in Sitemap. |
| Interne Suchergebnisse, persönliche Merkliste, beliebige Filterkombination | `noindex`, nicht in Sitemap; persönliche Daten zusätzlich privat schützen. |
| Reine URL-Duplikate | Permanente gezielte Weiterleitung oder Canonical auf tatsächlich gleichwertigen Inhalt. |
| Unbekannte Entität / unmögliche Route | Echter HTTP 404, lokalisiert. |
| Bekannter Film ohne Angebote | HTTP 200 mit hilfreichen Metadaten und ehrlichem Marktstatus; Qualität separat bewerten. |
| Paginierte Übersicht | Echte Links, eigene URL und passende Selbstkanonisierung; keine pauschale Kanonisierung aller Seiten auf Seite eins. |
| Staging / Entwicklung | Zugriffsschutz und geeignete `noindex`-Header; keine produktive Sitemap. |

Eine URL, deren `noindex` Google lesen soll, darf nicht gleichzeitig allein per `robots.txt` vom Abruf ausgeschlossen werden. Eine Canonical-Angabe ersetzt keine private Zugriffskontrolle. Leite Filter nicht pauschal auf die Startseite um. Begrenze crawlbare Facetten, Parameterreihenfolge und Kombinationen. [Google: Facettierte Navigation](https://developers.google.com/crawling/docs/faceted-navigation).

Erzeuge Sitemap-Index und ausreichend kleine XML-Sitemaps nach Inhaltsart und sinnvoller Aufteilung. Beachte aktuelle Protokollgrenzen. Enthalten sein dürfen nur kanonische, indexierbare, erfolgreiche URLs. `lastmod` folgt substanziellen Inhaltsänderungen und nicht jedem Jobstart. Verhindere verwaiste Seiten, Redirect-Ketten, Soft-404s und öffentliche Testdaten.

### 14.3 Qualitätsfreigabe

Die dauerhafte Erreichbarkeit in fünf Sprachen bedeutet nicht, dass jede unfertige Kombination sofort indexiert wird. Implementiere `indexabilityStatus` mit nachvollziehbarem Grund: gültige Identität, verständlicher lokalisierter Inhalt, sinnvoller Marktbezug, belastbarer Datenstatus und eigenständiger Nutzen. Vermeide willkürliche Mindestwortzahlen. Prüfe neu entstehende Seitentypen stichprobenartig, bevor du große Bestände freigibst.

Keine unnötigen `meta keywords`, keine Rankingversprechen durch Schema und keine Gleichsetzung von Sitemap-Eintrag mit garantierter Indexierung. Bereite Search Console und Sitemap-Einreichung vor; verwende nur tatsächlich eingerichtete Verifikationswerte.

## 15. Schema.org und strukturierte Daten

Erzeuge validiertes JSON-LD serverseitig aus denselben Daten wie den sichtbaren Inhalt. Verwende stabile absolute `@id`-Werte und konsistente Verknüpfungen. Escape eingebettete Daten sicher, insbesondere Zeichenfolgen, die ein Script-Element vorzeitig schließen könnten.

| Seitentyp | Passende Modellierung |
| --- | --- |
| Marke und Startseite | `Organization`, `WebSite`, `WebPage`, tatsächliches Logo und echte Identitätslinks. |
| Film | `WebPage` mit `mainEntity` vom Typ `Movie`. |
| Serie | `WebPage` mit `mainEntity` vom Typ `TVSeries`. |
| Sichtbare Staffeldetails | `TVSeason`; `TVEpisode` nur bei entsprechendem sichtbarem und verifiziertem Inhalt. |
| Anbieter-, Genre-, Ergebnisliste | `CollectionPage` und passende `ItemList`, soweit semantisch korrekt. |
| Navigation | `BreadcrumbList` mit echten Zielseiten und korrekter Reihenfolge. |
| Eigener redaktioneller Beitrag | `Article` nur für einen tatsächlichen Artikel mit wahrheitsgemäßen Angaben. |

Setze Name, Beschreibung, Bild, Datum, Laufzeit, Genre und beteiligte Personen nur bei gesicherten passenden Daten. Unterscheide Filmveröffentlichung, Serienstart und regionale Streamingaufnahme. Validiere Property-Typen und ISO-Formate gegen das aktuelle Vokabular. [Schema.org: Movie](https://schema.org/Movie), [TVSeries](https://schema.org/TVSeries).

Modelliere Angebote nur, wenn sichtbarer Anbieter, Preis, Währung, Angebotsart und erforderlicher Kontext korrekt abgebildet werden können. Cineradar ist nicht der Verkäufer oder Streaminghost. Ein Aboeintrag erhält kein erfundenes kostenloses Kaufangebot. Im Zweifel ist schlankes korrektes Markup besser als semantisch falsche Vollständigkeit.

Übernehme keine Drittanbieterbewertung als angebliche eigene `AggregateRating`. Verwende standardmäßig keine Bewertungssterne im Markup; eine spätere Erweiterung benötigt eine gesonderte Prüfung der Herkunft und Google-Richtlinien. Sichtbare TMDb-Bewertungen bleiben eindeutig beschriftet.

`VideoObject` ist nur für tatsächlich eingebettete oder direkt abspielbare, berechtigt verwendete Videos mit den erforderlichen echten Metadaten zulässig; ein Filmplakat oder Anbieterlink ist kein solches Video. Verwende keine erfundenen Rezensionen, Autoren, Upload-Daten oder Watch-Actions. FAQ-Markup und Movie-Markup versprechen keine Rich Results oder Streaming-Schaltflächen. [Google: strukturierte Daten allgemein](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [Movie-Funktion](https://developers.google.com/search/docs/appearance/structured-data/movie).

## 16. Open Graph, Social Cards und geteilte Links

Jede öffentliche teilbare Seite erhält konsistente, lokalisierte Metadaten: `og:title`, `og:description`, `og:type`, `og:url`, `og:site_name`, `og:locale`, passende Alternativ-Lokalisierungen sowie `og:image` mit absoluter HTTPS-Adresse, Typ, Abmessungen und sinnvoller Bildbeschreibung. Nutze nur semantisch passende Typen; ein generischer Seitentyp ist besser als ein falscher Videotyp. [Open Graph Protocol](https://ogp.me/).

Ergänze Twitter/X-Karten mit `summary_large_image`, Titel, Beschreibung, Bild und Alt-Text. Erfinde keinen Social-Accountnamen. Kanonischer Link, sichtbarer Inhalt und Vorschau müssen dieselbe Entität, Sprache und denselben Markt meinen. Links enthalten keine privaten Filter, Tokens oder Merklisteninhalte.

Erstelle eine eigene Bildvorlage für **1200 × 630 Pixel** mit folgenden Produktanforderungen:

- Erkennbares Cineradar-Branding, Film-/Serientitel, Jahr sofern sinnvoll und klarer Marktbezug.
- Lizenzkonformes Artwork, hoher Kontrast, sichere Innenabstände und guter kleiner Ausschnitt.
- Dynamische Typografie für lange Titel und Akzente; keine abgeschnittenen zentralen Informationen.
- Keine schnell veraltenden Preisangaben oder unbelegten Anbieterversprechen im dauerhaft gecachten Bild.
- Feste, gestaltete Fallbacks für fehlende Bilder und für technische Fehler.

Liefere Social-Bilder als breit unterstützte JPG- oder PNG-Dateien mit korrektem MIME-Typ; SVG allein ist dafür kein verlässlicher Standard. Halte sie möglichst unter 1 MB. Erzeuge sie serverseitig und cache sie anhand relevanter Revisionen. Ein Bot-Aufruf darf keine Kaskade kostenpflichtiger APIs oder eine unbegrenzte Bildgenerierung auslösen.

Metadaten und Bild müssen ohne Anmeldung, Consent-Dialog, JavaScript-Ausführung oder Cookie verfügbar sein. Teste das tatsächliche initiale HTML auch mit typischen Vorschau-Crawlern. Hosting, Weiterleitungen und WAF dürfen legitime öffentliche Vorschauen nicht blockieren; schütze private und administrative Bereiche weiterhin.

Überprüfe repräsentative Links für WhatsApp, Telegram, iMessage, Facebook, LinkedIn und X, soweit die jeweilige Prüfumgebung verfügbar ist. Dokumentiere tatsächlich ausgeführte Vorschautests; kennzeichne nicht verfügbare Tests. Beachte fremde Vorschau-Caches und halte einen Weg zur erneuten Prüfung bereit. Liefere außerdem Favicons, Apple-Touch-Icon und Web-App-Manifest mit passenden Symbolen und Farben.

## 17. Automatische Inhalte ohne Qualitätsverlust

Automatisiere die Ableitung aktueller Streamingantworten, Änderungen, Angebotslisten und zugehöriger Metadaten aus validierten Daten. Nutze sprachlich gepflegte Vorlagen mit Varianten für echte Zustände. Eine Änderung der Verfügbarkeit darf nicht automatisch eine erfundene Filmkritik oder neue Handlung erzeugen.

Übersetzungen erhalten Status, Quellenversion und Herkunft. Eine geänderte Originalbeschreibung invalidiert die davon abgeleiteten Fassungen; korrigierte redaktionelle Übersetzungen dürfen nicht bei jedem Import überschrieben werden. Lege die Vorrangregeln fest. Implementiere eine Prüfung auf fehlende Schlüssel, unerwartete Sprachmischung, leere Texte und defekte Platzhalter.

Eigene Ratgeber erklären beispielsweise Zusatzabos, Filmleihe, Länderunterschiede und Sprachfilter. Fakten über Anbieterpreise, Testabos oder Kündigungsbedingungen müssen separat aktuell belegt sein; erfinde sie nicht aus Filmdaten. „Neu verfügbar“ meint Katalogaufnahme, nicht automatisch Kinostart oder Erstveröffentlichung. „Bald weg“ und „Demnächst“ benötigen passende Quellensignale, bei fehlendem Datum eine entsprechend ungenaue Formulierung.

## 18. Sicherheit, Datenschutz, Nutzungsrechte und Monetarisierung

### 18.1 Sicherheit

Alle API-Schlüssel, Datenbankzugänge und Job-Secrets bleiben serverseitig. Keine Schlüssel in `NEXT_PUBLIC_*`, Browser-Bundles, OG-URLs, Querystrings, Git oder öffentlichen Logs. `.env.example` enthält ausschließlich Platzhalter. Aktiviere Secret-Scanning in der vorhandenen CI, soweit verfügbar.

Validiere Eingaben und API-Antworten zur Laufzeit. Begrenze Suchlänge, Pagination, Query-Komplexität und Anfrageraten. Verhindere SQL-Injection, XSS, SSRF, offene Weiterleitungen und Kostenmissbrauch. Anbieterlinks stammen aus validierten Datensätzen; ein Redirect-Endpunkt akzeptiert höchstens eine interne Angebots-ID und keine beliebige Ziel-URL.

Richte passende Sicherheitsheader und eine mit der Anwendung getestete Content Security Policy ein. Verwende sichere Cookies, CSRF-Schutz für relevante Mutationen und geeignete Cache-Control-Regeln. Der Betriebsbereich benötigt echte Authentifizierung und Autorisierung, keine bloß schwer erratbare URL. Audit-Logs für administrative Änderungen dürfen keine Secrets enthalten.

### 18.2 Datenschutz und Betreiberangaben

Verwende Datensparsamkeit als Standard. Lokale Merklisten und Anbieterpräferenzen werden nicht ohne bewusste Nutzerentscheidung in ein persönliches Serverprofil übertragen. Lege Speicherfristen, Löschung und bei Accounts die zugehörigen Auskunfts-/Exportwege fest. Persönliche Exporte enthalten eigene Nutzerdaten, keine vollständigen lizenzierten Angebotsdatenbanken.

Tracking, nicht erforderliche Drittanbieterinhalte und Marketing benötigen die nach eingesetzten Diensten und Zielmärkten erforderliche Behandlung. Plane einen datensparsamen Start ohne Werbetracker; lade Trailer oder externe Einbettungen erst nach passender Nutzeraktion und gegebenenfalls notwendiger Einwilligung. Ein pauschaler Cookiebanner ersetzt keine tatsächliche Prüfung der verwendeten Technologien.

Erstelle lokalisierbare Rechtsseiten auf Basis echter Betreiber-, Kontakt-, Dienstleister- und Verarbeitungsangaben. Fehlende Angaben bleiben klar als Einrichtungspunkt dokumentiert und blockieren die entsprechende Produktionsfreigabe. Erfinde kein Impressum, keine Anschrift und keinen angeblichen Datenschutzbeauftragten. Rechtliche Texte benötigen eine fachliche Freigabe für den tatsächlichen Betrieb. [Europäische Kommission: Datenschutz](https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en).

### 18.3 Lizenz- und Quellenpflichten

TMDb erklärt die kostenlose API-Nutzung für nichtkommerzielle Zwecke unter Attribution; bei einem auf Einnahmen ausgerichteten Projekt muss die passende kommerzielle Nutzung mit TMDb geklärt sein. Behandle einen kostenlosen Entwicklerschlüssel nicht als pauschale kommerzielle Lizenz. Stelle das offizielle TMDb-Logo und den vorgeschriebenen Hinweis sichtbar auf der Credits-/Über-Seite bereit:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

Der verbindliche Hinweis bleibt in dieser Form erhalten, ergänzt um lokalisierten Kontext. Prüfe aktuelle Logo-, Nutzungs- und Bildbedingungen. [TMDb: FAQ und Attribution](https://developer.themoviedb.org/docs/faq).

Verlinke TMDb auf der Credits-Seite mit [themoviedb.org](https://www.themoviedb.org/). Halte Quellenkennzeichnungen gut sichtbar, ohne eine Partnerschaft oder Zertifizierung von Cineradar zu behaupten.

Die veröffentlichten Bedingungen der Streaming Availability API erlauben kommerzielle Endnutzeranwendungen, verlangen aber Quellenattribution und untersagen die Weiterverteilung der Angebotsdaten an andere Plattformen beziehungsweise Unternehmen. Setze sichtbar die Attribution [Streaming Availability API by Movie of the Night](https://www.movieofthenight.com/about/api). Prüfe den aktuell gebuchten Vertrag einschließlich Cache-, Aufbewahrungs-, Bild- und Bandbreitenbedingungen; die Softwarelizenz eines SDK ist keine Datenlizenz. Berücksichtige erforderliche Abschaltung oder Ersetzung fremder Assets bei Lizenzende. Biete keine frei weiterverwendbare Bulk-API oder Datenbankexporte der Streamingangebote an. [Veröffentlichte Bedingungen](https://github.com/movieofthenight/streaming-availability-api/blob/main/TERMS.md), [aktuelle Vertragsseite](https://developers.movieofthenight.com/terms-and-conditions).

### 18.4 Monetarisierung

Bereite Affiliate-Verlinkung als austauschbaren, deaktivierten Adapter vor. Aktiviere nur tatsächlich vereinbarte Programme und zulässige Links; beachte die Bedingungen der Datenquelle. Kennzeichne bezahlte Platzierungen und Affiliate-Links angemessen, inklusive passenden Linkattributen wie `sponsored`.

Vergleichsergebnisse werden nach offengelegten Nutzerkriterien sortiert. Provisionen dürfen nicht verdeckt als günstigster Preis oder beste Verfügbarkeit ausgegeben werden. Keine erfundenen Angebote, Gratiszeiträume oder Rabattcodes. Werbung darf Suche, Lesbarkeit und Core Web Vitals nicht verdrängen.

## 19. Performance und technische Qualität

Optimiere auf tatsächlichen Mobilgeräten und langsamen Verbindungen. Priorisiere das sichtbare Hauptbild korrekt, lazy-loade Bilder unterhalb des ersten Bildschirms, reserviere Bildflächen und lade angemessene Größen. Verwende moderne Formate dort, wo sie zuverlässig unterstützt werden; die Social-Card-Vorgaben bleiben separat.

Vermeide unnötige Client-Komponenten, große Animationsbibliotheken, komplette Iconpakete und riesige Bilddateien. Prüfe Bundlegrößen und setze ein nachvollziehbares Budget für initiales JavaScript und Bilddaten. Lade schwere Trailer und Detailtabellen bei Bedarf. Öffentliche Karten müssen ohne N+1-Datenbankabfragen und ohne N+1-API-Abrufe entstehen.

Ziele im realen Feld am 75. Perzentil: **LCP ≤ 2,5 Sekunden, INP ≤ 200 Millisekunden, CLS ≤ 0,1**. Feldwerte können zum Launch noch fehlen; bezeichne Labortests nicht als Felddaten. [Web Vitals](https://web.dev/articles/vitals).

Als reproduzierbares Laborziel: Lighthouse Performance mindestens 90 auf repräsentativer Start-, Film- und Seriendetailseite unter dokumentiertem Mobilprofil, außerdem keine schwerwiegenden Accessibility- oder SEO-Befunde. Prüfberichte nennen Umgebung, Cachezustand und Einschränkungen. Optimiere belegte Engpässe, ohne künstlich unterschiedliche Inhalte an Prüfwerkzeuge auszuliefern.

## 20. Beobachtbarkeit und Bedienbarkeit im Betrieb

Implementiere strukturierte, datensparsame Logs und Kennzahlen für API-Aufrufe, Fehlerarten, Laufzeiten, Budget, Queue-Länge, Jobverzögerung, Cache-Trefferrate, Übersetzungsrückstand und Alter der Angebotsdaten je Markt. Trenne Liveness der Webanwendung von der Bereitschaft externer Dienste.

Der geschützte Betriebsbereich zeigt letzte erfolgreiche Läufe, nächste geplante Läufe, Abdeckungsübersicht, fehlgeschlagene Datensätze und tatsächlich aktive Funktionsschalter. Er ermöglicht gezielte Wiederholung, Pausieren und Prüfung von Nutzerfehlermeldungen. „Erneut prüfen“ darf keinen unbegrenzten Vollimport anstoßen.

Erkenne ausgebliebene Scheduler-Heartbeats, Quota-Probleme, ungewöhnliche Löschmengen und wachsende Übersetzungsrückstände. Benachrichtigungen an den Betreiber benötigen einen konfigurierten Kanal und Deduplizierung; ohne diesen muss der Status im Betriebsbereich sichtbar bleiben. Dokumentiere Reaktion und Wiederanlauf.

Richte regelmäßige Datenbanksicherungen und eine nachvollziehbare Wiederherstellung ein. Prüfe einen Restore in einer isolierten Umgebung, bevor du ihn als funktionsfähig meldest. Sichere auch Konfigurationswissen, Migrationsstand und notwendige Wiederaufbauinformationen, ohne Secrets in das Repository zu kopieren.

## 21. Konfiguration, Hosting und Veröffentlichung

### 21.1 Konfigurationsvertrag

Erstelle eine validierte `.env.example` mit verständlichen Kommentaren. Die folgenden Namen sind Projektvorschläge, keine Behauptung über vorgegebene Variablennamen eines Dienstes. Dokumentiere den tatsächlich implementierten Vertrag:

| Konfiguration | Zweck |
| --- | --- |
| `SITE_URL` | Produktionsbasis `https://cineradar.tv`; getrennte Preview-Basis bei Bedarf. |
| `DATABASE_URL` | Dauerhafte Datenbank mit passenden Berechtigungen. |
| `TMDB_READ_ACCESS_TOKEN` | Serverseitiger TMDb-Zugang. |
| `SAA_ACCESS_MODE` | `direct` oder `rapidapi`; genau ein konsistenter Zugang. |
| `SAA_API_KEY` beziehungsweise `RAPIDAPI_KEY` | Zum gewählten Modus passendes serverseitiges Secret. |
| `ENABLED_MARKETS` / `SUPPORTED_LOCALES` | Aktivierte Länder und die fünf Pflichtsprachen. |
| `SAA_MONTHLY_BUDGET` / `SAA_DAILY_BUDGET` | Tatsächliche Kontingente mit klar dokumentierter Einheit. |
| `SYNC_ENABLED` / Jobkonfiguration | Ausführungsmodus, Takte, Frischegrenzen und Parallelität. |
| `CRON_SECRET` | Authentifizierung externer Scheduler-Aufrufe, falls dieses Modell verwendet wird. |
| Admin-/Session-Secrets | Geschützter Betriebszugang, abhängig von der gewählten Authentifizierung. |
| Übersetzungszugang | Optionaler Adapter; lokalisierte Faktenfallbacks funktionieren ohne ihn. |
| Mail-/Monitoringzugang | Nur für tatsächlich eingerichtete optionale Benachrichtigungen. |

Verwende strikte Startup-Validierung für benötigte Werte. Gib fehlende Variablennamen an, niemals deren Inhalte. Lege Entwicklungs-, Test-, Preview- und Produktionskonfiguration getrennt an. Testmodus darf in einer Produktionsveröffentlichung nicht versehentlich aktiv werden.

### 21.2 Ausführbares Hosting

Nutze eine Umgebung, die serverseitige Seitenausgabe, PostgreSQL und dauerhafte Jobausführung zuverlässig unterstützt. Bei serverlosen Webrouten läuft der langlebige Worker in dafür geeigneter Infrastruktur; lange Imports gehören nicht in einen kurzlebigen Seitenrequest. Scheduler und Worker brauchen nachweisbare Aktivierung, Wiederanlauf und Zeitzonenregelung.

Implementiere mindestens lokal reproduzierbare Startbefehle und eine passende Deployment-Konfiguration. Wenn noch kein Hosting gewählt ist, bereite einen portablen containerbasierten Weg für Web, Worker und Datenbankverbindung vor und dokumentiere die Produktionsvoraussetzungen. Lokale Container allein sind kein nachgewiesener Produktionsbetrieb.

Richte bei vorhandener Autorisierung DNS, HTTPS, Zertifikatserneuerung und die kanonische Domain ein. `www.cineradar.tv` und HTTP werden gezielt auf `https://cineradar.tv` weitergeleitet. Prüfe IPv4/IPv6, relevante Weiterleitungen, 404s, Bilder, Sitemap und Vorschauen im tatsächlichen Zielsystem. Veröffentliche keine Secrets oder Testdaten.

Verwende überprüfte Migrationen, getrennte Vorschauen und ein dokumentiertes Rollback. Plane möglichst kompatible Schemaänderungen, sichere vor riskanten Migrationen die Daten und überprüfe Webanwendung sowie Worker nach dem Deployment. Entferne Produktions-`noindex` erst, wenn die Voraussetzungen erfüllt sind; Staging bleibt geschützt.

## 22. Verifikation: nachweisen statt behaupten

Schreibe aussagekräftige Tests für relevante Logik und Risiken. Keine Tests, die lediglich Konstanten der Implementierung abschreiben. Folgende Fälle müssen abgedeckt werden:

### 22.1 Daten- und Integrationstests

- Gleiche numerische TMDb-ID für Film und Serie bleibt korrekt getrennt.
- Film, Zusatzabo, Kauf, Leihe, unbekannter Preis und teilweise verfügbare Serie werden richtig normalisiert.
- Fehlende Audio-/Untertitelangaben werden nicht als bestätigte Sprachunterstützung behandelt.
- Leere erfolgreiche Antwort, fehlende Entität, 429, Timeout und ungültiges Schema führen zu unterschiedlichen, korrekten Zuständen.
- Abgebrochene Pagination löscht keine Angebote; Jobwiederholung dupliziert keine Änderungen.
- Gleichzeitige Worker überschreiten kein gemeinsames Budget; Reset und Reservierung sind nachvollziehbar.
- Fehlende Übersetzung liefert lokalen Faktenfallback; geänderte Quelle aktualisiert abhängige Fassungen kontrolliert.
- Bekannte Ablauftermine, Sommerzeit-/Datumsgrenzen und verschiedene Preis-Einheiten werden korrekt verarbeitet.

### 22.2 End-to-End-Tests

Prüfe mit Browserautomatisierung und gezielter visueller Kontrolle:

1. Titel suchen, eindeutiges Ergebnis öffnen, Angebot verstehen und korrekten Anbieterlink prüfen.
2. Land wechseln und dadurch Angebote aktualisieren; Sprache bleibt bestehen.
3. Sprache wechseln; Titelidentität und Land bleiben bestehen. Alle fünf Sprachen und alle vier initialen Märkte müssen in einer gezielten Parametermatrix geprüft werden.
4. Anbieter auswählen, Zusatzkanal unterscheiden, Filter zurücksetzen und Browser-Zurück verwenden.
5. Serie mit mehreren Staffeln und teilweise fehlender Granularität bedienen.
6. Titel zur lokalen Merkliste hinzufügen, Seite neu laden und wieder entfernen.
7. Leere Suche, unbekannter Titel, kein Angebot, veralteter Datenstand und API-Ausfall durchspielen.
8. Zwei verschiedene Nutzer-/Markt-/Sprachkontexte dürfen keine Cache-Daten miteinander teilen, die kontextspezifisch sind.
9. Tastatur, Fokus, Dialoge, Screenreader-Beschriftungen und reduzierte Bewegung überprüfen.

Teste Chromium, Firefox und WebKit, soweit in der Umgebung verfügbar. Emulation ersetzt keinen behaupteten Test auf einem echten iPhone. Prüfe kritische Layouts zusätzlich anhand von Screenshots auf den festgelegten Breiten sowie mit langen Übersetzungen und fehlendem Artwork.

### 22.3 SEO- und Vorschautests

Prüfe rohes HTTP-HTML ohne JavaScript: Hauptinhalt, Canonical, `hreflang`, JSON-LD, Open Graph und Twitter-Metadaten. Teste gültige und ungültige Slugs, Response-Codes, Redirects, Sitemap-Aufnahme, Noindex-Regeln und gegenseitige Sprachverweise. Stelle sicher, dass ein gefährlicher Titeltext nicht aus dem JSON-LD ausbrechen kann.

Validiere strukturierte Daten mit den geeigneten Schema- und Google-Prüfverfahren. Eine fehlerfreie Schema-Validierung allein beweist keine Berechtigung für ein Google-Suchergebnisfeature. Prüfe Social-Bilder als reale HTTP-Ressource mit korrektem Inhaltstyp, Abmessungen und lokalisierter Gestaltung.

### 22.4 Echte Live-Nachweise

Wenn Zugangsdaten vorhanden sind, prüfe beide APIs mit einem kleinen budgetierten Satz realer Filme und Serien in jedem aktiven Markt. Vergleiche die normalisierten Felder mit den erhaltenen Antworten. Erfasse fehlende Angebotsarten als tatsächliche Testlücke; erfinde keine Live-Beispiele.

Führe mindestens einen vollständigen geplanten Synchronisationslauf und einen Wiederanlauf nach simuliertem Fehler aus. Ein manueller Import oder eine existierende Cron-Datei beweist den Auto-Mode noch nicht. Dokumentiere Testzeitpunkt und Quelle, da Verfügbarkeiten später abweichen können.

## 23. Umsetzungsreihenfolge

1. **Grundlage:** Repository prüfen, Architektur und Konfiguration festlegen, Anforderungen erfassen, Design-Tokens und Routenmodell anlegen.
2. **Datenpfad:** Beide Adapter, Datenmodell, Migrationen, validierter Initialimport und Fehlerzustände entwickeln.
3. **Durchgängiger Kernablauf:** Startseite, Suche, Film, Serie und Anbieterlink in allen fünf Sprachen implementieren; früh mobil prüfen.
4. **Mehrwert:** Anbieterfilter, korrekter Preisvergleich, Staffelansicht, Merkliste und Heute-Abend-Finder vervollständigen.
5. **Auto-Mode:** Scheduler, Queue, Änderungssynchronisation, Budgetkontrolle, Übersetzungen, Monitoring und Wiederanlauf aktivieren.
6. **Auffindbarkeit:** Nützliche Übersichten, Indexierungsregeln, interne Links, Schema, Sitemaps, OG-Bilder und Social Cards vervollständigen.
7. **Freigabefähigkeit:** Sicherheit, Credits, echte Betreibertexte, Leistungsprüfung und dokumentierte Abnahme herstellen.
8. **Übergabe und Betrieb:** Vorschau bereitstellen, externe Voraussetzungen abschließen, bei vorhandener Autorisierung veröffentlichen und live prüfen.

Alle Schritte gehören zum Auftrag. Prüfe wichtige Querschnittsthemen wie i18n, Datenwahrheit, Responsive Design und SEO bereits während der Umsetzung. Verschiebe sie nicht auf eine abschließende kosmetische Runde.

## 24. Verbindliche Abnahmematrix

Erstelle im Repository für jede Kennung einen Status mit Beleg: **erfüllt**, **fehlgeschlagen** oder **durch externe Voraussetzung blockiert**. „Implementiert, aber nicht geprüft“ ist kein erfülltes Live-Kriterium.

| ID | Abnahmekriterium | Erwarteter Beleg |
| --- | --- | --- |
| CR-01 | Reproduzierbarer Build, Start und Migration | Tatsächlich ausgeführte Befehle, CI beziehungsweise Logs. |
| CR-02 | Ausschließlich die zwei vorgesehenen Inhalts-APIs | Adapter, Datenherkunft und dokumentierter Vertrag. |
| CR-03 | Alle Kernseiten vollständig DE/FR/IT/ES/EN | Übersetzungsprüfung und repräsentative E2E-Nachweise. |
| CR-04 | Sprache und Markt sind unabhängig | Tests von Wechseln, URLs und Cache-Isolation. |
| CR-05 | Suchablauf ohne Konto, maximal drei Folgeaktionen | Durchgespielter mobiler und Desktop-Ablauf. |
| CR-06 | Abo, Zusatzabo, gratis, Leihe und Kauf korrekt | Tests und reale Beispiele, soweit Quelle verfügbar. |
| CR-07 | Staffelinformationen ohne falsche Vollständigkeit | Serienfälle mit unterschiedlicher Datentiefe. |
| CR-08 | Lokale Merkliste, Anbieterwahl und Finder funktionieren | E2E inklusive Neuladen und leeren Zuständen. |
| CR-09 | Frische, Fehler und Nichtverfügbarkeit unterscheidbar | Statusmodell und simulierte Ausfälle. |
| CR-10 | Auto-Mode läuft tatsächlich und erholt sich | Scheduler-/Worker-Nachweis und Wiederanlaufprüfung. |
| CR-11 | Budget und Pagination sind sicher | Parallelitäts-, Limit- und Abbruchtests. |
| CR-12 | Responsive und zugängliche Bedienung | Bildschirmgrößen, Tastaturtest, Kontrast- und Layoutprüfung. |
| CR-13 | SEO-Inhalte serverseitig und konsistent | Rohes HTML, Statuscodes, Canonicals, Sprachverweise. |
| CR-14 | Kontrollierte Indexierung ohne Filterexplosion | Sitemap-/Robots- und Qualitätsfreigabeprüfung. |
| CR-15 | Wahrheitsgemäßes, valides JSON-LD | Validator-Ergebnisse und Abgleich mit sichtbarem Inhalt. |
| CR-16 | Lokalisierte, lesbare Linkvorschauen | OG-Bilder und dokumentierte Plattform-/HTML-Tests. |
| CR-17 | Performanceziele nachvollziehbar geprüft | Lighthouse-Berichte und gegebenenfalls echte Felddaten. |
| CR-18 | Secrets und private Bereiche geschützt | Konfigurations-, Zugriffskontroll- und Cache-Prüfung. |
| CR-19 | Quellen-, Bild- und Betreiberpflichten erledigt | Tatsächliche Credits, Vertragsstatus und Rechtsseiten. |
| CR-20 | Betrieb und Wiederherstellung dokumentiert | Monitoring, Runbook, Backup-/Restore-Nachweis. |
| CR-21 | Produktionsveröffentlichung ehrlich ausgewiesen | Erreichbare Domain, Live-Prüfung oder genaue externe Blocker. |

Kennzeichne optionale Features gesondert. Ein deaktiviertes E-Mail-Feature ist kein funktionierender E-Mail-Alarm; ein lokaler Testdatensatz ist keine Live-API-Integration. Deklariere keine Gesamtfertigstellung, solange erforderliche Kriterien fehlen. Wenn ein externer Zugang blockiert, schließe trotzdem alle davon unabhängigen Arbeiten ab.

## 25. Erwartete Übergabe durch Codex

Liefere die vollständige Implementierung im Zielrepository, migrationsfähige Datenbankstruktur, funktionierende Hintergrundjobs, automatisierte relevante Tests, Design-Tokens und alle fünf Sprachpakete. Entferne tote Buttons, Platzhalterangebote, ungenutzte Gerüste und irreführende Demo-Erfolgsmeldungen aus dem Produktionspfad.

Mindestens folgende Dokumentation gehört dazu; fasse Dateien zusammen, wenn dies die Klarheit verbessert:

- `README.md`: Installation, benötigte Dienste, Start, Tests und Produktionskonfiguration.
- `docs/architecture.md`: Datenfluss, Modelle, Entscheidungen und Cachegrenzen.
- `docs/api-contract.md`: Quellen, API-Vertrag, Abdeckung, Lizenzen und Budgetannahmen.
- `docs/seo-i18n.md`: Routen, Sprachen/Märkte, Canonicals, Sprachverweise und Indexierungsregeln.
- `docs/design-system.md`: Design-Tokens, Komponenten und Accessibility-Regeln.
- `docs/operations.md`: Scheduler, Worker, Kosten, Fehlerbehebung, Backup, Restore und Rollback.
- `docs/acceptance.md`: CR-Matrix, echte Prüfresultate und noch offene Voraussetzungen.
- `.env.example`: Nur dokumentierte Platzhalter; niemals echte Secrets.

Der abschließende Bericht ist knapp und konkret: Was wurde gebaut, wie wurde es geprüft, wo ist die Vorschau beziehungsweise Produktionsseite, welche Voraussetzungen fehlen noch und welche nächsten Betreiberhandlungen sind genau nötig? Unterscheide lokale Fertigstellung, Live-Datenanbindung und tatsächlichen Produktionsbetrieb.

Beginne jetzt mit der Prüfung des Repositorys und führe den Auftrag bis zum bestmöglichen vollständig überprüfbaren Ergebnis aus.

## 26. Quellen und Aktualitätsregel

Die genannten Dokumentationen wurden für diesen Auftrag am 6. September 2026 geprüft, soweit abrufbar. Insbesondere die offizielle GitHub-Spezifikation und die veröffentlichten Bedingungen dienten als überprüfbare API-Quellen. Einige separate Movie-of-the-Night-Dokumentationsseiten waren dabei nicht abrufbar. Verifiziere deshalb bei Implementierungsbeginn den aktuellen Vertrag, gebuchten Tarif und die tatsächlichen Antworten; behaupte keine Prüfung unzugänglicher Vertragsinhalte.

Die konkrete UX, Architektur, Jobtakte, Startmärkte und Abnahmekriterien sind Projektentscheidungen dieses Auftrags. Sie sind keine von Google oder den APIs vorgeschriebenen Regeln.

| Bereich | Primärquellen |
| --- | --- |
| Streaming Availability API | [Offizielles Repository](https://github.com/movieofthenight/streaming-availability-api), [OpenAPI](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml), [veröffentlichte Bedingungen](https://github.com/movieofthenight/streaming-availability-api/blob/main/TERMS.md) |
| TMDb | [Entwicklerdokumentation](https://developer.themoviedb.org/docs/getting-started), [Sprachen](https://developer.themoviedb.org/docs/languages), [Bilder](https://developer.themoviedb.org/docs/image-basics), [Nutzung und Attribution](https://developer.themoviedb.org/docs/faq) |
| Internationale Suche | [Regionale und mehrsprachige Websites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [Sprachversionen](https://developers.google.com/search/docs/specialty/international/localized-versions) |
| Indexierungsqualität | [Facetten](https://developers.google.com/crawling/docs/faceted-navigation), [Spam-Richtlinien](https://developers.google.com/search/docs/essentials/spam-policies) |
| Strukturierte Daten | [Allgemeine Richtlinien](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [Movie](https://developers.google.com/search/docs/appearance/structured-data/movie), [Schema.org Movie](https://schema.org/Movie), [Schema.org TVSeries](https://schema.org/TVSeries) |
| Vorschau, Leistung, Zugänglichkeit | [Open Graph](https://ogp.me/), [Web Vitals](https://web.dev/articles/vitals), [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) |


## Ergänzung: Englisch (Nutzerauftrag)
Englisch (en) ist eine gleichberechtigte fünfte Pflichtsprache für alle UI-, Inhalts-, SEO-, Vorschau- und Prüfkriterien. Die vier Startmärkte DE/FR/IT/ES bleiben unverändert. Standardmarkt für /en/ ist DE; Englisch aktiviert weder UK noch USA. Die Testmatrix umfasst fünf Sprachen × vier Länder (20 Kombinationen). Die Suchintentionstabelle in Abschnitt 13 ist zusätzlich auf Englisch umzusetzen: where to watch [title], [title] streaming, [series] season [N], included in my subscriptions, rent/buy [title] online, watch legally for free, new on [provider], leaving soon, 4K / English audio / subtitles, what to watch tonight.

