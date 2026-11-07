# Prova del canale Telegram come fonte degli spoiler (7 novembre 2026): legge la pagina pubblica t.me/s/CANALE (senza
# account), più pagine indietro, e salva in analysis/ i messaggi (data, testo, hashtag, foto) e le prime foto.
# Uso (via analysis.yml): python3 tools/probe_telegram.py CANALE [PAGINE]
import html, json, os, re, sys, urllib.request

ch = sys.argv[1]
pages = int(sys.argv[2]) if len(sys.argv) > 2 else 6
os.makedirs("analysis/foto", exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) DigitalGate-probe"}


def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()


msgs, before = [], None
for _ in range(pages):
    u = "https://t.me/s/%s" % ch + ("?before=%d" % before if before else "")
    h = get(u).decode("utf8", "replace")
    found = []
    for m in re.finditer(r'<div class="tgme_widget_message_wrap.*?(?=<div class="tgme_widget_message_wrap|$)', h, re.S):
        b = m.group(0)
        pid = re.search(r'data-post="[^/]+/(\d+)"', b)
        if not pid:
            continue
        t = re.search(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', b, re.S)
        txt = html.unescape(re.sub(r"<br\s*/?>", "\n", re.sub(r"<(?!br)[^>]+>", "", t.group(1)))) if t else ""
        txt = re.sub(r"<[^>]+>", "", txt)
        photos = re.findall(r"tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)", b)
        date = re.search(r'<time datetime="([^"]+)"', b)
        found.append({"id": int(pid.group(1)), "date": date.group(1) if date else "", "text": txt, "tags": re.findall(r"#\w+", txt), "photos": photos})
    if not found:
        break
    msgs += found
    before = min(x["id"] for x in found)
msgs.sort(key=lambda x: -x["id"])
json.dump(msgs, open("analysis/messaggi.json", "w"), ensure_ascii=False, indent=1)
print("messaggi:", len(msgs))
n = 0
for x in msgs:
    print("----", x["id"], x["date"], "foto:", len(x["photos"]), "tag:", " ".join(x["tags"]))
    print(x["text"][:600])
    for k, p in enumerate(x["photos"][:4]):
        if n < 40:
            try:
                open("analysis/foto/%d_%d.jpg" % (x["id"], k), "wb").write(get(p))
                n += 1
            except Exception as e:
                print("foto non scaricata", e)
