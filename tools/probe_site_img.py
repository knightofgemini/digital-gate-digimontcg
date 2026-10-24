#!/usr/bin/env python3
"""Scarica dal sito pubblicato le immagini indicate (es. img/f/BT27-035.webp) in analysis/, per controllarle."""
import pathlib, sys, urllib.request
out = pathlib.Path(__file__).resolve().parent.parent / "analysis"; out.mkdir(exist_ok=True)
for p in ",".join(sys.argv[1:]).split(","):
    u = "https://knightofgemini.github.io/digital-gate-digimontcg/" + p.strip()
    b = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
    (out / p.strip().replace("/", "_")).write_bytes(b); print(p, len(b))
