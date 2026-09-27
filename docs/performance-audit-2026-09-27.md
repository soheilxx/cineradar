# Cineradar: Performance-Diagnose vom 27. September 2026

## Ergebnis

Der belegte Hauptengpass liegt in aufwendigen Katalog-/SEO-Abfragen und konkurrierender Hintergrundlast in PostgreSQL. Ein unveränderter Wechsel von Vercel zu AWS nimmt diese Engpässe mit. Die aktuelle Anwendung skaliert bei Katalogwachstum und parallelen Zugriffen nicht ausreichend; zuerst Datenzugriff und Auslieferung korrigieren.

Die Prüfung war lesend. Es wurden keine Einstellungen, Produktionsdaten, Indizes oder Anwendungsdateien geändert, keine Anbieterimporte gestartet und keine AWS-Ressourcen angelegt.

## Live-Messungen

Zeitfenster ca. 20:43–20:47 Uhr MESZ. Einzelabrufe und begrenzte SQL-Diagnose, kein Lasttest. Die Datenbankmessungen liefen unter bestehender Produktionslast; alle ausführenden Diagnoseabfragen hatten ein 12-Sekunden-Limit. Lokale Netzwerkzeiten sind nicht mit SQL-Ausführungszeiten gleichzusetzen.

| Messung | Ergebnis |
| --- | --- |
| Öffentliche Health-Route, Node HTTP | 201 ms bis Header, 204 ms vollständig, HTTP 200 |
| Startseite, Node HTTP | Verbindung nach 30,0 Sekunden abgebrochen, kein vollständiges Dokument |
| Filmübersicht, Node HTTP | Antwort nach 24,1 Sekunden abgebrochen, kein vollständiges Dokument |
| Startseite im Codex-Browser | Error 503 / Service Unavailable |
| Person-of-Interest-Detail, Node HTTP | 734 ms bis Header, 797 ms vollständig, HTTP 200 |
| Detaildokument, entpackte Größe | 1.487.328 Bytes, ohne separat geladene Bilder/JS |
| SQL SELECT 1 | 28 ms |
| SQL gezielter Titelabruf mit 582 Angeboten | 270 ms |
| SQL aktuelle Filme auf Startseite | 2,04 Sekunden |
| SQL Netflix-Auswahl auf Startseite | 11,36 Sekunden |
| SQL Trends, ähnliche Titel, Suche Lucifer und Landing-hreflang | jeweils nach 12 Sekunden abgebrochen |

Separater curl-Durchlauf: Serienübersicht ohne Antwort nach 35 Sekunden; weitere Abrufe hatten TLS-/Transferabbrüche. Diese Transportfehler werden nicht als präzise Serverlaufzeiten interpretiert. Weitere Benchmarkabrufe wurden bei erkennbarer Datenbanksättigung begrenzt. Keine belastbaren neuen Core-Web-Vitals-/Lighthousewerte, da die Startseite im Browser fehlschlug.

Vercel bestätigte die aktive Produktion vom 12.09.2026, Deployment dpl_CmfZK5fdS3ZYNrn2GVdf7qDSC3Fx, Status Ready. Ein erfolgreicher Build belegt nicht die aktuelle Laufzeitqualität. Die jüngsten 100 Requestlogs deckten nur ca. 11 Sekunden ab; 42 Einträge hatten Status 0. Aus dieser Stichprobe lässt sich keine allgemeine Fehlerrate berechnen. Die Error-Log-Abfrage lieferte keine passenden Einträge; das widerlegt die direkt beobachteten Abbrüche nicht.

## Datenbank und Ursachen

### 1. Wachstum trifft auf teure Abfrageformen

Aktuell exakt 43.096 Katalogtitel: 6.147 Filme und 36.949 Serien. Am 12.09. waren es 9.346 Titel. Die Datenbank umfasst rund 6.173 MB; die Tabellenstatistik schätzt 2,46 Millionen Angebote.

Die Netflix-Auswahl verarbeitet alle 43.096 Titel und 2.613 passende Datensätze mit Sprach-/Snapshot-Lookups für zwölf ausgegebene Karten. Window-Gesamtzählungen, JSON-basierte Sortierung und korrelierte Suchbewertungen erschweren frühe Begrenzung auf tatsächlich sichtbare Ergebnisse.

