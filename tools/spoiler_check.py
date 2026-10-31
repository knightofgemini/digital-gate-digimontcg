#!/usr/bin/env python3
"""Controllo delle carte nuove dei prodotti in arrivo (spoiler), usato ogni giorno da .github/workflows/spoiler.yml.
Rigenera i dati dalla raccolta TakaOtaku, prende i prodotti con data di uscita futura e li confronta con src/data.json:
carte e alternative art nuove, tolte o cambiate. Segnala anche i prodotti con carte già svelate ma non ancora nel catalogo
(manca il nome in NAMES di make_data2.py).

Pubblicazione automatica con filtro (--auto, scelta dell'utente del 31 ottobre 2026): entrano nel catalogo solo le carte
con immagine (anteprima TakaOtaku o ufficiale) e testo completo (controllo automatico `incompleta`). Le altre vanno in
"_hold" di tools/card_fixes.json con il motivo e la data; le alternative senza immagine in "_hold_versions". Ogni giorno
quelle tenute da parte si ricontrollano ed entrano da sole quando l'immagine c'è e il testo è completo (con immagine e
testo che sembra incompleto da 5 giorni o più entrano comunque: il controllo del testo può sbagliare). Con "immagine
sbagliata" nel motivo conta solo l'immagine ufficiale.

Uso: python3 tools/spoiler_check.py [--apply] [--auto] [--report FILE] [--out FILE] [--prev ID,ID,...]
  --apply   scrive in src/data.json i prodotti in arrivo aggiornati (solo quelli)
  --auto    filtro della pubblicazione automatica (scrive anche tools/card_fixes.json)
  --report  riepilogo in Markdown (per la segnalazione su GitHub, che arriva via mail)
  --out     file dove scrivere "cambiato=1/0", "pubblica=1/0" e "ids=..." (GITHUB_OUTPUT)
  --prev    carte già segnalate l'ultima volta: nel riepilogo quelle davvero nuove sono evidenziate"""
import argparse, datetime, json, os, pathlib, re, sys, urllib.request
root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "tools"))
import merge_set as M
ap = argparse.ArgumentParser()
ap.add_argument("--apply", action="store_true"); ap.add_argument("--auto", action="store_true")
ap.add_argument("--report"); ap.add_argument("--out"); ap.add_argument("--prev", default="")
ap.add_argument("--noimg", action="store_true", help="prova in locale: nessuna immagine raggiungibile")
ap.add_argument("--allimg", action="store_true", help="prova in locale: tutte le immagini presenti")
a = ap.parse_args()
TODAY = datetime.date.today()
today = TODAY.isoformat()
FIXP = root / "tools" / "card_fixes.json"
def load_fix(): return json.load(open(FIXP, encoding="utf-8"))
def save_fix(F):
    FIXP.write_text(json.dumps(F, ensure_ascii=False, indent=1).replace(" ", "\\u00a0") + "\n", encoding="utf-8")

