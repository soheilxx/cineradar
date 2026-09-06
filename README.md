# Cineradar

Mehrsprachige Plattform zum Finden und Vergleichen legaler Streamingangebote. Deutsch, Französisch, Italienisch, Spanisch und Englisch sind unabhängig von den vier Startmärkten DE/FR/IT/ES wählbar. Englisch startet in DE.

## Stand

Die lokale Anwendung und ihre Quellenadapter sind implementiert. Die lokale Vorschau verwendet ausdrücklich gekennzeichnete Testangebote. Eine echte Datenbank, API-Zugänge, Tarif-/Lizenzbestätigung und Betreiberangaben fehlen; deshalb läuft kein produktiver Import. Eine private Sites-Veröffentlichung verwendet `APP_MODE=unconfigured` und zeigt keine Testangebote. Die genaue Abnahme steht in [docs/acceptance.md](docs/acceptance.md).

## Lokal starten

Voraussetzungen: Node.js ab 22.13, npm. Für echten Datenbetrieb PostgreSQL 17+ mit `pg_trgm` und `unaccent`, TMDb Read Access Token sowie Movie-of-the-Night-Zugang.

```sh
npm ci
cp .env.example .env.local
# Nur lokal: APP_MODE=fixture, DEPLOYMENT_ENV=local, SITE_URL=http://localhost:3000
npm run dev:node
```

`/` öffnet die Sprachen-/Länderauswahl, `/en/de/` den englischen Katalog für Deutschland. `npm run dev` startet die Sites-kompatible Entwicklungsumgebung. Diese beiden Server nicht gleichzeitig im selben Checkout verwenden.

## Echtbetrieb vorbereiten

1. `.env.example` als `.env` für CLI/Container ausfüllen. Secrets niemals als `NEXT_PUBLIC_*`, im Git oder im Chat ablegen.
2. `APP_MODE=live`, API-Zugang und `SESSION_SECRET` (32+ zufällige Zeichen) setzen. Den tatsächlichen API-Tarif in Tages-/Monatsbudgets und Endpoint-Gewicht abbilden. `SYNC_ENABLED=false` lassen, bis Migration und Dry Run geprüft sind.
3. `npm run db:migrate`, `npm run budget:estimate`, `npm run import:dry` ausführen. Migrationen brauchen eine direkte PostgreSQL-Verbindung; Web auf Sites kann `DATABASE_DRIVER=neon` über HTTPS verwenden.
4. `SYNC_ENABLED=true` setzen, `npm run import:bootstrap` und dauerhaft `npm run worker` betreiben. Ein Webaufruf führt keinen bezahlten Vollimport aus.
5. Für öffentliche Produktion `DEPLOYMENT_ENV=production`, HTTPS-`SITE_URL`, Betreiberkontakt/-adresse, Admin-/Session-Secrets und bestätigte `LEGAL_APPROVED`/`LICENSES_CONFIRMED` setzen. Diese Freigaben nur nach tatsächlicher Prüfung aktivieren.

`docker compose up --build -d` startet PostgreSQL, einmalige Migration, Web und Worker. `.env` muss dabei eine passende Datenbankadresse mit Host `postgres` enthalten. Die Containerdefinition ist vorbereitet; Docker steht in dieser Arbeitsumgebung nicht zur Laufzeitprüfung bereit. Vercel kann den stabilen Next.js-Webteil hosten; der persistente Worker benötigt einen eigenen Prozess/Container. Details: [Betrieb](docs/operations.md).

## Prüfungen

```sh
npm run i18n:check
npm run typecheck
npm test
npm run build:node
npx playwright install chromium firefox webkit
npm run test:e2e
node scripts/lighthouse.mjs
npm audit
```

Für E2E muss der lokale Server im Fixture-Modus auf Port 3000 laufen; CI startet ihn selbst. `TEST_BASE_URL` ändert das Testziel. Tests senden keine Nachricht an Dritte. Screenshots und Berichte liegen in `docs/evidence/`; Testdaten in `test/fixtures/`.

## Architektur und Dokumentation

- [Datenfluss und Entscheidungen](docs/architecture.md)
- [Quellenvertrag und Kosten](docs/api-contract.md)
- [SEO und fünf Sprachen](docs/seo-i18n.md)
- [Design und Zugänglichkeit](docs/design-system.md)
- [Betrieb, Sicherung und Wiederanlauf](docs/operations.md)
- [Abnahmekriterien und offene Voraussetzungen](docs/acceptance.md)

Optionale Übersetzungen erfordern einen explizit konfigurierten Dienst und Rechtefreigabe. E-Mail-Alarme, Konten und Affiliate-Umschreibungen sind nicht aktiviert. Die Merkliste bleibt lokal auf dem Gerät; Angebote und Fehlermeldungen verwenden PostgreSQL.
