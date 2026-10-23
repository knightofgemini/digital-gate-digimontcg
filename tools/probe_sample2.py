#!/usr/bin/env python3
"""Prova (via analysis.yml): per le immagini con SAMPLE, quanto differiscono le copie pulite delle altre fonti
(fuori dalla fascia della scritta) e coppie di esempio da guardare. Uso: python3 tools/probe_sample2.py EX13,BT26"""
import io, json, pathlib, sys, urllib.request, urllib.parse, concurrent.futures as cf
from PIL import Image, ImageChops, ImageStat
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sample_mark import score, SOGLIA
root = pathlib.Path(__file__).resolve().parent.parent
out = root / "analysis" / "s2"; out.mkdir(parents=True, exist_ok=True)
D = json.load(open(root / "src" / "data.json", encoding="utf-8"))
want = sys.argv[1].split(",")
SRC = {"world": "https://world.digimoncard.com/images/cardlist/card/{}.png", "en": "https://en.digimoncard.com/images/cardlist/card/{}.png",
       "taka": "https://web-garage.takaotaku.de/{}.webp"}
keys = []
for s in D["sets"]:
    if s["code"] not in want: continue
    for v in s.get("v", []):
        keys.append(D["cards"][v][0] if isinstance(v, int) else D["cards"][v[0]][0] + (v[1] or ""))
keys = sorted(set(keys))
def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 digimon-set-tracker"})
    return urllib.request.urlopen(req, timeout=30).read()
def small(im):
    g = im.convert("L").resize((215, 300)); g.paste(0, (0, 108, 215, 182)); return g
def one(code):
    q = urllib.parse.quote(code); ims = {}
    for n, u in SRC.items():
        try: ims[n] = Image.open(io.BytesIO(get(u.format(q)))).convert("RGB")
        except Exception: pass
    # immagine "attuale" come in fetch_images: per le alternative prima TakaOtaku
    order = ["taka", "world", "en"] if "_P" in code else ["world", "en", "taka"]
    cur = next((n for n in order if n in ims), None)
    if not cur: return code, None
    cs = score(ims[cur])
    r = {"cur": cur, "cur_score": None if cs is None else round(cs, 1), "cand": []}
    if cs is None or cs <= SOGLIA: return code, r
    for n, im in ims.items():
        if n == cur: continue
        s = score(im)
        if s is None or s > SOGLIA: continue
        d = ImageStat.Stat(ImageChops.difference(small(im), small(ims[cur]))).mean[0]
        r["cand"].append([n, round(s, 1), round(d, 1)])
        if 8 <= d < 60 and len(list(out.glob("*.jpg"))) < 60:
            a = ims[cur].resize((215, 300)); b = im.resize((215, 300))
            w = Image.new("RGB", (440, 300), "white"); w.paste(a, (0, 0)); w.paste(b, (225, 0))
            w.save(out / ("%s__%s_%s_d%d.jpg" % (code, cur, n, d)), quality=80)
    return code, r
res = {}
with cf.ThreadPoolExecutor(12) as ex:
    for k, r in ex.map(one, keys): res[k] = r
(out / "s2.json").write_text(json.dumps(res))
import collections
b = collections.Counter()
for k, r in res.items():
    if not r or r["cur_score"] is None or r["cur_score"] <= SOGLIA: continue
    if not r["cand"]: b["nessuna copia pulita"] += 1; continue
    d = min(c[2] for c in r["cand"])
    b["<8" if d < 8 else "8-15" if d < 15 else "15-30" if d < 30 else "30-60" if d < 60 else ">=60"] += 1
print(dict(b))
