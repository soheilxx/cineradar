# Cineradar-Bildspeicher

Implementiert sind ein privater Bildspeicher, eine persistente Verarbeitungswarteschlange und öffentliche WebP-Adressen auf der Cineradar-Domain. Dieses Dokument beschreibt den Code und die Betriebsabläufe; es bestätigt keine abgeschlossene Produktionsmigration oder einen vollständigen Backfill. Eine eigene Daten-API für externe Nutzer ist ausdrücklich zurückgestellt.

## Speicherung und Veröffentlichung

- `media_assets` enthält Quelle, Verarbeitungsversion, Status, Original-Metadaten und das aktuelle Variantenmanifest. `title_media` ordnet Poster und Hintergrundbild einem Titel zu. `media_variants` registriert tatsächlich veröffentlichte Varianten einschließlich Ablaufdatum.
- Die Originaldatei wird unverändert und privat unter `cineradar/originals/{sha256}.{format}` in Vercel Blob gespeichert. Der Hash ermöglicht die Wiederverwendung identischer Originale. Es gibt keinen öffentlichen Endpunkt für Originale.
- Auch die WebP-Dateien liegen in einem **privaten** Blob-Store. Ausschließlich registrierte, nicht abgelaufene und nicht zurückgezogene WebP-Varianten sind über `/media/…` erreichbar. Blob-Zugangsdaten und interne Originalpfade gelangen nicht in die öffentlichen Titel-Daten.
- Die Verarbeitung veröffentlicht das Manifest erst nach erfolgreichen Uploads. Sperr-Token verhindern, dass ein überholter Worker ein neues Ergebnis überschreibt. Deterministische Dateipfade und eine Prüfung bereits vorhandener Dateien machen Wiederholungen möglich.
- Katalog, Titelseite, Karten, Titelfinder, JSON-LD und Sitemap verwenden verfügbare eigene Bildadressen. Die OG-URL enthält die Artwork-Revision, damit geänderte Bilder einen neuen Vorschau-Schlüssel erhalten. Sprach- und Marktvarianten teilen dieselben Bilddateien.
- Bis ein Bild fertig ist, bleibt die bestehende externe Bildquelle nutzbar. Abgelaufene oder fehlgeschlagene neue Bilder fallen ebenfalls darauf zurück. Eine ausdrücklich zurückgezogene Quelle liefert kein externes Ersatzbild. Die Rohdaten des Titels werden durch diese Projektion nicht überschrieben.

## Dateinamen, Formate und freigegebenes Branding

Öffentliche Adresse:

```text
https://cineradar.tv/media/{asset-id}/{revision}/{titel-slug}-{jahr}-{poster|backdrop}-{breite}.webp
```

`asset-id` und `revision` bestehen jeweils aus 24 hexadezimalen Zeichen. Der Titel-Slug stammt aus der englischen Titelübersetzung, ersatzweise dem Originaltitel oder der Titel-ID. Er wird mit dem bestehenden `slugify` normalisiert, auf höchstens 90 Zeichen gekürzt und ohne abschließenden Bindestrich verwendet. Das Jahr wird nur bei einem gültigen vierstelligen Wert eingefügt. Die Breite im Dateinamen entspricht der **tatsächlichen** Bildbreite. Beispiel mit Platzhaltern für die beiden Hashes:

```text
/media/{asset-id}/{revision}/lucifer-2016-poster-500.webp
```

Die Asset-ID hängt von normalisierter Quelle, Bildart und Verarbeitungsprofil ab. Die Dateirevision berücksichtigt Originalinhalt, Profil, Bildart, Dateinamen und bei Postern die Branding-Version. Gleiche Quellen werden nicht pro Sprache oder Markt kopiert. Bei geteilten Assets bleibt der zuerst registrierte Dateiname bestehen.

| Bildart         | Zielbreiten             | Bearbeitung                                                                        |
| --------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| Poster          | 185, 342, 500, 780 px   | Ausrichtung korrigieren, proportional verkleinern, weiße Wortmarke einsetzen, WebP |
| Hintergrundbild | 300, 780, 1280, 1920 px | Ausrichtung korrigieren, proportional verkleinern, WebP ohne Branding              |

Kleinere Quellen werden nicht hochskaliert. Daraus entstehende identische Breiten werden nur einmal gespeichert. WebP wird aktuell mit Qualität 82 und Aufwand 4 erzeugt; responsive Bildangaben enthalten ausschließlich vorhandene Breiten.

