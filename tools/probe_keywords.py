"""Raccoglie dalle API di digimoncard.io il testo di promemoria (reminder) ufficiale di ogni keyword ＜...＞.
Uso: python3 tools/probe_keywords.py Blocker,Raid,...  -> analysis/keywords.json"""
import sys, json, re, time, pathlib, urllib.request, urllib.parse
kws = [k.strip() for k in sys.argv[1].split(",") if k.strip()]
out = pathlib.Path("analysis"); out.mkdir(exist_ok=True)
res = {}
for kw in kws:
    q = urllib.parse.urlencode({"desc": kw, "series": "Digimon Card Game"})
    url = "https://digimoncard.io/api-public/search?" + q
    try:
        data = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=40).read())
    except Exception as e:
        print(kw, "err", e); res[kw] = {"err": str(e)}; time.sleep(1); continue
    if isinstance(data, dict): data = data.get("data") or []
    forms = {}
    for c in data:
        for f in ("main_effect", "source_effect", "alt_effect", "security_effect"):
            t = c.get(f) or ""
            for m in re.finditer(r"[<＜]((?:[^<>＜＞]|\[[^\]]*\])*?" + re.escape(kw) + r"[^<>＜＞]*)[>＞]\s*(\((?:[^()]|\([^()]*\))*\))", t):
                k = m.group(1).strip()
                if k not in forms: forms[k] = {"r": m.group(2), "id": c.get("id") or c.get("cardnumber")}
    res[kw] = forms
    print(kw, len(data), len(forms))
    time.sleep(1)
json.dump(res, open(out / "keywords.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
