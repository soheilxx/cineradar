# Katalog und Nutzererlebnis – 7. September 2026

Diese Aktualisierung ersetzt die bisherigen Betriebsgrenzen aus dem Erstimport. Der Nutzer hat Streaming Availability API auf 100.000 Anfragen monatlich erhöht; `x-quota-granted=100000` wurde am 7. September bestätigt. Die Quelle meldet den nächsten Zykluswechsel am 7. Oktober 2026 um 13:56:48 UTC.

## Verarbeitung

Production verwendet `SAA_MONTHLY_BUDGET=100000`, `SAA_DAILY_BUDGET=2500`, `BUDGET_BUFFER=0.2`, `TMDB_DAILY_BUDGET=100000` und `SYNC_ENABLED=true`. Somit sind höchstens 2.000 SAA-Einheiten pro UTC-Tag und 80.000 pro Kalendermonat reservierbar. Die zusätzliche Tagesgrenze begrenzt auch einen verschobenen 31-Tage-Abrechnungszyklus auf höchstens 62.000 Einheiten. Schlüssel und Budgetzähler werden nicht zurückgesetzt. Preview bleibt ohne aktiven Sync.

Vercel Pro ruft `/api/cron/` jede Minute mit `CRON_SECRET` auf. Vier Arbeitsschleifen übernehmen persistente, durch Leases geschützte Jobs, beginnen innerhalb eines 45-Sekunden-Fensters und schließen ihren jeweils laufenden Job ab. Die Function hat höchstens 300 Sekunden Laufzeit. Der Vorgang schreibt `operations.hosted-worker` mit Zeitpunkt, Zahl verarbeiteter Jobs und fehlgeschlagenen Arbeitsschleifen. Der lokale Rechner wird für den weiteren Betrieb nicht benötigt. Budgetüberschreitungen verschieben Aufträge zum nächsten UTC-Tag; Quota-Antworten warten mindestens eine Stunde bzw. das längere Retry-After. Diese Wartezustände verbrauchen keine Fehlversuche.

Täglich werden Länder/Anbieter, zwei Seiten pro Medientyp und Land sowohl nach Erscheinungsdatum als auch nach Wochenpopularität sowie genau ein Batch mit höchstens 500 älteren Titeln eingeplant. Änderungen werden je sechs Stunden abgefragt. Die tägliche Batch-Sperre wird zusammen mit ihren Jobs atomar geschrieben; ein Minutentakt vervielfacht den Refreshumfang nicht. Quellenpagination und neue Titel teilen sich das globale Budget.

Der angelegte große Import umfasst bis zu 500 Film- und 500 Serienseiten je Markt, also höchstens 5.000 SAA-Abfragen und 75.000 Titel-/Marktzuordnungen vor Deduplizierung. Er beendet einzelne Katalogströme früher, wenn die Quelle keine Folgeseite liefert. Das ist keine Garantie für 75.000 unterschiedliche Titel oder einen vollständigen Quellenindex. Fortschritt und offene Jobs liegen in PostgreSQL; weitere Metadaten werden in allen fünf Sprachen angereichert.

## Oberfläche und Länder

Aktivierte Märkte: DE, FR, IT, ES und US. Alle fünf wurden über den Länderendpunkt bestätigt, darunter 20 Dienste für US. Englisch verwendet auf ausdrücklichen Nutzerwunsch USA als Standard; auch ein Wechsel über die Sprachauswahl auf Englisch setzt USA. Eine danach ausdrücklich gewählte andere Länderansicht bleibt möglich. Explizite vollständige Länder-URLs werden nicht umgeleitet.

Die Wurzel ermittelt Browser-Sprache und verfügbares Land, berücksichtigt gespeicherte Entscheidungen und leitet temporär direkt zur passenden Ansicht. Der einjährige funktionale Kontext-Cookie ist im Datenschutz beschrieben. Geo-Einstiege sind privat und nicht cachebar; alle sprach- und länderspezifischen URLs bleiben separat erreichbar.

Die Startseite ergänzt Neuerscheinungen, aktuelle Serien/Staffeln, Wochenpopularität, neue Angebote, Anbieterbereiche und kostenlose Angebote. Filme und Serien werden in gemischten Trends abwechselnd berücksichtigt. Die Bühne ist manuell bedienbar, die Titelreihen sind horizontal scrollbar. Netflix, Prime Video und Disney+ stehen in der schnellen Anbieterauswahl zuerst, soweit sie im Land vorhanden sind.

Kategorien liefern 24 Titel serverseitig. IntersectionObserver lädt weitere Seiten über die eigene Datenbank-API; Filter, Land und Sprache bleiben erhalten. Nach drei automatischen Ladungen steht der Button zur Verfügung, damit der Footer erreichbar bleibt. Echte paginierte Links funktionieren auch ohne JavaScript. Bilder laden verzögert und mit passenden Größen. Fehlende Qualitäts- und Audiodaten erzeugen keine störenden Angaben pro Angebot; HD/4K wird nur bei bestätigten Quelldaten gezeigt.

## SEO und Prüfung

Titelbezogene Texte beantworten anhand der tatsächlichen Länderangebote, wo ein Film/eine Serie im Abo, kostenlos, zum Leihen oder zum Kaufen verfügbar ist. Sichtbare Fragen erläutern Bildqualität und bei Serien belegte Staffeln. Metadaten enthalten Titel, Jahr, Streamingabsicht und Land. Titelbeschreibungen, ähnliche Titel und Anbieterlinks ergänzen die Inhalte. Movie/TVSeries, WebSite und BreadcrumbList verwenden belegte sichtbare Daten.

Eine fremdsprachig fehlende Beschreibung sperrt nicht mehr pauschal alle anderen Sprachversionen. Sinnvolle Titelinhalte mit erfolgreich geprüftem Angebotszustand bleiben indexierbar; ältere Daten werden als solche erläutert. Such- und Filtervarianten bleiben noindex. Pagination hat eigene Canonicals, Einstieg und ausgewählte Kategorien/Anbieter stehen zusätzlich in einer Seitensitemap. Titel-Sitemaps folgen derselben sprachbezogenen Inhaltsprüfung. Ranking- oder Indexierungszusagen werden nicht gemacht.

Vor der Veröffentlichung: 27 Tests, Typecheck, Lint und Next.js-Produktionsbuild bestanden. Lokale HTTP-Prüfung: fünf Länder-/Sprach-Startseiten mit 80–85 serverseitigen Titelkarten, 24 + 24 unterschiedliche Titel über die Kategorie-API, Weiterleitungen, paginierte Links, sichtbare Titeltexte, Breadcrumbs, Betreiberangaben, Readiness und Cron-Authentifizierung bestanden. Browserprüfung bestätigt Englisch → USA und automatisches Nachladen von 24 auf 48 Titel. Mobile Darstellung wird bei 390 Pixeln geprüft.
