# 🎯 Focus & Goals

Eine schlanke Web-App, die **Fokus-Sessions** mit **Zielen** verbindet: Jede
Pomodoro-artige Fokuszeit kann einem Ziel zugeordnet werden und zahlt sichtbar
darauf ein. Alles wird lokal im Browser gespeichert (kein Konto, kein Server).

## Schnellstart

Doppelklick auf **`vorschau.html`** – läuft offline im Browser, ohne Installation.
Live-Version (GitHub Pages): siehe Repo-Beschreibung.

## Funktionen

- **Fokus-Timer** (konfigurierbar, Standard 25 min Fokus / 5 min Pause):
  Start / Pause / Reset, akustisches Signal am Ende, Countdown im Browser-Tab.
- **Session → Ziel:** vor dem Start ein Ziel wählen – die Fokuszeit wird diesem
  Ziel gutgeschrieben.
- **Ziele** mit optionalem Zieldatum (Fälligkeits-Hinweis), **Meilensteinen**
  (Häkchen), automatischem **Fortschrittsbalken** und investierter **Fokuszeit**.
- **Überblick:** Fokus heute, Sessions heute, Fokus diese Woche, aktive Ziele.
- Ziele abschließen / wieder öffnen / löschen.

## Aufbau

```
src/styles.css              Styles
standalone/app.js           gesamte App-Logik + UI (Vanilla JS)
scripts/build-standalone.cjs  baut vorschau.html + docs/index.html
docs/index.html             Build-Ausgabe (GitHub Pages)
vorschau.html               Build-Ausgabe (lokaler Doppelklick)
```

Nach Änderungen an `src/` oder `standalone/`:

```bash
node scripts/build-standalone.cjs
```
