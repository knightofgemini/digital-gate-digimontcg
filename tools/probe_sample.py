#!/usr/bin/env python3
"""Prova (via analysis.yml): per i prodotti indicati conta quante immagini hanno la scritta SAMPLE in ogni fonte
e quante si possono avere pulite. Uso: python3 tools/probe_sample.py EX13,BT26,ST24"""
import io, json, pathlib, sys, urllib.request, urllib.parse, concurrent.futures as cf
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sample_mark import score, SOGLIA
root = pathlib.Path(__file__).resolve().parent.parent
out = root / "analysis" / "sample"; out.mkdir(parents=True, exist_ok=True)
D = json.load(open(root / "src" / "data.json", encoding="utf-8"))
want = sys.argv[1].split(",")
SRC = {"world": "https://world.digimoncard.com/images/cardlist/card/{}.png", "en": "https://en.digimoncard.com/images/cardlist/card/{}.png",
       "taka": "https://web-garage.takaotaku.de/{}.webp"}
keys = []
for s in D["sets"]:
    if s["code"] not in want: continue
    for v in s.get("v", []):
        if isinstance(v, int): keys.append((s["code"], D["cards"][v][0]))
        else: keys.append((s["code"], D["cards"][v[0]][0] + (v[1] or "")))
def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 digimon-set-tracker"})
    return urllib.request.urlopen(req, timeout=30).read()
def one(k):
    sc, code = k; r = {}
    for n, u in SRC.items():
        try:
            im = Image.open(io.BytesIO(get(u.format(urllib.parse.quote(code))))).convert("RGB"); s = score(im)
            r[n] = None if s is None else round(s, 1)
            if s is not None and s <= SOGLIA and len(list(out.glob(sc + "_*"))) < 6 and n != "world": im.save(out / ("%s_%s_%s.webp" % (sc, code, n)), "WEBP", quality=70)
        except Exception:
            r[n] = "manca"
    return k, r
res = {}
with cf.ThreadPoolExecutor(12) as ex:
    for k, r in ex.map(one, keys): res[k] = r
summ = {}
for (sc, code), r in res.items():
    d = summ.setdefault(sc, {"tot": 0, "world_sample": 0, "pulita_disponibile": 0, "resta_sample": 0, "da_dove": {}})
    d["tot"] += 1
    ws = isinstance(r.get("world"), float) and r["world"] > SOGLIA
    if ws: d["world_sample"] += 1
    clean = [n for n in ("world", "en", "taka") if isinstance(r.get(n), float) and r[n] <= SOGLIA]
    if clean: d["pulita_disponibile"] += 1; d["da_dove"][clean[0]] = d["da_dove"].get(clean[0], 0) + 1
    else: d["resta_sample"] += 1
print(json.dumps(summ, indent=1))
(out / "risultati.json").write_text(json.dumps({"%s|%s" % k: v for k, v in res.items()}, indent=0))
