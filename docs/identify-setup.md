# Betrieb: „Titel vergessen?“

Stand: 8. September 2026. Die Textsuche hat einen lokalen Katalogpfad und eine vorbereitete OpenAI-Anbindung. Ohne Schlüssel und Aktivierung ist nur der ausdrücklich als Katalogabgleich bezeichnete Pfad aktiv. Ein erfolgreicher Test mit Modell-Doubles ist kein Live-OpenAI-Test.

## Datenbank und Aktivierung

Vor dem Web-Release Migration `008_identify.sql` mit dem bestehenden Migrationsverfahren anwenden (`npm run db:migrate`, korrektes Ziel und direkte Verbindung vorher prüfen). Sie ergänzt getrennte, sprachabhängige Volltextindizes für Titel/Inhaltsangaben und Besetzung. Akzente werden in Dokument und Anfrage gleich normalisiert. Die bisherigen Titel-Suchindizes bleiben bestehen. Normale Importe aktualisieren die neuen generierten Spalten automatisch; es gibt keinen zusätzlichen Providerimport für eine Identifikation.

Die folgenden Variablen serverseitig in Vercel unter **Project → Settings → Environment Variables** für das gewünschte Deployment eintragen und anschließend neu deployen. Lokal gehören sie in `.env.local`. Keine `NEXT_PUBLIC_`-Variablen verwenden und Schlüssel nicht in Chat, Git oder Analytics eintragen.