Stellen: data/repositories/catalog.ts:178 und :263.

### 2. Sitemap-Fehler erzeugt wiederkehrende Zusatzlast

Produktionszustand bei Prüfung:

- Letzter erfolgreicher Export: 13.09.2026, 06:36:11 UTC.
- Letzter beobachteter Versuch: 27.09.2026, 18:45:20 UTC.
- Fehler: sitemap_export_failed.

Der minütliche Cron beginnt mit dem Sitemapexport. Das 15-Minuten-Gate berücksichtigt nur last_success. Nach Fehlschlägen wird die Sperre freigegeben, sodass der nächste Cron erneut beginnt. Die Exportabfrage aggregiert und hasht vollständige JSON-Angebote über den gesamten Bestand. Ein solcher Scan lief während der Diagnose bereits 23 Sekunden. Die Fehlerursache ist im gespeicherten Fehlercode nicht weiter aufgeschlüsselt; die beobachtete hohe Scanlast und Wiederholungslogik sind dagegen belegt.

Stellen: seo/sitemap-publish.ts:280, :290, :447; app/api/cron/route.ts:20; vercel.json.

Damit betrifft der Defekt sowohl Performance als auch die Aktualität der veröffentlichten Sitemap. Die letzte erfolgreiche Generation bleibt erhalten.

### 3. SEO und Seiteninhalt blockieren den sichtbaren Aufbau

Landing-Metadaten prüfen Titel × fünf Sprachen × fünf Länder im Seitenaufruf. Das Ergebnis wird nur 20 Sekunden innerhalb des jeweiligen Serverprozesses gespeichert. Die Startseite wartet auf Provider und acht Katalogreihen samt Artworkprojektion; Detailseiten warten auch auf ähnliche Titel. Header und Hauptinhalt werden erst anschließend zurückgegeben. Eine langsame Reihe hält so den gesamten sichtbaren Seitenaufbau auf.

Stellen: seo/landings.ts:20 und :105; app/[locale]/[market]/[[...segments]]/page.tsx:164 und :193.

### 4. Cache entlastet mehrere Serverinstanzen nicht gemeinsam

Öffentliche Katalogdaten liegen in einer lokalen Map: 30 Sekunden frisch, danach begrenzte Stale-Nutzung. Andere bzw. neue Funktionsinstanzen haben diesen Inhalt nicht. Die Route rendert dynamisch. Die Request-CSP verwendet Nonces, daher wäre ein blindes Umschalten auf statisches HTML/ISR keine sichere Korrektur.

Stellen: data/cache.ts:8; page.tsx:42; middleware.ts:29; app/layout.tsx:30.

### 5. Aktive Datenbankkonkurrenz

Beobachtet wurden bis zu 23 gleichzeitig aktive Katalogabfragen und Laufzeiten bis 27 Sekunden. Viele warteten auf BufferMapping beziehungsweise Neon/FileCache_Read. 94 Verbindungen bei einem Limit von 450 deuten nicht auf ein ausgeschöpftes Verbindungslimit. Einfache Punktzugriffe blieben deutlich schneller als breite Scans. Datenbank-CPU-/RAM-Dashboardwerte wurden nicht erhoben; eine konkrete Compute-Tarifempfehlung wäre deshalb verfrüht.

## Weitere Verstärker

- Eigene Coverauslieferung: Nach einem CDN-Miss erfolgt erst eine Datenbankprüfung, dann ein privater Blobabruf. Cachezeit maximal 300 Sekunden. Die Freigabe-/Rückzugslogik muss bei Verbesserungen erhalten bleiben. Stelle: data/media/serve.ts:28–62.
- Client-Code: Lokales Produktionsmanifest vom 12.09. verteilt dieselben sechs UI-Chunks auf viele Catch-all-Seiten: rund 925 KB unkomprimiert bzw. 274 KB gzip, zusätzlich Runtime. KI-/Voice-Code ist auf der Startseite statisch eingebunden, auch bei geschlossenem Bereich. Die aktuelle Live-Deploymentversion stimmt mit diesem Zeitraum überein; ein vollständiges frisches Browser-Waterfall konnte wegen des Fehlers nicht abgeschlossen werden.
- Suche/Auswahlfelder warten auf Hydration. Beim Länderwechsel fehlt ein eigenständiger Route-Loading-Zustand. Das verschärft die wahrgenommene Trägheit.
- Die Detailseite kann hunderte Angebote mehrfach als Props/Staffeldaten übertragen. Das gemessene 1,49-MB-Dokument zeigt das Optimierungspotenzial, obwohl dieser konkrete Abruf schnell beantwortet wurde.

