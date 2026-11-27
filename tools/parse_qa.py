# Legge le pagine salvate da tools/fetch_qa.py e scrive src/qa.json (27 novembre 2026):
# {"c": {CODICE: [[n, domanda, risposta, data], ...]}, "r": [[categoria, voce, n, domanda, risposta, data], ...],
#  "t": data dell'ultima Q&A}. Testi in inglese esattamente come sul sito (a capo = "\n").
import html, json, os, re, sys
D = sys.argv[1] if len(sys.argv) > 1 else "analysis/qa"
OUT = sys.argv[2] if len(sys.argv) > 2 else "src/qa.json"
MON = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
def clean(s):
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\r", "")
    return "\n".join(l.strip() for l in s.split("\n")).strip()
def date(s):
    m = re.search(r"([A-Z][a-z]{2})\.? (\d+), (\d{4})", s or "")
    return f"{m.group(3)}-{MON[m.group(1)]:02d}-{int(m.group(2)):02d}" if m else ""
def boxes(h, anchor):
    i = h.find(anchor)
    h = h[i:]
    for box in re.split(r'<dl class="qa_box">', h)[1:]:
        m = re.search(r'<dt class="qa_category">\s*<span>([^<]*)</span>(.*?)</dt>', box, re.S)
        if not m:
            continue
        head, title = clean(m.group(1)), clean(m.group(2))
        for q in re.finditer(r'<dl class="questions">\s*<dt>Q(\d+)</dt>\s*<dd>(.*?)</dd>\s*</dl>\s*<dl class="answer">\s*<dt>A\d+</dt>\s*<dd>(.*?)</dd>\s*</dl>', box, re.S):
            qq = q.group(2)
            sp = re.search(r"<span>(.*?)</span>\s*$", qq, re.S)
            d = date(sp.group(1)) if sp else ""
            if sp:
                qq = qq[: sp.start()]
            yield head, title, int(q.group(1)), clean(qq), clean(q.group(3)), d
cards, seen = {}, set()
for f in sorted(os.listdir(D)):
    if not f.startswith("card_"):
        continue
    h = open(os.path.join(D, f), encoding="utf8").read()
    for head, title, n, q, a, d in boxes(h, 'id="qaResult_card"'):
        m = re.match(r"([A-Z0-9]+-\d+)\s*(.*)", title)
        code = m.group(1) if m else title
        if (code, n) in seen:
            continue
        seen.add((code, n))
        cards.setdefault(code, []).append([n, q, a, d])
rules, rs = [], set()
for f in sorted(os.listdir(D)):
    if not f.startswith("rule_"):
        continue
    h = open(os.path.join(D, f), encoding="utf8").read()
    for head, title, n, q, a, d in boxes(h, 'id="qaResult_rule"'):
        if n in rs:
            continue
        rs.add(n)
        rules.append([head, title, n, q, a, d])
for v in cards.values():
    v.sort(key=lambda x: x[0])
alld = [x[3] for v in cards.values() for x in v if x[3]] + [x[5] for x in rules if x[5]]
out = {"t": max(alld) if alld else "", "c": dict(sorted(cards.items())), "r": rules}
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("carte", len(cards), "domande", sum(len(v) for v in cards.values()), "regole", len(rules), "ultima", out["t"], os.path.getsize(OUT) // 1024, "KB")
