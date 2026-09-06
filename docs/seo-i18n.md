# SEO und Internationalisierung

`de`, `fr`, `it`, `es`, `en` sind fünf gleichberechtigte UI-Sprachen. Die Streamingmärkte bleiben `de`, `fr`, `it`, `es`. Eine englische Oberfläche aktiviert weder UK noch USA. `/en/` führt nach `/en/de/`; die neutrale Wurzel bietet die Auswahl.

Routen werden zentral in `i18n/routes.ts` erzeugt. Beispiel: `/de/de/film/inception-27205/` und `/en/de/movie/inception-27205/`. Beim Sprachwechsel bleibt der Markt erhalten, beim Marktwechsel die Sprache. Titelwechsel benutzen die tatsächlich gespeicherten lokalisierten Slugs. Bekannte frühere Slugs leiten permanent um; erfundene Slugs und unbekannte Entitäten liefern echte 404.

Alle 163 Nachrichten sind als vollständige Fünfertupel typisiert. ICU-Pluralformen und `Intl` formatieren Mengen, Währungen, Länder und Datumsangaben. Die Prüfung kompiliert jede Nachricht und kontrolliert 20 Routen-Kontexte. Native Sprachnamen und Marken bleiben absichtlich unverändert. Der Masterprompt wurde im Original und in `docs/masterprompt.md` um Englisch erweitert.

Metadaten und sichtbare Titel werden serverseitig erzeugt. Canonicals enthalten Sprache und Markt; Varianten verweisen innerhalb desselben Markts aufeinander. Keine pauschalen sprachübergreifenden Canonicals. Filter-/Such-/Merklisten-/Betriebsseiten sind nicht indexierbar. Private Vorschauen tragen zusätzlich `X-Robots-Tag: noindex, nofollow`.

Öffentliche Indexierung erfordert Live-Modus, Produktionsumgebung, Lizenz-/Rechtsfreigabe und einen inhaltlich vollständigen Titel mit frischem, erfolgreich geprüftem Angebotssnapshot. Fehlende Beschreibungen, Fehler und Testdaten werden ausgeschlossen. Sitemaps sind in Pakete zu höchstens 2.000 Titel/Markt-Paaren mit je fünf Sprach-URLs aufgeteilt. `lastmod` basiert auf Inhalts-/Angebotsänderungen, nicht auf jedem Abruf. Ein 404 verliert seinen Fehlerstatus nicht durch die Gestaltung der Fehlerseite.

JSON-LD verwendet Movie oder TVSeries mit sichtbaren, belegten Fakten. Es gibt keine erfundenen Rezensionen, aggregierten Nutzerbewertungen oder Preisangebote im Schema. Script-Escaping schützt gegen eingebettetes HTML. `/api/og/` rendert lokalisierte echte PNGs in 1200 × 630 mit Titel, Marke und Markt. Die Revision ist Teil der Bild-URL.

Roh-HTML und PNG-Abmessungen werden automatisch geprüft. Externe Rich-Results-/Social-Plattform-Crawler sind noch nicht gegen eine öffentliche Domain geprüft. Ein niedriger Lighthouse-SEO-Wert in der privaten Vorschau entsteht durch das beabsichtigte `noindex`; diese Sperre darf nicht zur Verbesserung des Messwerts abgeschaltet werden.
