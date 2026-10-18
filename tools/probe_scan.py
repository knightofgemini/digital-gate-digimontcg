#!/usr/bin/env python3
"""Prova della scansione carte (via analysis.yml): scarica le immagini di alcune carte (tutte le versioni) dal sito
e i pacchetti di Tesseract.js, così la scansione si può provare in locale con una fotocamera finta.
Uso: python3 tools/probe_scan.py BT5-086,EX1-066,..."""
import json, pathlib, subprocess, sys, urllib.request

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "analysis" / "scan"
(out / "f").mkdir(parents=True, exist_ok=True); (out / "t").mkdir(parents=True, exist_ok=True)
codes = [c for c in sys.argv[1].split(",") if c]
d = json.loads((root / "src" / "data.json").read_text(encoding="utf-8"))
cards = d["cards"]
keys = set(codes)
for s in d["sets"]:
    for v in s.get("v", []):
        if isinstance(v, list) and v[1] and cards[v[0]][0] in codes:
            keys.add(cards[v[0]][0] + v[1])
base = "https://knightofgemini.github.io/digital-gate-digimontcg/img/"
for k in sorted(keys):
    for kind in ("f", "t"):
        try:
            req = urllib.request.Request(base + kind + "/" + k + ".webp", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                (out / kind / (k + ".webp")).write_bytes(r.read())
                print("ok", kind, k, r.headers.get("Access-Control-Allow-Origin"))
        except Exception as e:
            print("ERR", kind, k, e)
for pkg in ("tesseract.js@5", "tesseract.js-core@5", "@tesseract.js-data/eng@1"):
    r = subprocess.run(["npm", "pack", pkg, "--pack-destination", str(out)], capture_output=True, text=True)
    print(pkg, r.returncode, r.stdout.strip()[-200:], r.stderr.strip()[-300:])
