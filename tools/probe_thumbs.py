#!/usr/bin/env python3
"""Anteprime in locale (via analysis.yml): scarica le miniature (img/t) di tutte le versioni di alcuni prodotti dal sito.
Uso: python3 tools/probe_thumbs.py ex13,bt26"""
import json, pathlib, sys, urllib.request

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "analysis" / "t"; out.mkdir(parents=True, exist_ok=True)
d = json.loads((root / "src" / "data.json").read_text(encoding="utf-8"))
cards, want = d["cards"], set(sys.argv[1].lower().split(","))
keys = set()
for s in d["sets"]:
    if s["id"] not in want: continue
    for v in s.get("v", []):
        if isinstance(v, list): keys.add(cards[v[0]][0] + (v[1] or ""))
        else: keys.add(cards[v][0])
base = "https://knightofgemini.github.io/digital-gate-digimontcg/img/t/"
ok = 0
for k in sorted(keys):
    try:
        req = urllib.request.Request(base + k + ".webp", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r: (out / (k + ".webp")).write_bytes(r.read()); ok += 1
    except Exception as e: print("ERR", k, e)
print("scaricate", ok, "di", len(keys))
