#!/usr/bin/env python3
"""Prepara il deposito di GitHub Pages (www/) da cui l'app prende ciò che non sta dentro l'APK.

Da novembre 2026 il sito non è più un'app (la vecchia app è nell'etichetta "vecchia-app" e in docs/vecchia-app.md):
- www/index.html: pagina per scaricare l'APK (src/sito/index.html con il marchio di src/icons/digital-gate-mark.svg);
- www/sw.js: chiude il service worker della vecchia app nei browser che l'avevano aperta;
- www/dati/: carte e prodotti pubblicati, che l'app scarica da sola (rn/src/dataupd.ts) senza bisogno di un APK nuovo;
  ver.json = impronta dei dati (h) e momento dell'ultimo commit (t), lo stesso usato per i dati dentro l'APK;
- www/ocr/: copia del motore di lettura della scansione (rn/ocr/, da rn/scripts/ocr-files.js), ripiego di quello nell'APK.
Immagini (img/), confezioni e loghi (prod/), banner (banners/) li aggiungono gli altri script di tools/ (vedi build.yml)."""
import hashlib, json, pathlib, shutil, subprocess

root = pathlib.Path(__file__).resolve().parent.parent
src, www = root / "src", root / "www"
www.mkdir(exist_ok=True)

page = (src / "sito" / "index.html").read_text(encoding="utf-8")
mark = (src / "icons" / "digital-gate-mark.svg").read_text(encoding="utf-8").strip()
assert "<!--MARK-->" in page
(www / "index.html").write_text(page.replace("<!--MARK-->", mark), encoding="utf-8")
for f in ("favicon.ico", "favicon-32.png", "apple-touch-icon.png", "sw.js"):
    shutil.copy(src / "sito" / f, www / f)
# la vecchia app installata come app web cercava questo file: non c'è più
(www / "manifest.webmanifest").unlink(missing_ok=True)

dd = www / "dati"; dd.mkdir(exist_ok=True)
raw_d, raw_p = (src / "data.json").read_bytes(), (src / "products.json").read_bytes()
(dd / "data.json").write_bytes(raw_d); (dd / "products.json").write_bytes(raw_p)
try: t = int(subprocess.run(["git", "log", "-1", "--format=%ct"], cwd=root, capture_output=True, text=True).stdout.strip() or 0)
except Exception: t = 0
(dd / "ver.json").write_text(json.dumps({"h": hashlib.sha1(raw_d + raw_p).hexdigest()[:16], "t": t}), encoding="utf-8")

ocr = root / "rn" / "ocr"
if (ocr / "v.json").exists():
    shutil.rmtree(www / "ocr", ignore_errors=True)
    shutil.copytree(ocr, www / "ocr")
else:
    print("rn/ocr mancante (node rn/scripts/ocr-files.js): niente copia del motore di lettura sul sito")
print("deposito pronto:", ", ".join(sorted(p.name for p in www.iterdir())))