Freigegeben ist das kompakte **vollständige weiße Cineradar-Logo** unten rechts auf Postern: Wortmarke etwa 34 % der Coverbreite, inklusive seitlicher Innenabstände etwa 37,4 %. Der Außenabstand beträgt etwa 2,5 %. Die abgerundete dunkle Fläche verwendet 74 % Deckkraft und einen dezenten weißen Rand. Rundung und Mindestabstände können bei kleinen Bildern leicht abweichen. Die feste Version lautet `wordmark-white-compact-v2`. Die Schrift besteht aus SVG-Pfaden; auf dem Server muss keine Schrift nachgeladen werden. Originaldateien und Hintergrundbilder bleiben ohne Logo.

Eine spätere Designänderung erfordert zusätzlich einen bewussten Wechsel des Verarbeitungsprofils, damit bereits registrierte Titel erneut verarbeitet werden. Ein geänderter Branding-String allein scannt bestehende fertige Assets nicht neu ein.

## Konfiguration

Die allgemeinen Voraussetzungen des Live-Modus bleiben bestehen. Für den Bildspeicher kommen folgende serverseitige Variablen hinzu:

| Variable                     | Standard   | Bedeutung                                                                                                                                               |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEDIA_ENABLED`              | `false`    | Bildspeicher nur zusammen mit `APP_MODE=live` aktivieren                                                                                                |
| `BLOB_READ_WRITE_TOKEN`      | leer       | Geheimnis für den privaten Vercel-Blob-Store; niemals öffentlich ausgeben                                                                               |
| `BLOB_STORE_ID`              | leer       | Store-Zuordnung für die Umgebung; die aktuellen Blob-Aufrufe verwenden die SDK-Authentifizierung                                                        |
| `MEDIA_DOWNLOADS_PER_MINUTE` | `60`       | Gemeinsame Obergrenze reservierter Bildjobs je Kalenderminute über Cron, CLI und parallele Deployments; zusätzlich begrenzt durch `maxJobs` des Batches |
| `MEDIA_MAX_BYTES`            | `10000000` | Maximalgröße eines heruntergeladenen Originals, in Bytes                                                                                                |
| `MEDIA_MAX_PIXELS`           | `40000000` | Maximal erlaubte Pixelzahl beim Dekodieren                                                                                                              |
| `SITE_URL`                   | lokale URL | Öffentliche Basis für eigene Bildadressen; Produktion verwendet `https://cineradar.tv`                                                                  |

`DATABASE_URL`, gegebenenfalls `DATABASE_URL_UNPOOLED`, `ADMIN_KEY`, `SESSION_SECRET` und `CRON_SECRET` werden aus der bestehenden Konfiguration verwendet. Der Store muss privat sein. Vor Aktivierung muss die Datenbankmigration `db/migrations/009_media.sql` angewendet sein.

## CLI und Verwaltungsbereich

Die Befehle laden vorhandene Variablen aus `.env`; bereits gesetzte Prozessvariablen haben Vorrang. Sie sind getrennt nach Lesen, Einreihen und Verarbeiten:

```sh
npm run media:status
npm run media:enqueue
npm run media:run
```

- **status:** liest die Anzahl je Verarbeitungsstatus. Ohne aktiven Bildspeicher wird `enabled: false` ausgegeben, ohne eine Datenbank zu öffnen.
- **enqueue:** registriert aktuelle Poster- und Hintergrundquellen, Quellenänderungen und anstehende Auffrischungen. Maximal 100 Registrierungsdurchläufe mit jeweils 1.000 Einträgen; bei keinem weiteren Treffer endet der Aufruf. Es werden dabei keine Bilder heruntergeladen und keine TMDB-/Streaming-API-Aufrufe für Titel ausgeführt. `registered` zählt Zuordnungs-/Auffrischungsvorgänge, nicht zwingend neue unterschiedliche Bilddateien.
- **run:** registriert einen begrenzten nächsten Abschnitt und verarbeitet bis zu 40 Jobs, zusätzlich begrenzt durch die Download-Konfiguration. Neue Jobs werden höchstens 60 Sekunden lang begonnen; bereits laufende Arbeit darf noch auslaufen. Der Batch verwendet vier Worker und beendet danach die verwendete Datenbankverbindung.

`enqueue` und `run` führen bei deaktiviertem Bildspeicher ebenfalls keine Datenbankarbeit aus. Die CLI gibt keine Blob-Tokens oder Originalinhalte aus.

