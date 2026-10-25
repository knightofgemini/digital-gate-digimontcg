#!/usr/bin/env python3
"""Controllo delle carte nuove dei prodotti in arrivo (spoiler), usato ogni giorno da .github/workflows/spoiler.yml.
Rigenera i dati dalla raccolta TakaOtaku, prende i prodotti con data di uscita futura e li confronta con src/data.json:
carte e alternative art nuove, tolte o cambiate. Segnala anche i prodotti con carte già svelate ma non ancora nel catalogo
(manca il nome in NAMES di make_data2.py).
Uso: python3 tools/spoiler_check.py [--apply] [--report FILE] [--out FILE] [--prev ID,ID,...]
  --apply   scrive in src/data.json i prodotti in arrivo aggiornati (solo quelli)
  --report  riepilogo in Markdown (per la segnalazione su GitHub)
  --out     file dove scrivere "cambiato=1/0" e "ids=..." (GITHUB_OUTPUT)
  --prev    carte già segnalate l'ultima volta: nel riepilogo quelle davvero nuove sono evidenziate"""
import argparse, datetime, json, os, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "tools"))
import merge_set as M
ap = argparse.ArgumentParser()
ap.add_argument("--apply", action="store_true"); ap.add_argument("--report"); ap.add_argument("--out"); ap.add_argument("--prev", default="")
a = ap.parse_args()
today = datetime.date.today().isoformat()
CUR, NEW = M.load(), M.regenerate()
soon = [s for s in NEW["sets"] if s["date"] > today and s["date"][0] != "0"]
def entries(D, sid):
    """versioni del prodotto: {id versione: riga della carta}"""
    s = next((x for x in D["sets"] if x["id"] == sid), None)
    if not s: return {}
    out = {}
    for x in s["v"]:
        i, suf = (x, "") if isinstance(x, int) else (x[0], x[1])
        r = D["cards"][i]
        if r[16] == sid or suf: out[r[0] + suf] = r
    return out
F = "code name lv colors ct form attr trait dp cost evo eff inh sec extra rar set x".split()
REP, ids_all, changed = [], [], False
for s in soon:
    a0, b0 = entries(CUR, s["id"]), entries(NEW, s["id"])
    add = [k for k in b0 if k not in a0]; rem = [k for k in a0 if k not in b0]
    mod = [k for k in b0 if k in a0 and "_P" not in k and a0[k] != b0[k]]
    ids_all += add
    if not (add or rem or mod): continue
    changed = True
    REP.append("## %s %s · %d carte svelate (%d nuove)" % (s["code"], s["name"], sum(1 for k in b0 if "_P" not in k), len(add)))
    for k in add:
        r = b0[k]; alt = "_P" in k
        new = " 🆕" if a.prev and k not in a.prev.split(",") else ""
        REP.append("- **%s** %s%s · %s%s · %s%s" % (k, r[1], " (alternative art)" if alt else "", r[15], ("" if not r[2] else " · " + r[2]), r[4], new))
    if add:
        REP.append("")
        REP.append(" ".join('<img src="https://web-garage.takaotaku.de/%s-Sample.webp" width="150" alt="%s">' % (k, k) for k in add))
    for k in rem: REP.append("- tolta dalla fonte: %s %s" % (k, a0[k][1]))
    for k in mod:
        d = [F[i] for i in range(max(len(a0[k]), len(b0[k]))) if (a0[k][i] if i < len(a0[k]) else None) != (b0[k][i] if i < len(b0[k]) else None)]
        REP.append("- cambiata nella fonte: %s %s (%s)" % (k, b0[k][1], ", ".join(d)))
    REP.append("")
