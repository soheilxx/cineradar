# Cineradar: Masterplan für Sitemaps und Google-Indexierung

**Stand: 7. September 2026 · Status: technische Phase 1 live; vollständige öffentliche XML-Abnahme bestanden**

Das Ziel ist ein verlässliches Verzeichnis aller hochwertigen, kanonischen Cineradar-Seiten: vollständig gegenüber dem freigegebenen eigenen Bestand, international eindeutig und automatisch aktuell. Eine fehlende Serie wie „4 Blocks“ soll nach einem erfolgreichen Import auch in der richtigen Sitemap erscheinen. Eine Sitemap kann allerdings keine Titel erschließen, die noch nicht im Katalog stehen.

Die öffentliche Einreichungsadresse bleibt **https://cineradar.tv/sitemap.xml**. Nach der Umsetzung verwaltet diese Adresse alle Teildateien. In der Search Console wird die URL eingereicht; eine lokale XML-Datei wird dort nicht hochgeladen. Die Einreichung garantiert weder Indexierung noch Rankings. [Google: Sitemaps einreichen](https://support.google.com/webmasters/answer/7451001?hl=de), [Google: Sitemap-Grundlagen](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Umsetzungsstand: technische Phase 1

Der erste Ausbau umfasst den Generator und die konsistente Veröffentlichung aus dem eigenen Datenbestand. Er setzt Teile der unten beschriebenen Schritte 1 bis 3 um; der vollständige Vier-Schritte-Plan ist damit noch nicht abgeschlossen.

| Bereich                              | Erreicht / Nachweis                                                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erster erfolgreicher Datenbankexport | **67.096 URLs in 230 Teildateien**, erzeugt in **25,6 Sekunden**. Dies sind Sprach-/Marktvarianten und weitere Seiten-URLs, **nicht 67.096 verschiedene Filme oder Serien**. |
| Speicherung                          | Unveränderliche, mit Gzip komprimierte XML-Artefakte je Generation.                                                                                                          |
| Konsistenz                           | Der Masterindex und seine Dateien gehören zu derselben Generation; die neue Generation wird atomar veröffentlicht.                                                           |
| Aktualisierung                       | Der veröffentlichte Cron hat um **18:37:44 UTC** erfolgreich exportiert (24,1 Sekunden, kein Fehler oder verbliebener Lease). Der Publisher prüft alle **15 Minuten** auf Änderungen. |
| Validierung im Arbeitsstand          | **79 Tests und der vollständige Produktionsbuild bestanden**.                                                                                                                |
| Öffentliche Abnahme                  | Master und **alle 230 Teildateien HTTP 200**, vollständige XML-Prüfung: **67.293 URLs**, keine Dubletten, 5.302 gegenseitige Sprachgruppen, Bildangaben, Größenlimits, Gzip und bedingte 304-Antworten geprüft. GSC-Verarbeitung steht nach der Einreichung noch aus. |

Noch offen bleiben die Indexierungs- und Canonical-Entscheidungen für Informationsseiten, eigenständige redaktionelle Ratgeber, eine kontrollierte eigene Bildauslieferung, der sofortige Ausschluss zurückgezogener URLs aus bereits veröffentlichten Generationen und das laufende Monitoring mit Warnungen. Die folgenden Abschnitte bleiben dafür die fachliche Zielvorgabe. Die ursprünglichen Live-Befunde in Abschnitt 1 beschreiben den Zustand **vor diesem Umbau**.

## 1. Was die Prüfung konkret ergeben hat

Die öffentliche Stichprobe und der Code wurden geprüft, ohne die aktuelle Konfiguration zu ändern. Die Zahlen sind eine Momentaufnahme während laufender Katalogimporte.

