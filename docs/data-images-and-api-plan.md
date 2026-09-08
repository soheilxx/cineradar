# Datenbestand, eigene Bilder und spätere Cineradar-API

Stand: 8. September 2026. Dieser Plan beschreibt den Ausbau. Die Frage nach zusätzlichen Vertragsrechten ist noch offen; es wurden dafür weder Infrastruktur angelegt noch Logo-Varianten aktiviert. Der vorhandene kommerzielle TMDB-Vertrag und das Streaming-Kontingent von 100.000 Requests pro Monat werden berücksichtigt. Ihr genauer Nutzungsumfang liegt nicht vor.

**Ausgangslage.** Cineradar liest seinen Katalog bereits aus PostgreSQL. Das Live-Inventar umfasst:

| Bestand                   |  Anzahl |
| ------------------------- | ------: |
| Titel                     |   6.722 |
| Sprachfassungen           |  33.610 |
| Angebote                  | 514.148 |
| Markt-Snapshots           |  20.081 |
| Anbieter-Markt-Datensätze |      67 |
| Staffeln                  |   7.068 |
| Episoden-Datensätze       |       0 |
| Poster-Verweise           |   6.697 |
| Backdrop-Verweise         |   6.577 |

Die Datenbank belegt 1.472.872.448 Bytes, rund 1,47 GB beziehungsweise 1,37 GiB. Die 13.274 Bildverweise zeigen auf TMDB; sie sind keine lokal gespeicherten Bilddateien und müssen nicht ebenso viele unterschiedliche Dateien ergeben.

Gespeichert werden ausgewählte, normalisierte API-Felder. Der HTTP-Adapter verwirft nicht modellierte Felder; beispielsweise bleiben bei TMDB acht Darstellernamen erhalten. Staffelgrunddaten und saison-/episodenbezogene Angebote sind vorhanden, ein vollständiger Episodenkatalog und ein Archiv aller ursprünglichen Antworten fehlen. Angebotsänderungen werden protokolliert, ersetzte Angebote jedoch nicht vollständig historisiert. Die eigene `/api/og`-Route erzeugt bereits Cineradar-Share-Bilder als PNG; sie ersetzt keine dauerhafte Bildablage.

