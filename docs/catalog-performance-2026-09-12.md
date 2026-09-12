# Katalog- und Navigationsperformance, 12. September 2026

## Ausgangsmessung

Öffentliche, ausschließlich lesende GETs auf die Live-Domain. Drei aufeinanderfolgende Abrufe je Route; curl folgte Weiterleitungen und lud das vollständige Dokument. Keine Kompression angefordert. Ein erster Abruf ist kein gesicherter Nachweis eines kalten Serverprozesses.

| Route | TTFB, erster Abruf | TTFB, weitere Abrufe | Gesamtzeit, erster Abruf | Gesamtzeit, weitere Abrufe | HTML-Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/de/de/` | 3,200 s | 0,298 / 0,248 s | 5,566 s | 2,962 / 2,878 s | 553.239 |
| `/en/us/` | 4,307 s | 0,263 / 0,305 s | 5,980 s | 3,255 / 2,825 s | 574.990 |
| `/fr/fr/` | 3,186 s | 0,250 / 0,244 s | 5,121 s | 2,737 / 2,718 s | 551.314 |

Die Zeit bis zum ersten Byte allein verdeckt hier den langsameren Abschluss des gestreamten Dokuments.

## Datenbankbefund

Read-only-Messung über den vorhandenen PostgreSQL-Zugang von diesem Rechner zur Produktionsdatenbank, ohne Änderungen an Datensätzen oder Schema. Acht deutsche Home-Shelves einschließlich vorgeschalteter Providerabfrage dauerten ohne den bestehenden Katalogcache 2.773 und 2.636 ms. Dabei entstanden acht Rankingabfragen, obwohl nur vier unterschiedliche Rankinggruppen benötigt werden.

`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` auf zwei regulären SELECTs ergab vor Migration 012:

- Allgemeine Trending-Shelf: 294 ms Ausführungszeit, 5.317 passende Titel, 4.982 gelesene Shared Blocks.
- Netflix-Shelf: 516 ms Ausführungszeit. Ein paralleler Sequential Scan auf `offers` betrachtete etwa 754.000 Angebote und verwarf den Großteil. Der Plan las insgesamt 101.865 Shared Blocks. Der vorhandene Index `(market,title_id)` kann den Anbieter nicht eingrenzen.

## Änderungen

- Migration `012_catalog_performance.sql` ergänzt Indizes auf `(market,provider_id,title_id)` und `(market,data->>'type',title_id)`, jeweils mit `expires_at`. Migration `013_catalog_availability_index.sql` ergänzt denselben deckenden Ablauf für allgemeine Verfügbarkeitsprüfungen auf `(market,title_id) INCLUDE(expires_at)`. Es gibt keinen als unveränderlich deklarierten Datumsparser und keine direkte Schemaänderung außerhalb des Migrationsablaufs.
- Release-/New-Shelves berechnen keine ungenutzte Gesamtzahl mehr. Provider-/Free-/Trending-Shelves behalten den bisherigen Plan mit Windowzählung: Die reale Gegenprobe zeigte sonst eine verspätete Anbieterprüfung nach Sortierung des gesamten Katalogs (Netflix 310 statt 60 ms). Paginierte Kataloge behalten ihre exakte Zählung.
- Home- und Listingdaten starten parallel zur Providerabfrage. Informations-, Watchlist- und Detailseiten warten nicht mehr auf eine ungenutzte Providerliste.
- Öffentliche Ranking- und Providerabfragen verwenden den vorhandenen begrenzten Prozesscache. Sprache und Markt bleiben Teil des Katalogschlüssels; Suchtexte und persönliche Anbieterfilter werden weiterhin nicht öffentlich zwischengespeichert.
- Alle Home-Shelves teilen eine frische Artworkabfrage außerhalb des Katalogcaches. Rückgezogene Bilder verschwinden weiterhin unmittelbar; einzelne Titelversionen in den Ergebnissen bleiben erhalten.
- Metadaten und Seiteninhalt teilen die Routenauflösung anhand primitiver Schlüssel.
- Interne Links laden erst bei Hover/Fokus vor. Sprach-/Landoptionen laden nur das konkrete Ziel bei Maus-/Fokusabsicht vor. Während der Navigation zeigt die Auswahl den gewählten Wert und meldet `aria-busy`; weitere Kontextwechsel sind bis zum Abschluss deaktiviert. Queryparameter und History-Push-Verhalten bleiben erhalten.

Vor Anwendung der Indizes dauerte die zunächst durchgehend zählungsfreie kalte Datenstrecke noch 2.627 ms; eine sofortige Wiederholung traf den bereits zuvor vorhandenen Katalogcache und dauerte 6 ms. Diese Zahlen sind **kein** belastbarer Vorher/Nachher-Nachweis einer entsprechenden Beschleunigung.

Die Nachmessung nach Migration 012 machte eine zusätzliche Planregression sichtbar: PostgreSQL wählte den neuen Providerindex auch für allgemeine Verfügbarkeitsprüfungen ohne Anbieterfilter. Das führte zu wiederholten Scans über dessen nicht eingegrenzte mittlere Spalte (425.815 Shared Buffer Hits; allgemeine Shelf 2.674 ms). Die Netflix-Shelf selbst verbesserte sich auf 185 ms und 842 gelesene Blöcke. Deshalb ergänzt Migration 013 ausdrücklich einen passenden deckenden Index für die ungefilterte Prüfung; die Beurteilung des Gesamtergebnisses erfolgt erst nach dieser Korrektur.

## Abschließende Datenbankmessung nach Migrationen 012 und 013

Alle drei neuen Indizes wurden anschließend mit `indisvalid=true` und `indisready=true` geprüft. Datenbankdiagnose und HTTP-Abrufe liefen nacheinander. Die App war zu diesem Zeitpunkt noch nicht mit den neuen UI-/Cacheänderungen ausgerollt.

| Messung | Vorher | Nach gültigen Indizes |
| --- | ---: | ---: |
| Allgemeine Trending-Shelf, EXPLAIN-Ausführungszeit | 294 ms | 309 / 279 ms |
| Netflix-Shelf, EXPLAIN-Ausführungszeit | 516 ms | 56 / 63 ms |
| Netflix-Shelf, gelesene Shared Blocks | 101.865 | 462 / 0 |
| Bisheriges Home-Abfragemuster ohne Prozesscache, erster Lauf | 2.773 ms | 1.528 ms |
| Bisheriges Home-Abfragemuster ohne Prozesscache, zweiter Lauf | 2.636 ms | 1.287 ms |

Die allgemeine Shelf verwendet nun den passenden Index `offers_market_title_validity`; der zwischenzeitliche Fehlplan ist beseitigt. Die Anbieterabfrage benötigt in diesen Stichproben etwa 88–89 % weniger Datenbankzeit. Das bisherige Home-Abfragemuster benötigt etwa 45–51 % weniger Zeit.

Die abschließende neue Home-Datenstrecke mit selektiv erhaltener Windowzählung, parallel gestarteten Providern und vier statt acht Rankingabfragen dauerte 1.425 ms; alle acht Shelves lieferten jeweils zwölf Titel. Ein unmittelbarer Cachetreffer dauerte 8 ms. Die Diagnose verwendete die bestehende lokale PostgreSQL-Konfiguration; dort war die Artworkfunktion deaktiviert. Die Bündelung der frischen Artworkabfrage ist deshalb separat durch den Transporttest belegt. Die nachfolgende Live-Messung der vollständigen App ist unten ausgewiesen.

## Live-GETs nach den Indexmigrationen, vor App-Deployment

Gleiche curl-Methode wie bei der Ausgangsmessung; die Dokumentgrößen blieben identisch.

| Route | TTFB, erster Abruf | TTFB, weitere Abrufe | Gesamtzeit, erster Abruf | Gesamtzeit, weitere Abrufe |
| --- | ---: | ---: | ---: | ---: |
| `/de/de/` | 2,317 s | 0,341 / 0,278 s | 4,556 s | 2,917 / 2,804 s |
| `/en/us/` | 3,017 s | 0,279 / 0,249 s | 5,121 s | 2,769 / 2,779 s |
| `/fr/fr/` | 1,584 s | 0,274 / 0,255 s | 3,879 s | 2,954 / 2,772 s |

Die ersten Abrufe sind gegenüber der ursprünglichen Messung schneller; wiederholte vollständige HTML-Streams liegen weiterhin bei rund 2,77–2,95 Sekunden. Für diese warmen Dokumentabrufe lässt sich aus der Indexmigration allein noch kein deutlicher Gewinn ableiten. Die Auslieferung und Browserprüfung der neuen Artworkbündelung und UI-Navigation standen zu diesem Messzeitpunkt noch aus.

## Finale Live-GETs nach App-Deployment

Der Hauptagent bestätigte Commit `fa4b32c`, Deployment `dpl_3zxvSWnoUX2R9qZ1LKp2fKGScWwr` und den produktiven Alias `https://cineradar.tv`. Anschließend wurden erneut drei vollständige GETs pro Route mit derselben curl-Methode ohne angeforderte Kompression ausgeführt. Alle neun Antworten hatten HTTP-Status 200.

