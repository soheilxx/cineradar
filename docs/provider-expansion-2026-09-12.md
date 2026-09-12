# TVmaze, OMDb und Ladezeiten

## Umsetzung

TVmaze wird als eigener, dauerhaft gespeicherter Serienkatalog angebunden. Der Index wird seitenweise bis zur bestätigten 404-Antwort importiert und über einen persistenten Cursor fortgesetzt. Bekannte Serien werden nur über eindeutige IMDb-, TVDB- oder TVmaze-IDs verknüpft. Ein separater TMDB-Abgleich reiht neue Serien in den bestehenden Import ein; Sprachversionen und Streamingangebote werden dort nach den bestehenden Regeln ergänzt. Eine zusätzliche TVmaze-Zeile ist deshalb nicht automatisch eine bereits vollständig veröffentlichte Cineradar-Titelseite.

Die Serienseiten bekommen Episodenführer und nächste angekündigte Folge. Der Serienkalender zeigt gespeicherte Original-Sendetermine für die nächsten 14 Tage. Angaben ohne bekannte Uhrzeit bleiben datumbezogen; künstliche Mittagszeitstempel aus TVmaze werden nicht als genaue Uhrzeit dargestellt. Bekannte UTC-Termine werden mit ausgewiesener Zeitzone umgerechnet. Globale Webkanäle werden zusätzlich zum landesbezogenen TV-Programm abgefragt. Serienangebote beweisen nicht die Verfügbarkeit einzelner neuer Folgen.

OMDb ergänzt exakte IMDb-Identitäten um separat gespeicherte Bewertungen, Auszeichnungen und weitere Fakten. TMDB-Inhalte, redaktionelle Texte und Streamingverfügbarkeit werden nicht überschrieben. Letzte erfolgreiche Daten bleiben bei Fehlern erhalten. Jeder Abruf wird atomar auf das konfigurierte UTC-Tagesbudget angerechnet; Authentifizierungsfehler und Rate-Limits bremsen weitere Jobs. Aktualisierung nach 30 Tagen. Die Poster-API wird in diesem Ausbau nicht als Bildquelle benutzt; bestehende eigene WebP-Cover bleiben über den vorhandenen Bildspeicher aktiv.

Neue Daten werden ausschließlich durch Hintergrundjobs geladen. Besucheraufrufe lesen die gespeicherten Ergebnisse. Zusätzliche Titelinformationen werden als Serverkomponenten gestreamt. Kalender besitzen lokalisierte Metadaten und Share-Bilder; pro Sprache ist die Standard-Ländervariante kanonisch, um identische internationale Kalender nicht unter 25 URLs zu indexieren. Nur mit vorhandenen Terminen werden die fünf kanonischen Kalender in die Sitemap übernommen.

## Serverkonfiguration

| Variable | Typ in Vercel | Bedeutung |
| --- | --- | --- |
| `TVMAZE_ENABLED` | Config | `true` aktiviert TVmaze in Live-Umgebungen. |
| `TVMAZE_DAILY_BUDGET` | Config | Standard 2000 öffentliche API-Abrufe pro UTC-Tag; zusätzlich gemeinsame Abstände von mindestens 700 ms. |
| `OMDB_API_KEY` | Secret | Nur serverseitig hinterlegen; niemals in öffentlichen URLs, Frontendvariablen oder Logs. |
| `OMDB_ENABLED` | Config | `true` aktiviert OMDb zusammen mit den übrigen Voraussetzungen. |
| `OMDB_COMMERCIAL_USE_CONFIRMED` | Config | Die ausdrücklich vom Betreiber bestätigte kommerzielle Freigabe. |
| `OMDB_DAILY_BUDGET` | Config | Standard 900 Abrufe pro UTC-Tag. Erst erhöhen, wenn das tatsächliche OMDb-Tariflimit bekannt ist. |

Der Betreiber hat die kommerzielle OMDb-Freigabe und am 12.09.2026 das Hinterlegen des Schlüssels in `modernice/cineradar`, Production, ausdrücklich bestätigt. Der Schlüssel selbst gehört nicht in diese Dokumentation. Neue Konfiguration wird mit dem nächsten Deployment wirksam.

TVmaze-Daten bleiben mit Quelle und CC BY-SA 4.0 gekennzeichnet. Feldnormalisierung und Klartext-Umwandlung sind ausgewiesen. Die öffentlichen OMDb-Standardbedingungen nennen CC BY-NC 4.0; Grundlage der Aktivierung ist die vom Betreiber bestätigte gesonderte kommerzielle Freigabe.

## Betrieb

Der bestehende Minuten-Cron führt Bildjobs, TVmaze, OMDb und externe ID-Ergänzung als voneinander getrennte Batches aus. Die bestehenden TMDB/SAA-Budgets und die Streaming-Synchronisierung bleiben maßgeblich für das Veröffentlichen neu entdeckter Titel. Quellenabgleich und Anreicherung sind unabhängig von einem deaktivierten SAA-Sync möglich; neue Streamingangebote erfordern den eingeschalteten Katalogworker.

