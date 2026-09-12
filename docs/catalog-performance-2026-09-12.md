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

Die abschließende neue Home-Datenstrecke mit selektiv erhaltener Windowzählung, parallel gestarteten Providern und vier statt acht Rankingabfragen dauerte 1.425 ms; alle acht Shelves lieferten jeweils zwölf Titel. Ein unmittelbarer Cachetreffer dauerte 8 ms. Die Diagnose verwendete die bestehende lokale PostgreSQL-Konfiguration; dort war die Artworkfunktion deaktiviert. Die Bündelung der frischen Artworkabfrage ist deshalb separat durch den Transporttest belegt und noch über das finale App-Deployment zu messen.

## Live-GETs nach den Indexmigrationen, vor App-Deployment

Gleiche curl-Methode wie bei der Ausgangsmessung; die Dokumentgrößen blieben identisch.

| Route | TTFB, erster Abruf | TTFB, weitere Abrufe | Gesamtzeit, erster Abruf | Gesamtzeit, weitere Abrufe |
| --- | ---: | ---: | ---: | ---: |
| `/de/de/` | 2,317 s | 0,341 / 0,278 s | 4,556 s | 2,917 / 2,804 s |
| `/en/us/` | 3,017 s | 0,279 / 0,249 s | 5,121 s | 2,769 / 2,779 s |
| `/fr/fr/` | 1,584 s | 0,274 / 0,255 s | 3,879 s | 2,954 / 2,772 s |

Die ersten Abrufe sind gegenüber der ursprünglichen Messung schneller; wiederholte vollständige HTML-Streams liegen weiterhin bei rund 2,77–2,95 Sekunden. Für diese warmen Dokumentabrufe lässt sich aus der Indexmigration allein noch kein deutlicher Gewinn ableiten. Die neue Artworkbündelung und die UI-Navigationsänderungen benötigen die anschließende App-Auslieferung und Browserprüfung.

## Prüfung

- 28 gezielte Tests aus `catalog-performance`, `search-ranking`, `metadata-pagination`, `metadata` und `media-projection` bestanden.
- Der neue Transporttest bestätigt 3 Provider-Shelves mit 1 Ranking- und 1 Artworkabfrage, getrennte Länder-/Sprachcaches, ungecachte private Filter, erhaltene Listingzahlen, sofortigen Bildrückzug und erneuten Providerabruf nach transientem Fehler.
- Die bestehenden SQL-Rankingfälle prüfen zusätzlich, dass Shelves ohne Gesamtzählung dieselben ersten fünf Titel liefern.
- Nach dem zusätzlichen Index und der Queryplan-Anpassung wurden die fünf SQL-Rankingtests und der Cachetest erneut erfolgreich ausgeführt. Der Neon-Mock unterstützt auch den parallel integrierten Transaktions-Timeout.
- TypeScript und Oxlint für die geänderte Navigations-/Katalogstrecke bestanden.
- `test/e2e/navigation-performance.spec.ts` ergänzt einen verzögerten Sprachwechsel mit optimistischer Anzeige sowie Filter-/Back-/Forward-Prüfung. Die Browserausführung erfolgt durch den Hauptagenten.

Die Datenbankindizes sind abschließend gemessen. Eine abschließende Live-Messung und Browserprüfung nach Deployment der App-Änderungen steht noch aus.