**Vertragsrahmen.** Die am 8. September 2026 direkt geprüften [aktuellen Streaming-Bedingungen](https://developers.movieofthenight.com/terms-and-conditions) erlauben in §6 Speicherung von Daten und Bildern, auch über das Abo-Ende hinaus. §3 untersagt eigenständige Datenprodukte/APIs und konkurrierende Nachbildungen. §5 erteilt keine Rechte an fremden Postern, Logos oder Beschreibungen; Löschaufforderungen und Attribution bleiben zu beachten. Die ältere GitHub-Datei weicht bei der Bildaufbewahrung ab und ist hierfür nicht die aktuelle Referenz.

Die heute ausgelieferten [allgemeinen TMDB-API-Bedingungen](https://www.themoviedb.org/api-terms-of-use) nennen in §§1–3 sechs Monate maximale Cache-Dauer, Beschränkungen für Bearbeitungen und Weiterverkauf sowie gesonderte schriftliche kommerzielle Vereinbarungen. Der bestehende Vertrag kann abweichende Rechte enthalten. Die [TMDB-FAQ](https://developer.themoviedb.org/docs/faq) erklärt außerdem, dass TMDB kein Eigentum an den bereitgestellten Bildern beansprucht.

Vor der jeweiligen Freischaltung müssen Dauerarchivierung, eigene Bildauslieferung, Konvertierung/Zuschnitt/Logo-Überlagerung und B2B-Weitergabe einschließlich Kundennutzung konkret abgedeckt sein. Daraus werden je Quelle und Inhalt dokumentierte Nutzungsregeln abgeleitet. Die Request-Zahl allein ersetzt diese Prüfung nicht.

**Vorgeschlagener Datenfluss.** Bestehende Importjobs bleiben der Einstieg: zugelassener API-Endpunkt → Herkunft und Abrufzeit erfassen → validieren und normalisieren → PostgreSQL aktualisieren → geänderte Bildreferenzen in eine separate Warteschlange → Original prüfen und speichern → Varianten erzeugen → erst danach veröffentlichen. Webseitenaufrufe lösen keine vollständigen Neuimporte aus.

Importiert werden vereinbarte Endpunkte und Felder für einen definierten Katalogumfang. Änderungen, neue Titel und veraltete Datensätze erhalten Priorität; Cursor, Wiederholungen und Anbieterbudgets bleiben begrenzt. TMDB stellt dafür [Änderungslisten](https://developer.themoviedb.org/docs/tracking-content-changes) bereit. Seine [täglichen ID-Exporte](https://developer.themoviedb.org/docs/daily-id-exports) sind Listen zur Bestandsabstimmung, keine vollständigen Datenexporte.

Die Erweiterung baut auf bestehenden Tabellen auf:

| Bereich             | Ergänzung und Zweck                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_records`    | Anbieter, externe ID, Endpunkt, Sprache/Markt, Abrufzeit, Antwort-Hash, Schema-Version, Vertragsreferenz und Ablaufdatum. Vollständige Antworten nur für freigegebene Import-Endpunkte und Aufbewahrungszeiten; größere Archive komprimiert im privaten Objektspeicher. |
| Bestehender Katalog | Weiterhin normalisierte Titel, Sprachfassungen, Staffeln und Angebote. Quellenverknüpfung und letzter erfolgreicher Abruf getrennt vom Zeitpunkt einer tatsächlichen Inhaltsänderung. Eigene redaktionelle Beiträge bleiben erkennbar.                                  |
| `assets`            | Quell-URL, Anbieter-/Titelzuordnung, unveränderter Original-Hash, MIME-Typ, Breite/Höhe, Speicherpfad, Herkunft, Nutzungsumfang, Ablaufdatum und Status wie `pending`, `ready` oder `withdrawn`.                                                                        |
| `asset_variants`    | Asset-ID, Breite, Format, Qualität, Transformationsversion, optionale Logo-Version, Datei-Hash und Speicherpfad. Eindeutiger Schlüssel verhindert doppelte Verarbeitung.                                                                                                |

So lassen sich Antworten erneut verarbeiten, ohne unnötige Anbieteraufrufe auszulösen. Schlüssel, Authentifizierungsheader und private Such- oder Diktattexte gelangen nicht ins Quellenarchiv. Die SAA-ID wird künftig ausdrücklich als externe Zuordnung gespeichert; bisher liefert der Adapter sie zurück, der Titelimport übernimmt sie jedoch nicht dauerhaft.

**Bildspeicher und Versionierung.** Originale und Derivate gehören in dauerhaften Objektspeicher. Für Dateien empfiehlt auch [Vercel Objektspeicher](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions); das Dateisystem einer Function ist keine dauerhafte Bildablage. Ziel ist die Auslieferung unter `images.cineradar.tv`.

[Cloudflare R2](https://developers.cloudflare.com/r2/buckets/public-buckets/) unterstützt eigene Domains mit CDN-Cache direkt, sofern die DNS-Einrichtung passt. [Vercel Blob](https://vercel.com/docs/vercel-blob/public-storage) integriert sich in das bestehende Hosting, verwendet für öffentliche Dateien standardmäßig eigene Blob-Domains. Eine zusätzliche Auslieferung über die Cineradar-Domain wäre dort separat zu planen. Die Auswahl erfolgt nach Domain-Anbindung, Takedown/Purge-Möglichkeiten und gemessenen Speicher-/Transfermengen.

Das Original bleibt bytegleich und separat gespeichert. WebP-Poster entstehen in 185, 342, 500 und 780 Pixel Breite; Backdrops zunächst in 780, 1.280 und 1.920 Pixel Breite. Seitenverhältnis erhalten, kleinere Quellen nicht hochskalieren. Für größere Varianten wird eine ausreichend große, erlaubte Quelle benötigt: Ein bereits gespeicherter `w500`-Link liefert keine zusätzliche Detailauflösung für 780 Pixel. Qualität und Dateigröße werden im Pilot visuell geprüft.

Beispiel für einen versionierten Pfad: `https://images.cineradar.tv/titles/{id}/{source-hash}/webp-v1/poster-500.webp`. Eine geänderte Quelle oder Verarbeitung erhält neue Pfade. Die aktive Zuordnung wechselt erst, wenn die erforderlichen Dateien bereitstehen. Ein Logo unten rechts ist eine eigene, zunächst deaktivierte Variante mit eigener Logo-Version. Es verändert weder das Original noch ersetzt es die Quellenangabe; Anbieterlogos werden gesondert geführt. Bestehende Share-PNGs können parallel weiterlaufen.

**Sicherer Betrieb.** Bildjobs akzeptieren ausschließlich registrierte Quellen aus den Anbieterantworten. HTTPS und Host-/Pfad-Allowlist gelten auch nach DNS-Auflösung und bei jedem erlaubten Redirect; private Netze und beliebige Ziel-URLs sind ausgeschlossen. Initiale Pilotgrenzen: zwei parallele Downloads, höchstens zehn Downloads pro Minute, 15 Sekunden je Download, 10 MB je Datei und 40 Megapixel. Dateisignatur und tatsächlicher Decoderbefund müssen zum MIME-Typ passen; Fehler landen als begrenzte Wiederholung oder Quarantäne im Jobstatus. Schreibzugriff und Originalarchiv bleiben privat.

Ablaufregeln gelten für Quellen, Originale, Varianten und Backups. Eine Löschaufforderung sperrt die aktive Zuordnung, entfernt die betroffenen Dateien und leert den CDN-Cache. Kurze Browser-TTLs und begrenzte CDN-TTLs berücksichtigen die verbleibende Nutzungsdauer; ein versionierter Dateiname ersetzt keinen Widerruf. API-Requests, Bilddownloads, Speicher und Bildtransfer werden getrennt gemessen. Stabile externe Bild-URLs dürfen nicht vorausgesetzt werden: Die [SAA-Bilddokumentation](https://docs.movieofthenight.com/guide/images) nennt sechs bis zwölf Monate Gültigkeit für Show-Bildadressen.

**Umsetzung in fünf Stufen.**

1. **Rechte und Speicher auswählen.** Offene Vertragsfrage beantworten, Nutzungsregeln festhalten und R2/Blob samt Domain-Anbindung auswählen. Erst danach den benötigten Dienst einrichten.
2. **Pilot mit 50 Titeln.** Neue Tabellen und Jobs zunächst begrenzt einsetzen. Originaltreue, WebP-Qualität, mobile Ladezeiten, Wiederanlauf und einen vollständigen Takedown prüfen. Logo-Varianten bleiben ohne bestätigte Freigabe aus.
3. **Bestand nachziehen.** Vorhandene Bildreferenzen nach Quelle/Hash deduplizieren und in kontrollierten, fortsetzbaren Batches verarbeiten. Laufende Katalogänderungen haben Vorrang; Importfortschritt und Fehlerrate sichtbar machen.
4. **Bildausgabe und SEO umstellen.** Zentralen Resolver für `src`/`srcset`, Detailseiten, Share-Bilder und Sitemap-Bildverweise verwenden. Nur veröffentlichte Assets referenzieren, korrekten `image/webp`-Typ sowie Maße liefern und die Bilddomain für Suchmaschinen zugänglich halten. Nach einem Austausch HTML, Share-Cache und veröffentlichte Sitemap-Bildadressen gemeinsam aktualisieren; nach Takedown veraltete Verweise entfernen.
5. **Eigene API nach zusätzlicher Lizenz.** Eine versionierte `/v1`-Schnittstelle erhält feldweise Freigaben nach Quelle und Kundenvertrag. API-Schlüssel werden nur gehasht gespeichert, Berechtigungen, Quoten und Widerruf je Kunde verwaltet. Markt, Abrufzeit und Verfügbarkeit bleiben im Datenvertrag erkennbar. Datenexporte und Weitergabe von Bildvarianten werden nur im ausdrücklich erlaubten Umfang angeboten.

Der Speicherbedarf wird aus dem Pilot hochgerechnet: Summe der eindeutigen Originalgrößen plus Summe aller Varianten plus Quellenarchiv, Versionen und Backups. Der heutige Datenbankumfang allein erlaubt keine belastbare Prognose der Bildgröße oder monatlichen Auslieferungskosten.
