# Cineradar: Prüfung der Kontakt- und Vergleichsseiten

Stand: 7. September 2026. Dieses Protokoll beschreibt die Prüfung vor dem Produktionspush. Die anschließende Domainprüfung erfolgt gegen die tatsächlich veröffentlichte Version.

## Lieferumfang

- Kontaktseite mit Name, E-Mail, Betreff und Nachricht als Pflichtfeldern in fünf Sprachen; serverseitige Validierung, Speicherung und Anzeige im geschützten Betriebsbereich.
- Mobile Navigation als zugänglicher Dialog; Footer mit vier klaren Linkgruppen, auf Mobilgeräten in zwei Spalten.
- Neue Struktur und eigene Einleitungen für Informationsseiten; ergänzte, im offiziellen UID-Register geprüfte Betreiberkennungen.
- Zehn eigenständige Wettbewerbervergleiche und ein Hub, jeweils in fünf Sprachen: 55 kurze redaktionelle URLs.
- Selbstreferenzierende Canonicals, gegenseitige Sprachverweise, Sitemap-Einträge mit tatsächlichem Bearbeitungsdatum, WebPage- und BreadcrumbList-Daten.
- Share-Karten für Vergleiche, Informationsseiten, Anbieter, Genres, Filme und Serien mit vorhandenen Cineradar- beziehungsweise Titelmotiven.

## Durchgeführte Prüfungen

| Prüfung                           | Ergebnis                                                                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatisierte Tests              | 31 bestanden, einschließlich Kontaktvalidierung, redaktioneller Routen, Datenbankmigrationen und bisheriger Katalogfunktionen                                                          |
| TypeScript / Lint / Übersetzungen | Bestanden; 202 vollständige Nachrichtenschlüssel, fünf Sprachen, 25 Sprach-/Marktkontexte                                                                                              |
| Next.js-Produktionsbuild          | Bestanden; Vercel-Ausgabemodus                                                                                                                                                         |
| 55 lokale redaktionelle URLs      | Je HTTP 200, eine H1, eigene Titel und Beschreibungen, Selbst-Canonical und fünf korrekte Sprachverweise; Vergleichstabellen und strukturierte Daten bereits im HTML                   |
| Slash-Normalisierung              | Kurze Vergleichs-URLs ohne abschließenden Slash; Katalogpfade behalten ihren Slash; drei Weiterleitungsfälle geprüft                                                                   |
| Unbekannte URLs                   | Drei Fälle mit tatsächlichem HTTP 404                                                                                                                                                  |
| WerStreamt.es → Filmsuche         | „Dune“ und gewähltes Land bleiben erhalten; deutsche Filmdetailseite; Netflix-Link mit HTTP 302 auf den konkreten Titel                                                                |
| JustWatch → Seriensuche           | „Reacher“ und Deutschland bleiben erhalten; deutsche Seriendetailseite; Prime-Video-Link mit HTTP 302 auf amazon.de                                                                    |
| Englische Sprache                 | Wechsel im mobilen Menü öffnet `/en/us/show/reacher-108978/` mit sichtbarem USA-Kontext                                                                                                |
| Responsive Darstellung            | Kontakt/Footer bei 320, 390, 768 und 1440 CSS-Pixeln ohne horizontalen Seitenüberlauf; Menü bei 320 Pixeln innerhalb des Viewports; Vergleichstabelle scrollt innerhalb ihres Bereichs |
| Social-Bilder                     | Sechs Seitentypen mit HTTP 200, PNG, 1200 × 630 Pixeln; Titel- und Vergleichsmotive visuell geprüft                                                                                    |
| Datenbankschema                   | Migration `005_contact_details.sql` angewendet; bestehende Meldungen bleiben kompatibel                                                                                                |

Die mobilen und Desktop-Prüfungen erfolgten im Browser mit Größenemulation. Sie ersetzen keinen Test auf jedem physischen Gerät. Der Build meldet die bestehende Next.js-Abkündigung der Dateikonvention `middleware.ts`; dies ist kein Buildfehler.

## Nach dem Push

Die Produktionsprüfung muss die veröffentlichte Commit-ID, den Vercel-Status und die Alias-Domain `cineradar.tv` bestätigen. Anschließend werden dieselben 55 URLs einschließlich Sitemap, Robots-Freigabe und öffentlicher Canonicals sowie die Bildantworten überprüft. Lokale Prüfausgaben liegen unter `.local/` und werden nicht veröffentlicht.

## Bewusst offene Punkte

Das Support-Postfach ist auf Wunsch des Auftraggebers vertagt. Das Formular speichert Anfragen; es behauptet keine erfolgte E-Mail-Zustellung. Zuständigkeit und belastbarer Antwortkanal bleiben vor dem vollständigen Servicestart zu organisieren.

Der Katalog hat weiterhin Lücken bei bekannten älteren Titeln. Ein vollständiger Bestand, allgemeine Überlegenheit gegenüber Wettbewerbern und eine bereits erfolgte Google-Indexierung werden nicht behauptet. Die lokale Ereignisschnittstelle für Vergleiche ist noch keine eingerichtete Produktanalyse.

Inhaltsvertiefung, Datenschutzdetails und die weiteren Prioritäten sind im [Launch-Masterplan](launch-masterplan.md) festgehalten.
