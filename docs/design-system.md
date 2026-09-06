# Designsystem

Die visuelle Richtung verbindet ein dunkles Programmkino mit einer klaren Suchoberfläche. Eigene Cineradar-Bildmarke, warme goldene Akzente, große Filmflächen und ein asymmetrischer Wechsel aus Hauptfilm, Serienmotiv und Abendfinder geben der Seite ihre Identität. Es gibt keinen automatisch abspielenden Slider.

| Token | Wert / Verwendung |
|---|---|
| Hintergrund | `#090b10` |
| Flächen | Dunkles Blau/Graphit, feine helle Konturen |
| Akzent | `#f6c76b`, primäre Suche und Anbieteraktionen |
| Typografie | Selbst gehostete variable Manrope, systemische Fallbacks |
| Inhalt | Maximalbreite mit großzügigen Rändern, kleinere Abstände mobil |
| Plakate | Verhältnis 2:3, reservierte Flächen, responsive TMDb-Größen |
| Bewegung | Kurzer versetzter Karteneintritt, dezenter Bildzoom und Fokuszustände |

Das ursprüngliche Kinomotiv wurde speziell für dieses Projekt generiert und als WebP eingebunden. TMDb-Plakate und -Backdrops sind Quellenmaterial mit Credits. Fehlende/beschädigte Plakate erhalten eine eigene neutrale Filmfläche. Bewegungsreduktion deaktiviert Animationen und sanftes Scrollen.

Suche steht vor Entdeckung. Der Länder-/Sprachenwechsel ist unabhängig und auf Mobilgeräten zweizeilig angeordnet. Sechs Plakatspalten werden je nach Breite zu vier beziehungsweise zwei. Staffelangebote, Quelle, Aktualität und Bezugsart bleiben auf Detailseiten nachvollziehbar.

Wiederverwendete zugängliche Komponenten: Combobox-Suche, Select-Auswahl, Dialoge, Checkboxen und Pagination. Produktspezifische Komponenten liegen in `ui/`; vendorte `components/ui/`-Primitives bleiben unverändert. Die Suchvorschläge enthalten eine eigene zugängliche Suchaktion, weil die Combobox den übrigen Seitenbereich während der Auswahl für Screenreader isoliert.

Sichtbare Tastaturfokusse, Sprunglink, semantische Überschriften, beschriftete Formularfelder, echte Buttons/Links und Mindestzielgrößen um 44 px. Metadaten mindestens 12 px, wesentliche Bedienung mindestens 14 px. Layoutprüfung für 320, 360, 390, 768, 1024, 1440 und 1920 px. Automatische Kontrastprüfung erfolgt nach Abschluss endlicher Einblendanimationen.

Screenshots liegen unter `docs/evidence/home-<browser>-<width>.png`. Axe und Tastaturtests decken repräsentative Abläufe ab; das ist keine formale WCAG-Zertifizierung oder Prüfung mit allen realen Hilfsmitteln.

Lint-Ausnahmen sind projektspezifisch: Vendorte UI-Primitives werden nicht umgeschrieben; Node-Testregistrierungen sind absichtlich nicht awaited. React Compiler ist nicht aktiviert. Responsive Quellbilder verwenden geprüfte CDN-Größen statt eines Next-spezifischen Image-Optimierers, damit beide Hostingpfade dasselbe Verhalten bieten. Semantische Statusrollen werden zusätzlich mit Axe geprüft.