Der durch den bestehenden Cron-Bearer geschützte Endpunkt `/api/admin/providers/` liefert mit GET die Bestandszähler. POST akzeptiert ausschließlich `{"source":"tvmaze"}`, `{"source":"omdb"}` oder `{"source":"discovery"}` und führt einen begrenzten Batch aus. Es handelt sich nicht um eine öffentliche Daten-API.

Migrationen 010/011 sind additive Tabellen. Die Angebotsindizes aus 012 und gegebenenfalls nachfolgenden Performance-Migrationen können vor dem regulären Journal-Eintrag mit `CREATE INDEX CONCURRENTLY` gebaut und auf `indisvalid` geprüft werden, damit laufende Angebotsänderungen nicht auf den Indexaufbau warten müssen.

Messungen und Performance-Änderungen stehen in `docs/catalog-performance-2026-09-12.md`. Veröffentlichung erst nach SQL-/Providerregressionen, Typprüfung, Produktionsbuild und mobilem/Desktop-Browsertest bestätigen.

Quellen: https://www.tvmaze.com/api · https://www.tvmaze.com/faq/15/episodes#airtime-release-time · https://www.omdbapi.com/

## Abnahme vor Veröffentlichung

248 Tests der vollständigen Suite sowie sechs Chromium-Browsertests für mobiles Nachladen, Fehlerwiederholung, Seitennavigation und Sprachwechsel bestanden. Danach wurden zusätzlich zwei Tests für PostgreSQL-Pooling, Transaktions-Rollback und verbindungslokale Zeitgrenzen ergänzt und erfolgreich ausgeführt. Der Produktionsbuild und die fünfsprachige Nachrichtenprüfung bestanden; auch der abschließende Produktionsbuild mit Neon-Pooling-Fix ist erfolgreich.

Der Codex-Browser bestätigt bei 390 Pixel Breite die sichtbare normale Suche, den Wechsel zu Englisch/USA, den Kalender und gespeicherte Episodenführer. Der Kalender zeigt ausschließlich die Quelltypen Scripted, Animation, Documentary und Reality. Nachrichten, Sport, Talk- und Spielshows verdrängen die Serientermine nicht. Diese Datensätze bleiben im separaten Quellenbestand erhalten. Die SQL-Zeitgrenze wird vor der jeweiligen Abfrage serverseitig gesetzt; Neon-Pooling nutzt dafür eine gebundene Transaktion, Migrationen bleiben davon getrennt.

## Produktionsprüfung am 12.09.2026

Commit `fa4b32c` ist auf `main` und `feat/cineradar-platform` veröffentlicht; Vercel hat das Produktionsdeployment erfolgreich auf `cineradar.tv` geschaltet. TVmaze und OMDb melden beide `enabled: true`. Der erste echte OMDb-Batch hat 50 Titel ohne Fehler gespeichert. Die Live-Titelseite von El hormiguero zeigt daraufhin IMDb-Bewertung und Auszeichnungen aus OMDb.

Der unabhängige Minuten-Cron ist durch aktuelle Heartbeats und fortlaufende Bestandsänderungen bestätigt: In einer Stichprobe waren 23.554 native TVmaze-Shows, 5.167 Episoden, 159 verknüpfte Serien und 150 OMDb-Anreicherungen vorhanden. Der öffentliche Cineradar-Katalog wuchs während der Prüfung von 9.057 auf 9.065 Titel; weitere Importe waren bereits vorgemerkt. Native TVmaze-Shows sind ausdrücklich nicht mit vollständig publizierten Cineradar-Titeln gleichzusetzen.

Kalenderseite und Share-Bild liefern HTTP 200, das Bild `image/png`. Canonical, fünf hreflang-Verweise und Meta-Description wurden auf der öffentlichen deutschen Kalenderseite kontrolliert; bei 390 Pixel Viewportbreite gab es keinen horizontalen Überlauf. Die neue Sitemap-Generation enthält 135.299 indexierbare URLs; 134.511 davon verfügen über eigene Bild-URLs. Nach dem Routingfix in Commit `092bca8` liefern auch alle fünf Kalenderdateien HTTP 200 und jeweils fünf hreflang-Verweise.
Der zusätzliche SEO-Metadatencache in Commit `3b93e22` wurde ebenfalls auf der Live-Domain bestätigt. Die vollständige Testsuite bestand mit 258 Tests; ein anschließend ergänzter Cache-Race-Test und die gezielte Suite bestanden ebenfalls. Der Produktionsbuild ist erfolgreich. Wiederholte vollständige komprimierte Abrufe der deutschen und englischen Startseite dauerten 0,459 und 0,401 Sekunden. Erste Aufrufe bleiben abhängig von Datenbank und Cachezustand langsamer; Details und Vergleichswerte stehen im Performancebericht.