IMG = {}
def has_img(k, official_only=False):
    """indirizzo dell'immagine della versione k (es. BT27-015 o BT27-015_P1), se c'è"""
    if a.noimg: return None
    if a.allimg: return "prova"
    srcs = ("https://web-garage.takaotaku.de/%s-Sample.webp", "https://world.digimoncard.com/images/cardlist/card/%s.png")
    for u in srcs[1:] if official_only else srcs:
        if (u, k) in IMG:
            if IMG[(u, k)]: return IMG[(u, k)]
            continue
        ok = None
        try:
            r = urllib.request.urlopen(urllib.request.Request(u % k, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=15)
            if r.status == 200: ok = u % k
        except Exception: pass
        IMG[(u, k)] = ok
        if ok: return ok
    return None

def incompleta(r):
    """motivo per cui il testo della carta (riga di data.json) sembra incompleto, oppure None"""
    code, name, lv, colors, ct, form, attr, trait, dp, play, evo, eff, inh, sec, extra, rar = r[:16]
    if not name or name.startswith("[[") or not ct or not colors: return "nome, tipo o colore mancante"
    if not rar: return "rarità mancante"
    texts = [t for t in (eff, inh, sec, extra) if t]
    for t in texts + [name, trait]:
        if re.search(r"\?\?|\bTB[AD]\b|\[\[|XXX|■", t): return "segnaposto nel testo"
        if t.count("[") != t.count("]") or t.count("＜") != t.count("＞") or t.count("(") != t.count(")"): return "parentesi non chiuse"
    for t in (eff, inh, sec):
        for line in (t or "").split("\n"):
            s = line.strip()
            if s and s[-1] not in '.)]＞"”':
                return "testo che finisce a metà"
    egg = ct.startswith("Digi-Egg")
    if ct.startswith("Digimon") and not egg:
        if not lv or not dp or not play: return "livello, DP o costo mancante"
        if lv in ("Lv.3", "Lv.4", "Lv.5", "Lv.6", "Lv.7") and not evo and "Digievoluzione" not in (extra or ""): return "digievoluzione mancante"
        if lv in ("Lv.3", "Lv.4") and not eff and not inh: return "effetti mancanti"
    if (ct.startswith("Tamer") or ct.startswith("Option")) and not play: return "costo mancante"
    return None

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

CUR = M.load()
REP, ids_all, changed = [], [], False
PUB, HELD, FREED = [], [], []      # pubblicate, tenute da parte (nuove), liberate dalle tenute da parte

if a.auto:
    # 1) le tenute da parte: immagine arrivata? (il testo si controlla dopo la rigenerazione)
    F = load_fix()
    held = F.get("_hold", {})
    cand = {k: n for k, n in held.items() if has_img(k, "sbagliata" in n)}
    vcand = [k for k in F.get("_hold_versions", []) if has_img(k)]
    if cand or vcand:
        F2 = json.loads(json.dumps(F))
        for k in cand: F2["_hold"].pop(k)
        F2["_hold_versions"] = [k for k in F2.get("_hold_versions", []) if k not in vcand]
        save_fix(F2)
        TRY = M.regenerate()
        rows = {r[0]: r for r in TRY["cards"]}
        back = {}
        for k, n in cand.items():
            r = rows.get(k)
            why = incompleta(r) if r else "non più nella fonte"
            m = re.search(r"dal (\d{4}-\d\d-\d\d)", n)
            old = m and (TODAY - datetime.date.fromisoformat(m.group(1))).days >= 5
            if why and not (old and r):
                back[k] = n if why in n else "%s (dal %s)" % (why, m.group(1) if m else today)
            else:
                FREED.append(k)
        FREED += vcand
        F2["_hold"].update(back)
        save_fix(F2)
    # 2) carte nuove nei prodotti in arrivo: senza immagine o testo incompleto → tenute da parte
    NEW = M.regenerate()
    soon = [s for s in NEW["sets"] if s["date"] > today and s["date"][0] != "0"]
    F = load_fix(); hold_new = {}; hv_new = []
    for s in soon:
        a0, b0 = entries(CUR, s["id"]), entries(NEW, s["id"])
        for k, r in b0.items():
            if (k in a0 and a0[k] == r) or k in FREED: continue
            if "_P" in k:
                if k not in a0 and not has_img(k): hv_new.append(k)
                continue
            why = incompleta(r)
            if k not in a0 and not has_img(k): why = "senza immagine" + (", " + why if why else "")
            if why and k not in a0: hold_new[k] = "%s (dal %s)" % (why, today)
    if hold_new or hv_new:
        F.setdefault("_hold", {}).update(hold_new)
        F["_hold_versions"] = F.get("_hold_versions", []) + [k for k in hv_new if k not in F.get("_hold_versions", [])]
        save_fix(F)
        NEW = M.regenerate()
    HELD = list(hold_new.items()) + [(k, "alternative art senza immagine") for k in hv_new]
    FREED = [k for k in FREED if k not in hold_new and k not in hv_new]
else:
    NEW = M.regenerate()
    soon = [s for s in NEW["sets"] if s["date"] > today and s["date"][0] != "0"]

F = "code name lv colors ct form attr trait dp cost evo eff inh sec extra rar set x".split()
for s in soon:
    a0, b0 = entries(CUR, s["id"]), entries(NEW, s["id"])
    add = [k for k in b0 if k not in a0]; rem = [k for k in a0 if k not in b0]
    mod = [k for k in b0 if k in a0 and "_P" not in k and a0[k] != b0[k]]
    ids_all += add
    if not (add or rem or mod): continue
    changed = True; PUB += add
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

if a.auto:
    if HELD:
        changed = True; ids_all += ["held:" + k for k, _ in HELD]
        REP.append("## Tenute da parte (entrano da sole quando sono complete)")
        REP += ["- **%s**: %s" % (k, n) for k, n in HELD]; REP.append("")
    if FREED:
        changed = True
        REP.append("## Entrate nel catalogo dalle carte tenute da parte")
        REP += ["- **%s**" % k for k in FREED]; REP.append("")
else:
    # versioni e carte tenute da parte: l'immagine è arrivata? (solo segnalazione, da togliere a mano)
    FX = load_fix()
    ready = [(k, u) for k in FX.get("_hold_versions", []) for u in [has_img(k)] if u]
    if ready:
        changed = True; ids_all += ["img:" + k for k, _ in ready]
        REP.append("## Versioni in attesa: ora c'è l'immagine")
        REP += ["- **%s**: da togliere da `_hold_versions` in tools/card_fixes.json dopo il controllo" % k for k, _ in ready]
        REP.append(""); REP.append(" ".join('<img src="%s" width="150" alt="%s">' % (u, k) for k, u in ready)); REP.append("")
    held = FX.get("_hold", {})
    ready = [(k, u) for k, n in held.items() for u in [has_img(k, "sbagliata" in n)] if u]
    if ready:
        changed = True; ids_all += ["hold:" + k for k, _ in ready]
        REP.append("## Carte tenute da parte: ora c'è l'immagine")
        REP += ["- **%s** (%s): da togliere da `_hold` in tools/card_fixes.json dopo il controllo di immagine e testo" % (k, held[k]) for k, _ in ready]
        REP.append(""); REP.append(" ".join('<img src="%s" width="150" alt="%s">' % (u, k) for k, u in ready)); REP.append("")

# prodotti con carte svelate ma senza nome nel catalogo (questi restano da aggiungere a mano)
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
        REP += ["- %s: %d carte (va aggiunto il nome del prodotto: chiedi a Claude)" % (p, n) for p, n in sorted(cnt.items())]
except Exception as e:
    print("controllo prodotti nuovi non riuscito:", e)

pub = False
if a.apply:
    D = M.merge(CUR, NEW, [s["code"] for s in soon])
    if D != CUR: M.save(D); pub = True
head = "Controllo del %s: " % TODAY.strftime("%d/%m/%Y")
if a.auto:
    text = head + ("%d carte o alternative nuove pubblicate." % len(PUB) if PUB else "nessuna carta nuova pubblicata." if changed else "nessuna novità nei prodotti in arrivo (%s)." % ", ".join(s["code"] for s in soon))
else:
    text = head + ("carte nuove o cambiate nei prodotti in arrivo." if changed else "nessuna novità nei prodotti in arrivo (%s)." % ", ".join(s["code"] for s in soon))
body = text + "\n\n" + "\n".join(REP)
if PUB and a.auto:
    body += ("\n\nPubblicate da sole: hanno l'immagine e il testo completo, ma non sono state controllate una per una. "
             "Se noti un errore scrivilo a Claude. I segni ★ delle alternative art nuove si aggiungono a parte.")
elif changed and not a.auto:
    body += ("\n\nLe carte nuove dei prodotti già nel catalogo sono pronte nel ramo `spoiler-nuove` (non pubblicate). Chiedi a Claude di controllarle sulle immagini e pubblicarle.")
print(body)
if a.report: open(a.report, "w").write(body + "\n")
if a.out:
    with open(a.out, "a") as f: f.write("cambiato=%d\npubblica=%d\nids=%s\n" % (1 if changed else 0, 1 if (pub or FREED or HELD) else 0, ",".join(ids_all)))
