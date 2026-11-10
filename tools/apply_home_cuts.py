#!/usr/bin/env python3
"""Applica i tagli scelti dall'utente nella pagina "Tagli della Home" (artifact
https://claude.ai/artifact/2cEEKREWpca3JhpVyXeeDX, raccolta `tagli` del suo database).

Uso: python3 tools/apply_home_cuts.py CARTELLA_TAGLI
(i tagli di In evidenza con `phone` = s/m/l/f sono posizioni proprie di un telefono: CODICE@x.webp, voce `by` in covers.ts)
dove CARTELLA_TAGLI contiene un file JSON per taglio (come li salva ArtifactData list con out_dir: `tagli/<CODICE>__<sezione>.json`,
con dentro `data` oppure direttamente i campi). Le immagini originali sono in tools/home_art/CODICE.webp.
Scrive le immagini già ritagliate dove le legge l'app (rn/src/covers.ts):
  cover  -> rn/assets/covers/CODICE.webp  (300x420, "Set da completare")
  hero   -> rn/assets/hero/CODICE.webp    (1100x838, "In evidenza")
  square -> rn/assets/horizon/CODICE.webp (600x600, "All'orizzonte")
e stampa i codici da aggiungere a covers.ts se mancano."""
import json, pathlib, sys
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
OUT = {"cover": ("covers", (300, 420)), "hero": ("hero", (1100, 838)), "square": ("horizon", (600, 600))}
src = pathlib.Path(sys.argv[1])
covers = (root / "rn/src/covers.ts").read_text()
for f in sorted(src.rglob("*.json")):
    d = json.load(open(f)); d = d.get("data", d)
    code, sec = d["code"], d["sec"]
    art = root / "tools/home_art" / (code + ".webp")
    if not art.exists():
        print("manca l'originale", art); continue
    im = Image.open(art).convert("RGB"); W, H = im.size
    if (d.get("w"), d.get("h")) not in ((W, H), (None, None)):
        print(code, sec, "attenzione: il taglio è di un'immagine", d.get("w"), "x", d.get("h"), "ma l'originale è", W, "x", H)
    box = tuple(round(v) for v in (d["x0"] * W, d["y0"] * H, d["x1"] * W, d["y1"] * H))
    folder, size = OUT[sec]
    ph = d.get("phone")  # In evidenza con la catena sganciata: immagine solo per quella larghezza di telefono
    out = root / "rn/assets" / folder / (code + ("@" + ph if ph else "") + ".webp"); out.parent.mkdir(parents=True, exist_ok=True)
    if sec == "hero" and ph:
        size = (round(size[1] * (box[2] - box[0]) / (box[3] - box[1])), size[1])
    elif sec == "hero":
        # "In evidenza" cambia forma col telefono (larghezza schermo − 50, alta 276): si tiene l'altezza scelta e si
        # allarga l'immagine attorno allo stesso centro fino a 2:1 (pieghevoli aperti), senza uscire dall'originale,
        # così con posizione 50%/50% ogni telefono vede lo stesso centro (come le anteprime della pagina).
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        h = box[3] - box[1]; w = min(h * 2.0, 2 * min(cx, W - cx))
        box = tuple(round(v) for v in (cx - w / 2, box[1], cx + w / 2, box[3]))
        size = (round(size[1] * (box[2] - box[0]) / h), size[1])
    im.crop(box).resize(size, Image.LANCZOS).save(out, quality=86, method=6)
    print(code, sec, box, "->", out.relative_to(root))
    name = code + ("@" + ph if ph else "")
    if f'assets/{folder}/{name}.webp' not in covers:
        if ph:
            print(f'   da aggiungere in covers.ts, in HERO_ART.{code}.by: {ph}: require("../assets/hero/{name}.webp")')
        else:
            print("   da aggiungere in covers.ts:", folder, code)
# ricollegati nella pagina (documento cancellato): togliere a mano da covers.ts e da rn/assets/hero/ i CODICE@x.webp
# che non hanno più un taglio
