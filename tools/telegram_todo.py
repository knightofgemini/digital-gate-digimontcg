#!/usr/bin/env python3
"""Cosa fare con i messaggi del canale Telegram (7 novembre 2026). Legge il ramo "telegram" (scaricato in TGDIR da
tools/telegram_fetch.py via telegram.yml), la raccolta TakaOtaku (TAKA), src/data.json, tools/card_fixes.json e
tools/telegram_cards.json, e per le carte dei prodotti in arrivo:
  - carte nuove che TakaOtaku non ha ancora (o ha solo come segnaposto): da TRASCRIVERE dalla foto (la foto viene
    copiata in src/telegram/CODICE.jpg) → Claude aggiunge la voce in tools/telegram_cards.json (modello stampato sotto);
  - alternative art dei prodotti Premium Bandai (ristampe: il testo c'è già): voce aggiunta da sola in
    telegram_cards.json con id CODICE_PTnn (nn = numero del PB) e foto in src/telegram/;
  - carte già in TakaOtaku ma tenute da parte perché senza immagine: foto copiata in src/telegram/ (così entrano);
  - alternative art dei prodotti BT/EX/ST: solo segnalate (TakaOtaku le numera _P1, _P2…: da abbinare a mano).
Con --apply scrive i file; senza, mostra soltanto. Uso: TAKA=… python3 tools/telegram_todo.py TGDIR [--apply]"""
import datetime, json, os, pathlib, re, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
tg = pathlib.Path(sys.argv[1]); apply = "--apply" in sys.argv
taka = os.environ.get("TAKA") or "/home/claude/TakaOtaku_Digimon-Card-App"
src = json.load(open(taka + "/src/assets/cardlists/PreparedDigimonCardsENG.json", encoding="utf-8"))
real = {}
for k in src:
    if not (k["name"]["english"] or "").strip().startswith("[["): real.setdefault(k["cardNumber"].strip(), []).append(k)
D = json.load(open(root / "src" / "data.json", encoding="utf-8"))
F = json.load(open(root / "tools" / "card_fixes.json", encoding="utf-8"))
TP = root / "tools" / "telegram_cards.json"
T = json.load(open(TP, encoding="utf-8")) if TP.exists() else {"cards": []}
have_t = {e["id"] for e in T["cards"]}
cards = {r[0]: r for r in D["cards"]}
today = datetime.date.today().isoformat()
soon = {u["code"]: u for u in D["upcoming"] if (u.get("to") or u.get("from") or "9999") >= today}
PREFIX = {"BD01": "ST25", "BD02": "ST26"}
posts = json.load(open(tg / "posts.json", encoding="utf-8"))
photo_dir = root / "src" / "telegram"


def photo(p, key):
    """copia la foto del messaggio in src/telegram/KEY.jpg (se non c'è già)"""
    f = tg / "foto" / ("%d_0.jpg" % p["id"])
    dst = photo_dir / (key + ".jpg")
    if not f.exists(): return None
    if apply and not dst.exists():
        photo_dir.mkdir(exist_ok=True); shutil.copy(f, dst)
    return dst


TODO, AUTO, IMG, ALT = [], [], [], []
seen = set()
for p in sorted(posts, key=lambda p: p["id"]):   # dal più vecchio: a parità di carta vale l'ultimo messaggio
    c, prod = p.get("card"), p.get("prod")
    if not c or prod not in soon: continue
    n = c["code"]
    if prod.startswith("PB"):
        num = int(re.sub(r"\D", "", prod))
        key = "%s_PT%d" % (n, num)
        if any(re.search(r"\bPB-?0*%d\b" % num, k.get("notes") or "", re.I) for k in real.get(n, [])): continue
        if n not in cards: TODO.append((p, n, "ristampa di una carta che non è nel catalogo")); continue
        photo(p, key)   # anche per le voci già aggiunte (la foto può arrivare dopo)
        if key in have_t or key in seen: continue
        seen.add(key)
        T["cards"].append({"id": key, "cardNumber": n, "name": {"english": cards[n][1]}, "version": "Alternative Art",
                           "notes": "%s %s" % (prod[:2] + "-" + prod[2:], soon[prod]["name"]), "_prod": prod, "_post": p["id"], "_src": "telegram"})
        AUTO.append((p, key))
        continue
    home = PREFIX.get(n.split("-")[0], n.split("-")[0])
    if home != prod: continue   # ristampa di un'altra carta in un booster: la gestisce TakaOtaku
    if c["alt"]:
        ALT.append((p, n)); continue
    if n in real:
        if n in F.get("_hold", {}) and "senza immagine" in F["_hold"][n] and not (photo_dir / (n + ".jpg")).exists():
            photo(p, n); IMG.append((p, n))
        continue
    photo(p, n)
    if n in have_t or n in seen: continue
    seen.add(n)
    TODO.append((p, n, "da trascrivere"))

if apply and AUTO:
    TP.write_text(json.dumps(T, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("Prodotti in arrivo:", ", ".join(soon))
print("\nAlternative art dei Premium Bandai aggiunte da sole (%d):" % len(AUTO))
for p, k in AUTO: print("  %s  %s  (messaggio %d)" % (k, p["card"]["name"], p["id"]))
print("\nFoto usate per carte tenute da parte senza immagine (%d):" % len(IMG))
for p, k in IMG: print("  %s  %s" % (k, p["card"]["name"]))
print("\nDa TRASCRIVERE dalla foto in tools/telegram_cards.json (%d):" % len(TODO))
for p, k, why in TODO: print("  %s  %s  %s  foto: src/telegram/%s.jpg  (messaggio %d, %s)" % (p["prod"], k, p["card"]["name"], k, p["id"], why))
print("\nAlternative art di BT/EX/ST viste sul canale (da abbinare a mano, se servono) (%d):" % len(ALT))
for p, k in ALT: print("  %s  %s  messaggio %d, foto %s" % (k, p["card"]["name"], p["id"], tg / "foto" / ("%d_0.jpg" % p["id"])))
if TODO:
    print("""
Modello di voce (campi come nella raccolta TakaOtaku; "-" se vuoto; testo ESATTO come stampato, in inglese):
{"id": "BT27-089", "cardNumber": "BT27-089", "name": {"english": "…"}, "cardType": "Digimon|Tamer|Option|Digi-Egg",
 "color": "Red" (più colori: "Red/Blue"), "cardLv": "Lv.4" o "-", "form": "Rookie" o "-", "attribute": "Vaccine" o "-",
 "type": "Dragon Kin/…" o "-", "dp": "5000" o "-", "playCost": "4" o "-",
 "digivolveCondition": [{"color": "Red", "cost": "2", "level": "3"}],
 "effect": "[On Play] …" o "-", "digivolveEffect": "…" o "-", "securityEffect": "…" o "-", "specialDigivolve": "-",
 "rarity": "C|U|R|SR|SEC", "version": "Normal", "notes": "▹BOOSTER IGNITION OF X [BT-27]",
 "_post": NUMERO_MESSAGGIO, "_src": "telegram"}""")