# versioni annunciate ma tenute da parte perché senza immagine (_hold_versions): l'immagine è arrivata?
import urllib.request
FIX = json.load(open(root / "tools" / "card_fixes.json", encoding="utf-8"))
def has_img(k, official_only=False):
    srcs = ("https://web-garage.takaotaku.de/%s-Sample.webp", "https://world.digimoncard.com/images/cardlist/card/%s.png")
    for u in srcs[1:] if official_only else srcs:
        try:
            r = urllib.request.urlopen(urllib.request.Request(u % k, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=15)
            if r.status == 200: return u % k
        except Exception: pass
    return None
ready = [(k, u) for k in FIX.get("_hold_versions", []) for u in [has_img(k)] if u]
if ready:
    changed = True; ids_all += ["img:" + k for k, _ in ready]
    REP.append("## Versioni in attesa: ora c'è l'immagine")
    REP += ["- **%s**: da togliere da `_hold_versions` in tools/card_fixes.json dopo il controllo" % k for k, _ in ready]
    REP.append(""); REP.append(" ".join('<img src="%s" width="150" alt="%s">' % (u, k) for k, u in ready)); REP.append("")
# carte svelate ma tenute da parte (_hold: senza immagine, testo incompleto o immagine sbagliata): l'immagine è arrivata?
# con "immagine sbagliata" nella nota conta solo l'immagine ufficiale (l'anteprima TakaOtaku c'è già ma è di un'altra carta)
held = FIX.get("_hold", {})
ready = [(k, u) for k, n in held.items() for u in [has_img(k, "sbagliata" in n)] if u]
if ready:
    changed = True; ids_all += ["hold:" + k for k, _ in ready]
    REP.append("## Carte tenute da parte: ora c'è l'immagine")
    REP += ["- **%s** (%s): da togliere da `_hold` in tools/card_fixes.json dopo il controllo di immagine e testo" % (k, held[k]) for k, _ in ready]
    REP.append(""); REP.append(" ".join('<img src="%s" width="150" alt="%s">' % (u, k) for k, u in ready)); REP.append("")
# prodotti con carte svelate ma senza nome nel catalogo
try:
    taka = os.environ.get("TAKA") or "/home/claude/TakaOtaku_Digimon-Card-App"
    src = json.load(open(taka + "/src/assets/cardlists/PreparedDigimonCardsENG.json", encoding="utf-8"))
    have = {s["code"] for s in NEW["sets"]}
    cnt = {}
    for k in src:
        if (k["name"]["english"] or "").startswith("[["): continue
        p = k["cardNumber"].split("-")[0]
        if p not in have and p != "LM" and re.match(r"^(BT|EX|ST|RB|AD)\d+$", p): cnt[p] = cnt.get(p, 0) + 1
    if cnt:
        changed = True; ids_all += ["prod:%s:%d" % (p, n) for p, n in sorted(cnt.items())]
        REP.append("## Prodotti con carte svelate non ancora nel catalogo")
        REP += ["- %s: %d carte (va aggiunto il nome del prodotto)" % (p, n) for p, n in sorted(cnt.items())]
except Exception as e:
    print("controllo prodotti nuovi non riuscito:", e)
if a.apply and any(l.startswith("## ") and "in attesa" not in l and "tenute da parte" not in l and "non ancora nel catalogo" not in l for l in REP):
    M.save(M.merge(CUR, NEW, [s["code"] for s in soon]))
head = "Controllo del %s: " % datetime.date.today().strftime("%d/%m/%Y")
text = head + ("carte nuove o cambiate nei prodotti in arrivo." if changed else "nessuna novità nei prodotti in arrivo (%s)." % ", ".join(s["code"] for s in soon))
body = text + "\n\n" + "\n".join(REP)
if changed:
    body += ("\n\nLe carte nuove dei prodotti già nel catalogo sono pronte nel ramo `spoiler-nuove` (non pubblicate). Chiedi a Claude di controllarle sulle immagini e pubblicarle.")
print(body)
if a.report: open(a.report, "w").write(body + "\n")
if a.out:
    with open(a.out, "a") as f: f.write("cambiato=%d\nids=%s\n" % (1 if changed else 0, ",".join(ids_all)))
