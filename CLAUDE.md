# Digital Gate - Digimon TCG

Catalogo non ufficiale del Digimon Card Game (carte **in inglese**) con collezione, prossime uscite, deckbuilding, lista
ban, prezzi e scansione delle carte. Dal 3 novembre 2026 è **un'app Android** scritta in React Native/Expo (cartella
`rn/`). Il sito su GitHub Pages non è più un'app: è la **pagina per scaricare l'APK** e il **deposito** dei file che
l'app prende da internet (carte nuove, immagini, prezzi, copia del motore della scansione).

- Pagina e deposito: https://knightofgemini.github.io/digital-gate-digimontcg/
- APK (sempre l'ultimo): https://github.com/knightofgemini/digital-gate-digimontcg/releases/download/latest/DigimonSetTracker.apk
- Repository: `knightofgemini/digital-gate-digimontcg` (pubblico)
- Vecchia app (HTML + Capacitor) in archivio: etichetta `vecchia-app`, release `vecchia-app`, note in `docs/vecchia-app.md`
  (riferimento per come funzionava ogni schermata e per le scelte dell'utente, che la nuova app ripete).

## Come lavorare con l'utente

- **Rispondere sempre in italiano.** Tutta l'interfaccia è in italiano.
- **Mostrare un'anteprima prima di pubblicare**: lavorare su un ramo (es. `feature-x`) e far provare un **APK di prova**
  (`apk-prova.yml`, oppure `build.yml` avviato a mano sul ramo con "prova" e "apk": release `rn-prova`); per vedere le
  schermate senza telefono, foto su emulatore (`prova-emulatore.yml`). Fondere in `main` e pubblicare **solo dopo
  l'ok** ("vai", "pubblica", "okay").
- Dopo la pubblicazione, aspettare che il flusso finisca e confermare (APK dal link sopra; l'app propone da sola
  l'aggiornamento).
- Spiegazioni semplici, senza gergo tecnico; l'utente non è uno sviluppatore.
- L'utente non può fare test qui: chiedere conferma quando qualcosa va provato su telefono (aggiornamento, gesti, scansione).
- Obiettivo dell'utente: **app autonoma**. Catalogo dentro l'APK; da internet solo ciò che è troppo pesante o cambia
  spesso (immagini HD, carte nuove, prezzi), e **solo dal suo GitHub**: niente siti esterni (scelta del 3 novembre 2026).

## Regole fisse sul contenuto

- **Non tradurre MAI il testo delle carte** (effetti, nomi, tratti, keyword, colori nei tag): resta in inglese esattamente come stampato.
- I nomi lunghi si **rimpiccioliscono per stare su una riga** (se non basta, su due righe).
- Prodotti ordinati **dal più recente al più vecchio** per data di uscita.
- Dentro un prodotto le carte sono in **ordine di numero**, raggruppate in: `Regular`, `Alternative Art`, `Ristampe`, `Ristampe · Alternative Art`.
- **PB (Premium Bandai)**: mostrano solo `Ristampe · Alternative Art`.
- **AD1 (Digimon Generation)**: ordine e sezioni speciali: `Regular`, `Alternative Art`, `Ristampe`, `Ristampe · Alternative Art` (arte nuova), `Ristampe · Gold Border`. Classificazione in `tools/ad1_class.json` (gold/new/same), verificata sulle immagini.
- Stelle/SP delle alternative art in `tools/alt_marks.json` (1 = ★, 2 = ★★, "SP").

## Struttura del progetto

- `rn/` – **l'app** (Expo Router, TypeScript; note in `rn/AGENTS.md` e in fondo a questo file). Dati delle carte copiati
  dentro l'APK da `rn/scripts/sync-data.js`; motore della scansione (Tesseract.js) preparato da `rn/scripts/ocr-files.js`
  e copiato negli asset da `rn/plugins/withOcrAssets.js`.
- `android-res/` – icone Android di Digital Gate (adattive, rotonde, a tema), copiate sopra quelle di Expo.
- `android-keys/debug.keystore` – chiave di firma dell'APK. **Non cambiarla**: con un'altra chiave l'aggiornamento non
  si installa sopra.
- `src/` – dati: `data.json`, `products.json`, `prices.json` (ripiego dei prezzi), `banners/`, `logos/`, `errata/`,
  `icons/` (marchio Digivice, sorgente `digital-gate-mark.svg`), `sito/` (pagina di download, icone del sito e
  `sw.js` che chiude il service worker della vecchia app nei browser che l'avevano aperta).
- `tools/build.py` – prepara il deposito `www/`: pagina di download, `dati/` (carte e prodotti + `ver.json`), `ocr/`.
- `src/data.json` – dati generati (non modificare a mano): carte, prodotti, versioni, prossime uscite, banner, lista ban, errata.
- `tools/merge_set.py CODICE…` – aggiorna in `src/data.json` **solo** i prodotti indicati (rigenera tutto con `make_data2.py` in un file a parte, `DATA_OUT`, e prende solo quei prodotti, rinumerando gli indici): il resto del catalogo non cambia. Da usare per gli **spoiler** (es. `python3 tools/merge_set.py BT27` ogni volta che TakaOtaku aggiunge carte svelate). Una rigenerazione completa porterebbe anche le modifiche di TakaOtaku alle altre carte (ottobre 2026: tolte le spiegazioni di ＜Alliance＞, testi cambiati di EX13-064 ecc., nuove versioni in BT14/ST7), da controllare prima.
- `tools/make_data2.py` – genera `src/data.json` dalla raccolta TakaOtaku (`PreparedDigimonCardsENG.json`, repo `TakaOtaku/Digimon-Card-App`, clonata in `/home/claude/TakaOtaku_Digimon-Card-App`). Contiene nomi set, prodotti PB, prossime uscite.
- `tools/fetch_images.py` – scarica immagini carte (ufficiali HD, ripiego TakaOtaku) in `www/img/f` (grandi) e `www/img/t` (miniature), con cache.
- `tools/fetch_banners.py` + `tools/banners.json` – banner HD dei prodotti per la Home (`W/` sito ufficiale, `L/` copia salvata in `src/banners/`), con ritaglio per togliere date/testi promo e tenere il logo.
- `tools/fetch_products.py` + `tools/product_fixes.json` – caratteristiche dei prodotti dal sito ufficiale (uscita anche per regione, pre-release, prezzo, numero di carte, contenuto, rarità, immagine della confezione) in `src/products.json`, una voce per codice set; parte dall'indice del ramo `set-assets`. Va rilanciato quando escono prodotti nuovi (anche via `analysis.yml`). L'app li legge da `src/products.json` (dentro l'APK) e da `www/dati/products.json` (carte nuove).
- `tools/fetch_product_images.py` – confezioni (`pk` in `products.json`) in `www/prod/CODICE.webp`.
- `tools/apply_errata_images.py` – mette le immagini post-errata (`src/errata/KEY.webp`) come principali e salva l'originale in `www/img/pre/`.
- **Link (Appmon)**: `make_data2.py` scrive in `extra` anche `LinkReq:` (requisito e costo, es. `[Link] [Appmon] trait: Cost 3`) e `LinkDP:` (es. `+3000 DP`) prima di `Link:` (effetto); la scheda carta mostra in "Regole Link" requisito e costo, poi l'effetto e **in fondo** l'etichetta verde "LINK DP" con il valore (`linkFx`, `.ldpa`; scelta dell'utente, scartata la striscia verticale a destra). Ottobre 2026: aggiunti ai dati esistenti (77 carte) senza rigenerare tutto.
- Formato carta in `data.json`: `[code,name,lv,colors,ct,form,attr,sp(trait),dp,play,evo,eff,inh,sec,extra,rar,setId,{x}]`; `x.d` = lato Option delle Digimon/Option, `x.o` = spiegazione Overflow.
- Formato set: `{id,code,name,type,n,date,v:[idx | [idx,suf,versionIdx,mark,cls]]}`.
- `tools/img_versions.py` – `www/img/v.json`: immagini cambiate dall'ultima pubblicazione (l'app le riscarica).
- `tools/rn_shots.py`, `rn_gestures.py`, `rn_mazzo.py`, `rn_scan.py` – prove su emulatore (foto delle carte, gesti, ricerca del mazzo con la tastiera, scansione senza rete).

### Correzioni ai dati (sopravvivono agli aggiornamenti TakaOtaku)

- **Spoiler (BT27 Ignition of X, ottobre 2026)**: TakaOtaku elenca tutti i numeri del set e le carte non ancora svelate hanno il nome `[[:Category:|]]`: `make_data2.py` le salta (`placeholder`), e salta anche i prodotti senza nome in `NAMES` (es. EX14, che ha già 5 carte svelate: aggiungerlo a `NAMES`/`DATES` quando lo si vuole). Il lato Option delle Digimon/Option non ancora trascritto in `official_extra.json` viene da TakaOtaku (`optionCardEffect`, colore `optionCardColourRequirement`, costo = costo della carta) con le spiegazioni stampate sulle carte BT27: Use Req. "(Specified conditions meet color requirements.)", Arts Digivolve. Carte BT27 controllate una per una sulle immagini di anteprima (`tools/probe_spoiler.py` via `analysis.yml` con gli id separati da virgola): corretti BT27-020 DP, BT27-051 livello/forma/digievoluzione, BT27-067 costo, BT27-082 attributo e testo; segni ★ delle alternative in `alt_marks.json`. `_hold_versions` in `card_fixes.json`: versioni annunciate ma ancora senza immagine (BT27-103_P2), da togliere quando l'immagine arriva. Immagini: `fetch_images.py` usa come ultimo ripiego l'anteprima `web-garage.takaotaku.de/CODICE-Sample.webp` (951×1295, con SAMPLE), la segna `spoiler` in `sample.json` e a ogni build riprova le fonti normali per sostituirla. L'anteprima ha un margine bianco e angoli arrotondati: `tools/spoiler_trim.py` ritaglia la sola carta (lati riconosciuti dalla cornice, altezza dalle proporzioni ufficiali 430×600 e carta centrata, perché sopra/sotto le carte dal fondo bianco si confondono col margine) e riempie gli angoli con i colori del bordo (24 ottobre 2026, segnalato dall'utente); `SPV` in `fetch_images.py` = versione del ritaglio (cambiandola le anteprime salvate nella cache di Actions si riscaricano) e nell'app `?sp=2` (cambiandolo il telefono riscarica le anteprime). Nell'app (`soonSet`, `spoilerSet`, `spoilerN`): un set con data futura non compare tra i prodotti usciti né tra i recenti; la sua voce "In arrivo" mostra "Spoiler · N carte svelate" e apre la pagina del set con le carte e il riquadro "In arrivo · data" (`.spnote`); le immagini delle sue carte hanno `?sp=1` nell'indirizzo (`imgQ`), così all'uscita il telefono riscarica quelle ufficiali.
- **EX14 Malevolent VII (24 ottobre 2026)**: aggiunto come BT27 (data `2027-01-31` in `DATES`: è noto solo il mese, l'ultimo giorno lo tiene "in arrivo" per tutto gennaio). Svelate 2 carte (EX14-012, EX14-054), controllate sulle immagini (corretto il testo di EX14-012: "until the end of your opponent's turn"); le 3 alternative art annunciate non hanno ancora immagine e sono in `_hold_versions`.
- **BT27, spoiler del 25 ottobre 2026**: pubblicate dopo il controllo sulle immagini BT27-008, 009, 013, 015, 015_P1 (★), 087, 101 (corretti: BT27-008 "[Kyokyomon]" nella Digievoluzione speciale, BT27-015 "trash their", BT27-087 spazio prima della virgola, con ` `). **`_hold` in `card_fixes.json`** ({codice: motivo}): carte svelate ma tenute da parte, saltate da `make_data2.py` come `_remove`; `spoiler_check.py` segnala quando arriva l'immagine (se il motivo contiene "sbagliata" conta solo l'immagine ufficiale). Tenute da parte: BT27-074, 078, 081, 083, 085 (senza immagine, testo incompleto), BT27-096 (senza immagine), BT27-097 (l'anteprima TakaOtaku `BT27-097-Sample` è in realtà Keenan Crier BT27-096); in `_hold_versions` anche BT27-035_P2.
- **BT27, spoiler del 3 novembre 2026**: il controllo automatico ha pubblicato 35 carte/alternative (tra cui le tenute da parte BT27-074, 078, 081, 083, 085, 096); ★ di BT27-034_P1, 052_P1, 085_P1 controllate sulle anteprime TakaOtaku (riquadro del numero: una stella) e aggiunte in `alt_marks.json` e, a mano, nelle voci del set in `src/data.json`. Tenute da parte: BT27-032 (senza immagine), BT27-052_P2 e 085_P2.
- **Controllo giornaliero degli spoiler, pubblicazione automatica con filtro** (31 ottobre 2026, scelta dell'utente: niente più "vai" per gli spoiler). `.github/workflows/spoiler.yml` (ogni giorno alle 05:37 UTC, o a mano; con "prova" i dati vanno solo nel ramo `spoiler-auto-prova`, senza pubblicazione né avviso) clona TakaOtaku in `$TAKA` e lancia `tools/spoiler_check.py --apply --auto`: per i prodotti con data futura entrano nel catalogo **solo** le carte con immagine (anteprima TakaOtaku o ufficiale) e testo che supera il controllo automatico (`incompleta`: nome/tipo/colore/rarità, livello/DP/costo/digievoluzione delle Digimon, Lv.3/4 senza effetti, segnaposto tipo `??`/TBA, parentesi non chiuse, righe che finiscono a metà). Le altre vanno in `_hold` con motivo e data ("senza immagine (dal AAAA-MM-GG)"), le alternative senza immagine in `_hold_versions`; ogni giorno si ricontrollano ed entrano da sole quando l'immagine c'è e il testo passa il controllo (con immagine ma testo "incompleto" da 5 giorni entrano comunque; con "sbagliata" nel motivo conta solo l'immagine ufficiale). Se cambia qualcosa: commit di `src/data.json` + `card_fixes.json` su **main** e avvio di `build.yml` (`gh workflow run`, perché i push fatti con il token di Actions non avviano altri workflow) → deposito del sito (`www/dati`), che l'app scarica da sola: niente APK nuovo. Avviso via mail: segnalazione "Spoiler del GG/MM/AAAA" con l'elenco (pubblicate, tenute da parte, entrate) aperta e subito chiusa; stato nel ramo `spoiler-stato` per non ripetere lo stesso avviso. Restano a mano: prodotti nuovi senza nome in `NAMES`, segni ★ in `alt_marks.json`, correzioni del testo segnalate dall'utente. Prova locale: `--noimg` / `--allimg` al posto delle immagini vere. Prima del 31 ottobre i dati andavano nel ramo `spoiler-nuove` e si pubblicavano dopo il controllo sulle immagini e il "vai".
- **Canale Telegram come fonte degli spoiler (7 novembre 2026, scelta dell'utente)**: https://t.me/DigimonExpanseTCG
  pubblica ogni carta svelata come "Nome [Alternative Art] (CODICE)" + "#PRODOTTO #NomeProdotto" + una foto (inglese,
  con SAMPLE), di solito verso l'1:30, le 7, le 13:30 e le 16 (ora italiana). `telegram.yml` (a mano) legge la pagina
  pubblica `t.me/s/…` con `tools/telegram_fetch.py` e salva `posts.json` + `foto/` nel ramo `telegram`.
  `tools/telegram_todo.py TGDIR [--apply]` (con `TAKA`): alternative art dei **Premium Bandai** (ristampe, testo già
  noto) aggiunte da sole in `tools/telegram_cards.json` con id `CODICE_PTnn` (nn = numero del PB) e foto in
  `src/telegram/`; foto alle carte tenute da parte "senza immagine"; carte nuove che TakaOtaku non ha ancora: foto
  copiata e carta **da trascrivere a mano** (Claude, dalla foto, testo esatto) in `telegram_cards.json` (formato
  TakaOtaku, modello stampato dallo script); alternative di BT/EX/ST solo segnalate. `make_data2.py` usa le voci di
  `telegram_cards.json` **solo finché TakaOtaku non ha la stessa carta** (le `_PTnn` finché TakaOtaku non elenca la carta
  in quel PB): poi vale il testo di TakaOtaku. `fetch_images.py` usa `src/telegram/CODICE.jpg` come ultimo ripiego
  (ritagliata con `spoiler_trim`, segnata `spoiler`, sostituita appena c'è l'immagine ufficiale); `spoiler_check.py`
  la conta come immagine (non come ufficiale). Prodotti aggiunti per questo: **ST25/ST26** (carte numerate BD01/BD02,
  `PREFIX` in `make_data2.py`, uscita 4 dicembre 2026), **PB27/PB28** (nella lista `PB`, data `2027-06-30`).
  **Attività programmata di Claude** "Spoiler Digital Gate" (4 volte al giorno: 2:00, 8:00, 14:00, 17:00 ora italiana,
  orari scelti dall'utente perché il cron di `spoiler.yml` partiva con 5-8 ore di ritardo): avvia `telegram.yml`,
  esegue `telegram_todo.py --apply`, trascrive le carte nuove, fa il commit su main e avvia `spoiler.yml` (filtro e
  pubblicazione automatica di sempre); `spoiler.yml` resta anche col suo orario come riserva.
- `tools/card_fixes.json` – 96 correzioni verificate sulle immagini ufficiali (livello, costi, digievoluzioni, attribute, trait, rarità, DP…), testi delle **errata Bandai** (`text`: sostituzioni; attenzione agli spazi non separabili `\u00a0` della fonte) e voci da rimuovere (`_remove`; versioni alternative in `_remove_versions`, es. ST24-11_P2/_P3 in BT26, tolte su richiesta il 24 ottobre 2026 perché senza immagine).
- `tools/official_extra.json` – dalla lista carte ufficiale EN: lato Option delle Digimon/Option (10 BT26/EX13 trascritti dalle immagini) e testo Overflow.
- `tools/banlist.json` – lista ban/restrizioni (in vigore dal 1 set 2026, fonte https://world.digimoncard.com/rule/restriction_card/). Va aggiornata a mano quando Bandai la cambia.
- Errore noto della fonte corretto in `make_data2.py`: tratto e costo invertiti (`w/[3] trait: Cost DS` → `w/[DS] trait: Cost 3`).

### Prezzi

- Dati: `tools/cardmarket_prices.py` (file pubblici Cardmarket, gioco 17: catalogo + guida prezzi giornaliera; API CardTrader, gioco 8, con il segreto `CARDTRADER_TOKEN` creato dall'utente). Abbinamento per prodotto: espansione Cardmarket con più carte del codice del prodotto; per numero ordine di inserimento (V1, V2…) = Regular, ★, ★★, SP solo se i prezzi salgono; le carte CardTrader indicano il prodotto Cardmarket (`card_market_ids`) e il tipo nel numero (`a` ★, `rp` ★★, `sp` SP) e correggono l'ordine (es. Gankoomon EX13-061). Senza prezzi per ora: PB, LM, Special Limited Set. Ottobre 2026: 5738/6172 versioni Cardmarket, 5608 CardTrader.
- `.github/workflows/prezzi.yml` ogni notte (03:17 UTC) (fino a 3 tentativi a 5 minuti di distanza; download Cardmarket con nuovi tentativi; se CardTrader non risponde si pubblicano comunque i prezzi Cardmarket) scrive `prices.json` e `report.txt` sul ramo `prezzi`; l'app all'avvio scarica `raw.githubusercontent.com/.../prezzi/prices.json` (salvato in `dg-prices`), così non serve un nuovo APK; `apk.yml` mette nell'APK i prezzi del ramo `prezzi` (ripiego `src/prices.json`). Loghi dei negozi nell'app: `rn/assets/cardmarket-mark.png` e `rn/src/shops.tsx`.

### Immagini

- **Scritta SAMPLE (23 ottobre 2026)**: Bandai stampa "SAMPLE" sulle immagini ufficiali dei prodotti da BT22 in poi (prova: 1324 su 1540 immagini recenti). `tools/sample_mark.py` la riconosce con la maschera `tools/sample_mask.png` (luminosità dentro le lettere meno il bordo intorno: con scritta 35-130, senza circa −6..17, soglia 25; solo immagini 430×600). In `fetch_images.py`, dopo lo scaricamento, ogni immagine con la scritta viene cercata in TakaOtaku e world.digimoncard.com e sostituita con la prima **senza scritta e uguale fuori dalla fascia della scritta** (`same`, differenza media < 7: le copie vere stanno a 1-6). **Mai en.digimoncard.com**: a volte dà la carta **giapponese** (con SAMPLE in un'altra posizione, che la maschera non vede); la prima versione (build 113) lo usava e ha messo ~21 immagini giapponesi, cancellate e riscaricate con `sample.json` versione 2 (`_v`); en resta solo ultimo ripiego per lo scaricamento normale; esito in `www/img/sample.json` (`ok`/`pulita`/`sample`; le `sample` si riprovano a ogni build, quindi quando una fonte pubblica la versione pulita entra da sola). Circa metà delle immagini recenti ha una versione pulita; le altre restano con la scritta finché non compare una fonte pulita (scelta: non si cancella la scritta ritoccando le immagini). La cache delle immagini di Actions ora si salva a ogni build (`key` con `run_id`). Nel telefono la cache delle immagini è passata a `dg-img-v3` (v1 e v2 vengono cancellate) per riscaricare le immagini pulite. Prova delle fonti: `tools/probe_sample.py` via `analysis.yml`.
- **Raccoglitore del materiale promozionale** (`set-assets.yml` + `tools/fetch_set_assets.py`, ogni lunedì o a mano): scarica **solo il nuovo**. Parte dalla raccolta già nel ramo `set-assets`: prodotti nuovi per intero; per quelli usciti da meno di 12 mesi o in arrivo solo i tipi di immagine che mancano; i più vecchi non vengono toccati e nessun file già salvato viene sostituito. Per rifare tutto: avvio manuale con l'opzione `tutto`. Per i file già salvati controlla, senza scaricarli, se sul sito Bandai sono stati sostituiti (dimensione diversa) e in quel caso apre una **issue** su GitHub (una sola volta per cambiamento; opzione `prova` per una segnalazione di prova). **Nessuna dipendenza da unacollezione.it** (scelta dell'utente, ottobre 2026): i loghi nuovi si aggiungono a mano in `src/logos/`; nel ramo `set-assets` restano le copie dei loghi presi lì in passato.

## Pubblicazione (GitHub Actions)

- `build.yml` (**Sito e APK**; il nome del file resta questo perché il numero di run è il numero di build): a ogni invio su
  `main` e quando lo avvia un altro flusso. Prepara e pubblica il **deposito** su GitHub Pages; **l'APK** (`apk.yml`) si
  costruisce e va nella release `latest` **solo se è cambiata l'app** (`rn/`, `android-res/`, `android-keys/`,
  `build.yml`, `apk.yml`) o se lo si chiede avviandolo a mano ("apk"): per le sole carte nuove l'app scarica i dati da
  sola, senza APK nuovo né avviso di aggiornamento. Con "prova" non pubblica il sito e mette l'APK nella release
  `rn-prova`. La prima pubblicazione della nuova app ha salvato l'ultimo APK della vecchia nella release `vecchia-app`.
- `apk.yml` (richiamato dagli altri): `npm ci`, controllo dei tipi (esito nel ramo `rn-check`: `tsc.txt`, `gradle.txt`,
  `esito.txt`), dati, motore della scansione, `expo prebuild`, icone e chiave, `assembleRelease` (solo arm64-v8a e
  armeabi-v7a), controlli (servizio di scaricamento, motore della scansione, firma con `apksigner`). Tipo `latest`:
  versionCode e build = numero di run di `build.yml` (release "APK più recente · build N", l'app confronta N con il suo
  `extra.build`). Tipo `prova`: versionCode della `latest` e build 0 (niente avviso di aggiornamento), dati di `main`.
- `apk-prova.yml` (a mano su un ramo): APK di prova nella release `rn-prova` (`DigitalGate-prova.apk`).
- `prova-emulatore.yml`: APK x86_64 su emulatore Android 14; foto delle schede in `tools/rn_shots.txt` e prova dei
  gesti a ogni invio sul ramo `rn-tag`; prova della scansione senza rete (`tools/rn_scan.py`) con "scansione" o
  inviando sul ramo `rn-scan`. Risultati nel ramo `rn-shots`.
- `spoiler.yml` (ogni mattina, più l'attività programmata di Claude 4 volte al giorno), `telegram.yml` (canale Telegram, ramo `telegram`), `prezzi.yml` (ogni notte, ramo `prezzi`), `set-assets.yml` (ogni lunedì, ramo
  `set-assets`), `analysis.yml` (script a richiesta, risultati nel ramo `analysis-out`).
- Rami che devono restare: `main`, `prezzi`, `set-assets`, `spoiler-stato`, `telegram`, `analysis-out`, `rn-check`, `rn-shots`.
  Esperimenti scartati della vecchia app: etichette `archivio/<nome>` (pulizia del 3 novembre 2026: 75 rami già
  confluiti cancellati, 15 archiviati, con un flusso `pulizia.yml` usato una volta e poi tolto; si ritrova nella storia).
- Commit con autore `Claude <noreply@anthropic.com>`.

### Limiti dell'ambiente cloud

- Dalla sandbox i siti esterni (digimoncard.com, github.io, fandom…) e il registro npm di solito **non sono
  raggiungibili**: usare `.github/workflows/analysis.yml` (workflow_dispatch con `ids` e `script`), che esegue uno script
  in Actions e salva `analysis/` sul ramo orfano `analysis-out`:
  `git fetch origin +analysis-out:refs/remotes/origin/analysis-out && git archive refs/remotes/origin/analysis-out | tar -x -C DIR`
- Dispatch/monitoraggio via REST (`gh api ...`), GraphQL non disponibile; release e segreti non modificabili da qui.
- **Rami ed etichette non si cancellano da qui** (proxy): serve un flusso avviato dall'utente.
- Un flusso nuovo si avvia a mano (`workflow_dispatch`) solo dopo che è arrivato su `main` (o se ha anche un `push`).

## Idee in sospeso / possibili prossimi passi

- Banner mancanti o provvisori per PB24, EX14, BT28.
- Spostare la chiave di firma APK nei segreti GitHub (opzionale).
- Aggiornamento automatico dei dati TakaOtaku oltre agli spoiler (proposto, non fatto).

## App (`rn/`): note tecniche

- **Tag come l'app attuale (26 ottobre 2026)**: `rn/src/rich.tsx` → `Chip` disegna le icone di `[ ]`, `＜ ＞`, `⟦ ⟧` e i colori nel testo come `.ico` del sito: riquadri dentro il testo con sfumatura (SVG), bordino interno, angoli .35em, keyword esagonali in tre pezzi (punte + centro, senza misure: `onLayout` non arriva ai riquadri dentro un testo), Overflow metallizzato; `ICO_DY` = spostamento verticale. La spiegazione di una keyword si apre subito dopo la sua riga. Nella scheda carta (`rn/src/app/carta/[k].tsx`): "Altra Digievoluzione" rimpicciolita su una riga (`Evo one`), tratti che vanno a capo uno per uno, Use + colori, LINK DP con fondo, badge della lista ban (colori e "Coppia vietata con" del sito), ★/★★ sfalsate/SP (`Mark`, `VerName`) anche nei pulsanti delle versioni e nella barra in basso.
- **Anteprima con foto su emulatore**: `.github/workflows/prova-emulatore.yml` (prima `rn-shot.yml`) parte a ogni invio sul ramo `rn-tag` (riutilizzabile come ramo di prova): APK solo x86_64, emulatore Android 14 (pixel_6), `tools/rn_shots.py` apre le carte di `tools/rn_shots.txt` (`chiave@keyword`, chiave = `set|codice[~_P1]`) con `digitalgate://carta/…`, scorre, tocca la keyword e fotografa (anche tema chiaro). Foto nel ramo `rn-shots`. Le foto di confronto della vecchia app si fanno in locale con Playwright sul `www/index.html` di `main`.
- **Gesti come l'app attuale (27 ottobre 2026)**: scheda carta aperta sopra la pagina di partenza (`presentation: "transparentModal"`) e chiudibile tirandola giù dall'intestazione (PanResponder) o dal contenuto in cima; versione scelta di un altro prodotto → chiudendo si apre quel prodotto (`exitTo`, anche col tasto indietro); fila delle versioni centrata sulla scelta; foglio di ricerca del mazzo che segue il dito tra metà / alto / chiuso; pila scelta inquadrata con la sua barra; tendine dei Filtri, Salva in…, copertina e fogli della scansione tirati giù dal contenuto. **Su Android un elenco che scorre si prende il dito**: un PanResponder sopra di lui non riceve il gesto, quindi per tirare dal contenuto si usa `rn/src/pull.tsx` (`usePull`: spazio vuoto alto `PULL_S` sopra il contenuto che non conta nell'altezza, riposo a `PULL_S`, il foglio scende di `d` e l'elenco sale di `d`; nei fogli `SheetScrollView`, che somma lo spazio al margine interno in alto). Prova dei gesti: `tools/rn_gestures.py` (con `input motionevent`), lanciato da `prova-emulatore.yml` dopo `rn_shots.py`.
- **Ricerca del mazzo con la tastiera (4 novembre 2026, ramo `mazzo-tastiera`, segnalato dall'utente: con la tastiera il foglio arrivava quasi in cima)**: in `rn/src/app/mazzo/[id].tsx` → `AddSheet` l'altezza "metà" con la tastiera aperta è al massimo il 62% dello spazio sopra la tastiera (come nell'APK della vecchia app, dove la finestra si accorciava) e lascia sempre in vista sopra il foglio la prima fila del mazzo (`DK_SHOW`); "alto" lascia libera la barra in alto (`barH` = `bar.pad`, come i 52 px della vecchia app: prima il campo finiva sotto la barra); con il foglio aperto il mazzo ha in fondo uno spazio alto quanto la pagina, così anche l'ultimo gruppo si può portare sopra il foglio. Lo spazio disponibile si misura (`areaH`, vista trasparente a tutta pagina) così funziona sia se la tastiera copre la finestra sia se la accorcia. Regole della vecchia app riportate: tastiera aperta subito dalla barra "Cerca e aggiungi carte…" anche con filtri ricordati (`addK`; non da "+ Aggiungi" e Filtra), toccando il campo il mazzo torna alla prima carta (`toFirst`, ripetuto dopo 450 ms), carta aggiunta inquadrata sopra il foglio (`showNew`: il gruppo in cima, o la pila se resterebbe sotto il foglio), inquadrature calcolate con la copertura vera del foglio (`cov`), tastiera chiusa chiudendo il foglio, aprendo i Filtri e riducendo da alto a metà col dito. Prova: `tools/rn_mazzo.py` in `prova-emulatore.yml`. Sotto il campo, sopra i risultati, una striscia vuota (`DK_GAP`) e una sfumatura (`DK_FADE`, SVG sopra l'elenco) come `.dkbody` della vecchia app ma un po' più ampie (5 novembre 2026, richiesta dell'utente: le carte arrivavano a filo del campo).
- **Carte aggiornate senza APK nuovo (31 ottobre 2026)**: `rn/src/dataupd.ts`. `data.ts` chiama `pickData` prima di costruire carte e prodotti: se nel dispositivo ci sono dati scaricati (`dg-data.json`, `dg-products.json`, `dg-ver.json` nella cartella documenti, letti in modo sincrono con `File.textSync`) più recenti di quelli dell'APK (`rn/data/ver.json` di `scripts/sync-data.js`, `t` = `DATA_T` del workflow) usa quelli. `startDataUpdates` (da `_layout.tsx`, subito all'apertura e tornando nell'app dopo 3 ore) legge `www/dati/ver.json` del sito; se `h` è diverso e `t` più recente scarica i due file, li salva (ver.json per ultimo), li mette in uso subito e mostra il riquadro "Carte nuove" (sotto). `apk.yml` mette nell'APK i dati del commit pubblicato (APK di prova: quelli di `main`).
- **Carte nuove senza riavvio e riquadro "Carte nuove" (6 novembre 2026, ramo `carte-nuove`, richieste dell'utente: l'avviso di 10 s con "Aggiorna" non diceva quali carte, e niente riavvio dell'app "anche se c'è da rifare mezza app")**. Il controllo parte subito all'apertura (300 ms). **Catalogo sostituibile ad app aperta**: in `data.ts` `SETS`, `SETBY`, `CARDS`, `BYKEY`, `BYCODE`, `PRODUCTS`, `UPCOMING`, `BAN`, `PAIRS`, `BANNERS` sono sempre gli stessi oggetti, riempiti da `build()`; `setData(raw, products)` (registrata in `dataupd.ts` con `setApply`, per non avere import circolari) li svuota e li riempie con i dati scaricati, poi chiama le cache registrate con `onData` (`ALLV` dei filtri, `NAMES` della scansione, `NAVLIST` della scheda carta rimappato su `BYKEY`, elenchi e scaricamento automatico delle immagini di `offline.ts`, `changed()` dello store che ridisegna tutto ciò che usa `useStore`) e ridisegna chi usa `useData()`. **Regola**: un `useMemo` che legge il catalogo e non dipende già da `useStore`/oggetti del catalogo deve avere tra le dipendenze `useData()` (fatto in Ricerca carte, Prodotti, scheda carta, ricerca del mazzo, tendine dei Filtri, Immagini offline); una cache a livello di modulo costruita dal catalogo va svuotata con `onData`. Se `setData` fallisce si torna ai dati di prima (quelli nuovi restano salvati per la prossima apertura). `diffData` in `dataupd.ts` confronta i dati in uso (`USED`) con quelli scaricati, prodotto per prodotto, con le stesse chiavi di `data.ts`: "nuova" = versione che il prodotto prima non aveva (anche ristampe e alternative appena svelate), "corretta" = stessa versione con dati diversi, segnata solo nel suo prodotto, con cosa è cambiato (testo, DP, costo, stelle…). Riepilogo in `dg-news.json` (`h` dei dati, `seen` quando è stato visto). `rn/src/News.tsx` (foglio dal basso, intestazione e pulsanti fissi, dopo l'intro: `whenIntroDone`): prodotti dal più recente, miniatura, colori, codice, ★, nome, etichetta NUOVA/CORRETTA, al massimo 60 righe per prodotto; tocco su carta = scheda, su prodotto o "Vai a BT27" = pagina del prodotto. Se l'app si chiude senza guardarlo, compare alla prossima apertura. Nessun riquadro se non cambia nessuna carta (es. solo lista ban) o durante il recupero dei dati della vecchia app. **Prove**: `prova-emulatore.yml` con "novita" o sul ramo `rn-novita` (APK con i dati di prima del 3 novembre, `tools/rn_news.py`, controlla anche che il processo non cambi; il primo avvio dopo l'installazione o `pm clear` recupera i dati della vecchia app e lì il riquadro aspetta, quindi la prova fa prima un avvio senza rete. Esito del 6 novembre: riquadro in ~5 s sull'emulatore, `build()` 1,6 s, nessun riavvio); `apk-prova.yml` con "novita" fa un APK di prova con quei dati e `demo` in `ver.json`: alla prima apertura scarta i dati già scaricati (solo `dg-ver.json`), così sul telefono dell'utente il riquadro compare subito.
- **Nuova Home (6 novembre 2026, ramo `home-nuova`, dal mockup `home-proposta.html` preparato dall'utente)**: moduli in
  `rn/src/home.tsx`, scelte senza grafica in `rn/src/homeLogic.ts` (prove: `node --experimental-strip-types --test
  scripts/home-logic.test.mjs` dalla cartella `rn`). Ordine: titolo "Home" (Chakra Petch 25, non il `PageTitle` corsivo)
  con "Cerca una carta" (`goSearch` in `chrome.tsx`: scheda Carte con `kb`, `BottomBar` prop `focus` apre la tastiera
  sul campo); banner "In evidenza" = il primo di `upSorted()` come prima (stessa destinazione: `openUpcoming` se c'è
  in `PRODUCTS`, altrimenti calendario), alto almeno 276, illustrazione con sfumatura blu notte uguale nei due temi,
  data breve ("11 DIC", "NOV 2026", niente se da definire), riga "codice · tipo · conto alla rovescia di `upBadge`",
  pulsante "Scopri il set" (BT/EX) / "Scopri il prodotto" / "Vedi il calendario"; senza banner il ripiego confezione →
  logo → codice; "La tua collezione" con le carte diverse (stesso conto del menu Altro) → Collezione; "Un set da
  completare" (`pickGoal`: già uscito, `0 < h < n` di `setStats`, h/n più alto, a parità il più recente; "Ti mancano N
  carte" → pagina del prodotto con `miss=1`: etichetta "Mancanti" con ✕ e solo le carte non possedute; senza carte
  invito "Inizia la collezione", senza set incompleti niente modulo); "Usciti di recente" = `recentSets(2)` con
  "Nuovo" a 60 giorni; "All'orizzonte" al massimo due righe senza il prodotto in evidenza, stesso giorno esatto + stesso
  tipo + stesse uscite per regione in una riga (`upRows`, nome comune prima di " · ", tocco → calendario); "Riprendi
  il mazzo" (il più recente, copertina `deckCover`, conteggi e stato di `deckStats`/`deckState`) o "Il tuo primo
  mazzo". Prova su emulatore: `prova-emulatore.yml` con "home" (`tools/rn_home.py`).
- **Home scorrevole (6 novembre 2026, ramo `home-scorrevole`, richieste dell'utente)**: tolta la ricerca dal titolo;
  ordine: In evidenza, La tua collezione, Ultimi spoiler, Usciti di recente, All'orizzonte, Set da completare,
  Riprendi il mazzo; ogni sezione è una fila che scorre di lato (`Carousel` in `home.tsx`, scheda dopo che si intravede).
  **In evidenza** (`heroSlides` in `homeLogic.ts`, puntini sotto): prima il prodotto in arrivo con gli spoiler più
  recenti ("NUOVI SPOILER", "Vedi le N carte svelate"), poi uno per tipo (BT, EX, ST, LM, PB): il prossimo in arrivo se
  ha già carte, altrimenti l'ultimo uscito. **Ultimi spoiler** (`SpoilerRow`, scelta dell'utente tra due proposte;
  scartate le miniature dentro il banner): le carte dei prodotti in arrivo (16) nell'ordine in cui sono arrivate, dalla
  più recente, con codice e nome; la data non si mostra (scelta dell'utente). Le date di arrivo vengono da `tools/spoiler_dates.json` (`tools/spoiler_dates.py`:
  `stamp` da `merge_set.py`, `make_data2.py` e quindi `spoiler.yml`; storico ricostruito con `--storia` dai commit) →
  `sd` in `src/data.json` → `SPOILDATE`/`spoilDate` in `data.ts`. Set da completare = tutti (`goals`), dal più vicino
  al completamento; All'orizzonte fino a 20 righe, come **linea del tempo** (7 novembre 2026, scelta dell'utente tra 4
  proposte: copertina, confezione, locandina, linea del tempo): in alto una linea con un punto per data (arancione se il
  giorno è esatto, azzurro se si sa solo il mese), sotto l'immagine quadrata del prodotto (`ProdImg`: illustrazione,
  altrimenti confezione, logo o codice), codici, nome e conto alla rovescia (`HorizonLine`).
- **Taglio dei banner scelto a mano (9 novembre 2026, ramo `home-tagli`, segnalato dall'utente: le illustrazioni non
  combaciavano con i riquadri)**: i banner sono larghi (circa 16:9) e nei riquadri quadrati di "All'orizzonte" e in
  quelli formato carta di "Set da completare" ne resta una striscia. Scelta dell'utente tra tre proposte (riquadri a
  misura, immagine intera con sfondo sfocato, taglio a mano): per ogni banner `rn/src/bannerFocus.json` ha `x` = punto
  da tenere al centro (frazione della larghezza) e `r` = larghezza/altezza; `focusPos` in `homeLogic.ts` lo converte in
  `contentPosition` (prova in `home-logic.test.mjs`). Senza voce resta il taglio di prima. Banner nuovi: scaricarli con
  `analysis.yml` (`script` = `tools/probe_home_banners.py`, `ids` = `tutti` o i codici), guardarli e aggiungere la voce.
  **Copertine verticali** (9 novembre 2026, richiesta dell'utente, prima BT25 con un'immagine data da lui): in "Set da
  completare" `rn/src/covers.ts` (`COVERS`, immagini in `rn/assets/covers/CODICE.webp`, larghe circa 300 px, dentro
  l'APK) ha la precedenza sul banner tagliato.
  **LM08 Final Crest**: banner sostituito con l'illustrazione senza scritte data dall'utente
  (`src/banners/digimon_final_crest_art.webp`, 1462×1076; voce in `bannerFocus.json` con `x` 0.66, sul cavaliere).
- **Prove più veloci (7 novembre 2026)**: in `apk.yml` e `prova-emulatore.yml` si conservano tra una build e l'altra i
  file di Gradle, i suoi risultati riutilizzabili (`org.gradle.caching=true`) e le parti in C++ (ccache, finora poche
  riuse); emulatore salvato dopo il primo avvio (cache `avd-…`). APK di prova da 18 a 11 minuti. `prova-emulatore.yml`
  con "home" fa la prova rapida della Home (tema scuro, pagina intera, banner); con "completa" anche il resto.
- **Scheda carta, gesti solo sull'immagine (27 ottobre 2026, ramo `rn-fluido`, scelta dell'utente)**: la fila a ventaglio non scorre da sola (`scrollEnabled={false}`); sopra la carta al centro c'è una zona trasparente **fuori dalla pagina che scorre** (`imgPan` in `CardPage`, segue la carta con `scrollY`) che: di lato sposta la fila col dito (`fanCtl` begin/move/end), giù con la pagina in cima fa scendere la scheda (chiusa solo oltre il 30% dello schermo o con un colpo veloce lungo almeno 80 px, `CLOSE_*`), altrimenti fa scorrere la pagina. Tolti il trascinamento dall'intestazione e `usePull` dalla scheda; niente effetto elastico (`overScrollMode="never"`); sotto la scheda un fondo pieno che svanisce solo scendendo davvero (prima si vedeva il logo della pagina sotto). Tocco sulle carte ai lati = carta precedente/successiva. **Prodotti** a elenco progressivo (`FlatList` a righe, larghezza dalla finestra) e riquadri con illustrazione senza sfondo SVG: prima all'apertura si bloccava.
- **Scansione senza internet (3 novembre 2026)**: prima Tesseract.js si scaricava da jsdelivr la prima volta. Ora
  `rn/scripts/ocr-files.js` prende da npm (versioni fisse: tesseract.js 5.1.1, core 5.1.1, eng 1.0.0 `4.0.0_best_int`)
  libreria, worker, motore solo LSTM con e senza SIMD e dati della lingua, e li scrive in `rn/ocr/` come script che
  mettono il contenuto in `window.__OCR` (circa 12 MB nell'APK). La pagina del motore (`rn/src/scan/engineHtml.ts`) ha
  come base `file:///android_asset/ocr/`, li carica con `<script>` e costruisce **un worker unico** (blob) con il motore
  già definito (`TesseractCore`, così Tesseract.js non lo cerca altrove) e un `fetch` che risponde alle richieste di
  "…traineddata…" con i dati già presenti (il passaggio dei dati come oggetto `{code, data}` non funziona in 5.1.1:
  `initialize` usa `l.data` come nome). Se dall'APK non parte entro 60 s prova la copia del deposito (`OCR_SITE`,
  `www/ocr/`). Provato in locale (Chrome, pagina file://): pronto in 0,5 s senza richieste esterne.
- **Deposito (3 novembre 2026)**: oltre a immagini e prezzi, l'app prende dal sito solo `dati/` (`rn/src/dataupd.ts`) e,
  come ripiego, `ocr/`. L'aggiornamento dell'app legge la release `latest` (`rn/src/Update.tsx`).
