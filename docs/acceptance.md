# Abnahme vom 6. September 2026

Die lokale Anwendung ist implementiert und überprüft. Eine vollständige Produktionsabnahme ist wegen der unten genannten externen Voraussetzungen **nicht erreicht**. Private Sites-Veröffentlichung und lokale Fixture-Vorschau sind kein Live-Streamingdienst.

## Prüfresultate

- Stable Next.js 16.3.4: Produktionsbuild erfolgreich; TypeScript und Oxlint erfolgreich.
- 19/19 Domain-/Datenbanktests: vier PostgreSQL-Migrationen, Budgetgrenzen/UTC-Reset, Idempotenz, Teilantwortschutz, Job-Recovery/Lease-Fencing, Redaktionserhalt, sichere Pagination, Fehlerzustände und isolierter PostgreSQL-WASM-Dump/Restore.
- 24/24 E2E-Tests in Chromium und WebKit. Darin 20 Sprach-/Marktkontexte pro Browser, Desktop-/Mobil-Suche bis zum Anbieter, Merkliste/Reload, Anbieter-/Zusatzaboauswahl, Staffeln, 404, Roh-HTML/JSON-LD, PNG-OG, Origin-Schutz, Finder, reduzierte Bewegung und Bildausfall.
- 320, 360, 390, 768, 1024, 1440, 1920 px ohne horizontales Überlaufen; Screenshotprüfung und Axe ohne schwerwiegende Befunde in den geprüften Ansichten.
- Firefox installiert, aber der lokale Prozessstart scheitert mit `spawn UNKNOWN`. Kein Firefox-Bestand behauptet. Die CI-Matrix enthält Firefox für eine separate Linux-Ausführung; noch kein Remote-CI-Lauf.
- Lighthouse Standard-Mobilprofil: Performance 91/93/95 für Start/Film/Serie, Accessibility und Best Practices je 100. Beabsichtigte `noindex`-Sperre senkt SEO auf 69. LCP-Laborwerte 3,5/3,2/3,0 Sekunden erreichen das Feldziel von 2,5 Sekunden noch nicht. Keine INP-/75.-Perzentil-Felddaten.
- `npm audit`: keine bekannten Schwachstellen zum Prüfzeitpunkt.
- Sites-Worker separat gebaut. Lokaler Worker-Smoke-Test: Einstieg, englischer Katalog, Health und selbst gehostete Schrift liefern HTTP 200; Vorschau trägt noindex. PostgreSQL/API-Bereitschaft bleibt ohne Zugänge deaktiviert.

Die reproduzierbaren Dateien stehen unter `docs/evidence/`; Testcode in `test/`. Screenshots enthalten deutlich gekennzeichnete Testangebote. PostgreSQL-WASM führt SQL aus, ist aber kein Beweis für verteilte Produktionsworker oder reale Providerantworten.

## CR-Matrix

