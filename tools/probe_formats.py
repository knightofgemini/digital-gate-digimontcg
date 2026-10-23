#!/usr/bin/env python3
"""Misura formato, dimensioni e peso di TUTTE le immagini pubblicate sul sito (carte grandi e miniature, pre errata,
banner, confezioni, loghi, icone) e prova su un campione quanto si risparmierebbe con altri formati/qualità.
Si lancia con .github/workflows/analysis.yml (script=tools/probe_formats.py, ids=tutto); risultati in analysis/."""
import io, json, pathlib, statistics as stt, sys, time, urllib.request, urllib.parse, concurrent.futures as cf
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
outd = root / "analysis"; outd.mkdir(exist_ok=True)
SITE = "https://knightofgemini.github.io/digital-gate-digimontcg/"
D = json.load(open(root / "src" / "data.json", encoding="utf-8"))
codes = [c[0] for c in D["cards"]]
codes += sorted({D["cards"][x[0]][0] + x[1] for st in D["sets"] for x in st.get("v", []) if isinstance(x, list) and x[1]})
codes = list(dict.fromkeys(codes))
P = json.load(open(root / "src" / "products.json", encoding="utf-8"))
B = {k: v for k, v in json.load(open(root / "tools" / "banners.json")).items() if not k.startswith("_")}
own_logos = {p.stem for p in (root / "src" / "logos").glob("*.webp")}
q = urllib.parse.quote
groups = {
    "carte grandi (img/f)": [SITE + "img/f/" + q(c) + ".webp" for c in codes],
    "miniature (img/t)": [SITE + "img/t/" + q(c) + ".webp" for c in codes],
    "pre errata (img/pre)": [SITE + "img/pre/" + q(k) + ".webp" for k in D.get("errata", [])],
    "banner (banners)": [SITE + "banners/" + k + ".webp" for k in B],
    "confezioni (prod)": [SITE + "prod/" + k + ".webp" for k, v in P.items() if v.get("pk")],
    "loghi (prod/logo)": [SITE + "prod/logo/" + k + ".webp" for k, v in P.items() if v.get("lg") or k in own_logos],
    "pagina e icone": [SITE + x for x in ["", "index.html", "sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png",
                                          "icon-maskable-512.png", "apple-touch-icon.png", "favicon.ico", "favicon-32.png"]],
}
def get(url):
    for i in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 probe"}), timeout=30)
            return r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None, {}
        except Exception:
            time.sleep(1 + i)
    return None, {}
def info(url):
    b, h = get(url)
    if b is None: return url, None
    d = {"n": len(b), "ct": h.get("Content-Type", ""), "cc": h.get("Cache-Control", ""), "enc": h.get("Content-Encoding", "")}
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        d["fmt"] = "webp-" + {b"VP8 ": "lossy", b"VP8L": "lossless", b"VP8X": "ext"}.get(b[12:16], "?")
        if b[12:16] == b"VP8X": d["fmt"] += "+alpha" if b[20] & 0x10 else ""
    elif b[:8] == b"\x89PNG\r\n\x1a\n": d["fmt"] = "png"
    elif b[:3] == b"\xff\xd8\xff": d["fmt"] = "jpeg"
    elif b[4:12] in (b"ftypavif", b"ftypavis"): d["fmt"] = "avif"
    else: d["fmt"] = "altro"
    if d["fmt"] not in ("altro",):
        try:
            im = Image.open(io.BytesIO(b)); d["wh"] = im.size; d["mode"] = im.mode
        except Exception: pass
    return url, d
res = {}
t0 = time.time()
with cf.ThreadPoolExecutor(48) as ex:
    for g, urls in groups.items():
        res[g] = dict(ex.map(info, urls))
        print(g, len(urls), "file", round(time.time() - t0), "s", flush=True)
lines = []
def kb(n): return f"{n/1024:.1f} KB"
def mb(n): return f"{n/1048576:.1f} MB"
tot = 0
for g, d in res.items():
    ok = {u: v for u, v in d.items() if v}
    miss = len(d) - len(ok)
    ns = sorted(v["n"] for v in ok.values()); s = sum(ns); tot += s
    fm = {}; wh = {}; cc = set(); ct = set(); enc = set()
    for v in ok.values():
        fm[v["fmt"]] = fm.get(v["fmt"], 0) + 1
        k = "x".join(map(str, v.get("wh", ("?", "?")))); wh[k] = wh.get(k, 0) + 1
        cc.add(v["cc"]); ct.add(v["ct"]); enc.add(v["enc"])
    lines.append(f"== {g}: {len(ok)} file (+{miss} mancanti), totale {mb(s)}")
    if ns:
        lines.append(f"   media {kb(s/len(ns))}, mediana {kb(stt.median(ns))}, 95% sotto {kb(ns[int(len(ns)*.95)-1])}, max {kb(ns[-1])}")
    lines.append(f"   formati: {fm}")
    lines.append(f"   dimensioni piu comuni: {sorted(wh.items(), key=lambda x: -x[1])[:6]}")
    lines.append(f"   Content-Type: {ct}  Cache-Control: {cc}  compressione: {enc}")
    if g == "pagina e icone":
        for u, v in d.items(): lines.append(f"   {u[len(SITE):] or '/'}: {kb(v['n']) if v else 'manca'} {v and v.get('enc')}")
