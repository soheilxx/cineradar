# Cineradar GA4: Ereignisse, Datenvertrag und Kontoeinstellungen

Stand: 7. September 2026. Mess-ID: `G-6VDG3EL0NF`. Konto: `407150740`. Property: `553056079`. Webstream: `15735260052`.

Die Implementierung erfasst die Nutzung der Website detailliert, sobald eine gültige Einwilligung vorliegt. Sie behauptet weder eine vollständige Messung aller Besuche noch tatsächliche Wiedergaben bei Netflix oder anderen externen Anbietern. `provider_click` misst das Öffnen eines Anbieterlinks; `contact_success` bestätigt die Annahme durch Cineradars Kontakt-API, keine E-Mail-Zustellung.

## Aktivierung und Einwilligung

| Bedingung                                                                             | Verhalten                                                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GA4_ENABLED=true`, `APP_MODE=live`, `DEPLOYMENT_ENV=production`                      | GA4 kann nach Einwilligung geladen werden.                                                                                                        |
| `GA4_DEBUG=true`, `DEPLOYMENT_ENV=local`, `SITE_URL` auf `localhost` oder `127.0.0.1` | Lokale QA mit Debug-Ereignissen, ebenfalls erst nach Einwilligung.                                                                                |
| Preview-Deployment, fehlende Freigabe oder anderer lokaler Host                       | Kein Analytics-Tracking.                                                                                                                          |
| Keine Entscheidung oder Ablehnung                                                     | Kein GA4-Skript, keine Ereignisse und kein nachträglich versendeter Puffer.                                                                       |
| Zustimmung                                                                            | Statistik erlaubt; Werbespeicherung, Werbedaten und Personalisierung bleiben abgelehnt.                                                           |
| Widerruf                                                                              | Neue Ereignisse werden gestoppt; erreichbare `_ga`-Cookies werden entfernt. Bereits übermittelte Daten werden dadurch nicht automatisch gelöscht. |
| Geschützter Betriebsbereich                                                           | Von der Analytics-Erfassung ausgeschlossen.                                                                                                       |

Die Entscheidung wird 180 Tage als notwendige lokale Einstellung gespeichert. Bei blockierter Speicherung gilt sie nur für die laufende Seite. Analytics-Cookies haben eine Laufzeit von 180 Tagen; `cookie_update=false` verhindert die automatische Verlängerung bei jedem Besuch. Einstellungen sind jederzeit über den Footer erreichbar. Die fünf Sprachen Deutsch, Französisch, Italienisch, Spanisch und Englisch besitzen vollständige Consent-Texte.

Das kompakte Banner lässt sich über gleichwertige Schaltflächen akzeptieren oder ablehnen. Das X ist als „Ohne Statistik schließen“ beschriftet und speichert ebenfalls eine Ablehnung. Schließen oder Scrollen erteilt keine Einwilligung; Bannerklicks sind vom Klicktracking ausgeschlossen.

Google Signals und Werbepersonalisierung sind in der Website-Konfiguration deaktiviert. Die erweiterten Messungen im Webstream sollen ausgeschaltet bleiben: Die Website liefert Seiten-, Scroll-, Such-, Formular- und Linkereignisse selbst und bereinigt deren Parameter.

## Datenvertrag und Datenschutz

Die zentrale Schnittstelle ist `trackEvent(name, params)` in `lib/analytics.ts`. Nur registrierte Ereignisse und Parameternamen werden übernommen. Zahlen müssen endlich und nicht negativ sein; Kennungen und Optionswerte sind begrenzte technische Tokens. `title_id` erlaubt ausschließlich öffentliche TMDB-Kennungen wie `tv:63174` oder `movie:27205`.

Niemals an GA4 übergeben:

- Namen, E-Mail-Adressen, Betreff, Nachricht, sonstige Formularinhalte oder FormData.
- Eingegebene Suchbegriffe, auch nicht als `search_term` oder `search_query`.
- Vollständige Browser-URLs mit Query-String, Fragmenten, frei wählbaren Slugs oder Nutzerwerten.
- Unbereinigte Referrer, Fehlermeldungen, Stacktraces, DOM-Texte, Input-Werte oder Tastatureingaben.
- Eigene User-IDs, gehashte E-Mail-Adressen, Session-Replays oder Fingerprints.

`form_id` bedeutet ausschließlich die feste Formularkategorie `contact` oder `report`; der Parameter ist kein vom Benutzer eingegebener Name. Suchanalysen erhalten nur Eingabelänge und Trefferzahlen. Öffentliche Film-/Serienkennungen werden erst bei Titelereignissen verwendet. Ein generischer Klick enthält Elementtyp, Platzierung und gegebenenfalls eine feste Kontrollkennung, niemals den sichtbaren Text oder Eingabeinhalt.

`page_location` wird aus erlaubten Routenfamilien gebildet. Ein Titelpfad enthält gegebenenfalls nur die öffentliche numerische Titelkennung, keinen Titel-Slug. Bei externen Referrern bleibt nur die Origin; interne Referrer werden ebenfalls bereinigt. Rohe URL-Parameter dienen ausschließlich der lokalen Erkennung eines Seitenwechsels.

## Gemeinsame Parameter

Diese Felder ergänzt die Runtime zu jedem freigegebenen Produkt-Ereignis. Optionale Werte fehlen, wenn sie nicht bestimmt werden können.

| Parameter          | Bedeutung / Format                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `content_language` | Sprache der aktuellen Seite: `de`, `fr`, `it`, `es`, `en`.                                                                                |
| `streaming_market` | Streaming-Land der aktuellen Seite: `de`, `fr`, `it`, `es`, `us`. Bei länderübergreifenden Vergleichsseiten gegebenenfalls nicht gesetzt. |
| `page_type`        | Feste Routenfamilie, etwa `home`, `search`, `movie`, `tv`, `providers`, `contact`, `comparison`.                                          |
| `page_location`    | Bereinigte Origin und Route, ohne rohe Such-/Formulardaten.                                                                               |
| `page_title`       | Technischer Titel `Cineradar \| <page_type>`.                                                                                             |
| `page_referrer`    | Bereinigte interne Route oder externe Origin.                                                                                             |
| `send_to`          | Ausschließlich `G-6VDG3EL0NF`.                                                                                                            |
| `transport_type`   | `beacon`, soweit der Browser unterstützt.                                                                                                 |
| `debug_mode`       | Nur im expliziten lokalen Debugbetrieb wahr.                                                                                              |

Einzelne Produktkomponenten liefern ergänzend `locale` und `market` als technischen Kontext. Für Standardauswertungen sind die gemeinsamen Felder `content_language` und `streaming_market` vorgesehen.

## Vollständiger Ereigniskatalog

Gemeinsame Parameter aus der vorherigen Tabelle gelten zusätzlich. Ein Klick kann bewusst sowohl `ui_click` als auch ein fachliches Ereignis auslösen: Das erste beantwortet die Bedienfrage, das zweite die Produktfrage. Diese Ereignisse dürfen nicht addiert werden, um eindeutige Klicks zu schätzen.

| Ereignis                    | Auslöser / Bedeutung                                                                                           | Zusätzliche Parameter                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `page_view`                 | Erster sichtbarer Seitenkontext nach Zustimmung und anschließende Routenwechsel; lokal entdoppelt.             | `title_id`, `comparison_id`, wenn vorhanden                                                                                           |
| `view_title`                | Aufruf einer Film-/Seriendetailroute.                                                                          | `title_id`, `media_type`                                                                                                              |
| `ui_click`                  | Delegierter Klick im Dokument, einschließlich per Tastatur ausgelöster Klicks; Consent-Oberfläche ausgenommen. | `element_tag`, `control`, `placement`, `interaction_type`                                                                             |
| `title_select`              | Titelkarte oder verlinkter Spotlight-Titel gewählt.                                                            | `title_id`, `media_type`, `position`, `source`                                                                                        |
| `provider_click`            | Angebotslink zu einem Streaminganbieter geöffnet.                                                              | `title_id`, `provider_id`, `offer_type`, `quality`, `currency`, `offer_price`, `season_number`, `episode_number`, `unit`, `placement` |
| `navigation_click`          | Anderer interner oder externer Link gewählt.                                                                   | `placement`, `link_category`, `target_page_type`                                                                                      |
| `section_open`              | Ein HTML-Details-Bereich wird geöffnet.                                                                        | `control=details`                                                                                                                     |
| `scroll_depth`              | Erstmals 25, 50, 75, 90 oder 100 Prozent der scrollbaren Strecke erreicht.                                     | `scroll_percent`                                                                                                                      |
| `active_time`               | Sichtbare Seitennutzung in ungefähr 15-Sekunden-Abschnitten; Rest beim Verlassen/Verbergen.                    | `engagement_time_msec`                                                                                                                |
| `search_submit`             | Vollständige Suche abgeschickt.                                                                                | `query_length`, `result_count` (aktuelle Vorschlagszahl), `locale`, `market`                                                          |
| `search_suggestions_view`   | Aktuelle Autocomplete-Antwort erfolgreich geladen.                                                             | `query_length`, `result_count`, `locale`, `market`                                                                                    |
| `search_suggestions_error`  | Autocomplete-HTTP-/Netzwerkfehler, keine abgebrochenen veralteten Anfragen.                                    | `query_length`, `result_count` soweit vorhanden, `error_code`, `locale`, `market`                                                     |
| `search_suggestion_select`  | Konkreten Autocomplete-Titel gewählt.                                                                          | `query_length`, `result_count`, `title_id`, `media_type`, `position`, `locale`, `market`                                              |
| `search_results_view`       | Suchergebnisseite dargestellt.                                                                                 | `query_length`, `result_count` (gesamte Trefferzahl), `page_number`                                                                   |
| `search_more_start`         | Fehlenden Titel automatisch nachsuchen oder Status manuell prüfen.                                             | `query_length`, `trigger`, `source`, `locale`, `market`                                                                               |
| `search_more_status`        | Status der Nachsuche wechselt oder Ergebnisverfügbarkeit ändert sich.                                          | `query_length`, `status`, `results_available`, `locale`, `market`                                                                     |
| `catalog_load_more`         | Nächste Katalogseite automatisch oder per Button angefordert.                                                  | `page_number`, `trigger`, `source`, `locale`, `market`                                                                                |
| `catalog_load_success`      | Nächste Katalogseite erfolgreich angehängt.                                                                    | Wie `catalog_load_more`, dazu `result_count`, `duration_ms`                                                                           |
| `catalog_load_error`        | Laden weiterer Ergebnisse fehlgeschlagen.                                                                      | Wie `catalog_load_more`, dazu `error_code=load_failed`, `duration_ms`                                                                 |
| `filter_change`             | Feste Filteroption gewählt; nur tatsächlich angebotene Choice-Werte zulässig.                                  | `filter_name`, `filter_value`, `source`                                                                                               |
| `filter_apply`              | Filterkombination abgeschickt.                                                                                 | `selected_count`, `sort`, `source`                                                                                                    |
| `filter_reset`              | Filter zurückgesetzt; Suchtext bleibt lokal erhalten.                                                          | `source`                                                                                                                              |
| `offer_filter_change`       | Angebotsart, Bildqualität, Audio, Untertitel oder Staffel ausgewählt.                                          | `title_id`, `market`, `filter_name`, `filter_value`                                                                                   |
| `offer_filter_reset`        | Angebotsfilter zurückgesetzt.                                                                                  | `title_id`, `market`                                                                                                                  |
| `watchlist_add`             | Titel erfolgreich in lokaler Merkliste gespeichert.                                                            | `title_id`, `media_type`, `market`, `item_count`                                                                                      |
| `watchlist_remove`          | Titel erfolgreich aus lokaler Merkliste entfernt.                                                              | `title_id`, `media_type`, `market`, `item_count`                                                                                      |
| `watchlist_error`           | Schreiben der Merkliste fehlgeschlagen.                                                                        | `title_id`, `market`, `error_code=storage_error`                                                                                      |
| `watchlist_load_success`    | Titel/Änderungen der Merkliste erfolgreich geladen.                                                            | `market`, `result_count`, `change_count`                                                                                              |
| `watchlist_load_error`      | Merklistenabfrage fehlgeschlagen.                                                                              | `market`, `error_code=load_failed`                                                                                                    |
| `watchlist_sort_change`     | Merklistenreihenfolge geändert.                                                                                | `market`, `filter_value` (`saved`/`title`), `item_count`                                                                              |
| `provider_selection_change` | Anbieter-/Zusatzkanalpräferenz erfolgreich gespeichert.                                                        | `provider_id`, `selected`, `selected_count`, `source`, `market`                                                                       |
| `provider_selection_error`  | Anbieterpräferenzen konnten nicht gespeichert werden.                                                          | `market`, `error_code=storage_error`                                                                                                  |
| `provider_dialog_open`      | Verwaltung der Anbieterpräferenzen geöffnet.                                                                   | `market`, `selected_count`                                                                                                            |
| `provider_dialog_close`     | Verwaltung der Anbieterpräferenzen geschlossen.                                                                | `market`, `selected_count`                                                                                                            |
| `contact_start`             | Erster Fokus im Kontakt-/Meldeformular.                                                                        | `form_id`                                                                                                                             |
| `contact_validation_error`  | Native Formularvalidierung verhindert eine gültige Eingabe; gegebenenfalls pro betroffenem Feld.               | `form_id`, `error_code=browser_validation`                                                                                            |
| `contact_submit`            | Gültiges Formular an die Kontakt-API abgeschickt.                                                              | `form_id`                                                                                                                             |
| `contact_success`           | Kontakt-API nimmt die Anfrage erfolgreich an.                                                                  | `form_id`, `status=stored`, `duration_ms`                                                                                             |
| `contact_error`             | Kontakt-API lehnt ab oder Netzwerkfehler tritt auf.                                                            | `form_id`, `error_code` (`network_error`, `rate_limited`, `submission_rejected`), `duration_ms`                                       |
| `comparison_search_submit`  | Suche oder Titelwahl aus einem Vergleichs-Suchfeld.                                                            | `comparison_id`, `market`                                                                                                             |
| `context_change`            | Sprache/Streaming-Land über feste Auswahl geändert.                                                            | `filter_name`, `filter_value`, `source` (`header`/`comparison`)                                                                       |
| `mobile_menu_open`          | Mobiles Navigationsmenü geöffnet.                                                                              | Keine zusätzlichen Werte                                                                                                              |
| `mobile_menu_close`         | Mobiles Navigationsmenü geschlossen.                                                                           | Keine zusätzlichen Werte                                                                                                              |
| `spotlight_change`          | Aktiver Startseiten-Spotlight gewechselt.                                                                      | `title_id`, `media_type`, `position`, `direction`, `market`                                                                           |
| `shelf_scroll`              | Startseitenregal per Pfeil weitergeschoben.                                                                    | `direction`, `source=home_shelf`                                                                                                      |

## Parameterverzeichnis

| Parameter                                 | Typ / Werte                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title_id`                                | Öffentliche Kennung: `movie:<id>` oder `tv:<id>`.                                                                                                                     |
| `media_type`                              | `movie` oder `tv`.                                                                                                                                                    |
| `provider_id`                             | Öffentliche Anbieterkennung, etwa `netflix`.                                                                                                                          |
| `offer_type`                              | `subscription`, `addon`, `free`, `rent`, `buy`.                                                                                                                       |
| `quality`                                 | Gemeldete Qualität, etwa `sd`, `hd`, `qhd`, `uhd`; bei unbekanntem Wert nicht gesetzt.                                                                                |
| `currency`, `offer_price`                 | Währung und numerischer Angebotspreis. Ein Anbieter-Klick ist kein Umsatz-/Kaufereignis.                                                                              |
| `season_number`, `episode_number`, `unit` | Öffentliche Staffel-/Folgenzuordnung und `film`, `series`, `season` oder `episode`.                                                                                   |
| `query_length`                            | Länge der bereinigten Eingabe als Zahl; Inhalt wird nicht übertragen.                                                                                                 |
| `result_count`                            | Anzahl der Vorschläge, Gesamttreffer oder neu geladenen Titel, abhängig vom Ereignis.                                                                                 |
| `position`                                | Einsbasierte sichtbare Position; in nachgeladenen Katalogen durchlaufend.                                                                                             |
| `page_number`                             | Einsbasierte Katalog-/Suchseite.                                                                                                                                      |
| `duration_ms`                             | Dauer einer Lade-/Formularoperation in Millisekunden.                                                                                                                 |
| `selected_count`                          | Anzahl ausgewählter Filter oder Anbieter.                                                                                                                             |
| `item_count`, `change_count`              | Merklistengröße beziehungsweise Anzahl angezeigter Änderungen.                                                                                                        |
| `scroll_percent`                          | Feste Schwellenwerte `25`, `50`, `75`, `90`, `100`.                                                                                                                   |
| `engagement_time_msec`                    | Sichtbare aktive Messzeit; Standardparameter für die GA-Auswertung.                                                                                                   |
| `selected`, `results_available`           | Boolesche Zustände.                                                                                                                                                   |
| `status`                                  | Bei Nachsuche `queued`, `running`, `complete`, `deferred`, `failed`; Kontakt-Erfolg `stored`.                                                                         |
| `trigger`                                 | `automatic` oder `manual`.                                                                                                                                            |
| `filter_name`, `filter_value`             | Feste Optionsnamen und ausgewählte technische Werte; kein Freitext. Leere Auswahl wird als `all` bezeichnet.                                                          |
| `sort`                                    | `relevance`, `trending`, `latest`, `title` oder `year`.                                                                                                               |
| `form_id`                                 | Ausschließlich `contact` oder `report`.                                                                                                                               |
| `comparison_id`                           | Redaktionskennung einer Vergleichsseite; `hub` beim allgemeinen Vergleichseinstieg.                                                                                   |
| `source`                                  | Fester Produktkontext, etwa `search`, `catalog`, `finder`, `spotlight`, `header`, `comparison`, `status_check`, `title_discovery`, `home_shelf`, `provider`, `addon`. |
| `placement`                               | `header`, `footer`, `content`.                                                                                                                                        |
| `control`                                 | Feste Kontrollkennung, etwa `watchlist_toggle` oder `details`; kein Textlabel.                                                                                        |
| `element_tag`                             | HTML-Elementtyp, ohne Text/Inhalt.                                                                                                                                    |
| `interaction_type`                        | `pointer` oder `keyboard`.                                                                                                                                            |
| `link_category`                           | `internal` oder `external`.                                                                                                                                           |
| `target_page_type`                        | Bereinigte Routenfamilie des internen Linkziels.                                                                                                                      |
| `direction`                               | `previous`, `next` oder `direct`.                                                                                                                                     |
| `error_code`                              | Fester technischer Fehlercode, niemals die rohe Exception.                                                                                                            |

