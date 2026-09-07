# Cineradar — Arbeitsstand, 6. September 2026

## Aktualisierung vom 7. September 2026

Die untenstehenden Einträge dokumentieren die ursprüngliche Abnahme. Inzwischen sind beide APIs authentifiziert geprüft, Neon `cineradar` in Frankfurt im ausdrücklich freigegebenen Launch-Tarif angelegt, vier Migrationen angewendet und Vercel Preview/Development verbunden. Secrets wurden für Preview eingerichtet. Der begrenzte Erstimport enthält zehn Titel, 822 Angebote und 47 Anbieter-/Marktzuordnungen; eine fehlende Quellzuordnung bleibt als Fehler gekennzeichnet. 20 Tests und lokaler Live-Readiness-Test erfolgreich. Vercel-Buildfehler durch expliziten Next.js-Build und bedingte Standalone-Ausgabe behoben. Dauerhafter Worker und öffentliche Produktionsfreigabe bleiben offen; Sync ist ausgeschaltet. Details in `operations.md`.

Auftrag: Masterprompt um Englisch erweitern und die Plattform bauen. Zusätzlich verlangt der Nutzer ein dynamisches, unverwechselbares Design.

## Umgesetzt
- Fünf vollständige Sprachpakete (163 Schlüssel), vier unabhängige Märkte, 20 Kontexte.
- Kinodesign mit eigener Bildmarke, generiertem Kinomotiv, asymmetrischen Filmflächen und responsiven Komponenten.
- Katalog, Suche, Detail/Staffeln, Filter/Finder, Anbieterwahl, lokale Merkliste, Kontakt/Reports, rechtliche Freigabesperren, geschützter Betrieb.
- Zwei validierte Quellenadapter, PostgreSQL mit vier Migrationen, persistente Jobs, Lease-Fencing, Budgets, sichere Pagination, optionale Übersetzungen.
- SEO/JSON-LD/PNG-Linkvorschau, Qualitätsindexierung, Container und CI-Konfiguration.

## Verifiziert
- Stable Next.js 16.3.4 Produktionsbuild erfolgreich.
- 17 Domain-/PostgreSQL-WASM-Tests erfolgreich; isolierter Dump/Restore enthalten.
- Chromium: Sprach-/Länderwechsel, Merkliste, Anbieter/Addons, Suche bis Anbieter, Staffelzustände, 20 Kontexte, 7 Breiten, Axe-Prüfung und Metadaten einzeln bestanden.
- Vollständige Chromium/Firefox/WebKit-Matrix und Lighthouse laufen noch.
- npm audit zuletzt ohne bekannte Schwachstellen.

## Extern offen
Keine API-, Datenbank- oder Betreiber-Secrets vorhanden. Frage nach Speicherort ist gestellt; keine Antwort. Keine laufende produktive Datenbank, kein produktiver Worker, keine Domain-/Lizenz-/Rechtsfreigabe bestätigt. Kein Live-Datenbetrieb behauptet.

## Übergabe noch fertigzustellen
Drei-Browser-Berichte und Bilder prüfen, Labortests, Betriebsdokumentation/Abnahmematrix abschließen, Sites-Kompatibilitätsbuild und private Veröffentlichung. Bestehendes Sites-Projekt appgprj_6a9db5827dd88191a6f6d2c0e3674a24 wiederverwenden. Lokale Fixtures dürfen nicht gehostet werden. Git-Branch feat/cineradar-platform, Remote-Repository leer vor Implementierung.

## Verifikation abgeschlossen
19/19 Domain-/Datenbanktests und 24/24 Chromium/WebKit-E2E bestanden. Beide Builds erfolgreich. Firefox-Prozessstart extern blockiert. Lighthouse 91/93/95 Performance, Accessibility100; keine Feldzielerreichung behauptet. Dokumentation und differenzierte Abnahme vorhanden. Private Sites-Veröffentlichung läuft; Livebetrieb bleibt mangels Zugängen/Betreiberfreigaben blockiert.

## Private Veröffentlichung
Die private Version wurde erfolgreich unter https://cineradar.soheil91.chatgpt.site veröffentlicht. APP_MODE=unconfigured und SYNC_ENABLED=false; lokale Testangebote werden dort nicht ausgegeben. Die endgültige SITE_URL wird als Runtime-Einstellung auf diese zurückgemeldete Adresse gesetzt. cineradar.tv bleibt unveröffentlicht. Livebetrieb und externe Abnahmepunkte bleiben wie in acceptance.md beschrieben offen.