| Geprüfter Bereich   | Befund                                                                                        | Konsequenz                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Masterindex         | HTTP 200; acht Teildateien: eine Seitensitemap und sieben Titeldateien                        | Vorhandene Einreichungsadresse erhalten                                         |
| `pages.xml`         | 590 URLs; 55 Einträge mit `lastmod`                                                           | Seitenarten trennen und echte Änderungsdaten ergänzen                           |
| Erste Titeldatei    | 9.765 URLs, etwa 1,20 MB                                                                      | Gegenwärtig kein Größenproblem                                                  |
| Siebte Titeldatei   | 8.405 URLs; enthält „4 Blocks“                                                                | Der konkrete reparierte Titel erreicht bereits die Sitemap                      |
| XML-Erweiterungen   | In den geprüften Dateien keine Bild- oder Sprachverweise                                      | Geeignete Erweiterungen aus einer gemeinsamen Datenbasis erzeugen               |
| HTML-Sprachverweise | Fünf Sprachen werden innerhalb eines Landes verbunden                                         | Entsprechende Länderfassungen desselben Titels zusätzlich verbinden             |
| Änderungsdatum      | Angebotsänderungen berücksichtigt; Titelrevision basiert nur auf Übersetzungstexten           | Auch relevante Änderungen an Bildern, Besetzung, Laufzeit und Staffeln erfassen |
| Aufteilung          | Veränderliche Datenbankabfragen mit `LIMIT/OFFSET`; Masterindex separat berechnet und gecacht | Konsistent veröffentlichte Generation mit stabiler Zuordnung einführen          |
| Anbieter und Themen | Anbieter ohne Inhaltsprüfung aufgenommen; vier Genres freigegeben                             | Aufnahme nach Inhalt und Nutzbarkeit statt allein nach vorhandener Route        |
| Informationsseiten  | Derzeit weitgehend `noindex`                                                                  | Indexierungsentscheidung und Canonical zuerst ändern, danach Sitemap ergänzen   |

Die vorhandenen Sprachverweise sind deshalb nicht automatisch ungültig. Ebenso sind fehlende XML-Sprachverweise kein Beleg dafür, dass Google die vorhandenen HTML-Verweise ignoriert. Der Ausbau verbessert Vollständigkeit und Wartbarkeit; doppelte Auszeichnung ist kein zusätzlicher Rankingbonus.

Relevante Codebereiche: `app/sitemap.xml/route.ts`, `app/sitemaps/pages.xml/route.ts`, `app/sitemaps/titles.xml/route.ts`, `seo/metadata.ts`, `seo/content.ts`, `data/providers/tmdb.ts` und `db/migrations/003_search_translations.sql`.

## 2. Die geplante Struktur

