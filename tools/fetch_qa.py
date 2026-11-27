# Q&A ufficiali di Bandai (world.digimoncard.com/rule/, 27 novembre 2026, richiesta dell'utente): non c'è un PDF unico,
# la pagina delle regole cerca le Q&A per prodotto con un modulo (POST `is_card_search`, `prodid`) e le Q&A delle regole
# per categoria (`is_rule_search`, `category`). Lanciato da analysis.yml: salva le pagine dei risultati in analysis/qa/
# (card_PRODID[_pN].html, rule_CATEGORIA.html); le legge poi tools/parse_qa.py. Ogni notte da qa.yml (cartella come
# argomento), che aggiorna src/qa.json su main se Bandai ha aggiunto domande.
import os, re, sys, time, urllib.request, urllib.parse
OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("x") else "analysis/qa"
os.makedirs(OUT, exist_ok=True)
URL = "https://world.digimoncard.com/rule/"
UA = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", "Content-Type": "application/x-www-form-urlencoded", "Referer": URL}
def post(fields, url=URL):
    data = urllib.parse.urlencode(fields).encode()
    for k in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, data=data, headers=UA), timeout=60).read().decode("utf8", "replace")
        except Exception as e:
            print("errore", e, fields)
            time.sleep(5)
    return ""
home = urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=60).read().decode("utf8", "replace")
prods = re.findall(r'<option value="(\d+)"\s*>([^<]+)</option>', home)
cats = re.findall(r'<option value="([A-Z][^"]+)"\s*>', home)
open(OUT + "/prodotti.tsv", "w").write("".join(f"{a}\t{b}\n" for a, b in prods))
tot = 0
for pid, name in prods:
    h = post({"free_card": "", "prodid": pid, "search": "", "is_card_search": "true"})
    open(f"{OUT}/card_{pid}.html", "w").write(h)
    # pagine successive, se ci sono (link o moduli con "page")
    pages = sorted(set(re.findall(r'[?&]page=(\d+)', h)) | set(re.findall(r'name="page" value="(\d+)"', h)), key=int)
    for p in pages:
        if p == "1":
            continue
        h2 = post({"free_card": "", "prodid": pid, "search": "", "is_card_search": "true", "page": p}, URL + "?page=" + p)
        open(f"{OUT}/card_{pid}_p{p}.html", "w").write(h2)
    n = h.count("qaResult_list") + h.count('class="qa_')
    tot += 1
    print(pid, name, len(h), "pagine", pages[:5])
    time.sleep(0.6)
for c in cats:
    h = post({"free_rule": "", "category": c, "sub_category": "", "search": "", "is_rule_search": "true"})
    open(f"{OUT}/rule_{re.sub(r'\W+', '_', c)}.html", "w").write(h)
    print("regole", c, len(h))
    time.sleep(0.6)
print("prodotti", tot)
