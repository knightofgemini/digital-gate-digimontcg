#!/usr/bin/env python3
"""Versioni delle immagini pubblicate (24 ottobre 2026). Per ogni immagine del sito (carte grandi/miniature/pre errata,
banner, confezioni, loghi) confronta l'impronta con quella della build precedente, salvata in www/img/_hashes.json (che resta
nella cache di Actions insieme alle immagini): se il contenuto è cambiato (anteprima sostituita dall'ufficiale, scritta SAMPLE
tolta, errata, banner aggiornato…) il numero di versione cresce. Scrive www/img/v.json = {percorso: versione} solo per le
immagini cambiate almeno una volta: l'app aggiunge ?v=N al loro indirizzo e così il telefono le riscarica."""
import hashlib, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
www = root / "www"
HF = www / "img" / "_hashes.json"
try: H = json.loads(HF.read_text())
except Exception: H = {}
first = not H
cur, changed = {}, []
for d in ("img/f", "img/t", "img/pre", "banners", "prod", "prod/logo"):
    for f in sorted((www / d).glob("*.webp")):
        p = d + "/" + f.name
        h = hashlib.md5(f.read_bytes()).hexdigest()[:12]
        old = H.get(p)
        if old is None: cur[p] = [h, 0]
        elif old[0] == h: cur[p] = old
        else: cur[p] = [h, old[1] + 1]; changed.append(p)
# le immagini sparite (es. versioni tolte) restano ricordate: se tornano, la versione riprende da dove era
for p, v in H.items():
    if p not in cur: cur[p] = v
HF.write_text(json.dumps(cur, separators=(",", ":")))
V = {p: v[1] for p, v in cur.items() if v[1] > 0 and (www / p).exists()}
(www / "img" / "v.json").write_text(json.dumps(V, separators=(",", ":")))
print("::notice title=Versioni immagini::%d immagini, %d cambiate in questa build, %d con una versione nuova in tutto%s" % (
    len(cur), len(changed), len(V), " (prima esecuzione: impronte di partenza)" if first else ""))
if changed: print("cambiate:", changed[:60])