| ID | Status | Tatsächlicher Beleg / noch benötigter Nachweis |
|---|---|---|
| CR-01 | lokal erfüllt | Beide Builds, Start, vier SQL-Migrationen im Test; echter Container/DB-Host noch offen |
| CR-02 | durch externe Voraussetzung blockiert | Zwei validierte Adapter und Vertragsanalyse; authentifizierte Antworten fehlen |
| CR-03 | lokal erfüllt | Fünf Sprachpakete, 163 Schlüssel; Live-Metadatentexte hängen von Quelle/Übersetzungszugang ab |
| CR-04 | lokal erfüllt | 20 Kontexte, unabhängige Titel-/Sprach-/Marktwechsel, Cache-Schlüssel im Code |
| CR-05 | lokal erfüllt | Suche bis Anbieter auf Desktop und 390 px ohne Konto |
| CR-06 | lokal erfüllt, Livebeispiele offen | Abo/Add-on/gratis/Leihe/Kauf, exakte Dezimalpreise und getrennte Vergleichsgruppen geprüft |
| CR-07 | lokal erfüllt, Livefälle offen | Staffel-/Episodeneinheiten und unbekannte Nummern; keine Vollständigkeitsbehauptung |
| CR-08 | lokal erfüllt | Merkliste/Reload/Löschen, unabhängige Add-ons, Finder-Laufzeitfilter |
| CR-09 | lokal erfüllt | Statusmodell, simulierte 404/Quota/Auth/Timeout/Schemafehler, Bestandsschutz |
| CR-10 | durch externe Voraussetzung blockiert | Persistenter Scheduler/Worker implementiert; kein laufender produktiver Host/Zyklus |
| CR-11 | lokal erfüllt, verteilte Prüfung offen | Budget-/Pagination-/Lease-Tests; PGlite serialisiert auf einer Instanz, kein Mehrprozess-Lastbeweis |
| CR-12 | teilweise erfüllt | Chromium/WebKit, sieben Breiten, Tastatur, Axe; Firefox-Start und reale Hilfsmittelprüfung offen |
| CR-13 | lokal erfüllt | Server-HTML, Canonical, JSON-LD, tatsächliche 404 und Kontext-URLs |
| CR-14 | lokal erfüllt, Produktionscrawl offen | Qualitätsfreigabe und paginierte Sitemaps, private noindex-Sperre |
| CR-15 | teilweise erfüllt | Schema-Modell und Escaping geprüft; externer Rich-Results-Validator auf öffentlicher Domain offen |
| CR-16 | lokal erfüllt, Plattformprüfung offen | Lokalisierte 1200×630-PNGs und HTML; öffentliche Social-Crawler noch nicht geprüft |
| CR-17 | teilweise erfüllt | Lighthouse-Notenziel erreicht; LCP-Feldziel und echte Felddaten offen |
| CR-18 | lokal erfüllt, Infrastrukturprüfung offen | Origin/Auth/Config/Cache/URL-Validierung, Security-Header und Dependency-Audit |
| CR-19 | durch externe Voraussetzung blockiert | Credits vorhanden; Betreiberangaben und reale Bild-/API-Nutzungsfreigaben fehlen |
| CR-20 | teilweise erfüllt | Runbook, Dump/Restore-Code und isolierter WASM-Restore; echte tägliche Backups/Alarmierung noch nicht aktiviert |
| CR-21 | durch externe Voraussetzung blockiert | Private Vorschau vorbereitet; `cineradar.tv` nicht als öffentlich betriebsbereit veröffentlicht |

## Genau benötigte Betreiberhandlungen

1. TMDb-Zugang und Movie-of-the-Night-Zugang samt tatsächlichem Tarif, Gewichten, Nutzungs-/Bildrechten und Länderabdeckung bereitstellen beziehungsweise ihren Secret-Store benennen.
2. PostgreSQL mit erforderlichen Erweiterungen und einen dauerhaft laufenden Workerhost einrichten; Secrets setzen, Migration/Dry Run und kleinen echten Import prüfen.
3. Betreibername, ladungsfähige Anschrift, Kontaktadresse und rechtliche Freigabe ergänzen. Erst danach Indexierungs-/Produktionsfreigaben setzen.
4. Tägliche Sicherung/isolierten echten Restore, Monitoringkanal, Firefox-CI und öffentliche Validatoren durchführen; dann Domain/DNS/HTTPS freigeben.

Optionale E-Mail-Alarme, Konten und Affiliate-Umschreibungen sind nicht aktiviert. Es gibt keine vorgetäuschten Nachrichten, Käufe oder Live-Erfolgsmeldungen.

Private Veröffentlichung: https://cineradar.soheil91.chatgpt.site (erfolgreiche Bereitstellung, keine Live-Angebote). Der vollständige lokale Fixture-Katalog bleibt im Repository reproduzierbar. Der lokale Prüfserver wurde nach der Veröffentlichung beendet.