Diese Punkte sind sekundäre, im Code belegte Faktoren. Ihr jeweiliger Anteil an LCP/Interaktivität ist noch nicht separat quantifiziert.

## Priorisierte Korrektur

1. **Sitemap-Schleife entlasten:** Fehler-Backoff anhand des letzten Versuchs ergänzen, bestehende veröffentlichte Generation behalten, Fehlerursachen getrennt protokollieren. Vollständiges Angebots-Hashing anschließend durch inkrementelle Revisionen und begrenzte Exportabschnitte ersetzen.
2. **Teure Berechnungen aus Seitenaufrufen entfernen:** Home-Rankings und SEO-Alternates vorab erzeugen bzw. instanzübergreifend speichern; definierte Aktualität und Invalidierung statt bloß längerem Prozesscache.
3. **SQL auf sichtbare Ergebnisse begrenzen:** indexierte Kandidaten/IDs zuerst, volle Titel-/Angebotsdaten danach. Unnötige Gesamtzählungen aus Shelves entfernen; Suche über geeignete indexierte Vorauswahl. Querypläne unter realem Bestand gegenprüfen.
4. **Sichtbaren Bereich früh liefern:** Header, Suche und erste Reihe unabhängig rendern, sekundäre Inhalte mit Suspense nachladen; echten Ladezustand beim Kontextwechsel ergänzen.
5. **Bilder und Clientdaten abspecken:** Cache/Invalidierung der Bildauslieferung optimieren, KI-/Voice-Code bei Bedarf laden, große Angebotslisten kompakter übertragen.
6. **Erneut messen:** Kalt-/Warmabrufe, mobiles Rendering, Kontextwechsel und Verhalten während laufender Jobs. Erst danach verbleibenden Hosting-/Compute-Bedarf entscheiden.

## AWS-Bewertung