Ein flacher Masterindex verweist direkt auf echte URL-Sitemaps. Keine Kette aus ineinander verschachtelten Sitemap-Indizes. Jede Datei ist nach Seitenart sowie bei landesspezifischen Inhalten nach Sprache und Markt identifizierbar. Nur nichtleere, freigegebene Teildateien erscheinen im Index. [Google: große Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps), [Search Console: Sitemap-Fehler](https://support.google.com/webmasters/answer/7451001?hl=de).

```text
https://cineradar.tv/sitemap.xml
├── sitemap-movies-de-de-0001.xml
├── sitemap-series-de-de-0001.xml
├── sitemap-movies-en-us-0001.xml
├── sitemap-series-en-us-0001.xml
├── sitemap-landings-de-de-0001.xml
├── sitemap-providers-de-de-0001.xml
├── sitemap-topics-de-de-0001.xml
├── sitemap-comparisons-de-0001.xml
├── sitemap-comparisons-en-0001.xml
├── sitemap-information-de-0001.xml
└── weitere tatsächlich freigegebene Sprach-/Marktdateien
```

**Diese neuen Dateinamen sind Entwurfsnamen und noch nicht veröffentlicht.** Die Endung bleibt XML; die öffentlichen Dateiadressen liegen direkt unter der Domainwurzel. Damit vermeiden wir unnötige Unklarheiten über den Verzeichnisbereich einzelner Sitemaps. Ein eng begrenzter interner Rewrite kann die Dateien an einen gemeinsamen Artefakt-Handler weiterreichen, ohne HTTP-Weiterleitung und ohne eine konkurrierende dynamische Root-Route neben dem vorhandenen `[locale]` einzuführen.

Startvorgabe für die Umsetzung: höchstens **5.000 Seiten-URLs oder 20 MB unkomprimiert je Datei**, je nachdem, welche Grenze zuerst erreicht wird. Das sind unsere Betriebsgrenzen mit Reserve für Sprach- und Bildangaben. Googles Obergrenzen liegen bei 50.000 URLs und 50 MB unkomprimiert. Die tatsächliche Bytegröße wird nach XML-Escaping gemessen. [Google: Größen und Formate](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Die Aufteilung ist für Diagnose und Betrieb gedacht. Eine Datei namens „wichtige-filme.xml“, eine vordere Position oder besonders viele Teildateien verschaffen keinen zugesicherten Rankingvorteil.

## 3. Welche Seiten aufgenommen werden

Eine gemeinsame Datenbasis pro URL steuert Sitemap, Robots-Metadaten, Canonical und Sprachverweise. Die Felder `indexable` und `sitemapEligible` bleiben getrennt: Eine nützliche Folgeseite kann indexierbar sein, ohne einen Sitemap-Eintrag zu benötigen. Ein Sitemap-Eintrag setzt dagegen Indexierbarkeit voraus. Weitere Voraussetzungen sind eine öffentliche Produktionsadresse, HTTP 200, der richtige kanonische Pfad und tatsächlich nützlicher Inhalt. Eine Route oder ein Datensatz allein reicht nicht.

| Seitenart                                           | Entscheidung für Cineradar                                                                                                                                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Filme und Serien                                    | Aufnehmen, wenn Identität, lokaler Titel, Jahr, substanzieller Inhalt und erfolgreich geprüfter Marktstatus vorliegen. Beschreibung, Besetzung, Staffelabdeckung und konkrete Streamingantwort gemeinsam bewerten. Keine bloßen Titelhüllen.                                                           |
| Titel ohne Angebot                                  | Aufnehmen, wenn der Titel inhaltlich hilfreich ist und die Aussage „kein Angebot gefunden“ auf einem erfolgreichen Abgleich beruht. Fehlendes Angebot ist kein automatischer Löschgrund.                                                                                                               |
| Noch ungeprüfte Titel                               | Zunächst auslassen. Nach erfolgreichem Import und Inhaltsprüfung automatisch aufnehmen. Ein Suchtreffer kann schon vor der SEO-Freigabe nutzbar sein.                                                                                                                                                  |
| Vorübergehend gestörte Aktualisierung               | Neue ungeprüfte Seiten nicht freigeben. Bereits gute Seiten bei einem kurzen Ausfall nicht ständig zwischen Index und `noindex` wechseln lassen; letzten erfolgreichen Stand mit ehrlicher Aktualitätsangabe nutzen. Diese Änderung muss gleichzeitig in Seitenmetadaten und Sitemap umgesetzt werden. |
| Startseite, Filme, Serien                           | Freigegebene Sprach-/Marktfassungen mit realem Bestand aufnehmen. Der automatisch weiterleitende Einstieg `/` ist kein eigener `<loc>`-Eintrag.                                                                                                                                                        |
| Anbieterübersicht und Anbieter                      | Länderangebot, Anbieterbeschreibung, Angebotsarten und relevante Titel müssen einen nutzbaren Einstieg ergeben. Leere Standardkopien auslassen. Eine zeitweise leere, ausführliche Anbieterseite kann nach redaktioneller Prüfung bestehen bleiben.                                                    |
| Genres und Themen                                   | Die bisher vier Themen prüfen; weitere unterstützte Genres erst mit passender Auswahl, eigenem Einführungstext und internen Links freigeben. Keine automatisch vervielfachten Anbieter×Genre×Jahr-Seiten.                                                                                              |
| Neu verfügbar, kostenlos, bald nicht mehr verfügbar | Als eigenständige Einstiege aufnehmen, sobald Inhalte und Datenlage tragen. „Kostenlos“ muss echte kostenlose Angebote meinen; Ablaufdaten müssen bestätigt sein. Keine leeren oder irreführenden Versprechen.                                                                                         |
| Vergleiche                                          | Die bestehenden 50 Vergleichsseiten und fünf Vergleichshubs erhalten. Nach Sprache gliedern; sie werden nicht zusätzlich mit fünf Märkten multipliziert.                                                                                                                                               |
| Über uns, Datenmethodik, Hilfe, Kontakt             | Je Sprache eine bevorzugte, hilfreiche Fassung indexierbar machen. Marktunabhängige Kopien zusammenführen; unterschiedliche Länderinformationen bei Bedarf eigenständig behandeln.                                                                                                                     |
| Impressum, Datenschutz, Quellen                     | Empfehlung: die fünf sprachlichen Hauptfassungen nach Inhaltsprüfung indexierbar machen und aufnehmen. Andere gleichsprachige Marktkopien kanonisieren. Diese Seiten dienen Transparenz und Markenanfragen, nicht zusätzlichen Filmkeywords.                                                           |
| Öffentliche Ratgeber                                | Spätere Erweiterung nach echter Veröffentlichung mit Autor, Quellen, Prüfdatum und Verlinkung. Derzeit keine leere Ratgeber-Sitemap anlegen.                                                                                                                                                           |
| Pagination                                          | Echte Folgeseiten mit eigenen Inhalten bleiben erreichbar und selbstkanonisch. Zunächst keine vollständige Vervielfachung der Listenpagination in der Sitemap: alle freigegebenen Titel stehen bereits direkt darin. Die HTML-Verlinkung muss sämtliche echten Folgeseiten erschließen.                |
| Suche, Filter, Merkliste, persönliche Anbieter      | Auslassen. Ebenso Trackingparameter, administrative Seiten, Formulareingaben, API-Endpunkte und Anbieterweiterleitungen.                                                                                                                                                                               |
| Alte Slugs, Fehlerseiten, Weiterleitungen           | Auslassen; bekannte alte Titelpfade auf den aktuellen Pfad weiterleiten. Entfernte Inhalte mit passendem 404/410 behandeln, nicht pauschal auf die Startseite schicken.                                                                                                                                |
| Staffeln und Episoden                               | Aktuell Abschnitte auf der Serienseite, keine eigenständigen Sitemap-URLs. Erst nach echten eigenständigen Seiten mit zusätzlichem Nutzen aufnehmen. `#seasons` ist keine neue Seite.                                                                                                                  |

Für identische Informationsseiten bietet sich zunächst die vorhandene Hauptfassung je Sprache an: Deutsch unter `/de/de/`, Französisch `/fr/fr/`, Italienisch `/it/it/`, Spanisch `/es/es/`, Englisch `/en/us/`. Die konkreten Pfade kommen aus dem Router. So benötigen wir für diese Bereinigung keinen vollständigen URL-Umzug. Die gemeinsamen Informationsseiten erhalten sprachbezogene Metadaten ohne künstlichen Länderzusatz.

Eine Canonical-Konsolidierung darf nicht durch widersprüchliche Sitemap-Einträge oder Sprachverweise aufgehoben werden. Canonicals und interne Links zeigen auf dieselbe bevorzugte Fassung. [Google: doppelte URLs konsolidieren](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

Es gibt keine erfundene Google-Mindestwortzahl und keine Keyworddichte als Freigaberegel. Für jeden Ausschluss wird stattdessen ein prüfbarer Grund gespeichert, etwa `missing_localized_content`, `unchecked_market`, `duplicate_variant` oder `empty_listing`.

## 4. Alle sinnvollen Angaben an Google

| Angabe                                      | Ort und geplante Verwendung                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `loc`                                       | Absolute kanonische HTTPS-Adresse unter `cineradar.tv`; keine Preview-Domain, Filterzustände oder Fragmente |
| `lastmod` einer Seite                       | Zeitpunkt einer erheblichen Änderung dieser konkreten Sprach-/Marktfassung                                  |
| `lastmod` einer Teildatei                   | Im Masterindex: Zeitpunkt einer tatsächlichen Änderung ihres veröffentlichten XML-Inhalts                   |
| `xhtml:link` / `hreflang`                   | Echte, gegenseitig verknüpfte Sprach-/Länderfassungen; einschließlich der jeweiligen Seite selbst           |
| `image:image` / `image:loc`                 | Stabile, crawlbare, relevante Bilder, die auf der jeweiligen Seite tatsächlich verwendet werden             |
| `video:*`                                   | Nur bei künftig tatsächlich eingebundenen, geeigneten Videos und belegten Videodaten                        |
| `news:*`                                    | Nur für künftig echte Nachrichtenartikel nach den News-Vorgaben                                             |
| Title, Meta Description, Canonical, JSON-LD | Gehören ins HTML der Seite und werden aus derselben Datenbasis konsistent erzeugt                           |
| Open Graph und X-Karte                      | Gehören zu den Seitenmetadaten für URL-Vorschauen; die vorhandenen 1200×630-Karten bleiben erhalten         |

Google ignoriert `priority` und `changefreq`; diese Felder werden deshalb nicht ergänzt. Auch zusätzliche Fantasiefelder für Rankings oder Keywords gehören nicht in unsere XML-Dateien. Ein verlässliches `lastmod` ist das brauchbare Änderungssignal. [Google: lastmod und nicht verwendete Felder](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping).

### Sprache und Land

Die fünf Hauptkontexte bleiben **de-DE, fr-FR, it-IT, es-ES und en-US**. Englisch verwendet weiterhin standardmäßig USA. Eine ausdrücklich aufgerufene englische Deutschlandseite kann einen eigenen Nutzen haben und wird nicht pauschal auf die US-Fassung kanonisiert.

Für Titel wird die Alternativgruppe über `(Medientyp, TMDB-ID)` gebildet. In diese Gruppe kommen alle tatsächlich freigegebenen Sprach-/Marktfassungen desselben Films oder derselben Serie. Jede Fassung bleibt selbstkanonisch und bekommt dieselben vollständigen, gegenseitigen Verweise. Slugs werden aus den gespeicherten Übersetzungen gelesen, nicht aus dem deutschen Titel konstruiert.

Bei Vergleichen und marktunabhängigen Informationsseiten werden sprachliche Gruppen mit `de`, `fr`, `it`, `es`, `en` verwendet. Sie haben keine erfundene Länderabhängigkeit. Optionales `x-default` bekommt nur ein stabiles, passendes Ziel: beispielsweise die vorhandene US-Englisch-Fassung desselben Titels. Fehlt sie, bleibt `x-default` für diesen Titel weg. Ein Film verweist dafür nicht auf eine allgemeine Startseite.

HTML und XML werden gemeinsam aus diesem Modell erzeugt. Google unterstützt beide Methoden; die doppelte Ausgabe dient hier der Konsistenzprüfung. [Google: lokalisierte Versionen](https://developers.google.com/search/docs/specialty/international/localized-versions).

### Bilder

Priorität erhält das echte Poster. Ein inhaltlich relevantes Hintergrundbild kann ergänzt werden; dekorative Flächen und sämtliche `srcset`-Größen brauchen keine eigenen Einträge. Aktuell stammen Poster aus dem fremden TMDB-CDN. Wir können dessen Domain nicht als unsere eigene in GSC verifizieren. Für eine vollständig kontrollierte Bildauslieferung wird deshalb eine eigene stabile Asset-Adresse eingeplant, soweit die vorhandenen Nutzungsrechte diese Auslieferung erlauben; bis zur Klärung bleibt dieser Teil ausdrücklich offen.

Bildantworten müssen ohne Anmeldung funktionieren, den richtigen MIME-Typ liefern und crawlbar sein. Die entfernten Sitemap-Felder `image:title`, `image:caption`, `image:geo_location` und `image:license` werden nicht eingebaut. Bildbeschreibungen und Alternativtexte gehören zum sichtbaren Seitenkontext beziehungsweise zum HTML. [Google: Bild-Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps), [Google: Bild-SEO](https://developers.google.com/search/docs/appearance/google-images).

### Videos und Nachrichten: vorbereitete Erweiterungen

Ein Datensatz über einen Film ist noch kein Video auf Cineradar. Eine Video-Erweiterung wird erst bei einem erreichbaren Player oder einer Videodatei mit passendem Thumbnail, Titel und Beschreibung ausgegeben. Dauer, Veröffentlichungsdatum, Einschränkungen und Ablaufangaben werden nur ergänzt, wenn sie bekannt sind. Für eine Video-Suchergebnisdarstellung muss außerdem die Eignung der eigentlichen Seite geprüft werden. [Google: Video-Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps), [Google: Video-SEO](https://developers.google.com/search/docs/appearance/video).

„Neu verfügbar“ ist keine Google-News-Kategorie. Falls Cineradar später Nachrichten veröffentlicht, erhält diese Redaktion eine eigene Erweiterung mit Publikation, Sprache, Veröffentlichungsdatum und Artikeltitel. In die News-Erweiterung kommen nur die nach Googles Vorgaben aktuellen Nachrichten; der dauerhafte Artikel bleibt in der normalen Seitensitemap. [Google: News-Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap).

## 5. Änderungsdaten und technische Veröffentlichung

**Eine Quelle für alle SEO-Entscheidungen.** Das geplante URL-Verzeichnis enthält Entität, Seitenart, Sprache, Markt, kanonische URL, getrennte Indexierungs- und Sitemap-Freigabe mit Grund, Alternativgruppe, Bilder, Inhaltsrevision und Zeitpunkt der letzten relevanten Änderung. Es erfindet keine zweite Titel- oder Angebotsdatenbank.

**Änderungsregeln.** Übersetzung, Beschreibung, Besetzung, Genres, Bilder, Laufzeit, relevante Staffelabdeckung und sichtbar verwendete strukturierte Daten können die Inhaltsrevision ändern. Marktbezogene Anbieter-, Preis- und Verfügbarkeitsänderungen betreffen die zugehörigen Länderfassungen. Das zeitgesteuerte Ablaufen eines Angebots wird ebenfalls verarbeitet, auch wenn dafür kein neuer Providerabruf stattfindet. Ohne Änderung bleibt `lastmod` gleich. Abfragezeit, Kontrollzeit, Copyright-Jahr und bloßer Deploymentzeitpunkt werden nicht als neue Inhaltsänderung ausgegeben.

Bei fehlender Historie wird keine Genauigkeit erfunden: vorhandene belastbare Zeitstempel übernehmen, sonst `lastmod` zunächst auslassen und ab der ersten belegten Änderung korrekt führen. Nach einem Import darf nicht bei sämtlichen Übersetzungen ein neues Datum entstehen, wenn nur eine Sprache verändert wurde.

**Stabile Dateien.** URLs werden innerhalb eines Segments dauerhaft einer Teildatei zugeordnet; normale Neuimporte verschieben nicht alle folgenden Seiten. Erst werden Registry und XML für eine Generation aufgebaut und validiert, dann wird der Zeiger auf die neue Veröffentlichung atomar umgestellt. Der Masterindex nennt die exakten freigegebenen Dateien dieser Generation. Unveränderte Dateien behalten Inhalt, Änderungsdatum und ETag.

Eine Generation muss auch bei getrennt gecachten Abrufen konsistent bleiben: versionierte Artefaktadressen beziehungsweise ein eindeutiger Generationsschlüssel im Index; ältere referenzierte Artefakte werden mindestens sieben Tage weiter ausgeliefert. Ein Fehler lässt die letzte geprüfte Generation bestehen. Fehlt eine solche, kommt ein ehrlicher 503 statt einer leeren „erfolgreichen“ Sitemap. Endgültig zurückgezogene oder rechtlich zu entfernende URLs benötigen einen gesonderten sofortigen Ausschlusspfad.

**Betrieb ohne neue API-Abfragen.** Sitemap-Aufrufe lesen ausschließlich veröffentlichte Artefakte. Der Generator nutzt den eigenen Datenbestand und ruft weder TMDB noch die Streaming-API auf. Für die erste Fassung sind das vorhandene PostgreSQL für Registry/Manifest und komprimierte XML-Artefakte vorgesehen. Ein zusätzlicher Speicherdienst ist keine Voraussetzung dieses Plans.

Geplante Aktualität: qualifizierte neue Titel und relevante Änderungen innerhalb von **15 Minuten** in der veröffentlichten Sitemap; vollständiger Abgleich einmal täglich. Das ist ein internes Betriebsziel, keine Zusage über Googles Crawlzeit. Der vorhandene Hosting-Cron erhält einen eigenen begrenzten Anteil für deduplizierte SEO-Jobs, unabhängig von Provider-Sync und API-Budgets. Die bisherigen Abbrüche bei `SYNC_ENABLED=false` oder `operations.sync.paused` dürfen diesen Anteil nicht stoppen: redaktionelle Änderungen und Angebotsabläufe müssen auch bei pausiertem Import weiter verarbeitet werden. Last-Modified, ETag und bedingte HTTP-Antworten reduzieren unnötige Übertragungen.

Die alten Sitemap-Adressen bleiben während des Übergangs mindestens 30 Tage erreichbar. Die Einreichungsadresse `/sitemap.xml` bleibt unverändert. Alte und neue Generationsregeln werden nicht gleichzeitig als zwei unabhängige Wahrheiten weiterentwickelt.

## 6. Was zusätzlich für bessere Suchergebnisse dazugehört

Die Sitemap macht Seiten auffindbar. Die Seite muss die Suchfrage beantworten. Für „4 Blocks“ bedeutet das beispielsweise: „Wo läuft die Serie in Deutschland?“, bestätigte Anbieter und Angebotsarten, konkrete Staffelabdeckung, Aktualitätsstand, Handlung und passende weiterführende Titel. Titel, Originaltitel, Jahr und Streamingabsicht werden natürlich eingebunden; Anbieter- und HD-Versprechen entstehen nur aus belegten Daten.

Jede Seite erhält einen eindeutigen Titel und eine zutreffende Beschreibung. Google kann sowohl Titellink als auch Snippet selbst wählen; Längen und Formulierungen werden deshalb als redaktionelle Qualitätskontrolle behandelt, nicht als Garantie einer bestimmten Darstellung. [Google: Titellinks](https://developers.google.com/search/docs/appearance/title-link), [Google: Beschreibungen und Snippets](https://developers.google.com/search/docs/appearance/snippet).

Vorhandene `WebPage`, `Movie` beziehungsweise `TVSeries`, `WebSite` und `BreadcrumbList` werden konsistent erhalten. Ergänzungen wie Regie, echtes Veröffentlichungsdatum, Staffelentitäten, `sameAs` oder redaktionelle Autoren setzen tatsächliche Daten und passende sichtbare Inhalte voraus. Aus einem gespeicherten Erscheinungsjahr wird kein erfundenes Tagesdatum. TMDB-Bewertungen werden nicht als eigene Nutzerbewertungen ausgegeben. Schema.org-Felder allein garantieren keine Google-Sonderdarstellung. [Google: strukturierte Daten](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data), [Google: Film-Markup](https://developers.google.com/search/docs/appearance/structured-data/movie).

Interne Links bilden nachvollziehbare Wege: Startseite → Film-/Serienbereich → Anbieter oder Thema → Titel → passende Titel. Genrebezeichnungen auf Detailseiten können auf freigegebene Themenseiten verlinken. Neue Titel brauchen mindestens einen normalen eingehenden HTML-Link aus einer passenden Liste; wichtige redaktionelle Seiten zusätzlich Kontextlinks.

Das gewünschte Lazy Loading bleibt erhalten. Die erste Liste wird serverseitig ausgegeben, weitere tatsächliche Seiten sind über normale Links erreichbar. Google muss keinen Button anklicken oder endlos scrollen, um die nächsten Titel zu finden. Echte Folgeseiten bekommen eigene Canonicals; `page=1`, unzulässige Parameter auf Detailseiten und Seiten hinter dem Listenende werden sauber normalisiert beziehungsweise abgewiesen. [Google: Lazy Loading](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading), [Google: Pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).

`robots.txt` verweist weiter auf den Masterindex. CSS, JavaScript, Poster und notwendige Rendering-Ressourcen bleiben erreichbar. Eine `noindex`-Seite darf nicht zugleich so gesperrt werden, dass Google diese Anweisung nicht lesen kann. Für geeignete öffentliche Seiten wird `max-image-preview:large` vorgesehen; unnötige `nosnippet`- oder `noimageindex`-Sperren werden ausgeschlossen. Das erlaubt größere Vorschauen, erzwingt sie aber nicht. Der öffentliche Inhalt einer expliziten Sprach-/Länder-URL wird nicht je nach Googlebot, IP oder Cookie ausgetauscht. [Google: Robots- und Vorschauangaben](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).

## 7. Umsetzung in vier abnehmbaren Schritten

| Schritt                           | Ergebnis                                                                                                                           | Freigabebedingung                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. URL- und Inhaltsregeln         | Vollständiges Inventar aller Seitenarten; bevorzugte Informationsseiten; klare Freigabegründe; bereinigte Parameter und Pagination | Keine Sitemap-Kandidaten mit widersprechendem Canonical oder `noindex`; genehmigte Sprach-/Marktvarianten dokumentiert                      |
| 2. Änderungs- und Sprachmodell    | Gemeinsame Registry, relevante Änderungsrevisionen, Länder-/Sprachgruppen, geeignete Bildquellen                                   | Unveränderte Aktualisierung verändert kein `lastmod`; echte Änderung erreicht nur betroffene Varianten; alle Alternativziele gültig         |
| 3. Generator und Veröffentlichung | Segmentierte XML-Dateien, Manifest, Größenprüfung, atomare Veröffentlichung und Rückfall auf geprüfte Generation                   | Keine Auslassungen oder Dubletten beim Import während der Generierung; keine leeren angekündigten Dateien; keine Providerabfrage beim Abruf |
| 4. Produktionsprüfung und GSC     | Öffentliche Masteradresse, geprüfte Stichproben, Übergang alter Dateien, Einreichungsanleitung                                     | Master und Kinder abrufbar; Inhalte stimmen mit Seiten überein; Abnahmeprotokoll liegt vor                                                  |

Vor der Einreichung werden folgende Kriterien geprüft:

1. Jede zur Sitemap freigegebene kanonische URL ist genau einmal als `<loc>` in den regulären Teildateien dieser Generation enthalten. Alternativverweise zählen nicht als Dubletten.
2. Der Vergleich „Registry-URLs mit `sitemapEligible=true` gegen veröffentlichte XML-URLs“ ergibt keine fehlenden oder zusätzlichen URLs. Indexierbare, bewusst nicht aufgenommene Pagination bleibt davon unberührt.
3. XML ist valide, UTF-8, korrekt escaped und innerhalb beider Betriebsgrenzen; der Master enthält keine leeren Dateien und keine Unterindizes.
4. Sämtliche Alternativziele existieren, sind freigegeben, selbstkanonisch und gegenseitig verknüpft; HTML und XML stimmen überein.
5. Keine ausgeschalteten Märkte, Testdaten, Preview-Adressen, privaten Pfade, Weiterleitungsslugs oder Such-/Filtervarianten.
6. Reale HTTP-Stichproben aus jeder Seitenfamilie und allen fünf Hauptkontexten bestätigen Status, Canonical, Robots und Inhalt. Ein vollständiger Linkcheck läuft begrenzt und verteilt über die Sitemap-URLs.
7. Regressionen decken „4 Blocks“ nach Import, „1917“ als numerischen Titel, fehlende Übersetzung, erfolgreich leeren Markt, Angebotsablauf, kurzzeitigen API-Ausfall, Slugwechsel und Katalogänderung während des Exports ab.
8. Lastmod-Prüfung: keine Zukunftsdaten, keine Änderung durch bloßes Polling, korrekte Fortschreibung bei Text-, Bild- und Marktänderungen.
9. Bild- und Social-Vorschauen liefern passende öffentliche Antworten; defekte Poster entfernen nicht automatisch eine sonst wertvolle Seite aus der Web-Sitemap.
10. Ein unterbrochener Export lässt die letzte geprüfte Sitemap bestehen. Der nächste erfolgreiche Export holt Änderungen nach.

## 8. Deine Einreichung in der Google Search Console

Nach Umsetzung und Abnahme:

1. Die bestätigte Domain-Property **cineradar.tv** öffnen; alternativ die passende bestätigte URL-Präfix-Property `https://cineradar.tv/`.
2. Unter **Sitemaps → Neue Sitemap hinzufügen** die öffentliche Masteradresse `https://cineradar.tv/sitemap.xml` einreichen. Wenn die Oberfläche den Domainpräfix bereits vorgibt, genügt `sitemap.xml`.
3. Auf erfolgreichen Abruf und Verarbeitung prüfen. Eine bestehende Einreichung derselben Adresse muss nicht bei jedem Filmimport erneut angelegt werden.
4. In der URL-Prüfung exemplarisch „4 Blocks“, einen Film, einen Anbieter, einen Vergleich und eine US-Englisch-Seite prüfen. Googles ausgewähltes Canonical mit unserem erwarteten Canonical vergleichen.
5. Problematische Teilbereiche bei Bedarf über ihre einzelne Sitemap in GSC genauer verfolgen. Die Segmentierung dient insbesondere der Trennung von Filmen, Serien, Ländern und redaktionellen Seiten.

Die Sitemap wird auf Cineradar gehostet und dort automatisch aktualisiert. GSC erhält ihre Adresse, nicht die Plan-Datei und keinen einmaligen lokalen Katalogexport. [Google: Sitemaps-Bericht](https://support.google.com/webmasters/answer/7451001?hl=de).

Für die ersten 28 Tage ist ein Auswertungsplan vorgesehen: technischer Abruf nach Veröffentlichung, Kontrollen nach 7, 14 und 28 Tagen. Pro Segment werden freigegebene URLs, eingereichte URLs, Indexierungsstatus und Ablehnungsgründe verglichen. Impressionen, Klicks und Suchanfragen werden zusätzlich nach Seitengruppe, Sprache und Nutzerland betrachtet. Ein technisch erfolgreicher Sitemap-Abruf ist noch kein Nachweis, dass alle Seiten indexiert wurden. [Google: Seitenindexierung](https://support.google.com/webmasters/answer/7440203?hl=de).

Warnungen sollen intern entstehen, wenn eine Generation mehr als 30 Minuten hinter fälligen Änderungen zurückliegt, erwartete Segmente verschwinden, URL-Zahlen ohne geplante Änderung deutlich fallen oder Canonical-/Robots-Widersprüche auftreten. Diese Überwachung ist Teil der geplanten Implementierung; mit diesem Dokument wurde noch keine Automation eingerichtet.

**Abnahmeziel:** Die Masteradresse liefert jederzeit eine konsistente, überprüfbare Auswahl aller freigegebenen Cineradar-Seiten samt sinnvollen Erweiterungen. Neue Inhalte kommen automatisch hinzu, Fehler werden sichtbar, und deine GSC-Einreichung bleibt dauerhaft dieselbe.
