# Betrieb und Wiederanlauf

**Aktualisierung vom 7. September:** [experience-release.md](experience-release.md) beschreibt den aktuellen Tarif mit 100.000 SAA-Anfragen, fünf Märkte, 500 tägliche Refreshes und den ausführenden Minutentakt auf Vercel. Die folgenden Einrichtungswerte des ersten Verbindungstests sind historisch; ein separater Workerprozess ist auf Vercel nicht mehr erforderlich.

## Einrichtung am 7. September 2026

- Neon-Ressource `cineradar`, Frankfurt, PostgreSQL 18.6, vom Nutzer freigegebener Launch-Tarif; mit Vercel Preview und Development verbunden.
- Vier Migrationen erfolgreich auf Neon angewendet. Migrationen bevorzugen die direkte `DATABASE_URL_UNPOOLED`; HTTP-Webzugriffe verwenden den Neon-Treiber.
- Lokal und in Vercel Preview sind API-/Session-/Admin-/Cron-Secrets eingerichtet. Keine Secrets im Repository; `.env.local` ist für Web, `.env` für CLI/Worker.
- Begrenzter Erstimport: zehn Titel, 822 Angebotsdatensätze, 47 Anbieter-/Marktzuordnungen. Neun Titel wurden von der Angebotsquelle beantwortet; einer lieferte 404 und bleibt als Fehler/fehlende Quellzuordnung sichtbar, ohne leere Verfügbarkeit vorzutäuschen.
- Das echte Länderergebnis enthielt leere Add-on-Logos. Diese werden zu `null` normalisiert, während unsichere URLs weiter abgewiesen werden. Alle 65 Länder des gespeicherten Ergebnisses validieren; ein Regressionstest deckt den Fall ab.
- Konservatives App-Budget: 25 SAA-Einheiten pro Tag, 1.000 pro Monat, jeweils mit 20 Prozent Puffer. Das Anbieterlimit von 1.000 bis 1. Oktober wurde im Quota-Header bestätigt; das Tageslimit ist eine interne Begrenzung. Der Erstimport lief ausschließlich als begrenzter lokaler Lauf. `SYNC_ENABLED=false` bleibt gesetzt; kein dauerhafter Worker wurde gestartet.
- Lokale Readiness gegen Neon und deutsch-/englischsprachige Seiten antworten mit HTTP 200. 20 Domain-/Datenbanktests, Typecheck, Lint und Vercel-kompatibler Next.js-Build erfolgreich.

Produktionsumgebung und öffentliche Domain sind damit noch nicht freigegeben. Ein kontinuierlicher Aktualisierungsdienst, ein echter `pg_dump`-/Restore-Nachweis und bestätigte Betreiber-/Lizenzangaben bleiben offen.

Der aktuelle Katalogausbau und Veröffentlichungsstand stehen in [catalog-release.md](catalog-release.md). Die oben genannten zehn Titel beschreiben ausschließlich den früheren Verbindungstest.

## Dienste

Web und Worker sind getrennte Prozesse. Der Webserver liefert Seiten, validierte APIs und Gesundheitsendpunkte. `npm run worker` führt den Scheduler jede Minute und persistente Jobs aus. Serverless-Webhosting allein betreibt diesen Worker nicht. `/api/cron` ist mit `CRON_SECRET` geschützt und plant Arbeit ein, statt einen langen Import im HTTP-Request auszuführen.

`/api/health/` prüft Liveness. `/api/ready/` prüft getrennt die Konfiguration und Datenbank. Der Betriebsbereich `/<Sprache>/<Markt>/<lokalisierter-betriebspfad>/` braucht einen starken Adminschlüssel; HMAC-Sitzungen laufen nach acht Stunden ab. Login, Pause, gezielte Wiederholung und Reports sind vor Cross-Origin-Mutationen geschützt. Es wird kein offener Admin-Vollimport angeboten.

## Planung und Fehler

- Täglich: Länder/Anbieter, begrenzte Entdeckung, Wartung.
- Alle sechs Stunden: Änderungen je vier Märkte und je `new`, `updated`, `removed`.
- Täglich: bis zu 50 ältere Titel abgleichen, Metadaten etwa wöchentlich aktualisieren.
- Änderungen verwenden überlappende Zeitfenster und persistente Wasserstände. Ein Wasserstand wird erst nach allen Seiten fortgeschrieben. Wiederholte Cursor oder Abbrüche führen nicht zu Löschungen.

Retry-After hat Vorrang vor exponentiellem Backoff mit Jitter. Nach sechs Versuchen beziehungsweise nicht automatisch heilbaren Auth-/Schemafehlern wird ein Job zur Prüfung zurückgehalten. Abgelaufene Leases werden übernommen; die aktuelle Lease wird vor dem Snapshot-Commit geprüft. Ein verdächtiger Angebotsrückgang (mindestens zehn alte Angebote, weniger als 30 Prozent verbleibend) landet in Quarantäne. Die zuletzt gültigen Angebote bleiben erhalten.

