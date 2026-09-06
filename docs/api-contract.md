# Quellenvertrag und Budget

Geprüft am 6. September 2026: veröffentlichte Primärdokumentation und OpenAPI; keine authentifizierte Live-Abfrage. Der tatsächliche gebuchte Tarif und Nutzungsrechte sind weiterhin offen.

| Quelle | Ausschließliche Verwendung | Vertrag |
|---|---|---|
| TMDb | Titel, Beschreibungen, Bilder, Fakten, Cast und Staffelfakten | [API-Grundlagen](https://developer.themoviedb.org/docs/getting-started), [Bilder](https://developer.themoviedb.org/docs/image-basics), [FAQ](https://developer.themoviedb.org/docs/faq) |
| Movie of the Night | Streaminganbieter, Angebote, Deeplinks, Preise, Audio/Untertitel, Änderungen | [Show-Modell](https://docs.movieofthenight.com/guide/shows), [OpenAPI](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml), [Nutzungsbedingungen](https://github.com/movieofthenight/streaming-availability-api/blob/main/TERMS.md) |

Die verwendete OpenAPI liegt nachvollziehbar unter `docs/sources/saa-openapi.yaml`. TMDb-Watch-Provider-Daten, JustWatch-Scraping und zusätzliche Streamingquellen werden nicht genutzt. Credits verweisen auf beide Quellen; die erforderliche TMDb-Kennzeichnung und das offizielle Logo sind eingebunden. Das ersetzt keine kommerzielle Vertragsfreigabe.

## Adapter

TMDb nutzt serverseitige Bearer-Authentifizierung. `/configuration` liefert geprüfte Bildbasis/-größen; Titel werden in allen fünf Sprachen abgerufen. `/trending/all/day` und `/search/multi` liefern Importkandidaten. Bilder stammen nur aus geprüften TMDb-Pfaden. Originaltitel dürfen sprachübergreifend identisch sein. Fehlende Beschreibungen bleiben als Faktenfallback erkennbar und verhindern Indexierungsfreigabe.

Movie of the Night: direkter v4-Zugang mit `X-API-Key` oder explizit gewählter RapidAPI-Zugang mit dessen separatem Schlüssel und Host. `/countries` validiert tatsächlich unterstützte Länder und Anbieter. `/shows/{id}` verwendet `movie/<id>` oder `tv/<id>` und `series_granularity=episode`. Die Quelle kann typisierte TMDb-IDs wie `movie/238` liefern; Typ und Nummer werden beide geprüft. `/changes` wird pro Land und Änderungsart vollständig paginiert.

Die Spezifikation garantiert keine Staffelnummer aus dem Arrayindex. Deshalb werden nur explizit nummerierte englische Quelltitel wie „Season 3“/„Episode 2“ zugeordnet. Andere Einheiten bleiben als Staffel/Episode erhalten, ohne erfundene Nummer oder Vollständigkeitsbehauptung. Ein authentifizierter Serienvertragstest mit Sonderstaffeln bleibt vor Livefreigabe erforderlich.

Alle Antworten werden mit Zod validiert. 404, Authentifizierungsfehler, Quota, Timeout, Netzwerk-/Serverfehler und Schemafehler bleiben getrennt. 404 wird nicht als erfolgreich leere Verfügbarkeit interpretiert. Externe Redirects werden nicht blind verfolgt. Zeitstempel werden als UTC behandelt; unbekannte Preise oder Sprachen werden nicht zu null Euro oder deutsch ergänzt.

## Kosten und Mengen

`SAA_DAILY_BUDGET`, `SAA_MONTHLY_BUDGET` und `SAA_ENDPOINT_WEIGHT` müssen dem Vertrag entsprechen. Standardbudgets null deaktivieren Auto-Sync. 20 Prozent Puffer ist eine veränderbare Projektentscheidung. Die Schätzung `npm run budget:estimate` nennt alle Annahmen; zusätzliche Änderungsseiten kosten weitere reservierte Einheiten.

Ein Bootstrap ist auf zehn Titel begrenzt. Pro Metadatenimport fallen fünf Lokalisierungsabrufe plus Bildkonfiguration an; der Dry Run schätzt konservativ. Ein Show-Abruf verarbeitet die vier Märkte, sofern deren Abdeckung bestätigt ist. Suchanfragen an die eigene Datenbank lösen keinen bezahlten Request aus. Die echte Abdeckung von DE/FR/IT/ES wird erst mit dem vorhandenen Zugang geprüft und nicht aus dieser Startliste behauptet.

Optionale maschinelle Übersetzung erfordert `TRANSLATION_URL`, `TRANSLATION_KEY` und bestätigte Rechte. Der Dienst erhält `{text,source,target}` und liefert `{text}`. Cache nach Titel, Zielsprache und Quellhash; keine Übersetzung überschreibt redaktionell freigegebenen Text. Der Dienst und seine Datenschutz-/Kostenbedingungen sind noch nicht konfiguriert.
