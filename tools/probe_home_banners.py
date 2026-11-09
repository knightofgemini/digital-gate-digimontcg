#!/usr/bin/env python3
"""Scarica dal deposito del sito i banner della Home (www/banners/CODICE.webp) in analysis/banners/, per scegliere
a mano il punto da inquadrare nei riquadri di "All'orizzonte" e "Set da completare" (rn/src/bannerFocus.json).
Uso (analysis.yml): ids = "tutti" oppure codici separati da virgola."""
import json, pathlib, sys, urllib.request
SITE = "https://knightofgemini.github.io/digital-gate-digimontcg/banners/"
root = pathlib.Path(__file__).resolve().parent.parent
codes = [k for k in json.load(open(root / "tools" / "banners.json")) if not k.startswith("_")]
if len(sys.argv) > 1 and sys.argv[1] != "tutti":
    codes = [c for c in sys.argv[1].split(",") if c]
out = pathlib.Path("analysis/banners"); out.mkdir(parents=True, exist_ok=True)
for c in codes:
    try:
        data = urllib.request.urlopen(SITE + c + ".webp", timeout=30).read()
        (out / (c + ".webp")).write_bytes(data)
        print(c, "ok", len(data))
    except Exception as e:
        print(c, "ERRORE", e)