Vercel Functions verwenden bereits Frankfurt (fra1), Neon liegt ebenfalls in Frankfurt (eu-central-1). Die Grundbedingung kurzer Wege ist erfüllt. [Vercel: Function regions](https://vercel.com/docs/functions/configuring-functions/region)

AWS ECS/Fargate mit dauerhaft laufenden Next-Containern und getrennten Workern ist eine mögliche spätere Architektur. Auch dort benötigen mehrere Instanzen einen gemeinsamen Cache; ineffiziente SQL-Abfragen bleiben ineffizient. [Next.js: Self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [AWS ECS scaling](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html)

Amplify ist für dieses konkrete Next-16.3.4-Projekt kein ungeprüfter Direktersatz: Die aktuell geprüfte Dokumentation nennt Next 12–15 und führt Streaming/On-Demand ISR unter nicht unterstützt. [AWS Amplify support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)

Empfehlung: Vorerst keinen Hostingumzug starten. Zuerst die nachgewiesenen Datenbank-/Sitemap-/Cacheursachen beseitigen. Eine Migration ohne diese Korrekturen hätte keinen belegten Performancegewinn.

## Umsetzung nach Freigabe

Der Nutzer hat die Korrektur beauftragt. Migrationen 014 und 015 wurden am 27.09. gegen die Produktionsdatenbank angewendet. Der erste Versuch wurde wegen einer kurzen Sperrwartefrist abgebrochen; der anschließende begrenzte Versuch war erfolgreich. Die Migrationen ergänzen automatisch gepflegte Sortierfelder, Suchindizes und eine wiederaufbaubare Tabelle für Sitemap-Fingerprints.

- Katalog: Kandidaten und Reihenfolge vor vollständigen Titel-/Angebotsdaten; Home-Reihen ohne Gesamtzählungen; indexgestützte Suche und bevorzugte Ranking-Präfixe.
- SEO: begrenzte Existenzprüfungen statt vollständiger Counts über alle Varianten. Netflix-Landing Seite 2: 462 ms statt Überschreitung von 15 Sekunden. Film-Landing: 498–1.664 ms unter wechselnder Last.
- Cache: Next Data Cache für öffentliche Katalog-/Ranking-/SEO-Ergebnisse, getrennt nach Datenbank, Umgebung, Sprache, Land und Filtern. Suchtexte und persönliche Providerfilter bleiben ausgeschlossen. Bilderfreigaben werden weiterhin nach dem Daten-Cache aktuell geprüft. Nach fünf Minuten wird erneuert; sehr alte Einträge werden synchron aktualisiert und bei Fehlern nicht unbegrenzt weitergereicht.
- Rendering: Header und Home-Suche ohne Warten auf acht Reihen; einzelne Reihen und ähnliche Titel streamen unabhängig. Sichtbarer Navigationsfortschritt, KI-/Voice-Code erst bei Nutzung. Routevalidierung erhält echte HTTP-404.
- Hintergrundjobs: übergreifende Cron-Sperre verhindert überlappende vollständige Läufe; Ablauf nach einem abgebrochenen 300-Sekunden-Job ermöglicht Wiederaufnahme.
- Sitemap: 15 Minuten Retry-Abstand, 100-Titel-Batches, wiederverwendete unveränderte Angebotsfingerprints, 120 Sekunden Startbudget. Bestehende Generation bleibt bei Fehlern erhalten. Byte-identische Fingerprints vermeiden künstliche lastmod-Änderungen.

Neue Messung gegen Produktion, ohne Katalogcache und mit sequenziellen Abfragen:

| Abfrage | Vorher SQL | Nachher DB einschließlich Übertragung |
| --- | --- | --- |
| Aktuelle Filme | 2,04 s | 392 ms |
| Netflix-Auswahl | 11,36 s | 269 ms |
| Trends | >12 s | 221 ms |
| Ähnliche Serien | >12 s | 989 ms |
| Lucifer | >12 s | 418 ms |

Die Messungen stammen aus unterschiedlichen Lastsituationen. Lucifer liefert elf Treffer und tv:63174 auf Rang eins. Der erste lokale vollständige Home-Abruf überschritt noch 20 Sekunden: Die zusätzliche Neuheiten-Reihe wurde anschließend als weiterer Engpass identifiziert. Die Messung des bereits warmen Home-Abrufs: 113 ms bis Header / 2.604 ms kompletter HTML-Stream; Filmübersicht 632/636 ms; Such-API 987/988 ms. Diese Werte sind lokale Produktionsbuild-Messungen mit echten Daten, keine öffentlichen Core Web Vitals.

Validierung bis zu diesem Stand: 270 Tests bestanden, Produktionsbuild und Lint erfolgreich; zwei Chromium-E2E-Tests für Sprachwechsel/Verlauf, beide Suchmodi und echte 404 bestanden; Desktop 1440 px und Mobile 390 px ohne Überbreite oder Browserfehler geprüft.

## Veröffentlichung und Live-Nachmessung

Commit `39e8624` wurde auf `main` gepusht. Vercel meldet Deployment `dpl_8EVMChf7nTP6ZPsJvDVKEGyZ2dsq` als Ready; `cineradar.tv` und `www.cineradar.tv` zeigen auf dieses Deployment. Migration 016 wurde anschließend mit `CREATE INDEX CONCURRENTLY` abgeschlossen und als gültig geprüft. Der Aufbau dauerte 262 Sekunden.

| Öffentlicher Abruf | HTTP | Antwortheader | Vollständiger HTML-/JSON-Body |
| --- | --- | --- | --- |
| Startseite, erster Messabruf | 200 | 467 ms | 6.544 ms |
| Startseite, Folgeabruf | 200 | 157 ms | 482 ms |
| Filmübersicht | 200 | 648 ms | 676 ms |
| Lucifer-Suche | 200 | 625 ms | 626 ms |
| Nicht vorhandener Titel | 404 | 104 ms | 106 ms |

Diese Messungen umfassen den HTML-/API-Transfer, nicht den Abschluss sämtlicher Bilddownloads oder Core Web Vitals. Der erste Abruf liefert die Oberfläche früh und streamt weitere Reihen nach. Die normale Suche und der erst bei Bedarf geladene KI-Titelfinder wurden im Codex-Browser auf der öffentlichen Domain geprüft; alle sieben nachgeladenen Inhaltsreihen waren vorhanden, ohne horizontalen Überlauf oder Konsolenfehler.

Die einmalige Neuheiten-Abfrage nach Migration 016 benötigte 2,20 Sekunden statt zuvor 9,79 Sekunden. Der zugehörige `EXPLAIN`-Plan nutzte vorhandene Angebotsindizes, nicht den neuen Datumsindex; eine kausale Verbesserung durch diesen zusätzlichen Index ist damit nicht belegt.

Der anschließende vollständige Sitemap-Probelauf scheiterte nach 157,6 Sekunden in der Phase `artifacts` am Zeitbudget. Die Quelle wurde vollständig gelesen; die synchrone Verarbeitung aller URL-Varianten konnte das Budget jedoch zwischen zwei Prüfungen überschreiten. Die bisherige Sitemap-Generation blieb erhalten. Eine dauerhaft wiederaufnehmbare Verarbeitung in kleinen Schritten wird deshalb zusätzlich umgesetzt; der erste Live-Release allein löst diesen verbliebenen Exportengpass noch nicht vollständig.

## Ergänzende Korrektur des Sitemap-Exports

Migration 017 wurde anschließend erfolgreich angewendet (1,0 Sekunden). Die benötigten Indizes wurden zuvor ohne Schreibsperre aufgebaut. Der Publisher verarbeitet nun einen gespeicherten Build in begrenzten Schritten: 100 Titel lesen, höchstens 1.000 URL-Datensätze je Schreibzugriff speichern, Landingseiten abschließen, geprüfte XML-Dateien erzeugen, entfernte Varianten abgleichen und abschließend den öffentlichen Index atomar wechseln. Ein normaler Cron-Aufruf arbeitet höchstens 45 Sekunden an neuen Schritten; jede zusätzliche Abfrage prüft dieses Budget. Ein bereits laufendes Statement bleibt durch das Datenbanklimit begrenzt.

- Gesunde Zwischenstände werden beim nächsten Cron fortgesetzt; echte Fehler behalten den 15-Minuten-Abstand. Beide Fälle erhalten den bisherigen öffentlichen Index.
- Checkpoints, reservierte Ordinals und feste Build-Zeitpunkte bleiben über Aufrufe erhalten. Auch teilweise gespeicherte Batches mit anschließend geändertem Slug, Genre oder gelöschtem Titel werden korrekt wiederholt.
- Titel- und redaktionelle hreflang-Gruppen werden jeweils vollständig vor dem Speichern geprüft. Die einzigen Gruppen über Batchgrenzen hinweg – Landingseiten – werden zusätzlich per SQL geprüft. Millionen redundanter Prüfungen derselben Titelverweise entfallen.
- Unveränderte XML-Shards werden wiederverwendet. Die Veröffentlichung prüft Dateinamen, Metadaten, Mengen, gültige Lease und mindestens einen qualifizierten Katalogtitel.
- Die Bereinigung arbeitet separat in kleinen Batches. Alte öffentliche Dateien bleiben acht Tage ab Ablösung erhalten, auch wenn die abgelöste Generation zuvor lange unverändert war. Aktive Builds werden nicht bereinigt.

Der reale Build konnte nach dem ersten Abschnitt mit 100 Titeln und 1.324 qualifizierten URLs korrekt fortgesetzt werden; der nachfolgende Abschnitt erreichte 32.245 URLs. Eine weitere Live-Messung während des Exports: französische Startseite HTTP 200, 661 ms bis zu den Headern und 1.199 ms für den vollständigen HTML-Body. Der vollständige initiale Neuaufbau wird weiterhin in begrenzten Abschnitten durchgeführt; der Besucherbetrieb wartet nicht auf dessen Abschluss.

Abschließende Prüfung des gesamten Codes: **280 Tests bestanden**, Produktionsbuild, Typecheck, Lint und `git diff --check` erfolgreich. Darin enthalten sind Upgrade, Wiederaufnahme ohne Force, unveränderte öffentliche Generation während Teilständen, Abbruch nach Artefaktspeicherung, konkurrierende Lease-Übernahme, Slug-/Genreänderung und Titellöschung während eines Replays sowie begrenzte Bereinigung und Dateiaufbewahrung.

## Nachmessung der vollständigen Korrektur

Auch Commit `f881508` wurde auf `main` veröffentlicht. Vercel meldet Deployment `dpl_vf11v2di1VZGfEagQFajtzC8sHUd` als Ready; beide öffentlichen Domains zeigen auf diese Version. Die folgende Stichprobe wurde während des laufenden Sitemap-Neuaufbaus gegen `cineradar.tv` erhoben:

| Öffentlicher Abruf | HTTP | Antwortheader | Vollständiger HTML-/JSON-Body |
| --- | --- | --- | --- |
| Startseite, erster Messabruf | 200 | 556 ms | 877 ms |
| Startseite, Folgeabruf | 200 | 407 ms | 448 ms |
| Filmübersicht | 200 | 730 ms | 755 ms |
| Lucifer-Suche | 200 | 1.261 ms | 1.262 ms |
| Nicht vorhandener Titel | 404 | 311 ms | 313 ms |

Der erste Messabruf ist kein nachgewiesener Kaltstart. Die Stichprobe misst den HTML-/JSON-Transfer ohne sämtliche Bilder und ist keine Core-Web-Vitals-Erhebung. Lucifer steht weiterhin auf Rang eins. Im Codex-Browser wurden der sichtbare Ladezustand beim Sprachwechsel, Englisch mit USA, die unabhängige Länderauswahl und die Rückkehr zu Deutsch/Deutschland geprüft.

Die Messwerte stützen die Empfehlung, zunächst bei Vercel und Neon in Frankfurt zu bleiben. Sie belegen keinen generellen Geschwindigkeitsvergleich zu AWS und ersetzen keine längerfristigen Messungen unter realer Besucherauslastung.

## Erfolgreicher vollständiger Sitemap-Neuaufbau

Der Produktionsjob hat die gespeicherte Verarbeitung übernommen und am **27.09.2026 um 20:36:27 UTC** die Generation `77f7aa09-1756-4a31-af40-89ca778260ac` veröffentlicht. `last_error` ist leer, `building_generation` wurde zurückgesetzt. Die zuvor seit 13.09. unveränderte öffentliche Generation ist damit abgelöst.

- Durchlaufener Bestand: **43.096 Titel**.
- Geprüfte Sprach-/Ländervarianten einschließlich weiterer Seitentypen: 1.078.000 Registereinträge.
- Für die öffentliche Sitemap geeignete URLs: **495.797** in **1.185 XML-Dateien**. Die URL-Anzahl ist keine Anzahl unterschiedlicher Filme oder Serien.
- Öffentliche Prüfung um 20:37 UTC: `/sitemap.xml` HTTP 200 in 547 ms, 1.185 gleich-originige Dateiverweise und aktuelles `Last-Modified` vom Veröffentlichungszeitpunkt.
- Stichprobe deutsche Filme: HTTP 200, 656 URLs, 1.303 Bildangaben und 10.992 Sprachverweise.
- Stichprobe englische Serien für USA: HTTP 200, 562 URLs, 1.119 Bildangaben und 12.703 Sprachverweise.
- Stichprobe deutscher Kalender: HTTP 200, eine URL und fünf Sprachverweise.

Die öffentliche Abrufprüfung ist eine Stichprobe; die vollständige Dateiliste und ihre Mengen wurden zusätzlich bei der atomaren Veröffentlichung geprüft. Google-Crawling oder Indexaufnahme lassen sich daraus nicht garantieren. Der initiale Neuaufbau lief ungefähr 32 Minuten über gespeicherte Teilabschnitte; die Website blieb dabei erreichbar. Folgeläufe können unveränderte XML-Dateien wiederverwenden.
