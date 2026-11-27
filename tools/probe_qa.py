# Prova (analysis.yml): come il sito ufficiale pubblica le Q&A delle carte. Salva la pagina delle regole, i suoi script
# e le risposte degli indirizzi che sembrano la ricerca delle Q&A, per guardarli da Claude.
import os, re, sys, urllib.request, urllib.parse
OUT = "analysis"
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"}
def get(u, data=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, data=data, headers=UA), timeout=40)
        return r.status, r.read()
    except Exception as e:
        return getattr(e, "code", 0), str(e).encode()
seen = set()
def save(name, u, data=None):
    st, b = get(u, data)
    open(os.path.join(OUT, name), "wb").write(b)
    print(st, len(b), u)
    return b
base = "https://world.digimoncard.com"
h = save("rule.html", base + "/rule/").decode("utf8", "replace")
for i, s in enumerate(sorted(set(re.findall(r'(?:src|href)="([^"]+\.js[^"]*)"', h)))):
    save("js_%02d.js" % i, urllib.parse.urljoin(base + "/rule/", s))
for u in sorted(set(re.findall(r'(?:href|action)="([^"]*(?:qa|faq|search)[^"]*)"', h, re.I))):
    print("LINK", u)
# indirizzi probabili
for i, u in enumerate([base + "/rule/qa/", base + "/rule/qa/?search=BT1-001", base + "/cardlist/?search=true&keyword=ST1-01", base + "/rule/qa_search/?keyword=ST1-01", base + "/qa/", base + "/rule/pdf/qa_starter01.pdf", base + "/rule/pdf/qa_pack_01.pdf"]):
    save("try_%02d.bin" % i, u)