| Variable                  | Wert / Bedeutung                                                          |
| ------------------------- | ------------------------------------------------------------------------- |
| `OPENAI_API_KEY`          | Schlüssel eines geeigneten OpenAI-API-Projekts mit aktivierter Abrechnung |
| `OPENAI_IDENTIFY_MODEL`   | `gpt-5.4-mini`                                                            |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe`                                                  |
| `IDENTIFY_AI_ENABLED`     | Erst zur Aktivierung `true`; Standard ist `false`                         |
| `IDENTIFY_DAILY_LIMIT`    | Standard `200` reservierte Modellaufrufe pro UTC-Tag                      |
| `IDENTIFY_MONTHLY_LIMIT`  | Standard `4000` reservierte Modellaufrufe pro UTC-Monat                   |

Ein Schlüssel allein aktiviert die Funktion nicht. `identifyAiEnabled` setzt Schlüssel **und** Schalter voraus. Das Textmodell muss Responses, strikte JSON-Schema-Ausgaben und `reasoning.effort=none` unterstützen. Für ein anderes Modell sind Kompatibilitäts- und Qualitätsprüfung erforderlich; es gibt keine automatische Modellersetzung.

Bei diesem Implementierungsstand war kein OpenAI-Schlüssel konfiguriert. Der reale Erkennungs- und Transkriptionsaufruf sowie Abrechnung, Projektzugang und Modellfreigabe müssen nach Einrichtung mit wenigen bewussten Testanfragen geprüft werden. Der Katalogpfad und kontrollierte Providerantworten sind unabhängig davon testbar.

## Aufruf- und Kostenkontrolle

Die atomare PostgreSQL-Funktion `reserve_budget` reserviert vor jedem kostenpflichtigen Versuch einen Aufruf im eigenen Service `openai-identify`. Textsuche braucht höchstens zwei Aufrufe; eine Transkription braucht einen. Beide teilen Tages- und Monatsgrenze. Fehlversuche zählen mit; es gibt keine automatischen Wiederholungen oder Rückerstattung der Reservierung. TMDB-/Streaming-API-Budgets sind davon getrennt. Ein Limit von `0` verhindert weitere OpenAI-Aufrufe.

Die Grenzwerte sind Aufruflimits, keine garantierten Eurobeträge. Tatsächliche Kosten hängen von Text-/Audioumfang, Modell und Anbieterpreisen ab. Zusätzlich OpenAI-Projektbudget und Benachrichtigungen konfigurieren. Textaufrufe haben jeweils maximal 2.000 Ausgabetokens. Die erste Stufe erhält höchstens 1.600 Eingabezeichen; die zweite höchstens 24 geprüfte Titel mit jeweils maximal 1.200 Zeichen Inhaltskontext und acht Cast-Namen. Der Erkennungslauf endet spätestens nach 25 Sekunden; die erste Modellstufe nach spätestens neun Sekunden. Keine Hintergrund- oder Toolaufrufe.

Kontingente nur als Metadaten prüfen, zum Beispiel:

```sql
SELECT period, consumed
FROM budgets
WHERE service = 'openai-identify'
ORDER BY period DESC;
```

Perioden sind `YYYY-MM-DD` und `YYYY-MM` in UTC. Keine freien Beschreibungen oder Modellantworten werden in Budget-, Job- oder Protokolltabellen geschrieben. Die Text-API erlaubt zehn Anfragen pro zehn Minuten und gehashter, vertrauenswürdiger Plattform-IP; ohne IP-Header gilt eine gemeinsame Grenze. Origin, Typ, Locale, aktiviertes Land, Jahrzehnt und maximal sechs ausgeschlossene IDs werden serverseitig geprüft. JSON ist auf 8 KiB und fünf Sekunden Einlesezeit begrenzt.

## Datenverarbeitung

Bei aktiviertem KI-Pfad werden die abgesendete Beschreibung und ausgewählte öffentliche Titelmetadaten an OpenAI übertragen. Ausschließlich vorhandene Katalog-IDs dürfen zurückkommen; Titel, Bilder, Links und Angebote stammen weiterhin aus Cineradar. Angezeigte Modellbegründungen müssen wörtlich in einem mitgegebenen öffentlichen Inhalts- oder Cast-Text vorkommen. Es werden keine vom Modell gelieferten Links aufgerufen oder angezeigt. Fehlende Streamingangebote verhindern nicht das Wiederfinden eines Titels.

Responses nutzt `store:false`. Das ist keine Zusage einer vollständigen Nullaufbewahrung bei OpenAI: gesonderte Abuse-Monitoring-Regeln können gelten. Der Betreiber muss seine konkrete Projektkonfiguration und Datenschutzhinweise abstimmen. Die Browser-Spracherkennung kann ebenfalls Dienste des Browseranbieters verwenden. Eine Aufnahme startet nur durch aktive Nutzerhandlung; der Text bleibt vor dem Absenden editierbar. Cineradar speichert Audiodateien nicht dauerhaft.

Beschreibungen und Transkripte gehören nicht in URLs, Seitenmetadaten, Logs, GA4 oder Fehlerberichte. Analyseereignisse dürfen nur die vorgesehenen kontrollierten Statuscodes, Laufzeiten, Längen, Anzahlen und öffentlichen Titel-IDs enthalten und bleiben an die bestehende Einwilligung gebunden.

## Qualitätsabnahme und Grenzen

1. Ohne aktivierten Schlüssel eine präzise vorhandene Handlung suchen; die Oberfläche kennzeichnet den Katalogabgleich.
2. Nach Aktivierung bekannte Titel in fünf Sprachen, eine alternative Umschreibung und eine bewusst unbekannte Erinnerung testen. Namen und Detailziele müssen zum echten Bestand gehören.
3. Nach einem falschen Kandidaten ausschließen und nochmals suchen; Medientyp und Jahrzehnt beachten. Kein Treffer soll eine hilfreiche Rückfrage auslösen.
4. Probeweise sehr kleines Aufrufkontingent verwenden: erschöpftes Kontingent oder Providerfehler führen zu einem gekennzeichneten Katalogfallback. Eine nicht erreichbare Datenbank liefert einen Dienstfehler statt eines erfundenen „kein Treffer“.
5. Textabbruch, Navigation und Diktatabbruch prüfen. Mikrofonprüfung erfolgt bewusst durch einen Menschen; automatisierte Tests ersetzen keinen realen Gerätetest.

Der aktuelle Bestand enthält 6.722 Titel, aber keine eigenen Szenen-/Keyworddaten. Nicht jede Sprache hat eine ausführliche Synopsis. Gewichtete Stichwortabdeckung findet passende vorhandene Beschreibungen; sie kann aus einer stark umschriebenen Szene keine fehlenden Fakten ableiten. Dafür dient die zusätzliche Modellstufe mit gegen den Katalog aufgelösten Titelhypothesen. Auch diese ist keine Garantie, jeden Film zu erkennen.

Die 15 redaktionellen Beispielbeschreibungen wurden am 8. September 2026 zusätzlich rein lesend gegen den echten Bestand geprüft: Der erwartete Titel erscheint in allen Fällen in den tatsächlich ausgegebenen Karten, vierzehnmal auf Platz 1 und einmal auf Platz 2. Das ist eine gezielte Beispielabnahme, keine allgemeine Erkennungsquote. Sprachbezogene Stopwörter erhalten mehrteilige Ortsnamen wie „Los Angeles“; tatsächlich benachbarte markante Wörter erhalten einen begrenzten Rankingbonus. Wiederholte Beugungen desselben Wortstamms zählen nicht als mehrere unabhängige Hinweise.

Gezielte Tests: `npx tsx --test test/identify.test.ts test/identify-regressions.test.ts`. Sie verwenden lokale PGlite-Datenbanken und Provider-Doubles; keine OpenAI- oder Streamingaufrufe. Vor Veröffentlichung außerdem Typecheck, Lint, vorhandene Regressionssuite und Build ausführen.

Offizielle Quellen: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.4 mini und Preise](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [Datenverarbeitung und Aufbewahrung](https://developers.openai.com/api/docs/guides/your-data), [Spracherkennung](https://developers.openai.com/api/docs/guides/speech-to-text).