Die vorhandene, durch den Admin-Login geschützte Betriebsseite zeigt die Zustände `ready`, `queued`, `running`, `failed` und `withdrawn` in allen fünf Sprachen. Der Status wird erst nach der Zugriffsprüfung und nur bei aktiviertem Bildspeicher geladen. Es handelt sich um Asset-Zähler über die gespeicherten Verarbeitungsversionen, nicht um die Anzahl von Filmen, URLs oder Sprachfassungen. `ready` wird als verarbeitet bezeichnet; eine exakte Zahl gerade öffentlich auslieferbarer Varianten ist daraus nicht abzuleiten.

`logicalBytes` in der CLI summiert die in den aktuellen Asset-Manifesten hinterlegten Original- und Variantenbytes. **Das ist keine exakte Blob-Speicherbelegung oder Abrechnungsgröße.** Geteilte Originale können mehrfach zählen, alte Revisionen und Uploadreste dagegen außerhalb dieser Summe liegen. Die tatsächlichen Speicher- und Transferwerte sind im Blob-Konto zu prüfen.

## Cron, Backfill und Auffrischung

Der bestehende Vercel-Cron ruft `/api/cron/` jede Minute auf. Nach den unabhängigen Sitemap-Arbeiten startet er einen begrenzten Medienbatch. Der Medienlauf ist durch `MEDIA_ENABLED` gesteuert; ein Pausieren der Katalogsynchronisierung über den bisherigen Sync-Schalter pausiert den Bildspeicher nicht. Für eine Pause des Bildspeichers ist die eigene Konfiguration maßgeblich.

Der Cron-Batch verarbeitet mit vier Workern bis zu 60 Bilder und beginnt neue Arbeit höchstens 55 Sekunden lang. Anschließend werden bereits begonnene Bilder fertiggestellt. Pro Worker wird weiterhin nur eine Bildvariante gleichzeitig dekodiert und kodiert; Varianten werden in Gruppen von höchstens zwei hochgeladen. Die gemeinsame Datenbankgrenze von standardmäßig 60 Job-Starts pro Kalenderminute gilt auch bei überlappenden Cron- und Verwaltungsläufen. Diese Grenzen sind Höchstwerte; die tatsächliche Geschwindigkeit hängt von Bildgröße und Speicherantwortzeiten ab.

Für den anfänglichen Backfill: Migration und privaten Store bereitstellen, Live-Konfiguration aktivieren, Quellen mit `media:enqueue` erfassen und die Queue durch Cron oder begrenzte `media:run`-Aufrufe abarbeiten lassen. Der Katalog bleibt dabei nutzbar. Einen vollständigen Backfill erst nach Prüfung der Zustandszahlen und konkreter eigener Bildadressen melden. Die Datenbank reserviert Download-Jobs atomar in einem gemeinsamen Minutenfenster; parallele Cron- und CLI-Aufrufe teilen sich dieselbe Grenze. Das Fenster ist an Kalenderminuten gebunden und kein gleitendes 60-Sekunden-Limit. Abgelaufene Zähler werden nach zwei Tagen entfernt.

Für authentifizierte Betriebswerkzeuge besteht außerdem `/api/admin/media/`: `GET` liest den Status, `POST` startet einen begrenzten Batch. Beide verlangen den bestehenden Bearer-Cron-Schlüssel. Der aktuelle POST-Body ist beispielsweise `{"maxJobs":10}`; der Endpunkt akzeptiert 1 bis 60 Jobs und beginnt neue Arbeit höchstens 60 Sekunden lang. Er ist keine öffentliche Daten-API und gehört nicht in die Navigation.

Nach erfolgreicher Verarbeitung ist eine Veröffentlichung **180 Tage** gültig. Sie wird ab sieben Tagen vor Ablauf erneut zur Prüfung eingeplant. Währenddessen kann eine noch gültige veröffentlichte Revision weiter ausgeliefert werden. Identische, erneut geprüfte Dateien behalten ihre Adresse mit erneuerter Freigabe. Bei geänderten Dateien entsteht eine neue Revision; ältere Varianten behalten ihr bisheriges Ablaufdatum. Ohne erfolgreiche Auffrischung werden abgelaufene eigene URLs nicht mehr ausgeliefert.

