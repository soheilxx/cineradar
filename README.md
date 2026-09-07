# Cineradar

Mehrsprachige Plattform zum Finden und Vergleichen legaler Streamingangebote. Deutsch, Französisch, Italienisch, Spanisch und Englisch sind unabhängig von den vier Startmärkten DE/FR/IT/ES wählbar. Englisch startet in DE.

## Stand

Neon PostgreSQL ist in Frankfurt im freigegebenen Launch-Tarif eingerichtet und mit Vercel Preview/Development verbunden. Alle vier Migrationen sind angewendet. TMDb und Movie of the Night wurden authentifiziert geprüft; der erste begrenzte Import enthält zehn Titel und 822 Angebotsdatensätze für vier Märkte. Ein Titel ist bei der Angebotsquelle nicht vorhanden und bleibt ausdrücklich ungeprüft/fehlerhaft. Die Vercel-Vorschau verwendet echte Daten (`APP_MODE=live`); API- und Anwendungsschlüssel sind dort als Secrets hinterlegt. Dauerhafter Worker-Betrieb, öffentliche Produktionsfreigaben und Betreiberangaben stehen noch aus, daher bleibt `SYNC_ENABLED=false`. Die separate private Sites-Veröffentlichung bleibt vorerst `APP_MODE=unconfigured`. Die genaue Abnahme steht in [docs/acceptance.md](docs/acceptance.md).

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
3. `npm run db:migrate`, `npm run budget:estimate`, `npm run import:dry` ausführen. Migrationen verwenden `DATABASE_URL_UNPOOLED`, falls gesetzt, und brauchen eine direkte PostgreSQL-Verbindung für die Sitzungssperre. Web auf Vercel/Sites kann `DATABASE_DRIVER=neon` über HTTPS verwenden.
4. `SYNC_ENABLED=true` setzen, `npm run import:bootstrap` und dauerhaft `npm run worker` betreiben. Ein Webaufruf führt keinen bezahlten Vollimport aus.
5. Für öffentliche Produktion `DEPLOYMENT_ENV=production`, HTTPS-`SITE_URL`, Betreiberkontakt/-adresse, Admin-/Session-Secrets und bestätigte `LEGAL_APPROVED`/`LICENSES_CONFIRMED` setzen. Diese Freigaben nur nach tatsächlicher Prüfung aktivieren.

`docker compose up --build -d` startet PostgreSQL, einmalige Migration, Web und Worker. `.env` muss dabei eine passende Datenbankadresse mit Host `postgres` enthalten. Die Containerdefinition ist vorbereitet; Docker steht in dieser Arbeitsumgebung nicht zur Laufzeitprüfung bereit. Vercel kann den stabilen Next.js-Webteil hosten; der persistente Worker benötigt einen eigenen Prozess/Container. Details: [Betrieb](docs/operations.md).

## Prüfungen

### Vercel-Build

`vercel.json` legt Next.js, `npm run build:node` und `.next` als Ausgabe fest. Der Standardbefehl `npm run build` erzeugt den Cloudflare-/Sites-Build und ist für Vercel ungeeignet. Die Konfiguration im Repository verhindert, dass Vercel diesen Standardbefehl verwendet.

Auf Vercel (`VERCEL=1`) wird `output: 'standalone'` ausgelassen: Der Vercel-Adapter erstellt das Deployment selbst. Das vermeidet den [Next.js-16.3-Fehler mit fehlender `next-server.js.nft.json`](https://github.com/vercel/next.js/issues/96646). Container und andere selbst gehostete Builds behalten ihre Standalone-Ausgabe.

API-Schlüssel aus `.env.local` werden nicht mit Git übertragen. Für echten Datenbetrieb müssen sie zusätzlich als serverseitige Umgebungsvariablen im Vercel-Projekt sowie beim externen Worker hinterlegt werden. Vorschauen verwenden `APP_MODE=unconfigured`, `DEPLOYMENT_ENV=preview`, `SYNC_ENABLED=false` und ihre HTTPS-Adresse als `SITE_URL`, bis Datenbank und Import eingerichtet sind.

### Lokale Prüfungen

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

### Analytics und Navigation

Interne Links, Suche, Filter sowie Sprach- und Länderwechsel verwenden den Next.js-Router ohne vollständiges Neuladen. Die Dokumentsprache und Einwilligungstexte folgen dabei der aktuellen URL; direkte Aufrufe erhalten weiterhin die serverseitige Dokumentsprache. Navigation wartet nicht auf Analytics. Ereignisse werden ausschließlich nach Einwilligung übermittelt, ohne persistente Ereigniswarteschlange oder Garantie vollständiger Netzwerkzustellung.

- [Datenfluss und Entscheidungen](docs/architecture.md)
- [Quellenvertrag und Kosten](docs/api-contract.md)
- [SEO und fünf Sprachen](docs/seo-i18n.md)
- [Design und Zugänglichkeit](docs/design-system.md)
- [Betrieb, Sicherung und Wiederanlauf](docs/operations.md)
- [Abnahmekriterien und offene Voraussetzungen](docs/acceptance.md)

Optionale Übersetzungen erfordern einen explizit konfigurierten Dienst und Rechtefreigabe. E-Mail-Alarme, Konten und Affiliate-Umschreibungen sind nicht aktiviert. Die Merkliste bleibt lokal auf dem Gerät; Angebote und Fehlermeldungen verwenden PostgreSQL.
