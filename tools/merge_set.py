#!/usr/bin/env python3
"""Aggiorna in src/data.json SOLO i prodotti indicati (es. gli spoiler di un set in arrivo), prendendoli da una rigenerazione
completa di make_data2.py, senza toccare il resto del catalogo (testi delle altre carte, versioni degli altri prodotti).
Applica anche "_remove_versions" di tools/card_fixes.json a tutti i prodotti.
Uso: python3 tools/merge_set.py BT27 [EX14 ...]   (serve la raccolta TakaOtaku in /home/claude/TakaOtaku_Digimon-Card-App)"""
import json, os, re, subprocess, sys, tempfile, collections, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
codes = [c.upper() for c in sys.argv[1:]]
if not codes: sys.exit("indica almeno un codice di prodotto, es. BT27")
tmp = tempfile.mktemp(suffix=".json")
subprocess.run([sys.executable, str(root / "tools" / "make_data2.py")], check=True, env=dict(os.environ, DATA_OUT=tmp), stdout=subprocess.DEVNULL)
NEW = json.load(open(tmp, encoding="utf-8")); os.unlink(tmp)
CUR = json.load(open(root / "src" / "data.json", encoding="utf-8"))
FIX = json.load(open(root / "tools" / "card_fixes.json", encoding="utf-8"))
def nat(s): return [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', s.lower())]
ids = {s["id"] for s in NEW["sets"] if s["code"] in codes}
miss = [c for c in codes if c not in {s["code"] for s in NEW["sets"]}]
if miss: sys.exit("prodotti non trovati nella rigenerazione: %s" % miss)
def ident(rows):   # identità di ogni riga: (codice, set, n-esima occorrenza)
    seen = collections.Counter(); out = []
    for r in rows:
        k = (r[0], r[16]); seen[k] += 1; out.append(k + (seen[k],))
    return out
# righe: quelle attuali tranne i prodotti aggiornati, più quelle nuove dei prodotti aggiornati
cur_id, new_id = ident(CUR["cards"]), ident(NEW["cards"])
rows = {i: r for i, r in zip(cur_id, CUR["cards"]) if r[16] not in ids}
rows.update({i: r for i, r in zip(new_id, NEW["cards"]) if r[16] in ids})
# prodotti: attuali, con quelli aggiornati presi dalla rigenerazione
nsets = {s["id"]: s for s in NEW["sets"]}
sets = [s for s in CUR["sets"] if s["id"] not in ids] + [nsets[i] for i in ids]
order = ["BT", "EX", "ST", "LM", "PB", "AL"]
sets.sort(key=lambda s: (s["date"], nat(s["code"])), reverse=True)
chron = {s["id"]: i for i, s in enumerate(sets)}
sets.sort(key=lambda s: order.index(s["type"]))
keys = sorted(rows, key=lambda i: (chron[i[1]], nat(i[0]), i[2]))
pos = {k: n for n, k in enumerate(keys)}
VERS = list(CUR["versions"])
def vix(label):
    if label not in VERS: VERS.append(label)
    return VERS.index(label)
rmv = set(FIX.get("_remove_versions", []) + FIX.get("_hold_versions", []))
def remap(s, src_rows_id, src_vers):
    v = []
    for x in s["v"]:
        if isinstance(x, int): v.append(pos[src_rows_id[x]]); continue
        i, suf, vv = x[0], x[1], x[2]
        k = src_rows_id[i]
        if k[0] + suf in rmv: continue
        y = [pos[k], suf, vix(src_vers[vv])] + list(x[3:]); v.append(y)
    return v
out = []
for s in sets:
    s = dict(s)
    s["v"] = remap(s, new_id, NEW["versions"]) if s["id"] in ids else remap(s, cur_id, CUR["versions"])
    out.append(s)
CUR["cards"] = [rows[k] for k in keys]; CUR["sets"] = out; CUR["versions"] = VERS
s = json.dumps(CUR, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
open(root / "src" / "data.json", "w", encoding="utf-8").write(s)
for c in codes:
    st = next(x for x in out if x["code"] == c)
    print(c, ":", sum(1 for r in CUR["cards"] if r[16] == st["id"]), "carte,", len(st["v"]), "versioni")
print(len(CUR["cards"]), "carte in tutto,", len(out), "prodotti")