Der Ablauf entfernt derzeit keine Blob-Objekte automatisch. Eine physische Bereinigung alter Revisionen, verwaister Uploads und nicht mehr referenzierter Originale benötigt einen gesonderten, referenzgeprüften Löschlauf. Eine solche Löschung ist nicht Bestandteil des aktuellen Cron-Backfills.

## Fehler und Zurückziehen

Kurzzeitige Fehler werden mit wachsendem Abstand erneut versucht. Nach sechs Versuchen oder bei einem als dauerhaft eingestuften Fehler wird ein Asset `failed`. `error_code` enthält einen begrenzten technischen Fehlercode; `storage_*`-Codes unterscheiden Speicher-Authentifizierung, fehlenden oder gesperrten Store, Rate-Limit und Timeout ohne Zugangsdaten auszugeben. Quell-Downloads erlauben nur die vorgesehenen HTTPS-TMDB-Bildadressen; Weiterleitungen, private Zieladressen, nicht erlaubte Formate und überschrittene Größen werden abgewiesen. Defekte Bilder erzeugen kein veröffentlichtes Teilmanifest.

Ein Betriebsverantwortlicher kann nach Beheben der Ursache gezielt einen fehlgeschlagenen Datensatz erneut einreihen. `$1` steht für eine vorab überprüfte Asset-ID und wird als SQL-Parameter übergeben:

```sql
UPDATE media_assets
SET state = 'queued', attempts = 0, run_at = now(), error_code = null,
    lock_token = null, lock_until = null, updated_at = now()
WHERE id = $1 AND state = 'failed';
```

Für einen tatsächlichen Rückzug müssen alle gespeicherten Profile derselben Quelle und Bildart gesperrt werden. Die Quelle zunächst anhand der konkreten Asset-ID prüfen, anschließend die folgende gezielte Operation in einer Transaktion ausführen:

```sql
WITH target AS (
  SELECT source_url, kind FROM media_assets WHERE id = $1
)
UPDATE media_assets AS asset
SET state = 'withdrawn', error_code = 'withdrawn',
    lock_token = null, lock_until = null, updated_at = now()
FROM target
WHERE asset.source_url = target.source_url AND asset.kind = target.kind;
```

Ein Rückzug bleibt über Verarbeitungsversionen hinweg bestehen. Die Bildprojektion liefert für die betroffene Quelle kein externes Ersatzbild; neue Anfragen an die öffentliche Auslieferung werden abgewiesen. Bereits gecachte Antworten können noch bis zum verbleibenden öffentlichen Cache-Intervall sichtbar sein, derzeit höchstens 300 Sekunden. Bereits von Suchmaschinen oder sozialen Netzwerken gespeicherte Kopien werden dadurch nicht automatisch gelöscht. Bei dringendem Rückzug sind auch deren Vorschauen und veröffentlichte Sitemap-Generationen zu berücksichtigen.

`MEDIA_ENABLED=false` ist ein Betriebs-/Rollout-Schalter und kein Ersatz für einen Bildrückzug: Die deaktivierte Projektion verwendet wieder die bestehenden externen Quellen. Für eine Rücknahme daher den gespeicherten Status verwenden und die konkret betroffenen öffentlichen Adressen prüfen.

Bei Blob-Lesefehlern antwortet die eigene Bildroute ohne Cache mit `503` und `Retry-After: 60`. Unbekannte, abgelaufene oder gesperrte Adressen liefern `404` ohne Cache. Reguläre Varianten besitzen einen Inhalts-ETag, unterstützen `HEAD` und bedingte Anfragen und werden höchstens bis zu ihrem Ablauf, maximal 300 Sekunden, öffentlich gecacht.

## Relevante Implementierung

- `data/media/repository.ts`: Registrierung, Queue-Leases, Status, Veröffentlichung und Lesefreigabe.
- `data/media/source.ts`, `process.ts`, `storage.ts`: geprüfter Download, Variantenbildung und private Speicherung.
- `data/media/branding.ts`, `wordmark.ts`: freigegebene kompakte weiße Wortmarke.
- `data/media/serve.ts`, `app/media/[...segments]/route.ts`: öffentliche Variantenauslieferung.
- `data/media/project.ts`, `domain/artwork.ts`: gemeinsame Titel-Projektion und responsive Varianten.
- `jobs/media.ts`, `scripts/media.ts`, `ui/operations.tsx`: begrenzte Worker, CLI und bestehende Betriebsseite.
- `seo/sitemap-publish.ts`, `seo/metadata.ts`: eigene Bildadressen und Versionswechsel in SEO-Ausgaben.
