#!/usr/bin/env python3
"""Lettura del canale Telegram DigimonExpanseTCG (7 novembre 2026, scelta dell'utente: fonte degli spoiler oltre a
TakaOtaku). Usato da .github/workflows/telegram.yml (dalla sandbox t.me non è raggiungibile).

Legge la pagina pubblica t.me/s/CANALE (niente account) dalla più recente all'indietro, fino ai messaggi già salvati
(al massimo PAGINE pagine), e aggiorna nella cartella OUT:
  posts.json  tutti i messaggi letti: {id, date, text, tags, photos (indirizzi), card: {name, code, alt}, prod}
  foto/ID_N.jpg  le foto dei messaggi di carte (scaricate una volta sola)
I messaggi degli spoiler sono sempre "Nome [Alternative Art] (CODICE)" + "#PRODOTTO #NomeProdotto" + una foto.
Uso: python3 tools/telegram_fetch.py OUT [CANALE] [PAGINE]"""
import html, json, os, re, sys, time, urllib.request

out = sys.argv[1]
ch = sys.argv[2] if len(sys.argv) > 2 else "DigimonExpanseTCG"
pages = int(sys.argv[3]) if len(sys.argv) > 3 else 12
os.makedirs(out + "/foto", exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) DigitalGate"}
PJ = out + "/posts.json"
old = {p["id"]: p for p in json.load(open(PJ))} if os.path.exists(PJ) else {}


def get(u):
    for n in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()
        except Exception:
            if n == 2: raise
            time.sleep(3)


def parse(h):
    found = []
    for m in re.finditer(r'<div class="tgme_widget_message_wrap.*?(?=<div class="tgme_widget_message_wrap|$)', h, re.S):
        b = m.group(0)
        pid = re.search(r'data-post="[^/]+/(\d+)"', b)
        if not pid: continue
        t = re.search(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', b, re.S)
        txt = html.unescape(re.sub(r"<[^>]+>", "", re.sub(r"<br\s*/?>", "\n", t.group(1)))) if t else ""
        photos = re.findall(r"tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)", b)
        date = re.search(r'<time datetime="([^"]+)"', b)
        tags = re.findall(r"#\w+", txt)
        p = {"id": int(pid.group(1)), "date": date.group(1) if date else "", "text": txt, "tags": tags, "photos": photos}
        c = re.search(r"^(.+?)\s*\(([A-Z]+\d*-\d+)\)\s*$", txt.split("\n")[0].strip())
        if c:
            name, alt = c.group(1).strip(), False
            if re.search(r"\s+Alternative Art$", name): name, alt = re.sub(r"\s+Alternative Art$", "", name), True
            p["card"] = {"name": name, "code": c.group(2), "alt": alt}
        prod = [x[1:] for x in tags if re.match(r"#(BT|EX|ST|PB|LM|AD|RB)\d+$", x)]
        if prod: p["prod"] = prod[0]
        found.append(p)
    return found


got, before = {}, None
for _ in range(pages):
    h = get("https://t.me/s/%s" % ch + ("?before=%d" % before if before else "")).decode("utf8", "replace")
    f = parse(h)
    if not f: break
    for p in f: got[p["id"]] = p
    before = min(p["id"] for p in f)
    if old and before <= max(old): break
new = [i for i in got if i not in old]
old.update(got)
for p in old.values():
    if "card" not in p: continue
    for k, u in enumerate(p.get("photos", [])[:2]):
        fn = "%s/foto/%d_%d.jpg" % (out, p["id"], k)
        if os.path.exists(fn): continue
        try: open(fn, "wb").write(get(u))
        except Exception as e: print("foto non scaricata", p["id"], e)
L = sorted(old.values(), key=lambda p: -p["id"])
json.dump(L, open(PJ, "w"), ensure_ascii=False, indent=1)
print("messaggi salvati: %d, nuovi: %d" % (len(L), len(new)))
for i in sorted(new, reverse=True):
    p = old[i]
    if "card" in p: print("  %d %s %s %s%s" % (i, p["date"][:16], p.get("prod", "?"), p["card"]["code"], " (alternative art)" if p["card"]["alt"] else ""))