## GA4-Kontoeinstellungen und Abnahmestand

Die folgenden Einträge dokumentieren die manuelle Einrichtung in der Property. Als „ausstehend“ markierte Punkte dürfen erst nach sichtbarer Bestätigung in GA4 als erledigt gelten. Die Website sendet Parameter bereits unabhängig davon; zur komfortablen Nutzung in Berichten müssen benutzerdefinierte Definitionen in GA4 zusätzlich registriert sein. [Google: Benutzerdefinierte Dimensionen und Messwerte](https://support.google.com/analytics/answer/14240153?hl=de).

| Einstellung                                      | Sollwert                                            | Status                                                 |
| ------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| Mess-ID / Stream-Zuordnung                       | `G-6VDG3EL0NF` / `15735260052`                      | Im Root-Browser bestätigt                              |
| Erweiterte Messungen                             | Deaktiviert; eigene bereinigte Ereignisse verwenden | Im GA4-Konto gespeichert und Persistenz bestätigt      |
| Ereignisdaten-Aufbewahrung                       | 14 Monate                                           | Im GA4-Konto gespeichert und Persistenz bestätigt      |
| Nutzerdaten-Aufbewahrung                         | 14 Monate                                           | Im GA4-Konto geprüft und Persistenz bestätigt          |
| Nutzerkennungen bei neuer Aktivität zurücksetzen | Aktiv                                               | Im GA4-Konto geprüft und Persistenz bestätigt          |
| Benutzerdefinierte Ereignisdimensionen           | 20 Definitionen gemäß Tabelle unten                 | 20 Definitionen im GA4-Konto gespeichert und bestätigt |
| Benutzerdefinierte Messwerte                     | 7 Definitionen gemäß Tabelle unten                  | 7 Definitionen im GA4-Konto gespeichert und bestätigt  |
| `provider_click` als Schlüsselereignis           | Create with code; Once per event; kein Standardwert | Im GA4-Konto erstellt und bestätigt                    |
| `contact_success` als Schlüsselereignis          | Create with code; Once per event; kein Standardwert | Im GA4-Konto erstellt und bestätigt                    |

Die 14-Monatsfrist ist von der 180-Tage-Cookiefrist getrennt. Neue Aktivität erneuert nur die Frist für Nutzerkennungen. Aggregierte Standardberichte sind von dieser Aufbewahrungseinstellung ausgenommen. [Google: Datenaufbewahrung](https://support.google.com/analytics/answer/7667196?hl=de).

### 20 benutzerdefinierte Ereignisdimensionen

Für alle Definitionen ist der Umfang **Ereignis**. Parameter exakt übernehmen; vorhandene Definitionen prüfen und keine Dubletten anlegen.

| Anzeigename        | Ereignisparameter  | Bedeutung                          | Status    |
| ------------------ | ------------------ | ---------------------------------- | --------- |
| Content language   | `content_language` | Seitensprache                      | Bestätigt |
| Streaming market   | `streaming_market` | Streaming-Land                     | Bestätigt |
| Page type          | `page_type`        | Seitentyp                          | Bestätigt |
| Title ID           | `title_id`         | Öffentliche Titelkennung           | Bestätigt |
| Media type         | `media_type`       | Film oder Serie                    | Bestätigt |
| Streaming provider | `provider_id`      | Streaminganbieter                  | Bestätigt |
| Offer type         | `offer_type`       | Abo, Kauf, Leihe usw.              | Bestätigt |
| Streaming quality  | `quality`          | Gemeldete Bildqualität             | Bestätigt |
| Interaction source | `source`           | Produktkontext                     | Bestätigt |
| Page placement     | `placement`        | Header, Inhalt oder Footer         | Bestätigt |
| Interface control  | `control`          | Technische Kontrollkennung         | Bestätigt |
| Form type          | `form_id`          | Kontaktformular oder Datenmeldung  | Bestätigt |
| Event status       | `status`           | Zustand einer Produktoperation     | Bestätigt |
| Error category     | `error_code`       | Feste Fehlerklasse                 | Bestätigt |
| Event trigger      | `trigger`          | Automatisch oder manuell           | Bestätigt |
| Filter name        | `filter_name`      | Geänderter Filter                  | Bestätigt |
| Filter value       | `filter_value`     | Gewählte feste Option              | Bestätigt |
| Sort order         | `sort`             | Angewendete Sortierung             | Bestätigt |
| Comparison page    | `comparison_id`    | Redaktionskennung eines Vergleichs | Bestätigt |
| Navigation target  | `target_page_type` | Interner Navigationszieltyp        | Bestätigt |

`title_id` kann sehr viele unterschiedliche Werte besitzen. Detailanalysen daher auf Zeitraum, Ereignis und gegebenenfalls Markt begrenzen; keine Rohsuchbegriffe als zusätzliche Dimension registrieren.

### 7 benutzerdefinierte Messwerte

| Anzeigename             | Ereignisparameter | Einheit              | Auswertungshinweis                                                    | Status    |
| ----------------------- | ----------------- | -------------------- | --------------------------------------------------------------------- | --------- |
| Search query length     | `query_length`    | Standard             | Durchschnitt je Suchereignis, nicht summierte Textmenge               | Bestätigt |
| Result count            | `result_count`    | Standard             | Ereignisse nach Vorschlägen/Gesamtergebnissen/Ladepaketen trennen     | Bestätigt |
| Result position         | `position`        | Standard             | Durchschnittliche gewählte Position pro Titelwahl                     | Bestätigt |
| Catalog page            | `page_number`     | Standard             | Tiefe der aufgerufenen Katalogseite                                   | Bestätigt |
| Operation duration      | `duration_ms`     | Zeit → Millisekunden | Dauer erfolgreicher und fehlgeschlagener Operationen getrennt ansehen | Bestätigt |
| Selected provider count | `selected_count`  | Standard             | Anzahl aktiver Optionen pro Aktion                                    | Bestätigt |
| Scroll depth percent    | `scroll_percent`  | Standard             | Prozentwert 0–100; keine Geld-/Zeiteinheit                            | Bestätigt |

Keinen dieser Messwerte als Werbeumsatz oder personenbezogene Nutzerinformation deklarieren. `engagement_time_msec` und `currency` bleiben Standardparameter. `offer_price` ist ausschließlich ein Angebotspreis und wird vorerst als unregistrierter Zusatzparameter gesendet; ein achter benutzerdefinierter Messwert wird dafür nicht angelegt. Der GA4-Umsatzparameter `value` wird für Anbieter-Klicks nicht verwendet.

## Browserabnahme des aktuellen Arbeitsstands

Die folgenden Prüfungen wurden im Codex-In-App-Browser durchgeführt. Der Stand ist auf cineradar.tv veröffentlicht. Dort wurden fehlende Google-Skripte vor Einwilligung sowie erfolgreiche HTTP-204-Messungen für Seitenaufrufe, Suchergebnisse und Titelansichten nach Zustimmung bestätigt. Konto- und DebugView-Prüfungen sowie Widerruf und mobile Darstellung wurden zusätzlich lokal geprüft.

| Prüfung              | Beobachtetes Ergebnis                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vor der Einwilligung | Keine Google-Analytics-Skripte und keine GA-Cookies.                                                                                                                      |
| Ablehnung            | Statistik bleibt deaktiviert; keine GA-Skripte oder GA-Cookies.                                                                                                           |
| Zustimmung           | Messanfragen an den Google-Collect-Endpunkt mit HTTP 204; genau ein eigener Seitenaufruf je geprüftem Seitenwechsel.                                                      |
| Suche nach Lucifer   | `search_results_view` mit `query_length=7` und `result_count=10`; Serie `tv:63174` als erster Treffer. Der Suchtext selbst wird nicht als Analytics-Parameter übertragen. |
| Streaminganbieter    | `provider_click` für Netflix mit öffentlicher Titelkennung und Streaming-Markt im Messkontext.                                                                            |
| GA4 DebugView        | `scroll_depth`, `ui_click` und `active_time` sichtbar bestätigt. Dies ist kein Nachweis für sämtliche weiteren Ereignisarten.                                             |
| Widerruf             | GA-Deaktivierungsflag wahr, GA-Cookies entfernt, bei anschließender Interaktion keine neuen Messanfragen.                                                                 |
| Neues Banner-X       | Speichert `denied` und schließt ohne Laden des Analytics-Skripts.                                                                                                         |
| Mobile Ansicht       | Bei 375 Pixeln Viewportbreite kein horizontaler Überlauf; Banner 351 Pixel breit.                                                                                         |

Die zwei Schlüsselereignisse `provider_click` und `contact_success` wurden ohne Standard-Geldwert registriert. Die Zählweise ist einmal pro Ereignis. Es wurden keine zusätzlichen Ableitungsregeln erzeugt, die dieselbe Interaktion nochmals senden.

Die Produktionsprüfung deckte einen Verlust unmittelbar vor vollständigen internen Seitenwechseln auf. Such- und Filteraktionen sowie interne Seitenlinks verwenden deshalb Next.js-Navigation mit persistenter Analytics-Runtime. Kataloglinks verzichten auf automatisches Prefetching. Die erneute öffentliche Netzwerkabnahme bestätigt `ui_click`, `search_submit` und `title_select` mit HTTP 204 zusammen mit den folgenden Seitenaufrufen. Mobiles Menüschließen und der Abbruch veralteter Lazyload-Anfragen sind für diese Navigation abgesichert. Sprach- und Landwechsel verwenden ebenfalls interne Navigation; HTML-Sprache und Einwilligungstexte folgen der aktuellen Route. Navigation wartet nicht auf Analytics und erzeugt keinen persistenten Ereignispuffer.

## Grenzen und laufende Qualitätsprüfung

- Ohne Einwilligung gibt es absichtlich keine Analytics-Messung. Frühere Aktionen werden auch nach einer späteren Zustimmung nicht rekonstruiert.
- Adblocker, Browser-Schutz, deaktiviertes JavaScript, Verbindungsabbrüche, verworfene Beacon-Anfragen und die GA4-Verarbeitung können Ereignisse verhindern oder verzögern. Eine HTTP-Antwort auf einen Messrequest beweist noch keine sichtbare Berichtsverarbeitung.
- Klicks auf externe Streamingangebote belegen keinen abgespielten Film, keinen Vertragsabschluss und keine tatsächliche Streaminghäufigkeit. Suchranking und GA4-Klickdaten sind getrennte Funktionen.
- GA4 misst keine Nutzer ohne technische Messung nachträglich. Die Erfassungsquote muss bei jeder Auswertung berücksichtigt werden; „100 Prozent lückenlos“ wäre eine falsche Zusage.
- Das Kontaktformular wird nur über seine Prozesszustände ausgewertet. Eine erfolgreiche Übermittlung erlaubt keine Einsicht in Namen, E-Mail-Adresse oder Nachricht in GA4.
- Produktionsabnahme: Einwilligung ablehnen → keine Google-Anfrage; zustimmen → bereinigter Seitenaufruf; Suche/Filter/Titel/Anbieter/Merkliste/Kontaktprozess → passende Ereignisse; widerrufen → keine neuen Ereignisse. Such-/Formular-Testdaten dürfen in keiner Messanfrage erscheinen.
- In GA4 Realtime/DebugView korrekte Property, Eventnamen und Parameter bestätigen. Anschließend ein reales Berichtsfenster mit registrierten Definitionen prüfen. Keine Dubletten durch zusätzliche GTM-Tags, Enhanced Measurement oder abgeleitete Kopien derselben Ereignisse erzeugen.

Technische Quellen: `lib/analytics.ts`, `ui/analytics.tsx`, `ui/analytics-consent.tsx`, `lib/config.ts`, instrumentierte Komponenten in `ui/`, `test/analytics.test.ts` und `test/analytics-config.test.ts`.
