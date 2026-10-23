#!/usr/bin/env python3
"""Spoiler di un prodotto in arrivo: per ogni carta indicata prova le fonti delle immagini (sito ufficiale world/en, TakaOtaku)
e salva in analysis/img/ la prima trovata, con un riepilogo (fonte, misure, scritta SAMPLE). Salva anche la pagina ufficiale
del prodotto, per vedere se c'è già una lista carte.
Uso (via .github/workflows/analysis.yml): script=tools/probe_spoiler.py, ids="BT27-002,BT27-003,...[,PAGE=url]"."""
import io, json, pathlib, sys, urllib.request, urllib.parse
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "tools"))
try:
    from sample_mark import score, SOGLIA
except Exception:
    score = None
out = root / "analysis"; (out / "img").mkdir(parents=True, exist_ok=True)
args = ",".join(sys.argv[1:]).split(",")
page = [a[5:] for a in args if a.startswith("PAGE=")]
ids = [a.strip() for a in args if a.strip() and not a.startswith("PAGE=")]
UA = {"User-Agent": "Mozilla/5.0 digimon-set-tracker"}
def get(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30)
        return r.read()
    except Exception as e:
        return None
SRC = [("world", "https://world.digimoncard.com/images/cardlist/card/{}.png"),
       ("en", "https://en.digimoncard.com/images/cardlist/card/{}.png"),
       ("taka", "https://web-garage.takaotaku.de/{}.webp"),
       ("taka-sample", "https://web-garage.takaotaku.de/{}-Sample.webp")]
rep = {}
for i in ids:
    q = urllib.parse.quote(i); rep[i] = {}
    for name, tpl in SRC:
        b = get(tpl.format(q))
        if not b: rep[i][name] = None; continue
        try:
            im = Image.open(io.BytesIO(b)); im.load()
        except Exception:
            rep[i][name] = "non immagine"; continue
        d = {"wh": im.size, "kb": round(len(b) / 1024, 1)}
        if score and im.size == (430, 600):
            try: d["sample"] = round(score(im), 1)
            except Exception: pass
        rep[i][name] = d
        p = out / "img" / (i + "." + name + ".webp")
        if not any((out / "img").glob(i + ".*")):
            im.convert("RGB").save(p, "WEBP", quality=90)
    print(i, rep[i], flush=True)
for u in page:
    b = get(u)
    (out / "page.html").write_bytes(b or b"")
    print("pagina", u, len(b or b""))
json.dump(rep, open(out / "spoiler.json", "w"), indent=1)
