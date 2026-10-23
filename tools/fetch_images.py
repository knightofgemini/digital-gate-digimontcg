#!/usr/bin/env python3
"""Scarica le immagini delle carte (fonte ufficiale HD, ripiego Taka) e crea miniature + versione grande in www/img/{t,f}.
Incrementale: salta i file già presenti (la cache di GitHub Actions li conserva fra un'esecuzione e l'altra)."""
import json, io, pathlib, urllib.request, urllib.parse, concurrent.futures as cf, sys
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
out = root / "www" / "img"
(out / "t").mkdir(parents=True, exist_ok=True); (out / "f").mkdir(parents=True, exist_ok=True)
D = json.load(open(root / "src" / "data.json", encoding="utf-8"))
codes = [c[0] for c in D["cards"]]
# versioni alternative (es. BT11-089_P2) presenti nei prodotti
codes += sorted({D["cards"][x[0]][0] + x[1] for st in D["sets"] for x in st.get("v", []) if isinstance(x, list) and x[1]})
SRC = ["https://world.digimoncard.com/images/cardlist/card/{}.png", "https://en.digimoncard.com/images/cardlist/card/{}.png",
       "https://web-garage.takaotaku.de/{}.webp"]
# per le versioni alternative la numerazione _Pn è quella di TakaOtaku: prima la sua fonte
SRC_ALT = [SRC[2], SRC[0], SRC[1]]
# en.digimoncard.com a volte restituisce la carta GIAPPONESE (e con SAMPLE in un'altra posizione): solo ultimo ripiego
SRC = [SRC[0], SRC[2], SRC[1]]
# correzione del 23 ottobre 2026: la prima pulizia SAMPLE accettava anche en.digimoncard.com e ha messo alcune immagini
# giapponesi; le immagini "pulite" di allora si cancellano e si riscaricano (versione 2 di sample.json)
_SJ0 = out / "sample.json"
try: _old = json.loads(_SJ0.read_text())
except Exception: _old = {}
if _old.get("_v") != 2:
    for _k, _s in _old.items():
        if _s == "pulita":
            for _d in ("f", "t"):
                _p = out / _d / (_k + ".webp")
                if _p.exists(): _p.unlink()
    _SJ0.write_text(json.dumps({"_v": 2}))
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 digimon-set-tracker"})
    return urllib.request.urlopen(req, timeout=30).read()
def one(code):
    t, f = out / "t" / (code + ".webp"), out / "f" / (code + ".webp")
    if t.exists() and f.exists(): return "cache"
    q = urllib.parse.quote(code)
    for tpl in (SRC_ALT if "_P" in code else SRC):
        for _ in range(2):
            try:
                im = Image.open(io.BytesIO(get(tpl.format(q)))).convert("RGB")
                a = im.copy(); a.thumbnail((480, 672)); a.save(f, "WEBP", quality=80, method=4)
                b = im.copy(); b.thumbnail((120, 168)); b.save(t, "WEBP", quality=75, method=4)
                return "ok"
            except Exception:
                pass
    return "manca"
# ---- Scritta "SAMPLE": Bandai la stampa sulle immagini dei prodotti recenti. Per ogni immagine già scaricata con la
# scritta si cercano le stesse carte nelle altre fonti e si tiene la prima senza scritta, solo se è davvero la stessa
# immagine (uguale fuori dalla fascia della scritta). Esito in www/img/sample.json (nella cache di Actions):
# "ok" = senza scritta (non si ricontrolla), "pulita" = sostituita, "sample" = nessuna fonte pulita (si riprova a ogni build).
sys.path.insert(0, str(root / "tools"))
from sample_mark import score, SOGLIA
from PIL import ImageChops, ImageStat
SJ = out / "sample.json"
try: SST = json.loads(SJ.read_text())
except Exception: SST = {}
ERR = {x.stem for x in (root / "src" / "errata").glob("*.webp")}
def _small(im):
    g = im.convert("L").resize((215, 300)); g.paste(0, (0, 108, 215, 182)); return g   # fascia della scritta esclusa
def same(a, b): return ImageStat.Stat(ImageChops.difference(_small(a), _small(b))).mean[0] < 7
def clean(code):
    if SST.get(code) in ("ok", "pulita") or code in ERR: return SST.get(code, "errata")
    f, t = out / "f" / (code + ".webp"), out / "t" / (code + ".webp")
    if not f.exists(): return "manca"
    try: cur = Image.open(f).convert("RGB")
    except Exception: return "manca"
    s = score(cur)
    if s is None or s <= SOGLIA: return "ok"
    q = urllib.parse.quote(code)
    # solo TakaOtaku e il sito ufficiale internazionale (inglese); mai en.digimoncard.com
    for tpl in ["https://web-garage.takaotaku.de/{}.webp", "https://world.digimoncard.com/images/cardlist/card/{}.png"]:
        try: im = Image.open(io.BytesIO(get(tpl.format(q)))).convert("RGB")
        except Exception: continue
        cs = score(im)
        if cs is None or cs > SOGLIA or not same(im, cur): continue
        a = im.copy(); a.thumbnail((480, 672)); a.save(f, "WEBP", quality=80, method=4)
        b = im.copy(); b.thumbnail((120, 168)); b.save(t, "WEBP", quality=75, method=4)
        return "pulita"
    return "sample"
res = {}
with cf.ThreadPoolExecutor(12) as ex:
    for code, r in zip(codes, ex.map(one, codes)): res[code] = r
from collections import Counter
cnt = Counter(res.values()); print(cnt)
miss = [c for c, r in res.items() if r == "manca"]
print("::notice title=Immagini::%d carte, %d con immagine, %d senza. Esempi mancanti: %s" % (len(res), len(res) - len(miss), len(miss), " ".join(miss[:25])))
print("senza immagine:", [c for c, r in res.items() if r == "manca"][:40])
with cf.ThreadPoolExecutor(12) as ex:
    for code, r in zip(codes, ex.map(clean, codes)): SST[code] = r
SST["_v"] = 2
SJ.write_text(json.dumps(SST, separators=(",", ":")))
cs = Counter(SST.get(c) for c in codes)
print("::notice title=Scritta SAMPLE::%d immagini senza scritta, %d sostituite con una versione pulita, %d ancora con la scritta (nessuna fonte pulita per ora)" % (cs.get("ok", 0), cs.get("pulita", 0), cs.get("sample", 0)))