Bei Quota zuerst Budget/Plan und Reservierungen prüfen. Bei Authfehlern Schlüssel im Secret Store erneuern. Bei Schemafehlern den Quellenvertrag prüfen, Daten nicht als leer markieren. Bei fehlendem Heartbeat (> fünf Minuten) Worker-Prozess und Datenbank prüfen; der Betriebsbereich meldet dann keinen gesunden Auto-Modus. Nach Behebung gezielt den fehlgeschlagenen Job wiederholen. Keine manuelle Rücksetzung der Budgetzähler, um eine Tarifgrenze zu umgehen.

## Beobachtung

Strukturierte Logs enthalten nur freigegebene Felder wie Dienst, Fehlercode, Dauer, Job-ID und reservierte Einheiten. Keine Quellschlüssel, Suchtexte, E-Mail-Adressen oder vollständigen Provider-URLs. Budgettabelle, Queue, letzter Scheduler-Heartbeat, nächste Jobzeiten, Reports, Quarantäne und Marktfrische sind im geschützten Betrieb sichtbar. `data/cache.ts` stellt Prozess-Cachestatistiken bereit; für eine Flottenmetrik ist ein konfiguriertes Monitoring-System nötig.

Ein externer Benachrichtigungskanal ist nicht konfiguriert. Deshalb werden weder Betreiber-E-Mails noch Nutzeralarme versendet. Die Produktionsfreigabe muss Monitoring/Alarmierung, Übersetzungsrückstand und angemessene Lösch-/Aufbewahrungsfristen für die konkreten Vertragsbedingungen bestätigen.

## Backup und Restore

PostgreSQL-Dumps nutzen die offiziellen Programme `pg_dump`/`pg_restore` in einer zum Server passenden Version. Zugangsdaten werden über die Prozessumgebung weitergegeben, nicht geloggt.

```sh
npm run db:backup -- /secure/backups
# RESTORE_DATABASE_URL auf eine separate, leere Datenbank setzen:
npm run db:restore -- /secure/backups/cineradar-<timestamp>.dump
```

Der Restore verweigert dieselbe Verbindungsadresse wie die Quelldatenbank und verwendet weder `--clean` noch ein Drop-Kommando. Trotzdem muss der Betreiber eine tatsächlich isolierte leere Zielinstanz bereitstellen; unterschiedliche Alias-URLs können dieselbe Datenbank bezeichnen. Nach Restore Migrationstand, Titel-/Angebots-/Reportzahlen, Budgetstände, Routen und Readiness vergleichen. Erst dann Traffic umstellen.

Der automatisierte Test hat einen vollständigen PostgreSQL-WASM-Datendump in einer zweiten isolierten Instanz wiederhergestellt und Datenbestände geprüft. Ein Restore aus `pg_dump` auf der späteren Produktionsinstanz ist noch nicht nachgewiesen. Vor Livefreigabe täglich verschlüsselte Sicherungen im Datenbankhost konfigurieren, externe Aufbewahrung/7-Tage-Mindestretention festlegen und einen echten Restore protokollieren. Ohne Zugang lässt sich diese Infrastruktur nicht aktivieren.

## Rollback und Veröffentlichung

Migrationen sind versioniert und unter einer dedizierten Verbindung atomar gesperrt. Schemaänderungen zuerst in einer isolierten Vorschau anwenden. Rollback: Sync pausieren, vorige validierte Web-/Worker-Version starten, bei inkompatiblem Schema in eine neue Datenbank restoren und Verbindungen umstellen. Keine automatische destruktive Down-Migration.

Stable-Next-Container sind mit nicht privilegiertem Node-Nutzer vorbereitet. Sites benötigt Neon HTTP für PostgreSQL und einen externen Worker. Dort werden nur ausdrücklich erlaubte Runtime-Werte gesetzt; lokale Fixtures bleiben gesperrt. Die Domain `cineradar.tv` wird nicht als live bezeichnet, bevor DNS, HTTPS, Rechts-/Lizenzfreigaben und ein authentifizierter Quellen-Smoke-Test tatsächlich bestanden sind.

## Messumgebung
Die Laborprüfung vom 6. September 2026 lief auf Windows x64, Node 24.18, stable Next.js 16.3.4 Produktionsbuild und Lighthouse 13.4.1 mit dessen Standard-Mobilprofil (simulierte Mobilnetz-/CPU-Drosselung). Kalter Browsercache pro Navigation, aufgewärmter lokaler Webprozess, englische Fixture-Seiten für DE, externe TMDb-Bilder. Keine Live-Datenbank und keine Feldmessung. Ein früherer Lauf parallel zur Browsermatrix lag niedriger; der dokumentierte separate Lauf vermeidet diese CPU-Konkurrenz. JSON und HTML sind unter `docs/evidence/lighthouse-*.{json,html}` gespeichert.

Letzter separater Lauf: Performance 91/93/95 (Start/Film/Serie), Accessibility und Best Practices jeweils 100. Der SEO-Wert 69 kommt durch beabsichtigte Nichtindexierung der Vorschau zustande. Simuliertes LCP etwa 3,5/3,2/3,0 Sekunden liegt noch über dem Feldziel 2,5 s; eine Lighthouse-Gesamtnote ersetzt diesen Zielwert nicht. CLS in allen drei Fällen unter 0,01. INP am 75. Perzentil kann erst mit echter Nutzung gemessen werden.