lines.append(f"TOTALE immagini e pagina: {mb(tot)}")
# ---- prova di altri formati su un campione di carte, partendo dalle immagini originali (PNG ufficiali)
lines.append("\n== Prova su un campione (dall'originale ufficiale, ridotto come oggi a 480x672 e 120x168)")
try:
    from PIL import features
    AV = features.check("avif")
except Exception: AV = False
lines.append(f"   AVIF disponibile in Pillow: {AV}")
import numpy as np
def ssim(a, b):
    a = np.asarray(a.convert("L"), dtype=np.float64); b = np.asarray(b.convert("L"), dtype=np.float64)
    from scipy.ndimage import uniform_filter as uf
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ma, mb_ = uf(a, 7), uf(b, 7); va = uf(a * a, 7) - ma * ma; vb = uf(b * b, 7) - mb_ * mb_; cv = uf(a * b, 7) - ma * mb_
    return float((((2 * ma * mb_ + C1) * (2 * cv + C2)) / ((ma * ma + mb_ * mb_ + C1) * (va + vb + C2))).mean())
step = max(1, len(D["cards"]) // 60)
sample = [D["cards"][i][0] for i in range(0, len(D["cards"]), step)][:60]
cfgs = [("webp q80 (oggi)", "WEBP", dict(quality=80, method=4)), ("webp q80 m6", "WEBP", dict(quality=80, method=6)),
        ("webp q72 m6", "WEBP", dict(quality=72, method=6)), ("webp q65 m6", "WEBP", dict(quality=65, method=6))]
if AV: cfgs += [("avif q60", "AVIF", dict(quality=60, speed=4)), ("avif q50", "AVIF", dict(quality=50, speed=4)), ("avif q40", "AVIF", dict(quality=40, speed=4))]
tcfgs = [("webp q75 (oggi)", "WEBP", dict(quality=75, method=4)), ("webp q60 m6", "WEBP", dict(quality=60, method=6))]
if AV: tcfgs += [("avif q50", "AVIF", dict(quality=50, speed=4))]
acc = {n: [0, []] for n, _, _ in cfgs}; tacc = {n: [0, []] for n, _, _ in tcfgs}; used = 0
for code in sample:
    b, _ = get("https://world.digimoncard.com/images/cardlist/card/" + q(code) + ".png")
    if not b: b, _ = get("https://web-garage.takaotaku.de/" + q(code) + ".webp")
    if not b: continue
    im = Image.open(io.BytesIO(b)).convert("RGB"); used += 1
    f = im.copy(); f.thumbnail((480, 672)); t = im.copy(); t.thumbnail((120, 168))
    for n, fmt, kw in cfgs:
        o = io.BytesIO(); f.save(o, fmt, **kw); acc[n][0] += o.tell(); acc[n][1].append(ssim(f, Image.open(io.BytesIO(o.getvalue())).convert("RGB")))
    for n, fmt, kw in tcfgs:
        o = io.BytesIO(); t.save(o, fmt, **kw); tacc[n][0] += o.tell(); tacc[n][1].append(ssim(t, Image.open(io.BytesIO(o.getvalue())).convert("RGB")))
lines.append(f"   carte del campione: {used}")
for title, A in (("grandi 480x672", acc), ("miniature 120x168", tacc)):
    base = list(A.values())[0][0] or 1
    lines.append(f"   {title}:")
    for n, (s, ss) in A.items():
        if used: lines.append(f"     {n:18s} media {kb(s/used)}  ({100*s/base:.0f}% di oggi)  somiglianza SSIM {stt.mean(ss):.4f}")
txt = "\n".join(lines); print(txt)
(outd / "formati.txt").write_text(txt)
json.dump({g: {u[len(SITE):]: v for u, v in d.items()} for g, d in res.items()}, open(outd / "formati.json", "w"))
