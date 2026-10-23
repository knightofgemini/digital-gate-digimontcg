#!/usr/bin/env python3
"""Prova (via analysis.yml): cerca immagini delle carte in inglese senza la scritta SAMPLE su altre raccolte pubbliche.
Uso: python3 tools/probe_clean.py EX13-004,BT16-048"""
import pathlib, sys, urllib.request
root = pathlib.Path(__file__).resolve().parent.parent
out = root / "analysis" / "clean"; out.mkdir(parents=True, exist_ok=True)
SRC = {
    "takaotaku": "https://web-garage.takaotaku.de/{}.webp",
    "dcio": "https://images.digimoncard.io/images/cards/{}.jpg",
    "dcio_webp": "https://images.digimoncard.io/images/cards/{}.webp",
    "official": "https://world.digimoncard.com/images/cardlist/card/{}.png",
}
for code in sys.argv[1].split(","):
    for name, u in SRC.items():
        url = u.format(code)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read(); ext = url.rsplit(".", 1)[1]
                (out / ("%s_%s.%s" % (code, name, ext))).write_bytes(data)
                print("ok", name, code, len(data))
        except Exception as e:
            print("ERR", name, code, e)