| Route | TTFB, erster Abruf | TTFB, weitere Abrufe | Gesamtzeit, erster Abruf | Gesamtzeit, weitere Abrufe | HTML-Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/de/de/` | 2,295 s | 0,334 / 0,274 s | 4,494 s | 3,201 / 2,771 s | 549.679 |
| `/en/us/` | 2,215 s | 0,257 / 0,277 s | 4,496 s | 2,861 / 2,881 s | 571.351 |
| `/fr/fr/` | 1,431 s | 0,393 / 0,447 s | 3,737 s | 2,902 / 3,015 s | 547.745 |

Gegenüber den ersten Abrufen der ursprünglichen Messreihe sank die Zeit bis zum ersten Byte in diesen Stichproben um 28 % (de), 49 % (en) und 55 % (fr). Die Zeit für das vollständige erste Dokument sank um 19 %, 25 % und 27 %. Die wiederholten vollständigen Abrufe liegen dagegen bei 2,77–3,20 Sekunden und zeigen weiterhin **keinen konsistenten Geschwindigkeitsgewinn** gegenüber der ursprünglichen Spanne von 2,72–3,25 Sekunden.

Die Reihen wurden zeitlich getrennt gemessen; Zustand von Serverprozess, Datenbank-/Anwendungscaches und Netz waren nicht kontrolliert. Deshalb belegen die ersten Abrufe eine beobachtete Verbesserung in diesen Stichproben, jedoch keinen isolierten, garantierten Kaltstartgewinn. Gemessen wurde das komplette unkomprimiert angeforderte HTML-Dokument, nicht LCP oder eine bereits vorbereitete Clientnavigation. Die gezielten Datenbankpläne und Tests liefern den getrennten Nachweis für weniger Datenbankarbeit und korrektes Navigationsverhalten.

## Zusätzlicher Befund: wiederholte Landing-Metadatenabfrage

Die Untersuchung des verbleibenden wiederholten Delays zeigte anschließend einen separaten Engpass: `metadata()` wartet für öffentliche, ungefilterte Landingpages auf `landingAlternates()`. Dessen Abfrage zählt die möglichen Katalogseiten für alle fünf Sprachen und fünf Länder gemeinsam; vor dieser Korrektur wurde dieselbe Berechnung für jeden einzelnen Seitenabruf erneut ausgeführt. Damit löste auch ein reiner Sprach- oder Landwechsel die Berechnung aller 25 Kontexte nochmals aus.

Die SQL-Abfrage und ihre Eligibility-Regeln bleiben unverändert. Ihr erfolgreiches Ergebnis wird nun strikt 20 Sekunden ab Abschluss der Abfrage im Prozess gespeichert. Gleichzeitige Aufrufer teilen eine laufende Abfrage. Der global auf 128 Einträge begrenzte LRU-Cache unterscheidet Datenbank-Objektidentität, aktivierte Länder, Origin, Route, Tail und Seitennummer. Die aktuelle Besuchersprache bzw. das aktuelle Land brauchen keinen zusätzlichen Schlüssel, weil das Ergebnis bereits sämtliche unterstützten Kombinationen enthält. Ergebnisse werden pro Aufrufer kopiert. Fehler werden nicht gespeichert; nach Ablauf gibt es keinen Rückgriff auf veraltete Eligibility-Daten. Verdrängte laufende Abfragen dürfen bei späterem Abschluss weder den Cache vergrößern noch einen neueren Eintrag ersetzen.

Read-only-Nachweis mit der produktiven Datenbank und genau derselben Home-Landingabfrage:

| Aufruf | Dauer | Neue Datenbankabfragen | Alternates |
| --- | ---: | ---: | ---: |
| Ungecachte Abfrage, Lauf 1 | 2.891,839 ms | 1 | 25 |
| Ungecachte Abfrage, Lauf 2 | 2.601,135 ms | 1 | 25 |
| Erster Cacheaufruf mit 25 gleichzeitigen Aufrufern | 2.636,007 ms | 1 insgesamt | je 25 |
| Anschließender Cachetreffer, Lauf 1 | 0,069 ms | 0 | 25 |
| Anschließender Cachetreffer, Lauf 2 | 0,019 ms | 0 | 25 |

Dies belegt die Wiederverwendung der aufwendigen Metadatenberechnung innerhalb desselben Prozesses und TTL-Fensters. Es ist keine garantierte Gesamtseiten-Beschleunigung: Der erste Aufruf eines Prozesses bzw. einer abgelaufenen Landing bleibt eine echte Datenbankabfrage. Die oben aufgeführten Live-GETs für Commit `fa4b32c` wurden vor dieser zusätzlichen Korrektur gemessen; ihre abschließende Live-Prüfung folgt mit dem nächsten Deployment.

## Prüfung

- 28 gezielte Tests aus `catalog-performance`, `search-ranking`, `metadata-pagination`, `metadata` und `media-projection` bestanden.
- Der neue Transporttest bestätigt 3 Provider-Shelves mit 1 Ranking- und 1 Artworkabfrage, getrennte Länder-/Sprachcaches, ungecachte private Filter, erhaltene Listingzahlen, sofortigen Bildrückzug und erneuten Providerabruf nach transientem Fehler.
- Die bestehenden SQL-Rankingfälle prüfen zusätzlich, dass Shelves ohne Gesamtzählung dieselben ersten fünf Titel liefern.
- Nach dem zusätzlichen Index und der Queryplan-Anpassung wurden die fünf SQL-Rankingtests und der Cachetest erneut erfolgreich ausgeführt. Der Neon-Mock unterstützt auch den parallel integrierten Transaktions-Timeout.
- TypeScript und Oxlint für die geänderte Navigations-/Katalogstrecke bestanden.
- `test/e2e/navigation-performance.spec.ts` ergänzt einen verzögerten Sprachwechsel mit optimistischer Anzeige sowie Filter-/Back-/Forward-Prüfung. Der Hauptagent meldete sechs erfolgreiche Browserprüfungen und eine erfolgreiche mobile CUA-Prüfung.
- Sechs zusätzliche Landing-Cachetests decken parallele Aufrufer, TTL ab Queryabschluss, Fehler-/Staleverhalten, unveränderliche Rückgaben, sämtliche Kontextschlüssel, LRU-Grenze und verspätete Antworten verdrängter Abfragen ab. Die bestehenden SQL-Pagination-/Eligibilitytests verwenden den unveränderten ungecachten Loader, damit ihre unmittelbar aufeinanderfolgenden Fixtureänderungen weiterhin geprüft werden.

Die Datenbank- und Live-GET-Nachmessungen für Commit `fa4b32c` sind abgeschlossen. Für den anschließend ergänzten Landing-Metadatencache steht die Live-Prüfung des nächsten Deployments noch aus. Die Angaben zur Browserprüfung stammen vom Hauptagenten; dieses Teilprojekt führte ausschließlich lesende HTTP-/Datenbankdiagnosen und lokale Tests aus.
