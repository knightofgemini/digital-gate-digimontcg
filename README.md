# Digital Gate · Digimon TCG

Catalogo non ufficiale del Digimon Card Game in inglese: carte e versioni, collezione e wishlist, deckbuilding con
lista ban, prezzi, scansione delle carte e prossime uscite. È un'app Android (React Native/Expo).

**Scarica l'app:** [DigimonSetTracker.apk](https://github.com/knightofgemini/digital-gate-digimontcg/releases/download/latest/DigimonSetTracker.apk)
· pagina: https://knightofgemini.github.io/digital-gate-digimontcg/

- `rn/` – l'app · `src/` – catalogo delle carte e dei prodotti, banner, loghi, errata, pagina del sito
- `tools/` – preparazione dei dati e delle immagini (TakaOtaku, sito ufficiale, Cardmarket e CardTrader)
- `.github/workflows/build.yml` – a ogni invio su `main`: deposito su GitHub Pages (carte nuove, immagini) e, se è
  cambiata l'app, APK nella release "latest"
- `spoiler.yml`, `prezzi.yml`, `set-assets.yml` – carte in arrivo, prezzi e materiale promozionale, in automatico

La vecchia app (HTML + Capacitor) è in archivio nell'etichetta `vecchia-app` (note in `docs/vecchia-app.md`).
Dettagli per chi ci lavora: `CLAUDE.md`.
