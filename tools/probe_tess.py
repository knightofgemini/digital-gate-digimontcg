#!/usr/bin/env python3
"""Prova (via analysis.yml): scarica Tesseract.js 5 dal registro npm ed elenca i file e le parti di codice che servono
per caricare il motore di lettura dai file dell'APK invece che da internet."""
import os, re, subprocess, sys, tarfile, glob

out = "analysis"; os.makedirs(out, exist_ok=True)
d = "/tmp/tess"; os.makedirs(d, exist_ok=True)
log = open(os.path.join(out, "tess.txt"), "w")
def p(*a):
    print(*a); print(*a, file=log); log.flush()

for pkg in ("tesseract.js@5", "tesseract.js-core@5", "@tesseract.js-data/eng"):
    r = subprocess.run(["npm", "pack", pkg, "--json"], cwd=d, capture_output=True, text=True)
    p("==", pkg, r.stdout[-400:], r.stderr[-300:])
for t in glob.glob(d + "/*.tgz"):
    name = os.path.basename(t)[:-4]
    with tarfile.open(t) as tf:
        tf.extractall(os.path.join(d, name))
for f in sorted(glob.glob(d + "/*/package/**/*", recursive=True)):
    if os.path.isfile(f) and ("/dist/" in f or f.endswith((".wasm.js", ".gz", ".wasm")) or "package.json" in f[-12:]):
        p(os.path.getsize(f), f.replace(d, ""))
# codice: caricamento della lingua e creazione del worker
for f in glob.glob(d + "/tesseract.js-*/package/src/**/*.js", recursive=True):
    s = open(f, encoding="utf-8").read()
    for pat in ("_lang.data", "loadAndGunzipFile", "workerBlobURL", "readCache", "langPath", "corePath", "importScripts", "fetch("):
        for m in re.finditer(re.escape(pat), s):
            a = s.rfind("\n", 0, max(0, m.start() - 300)); b = s.find("\n", m.end() + 300)
            p("----", f.replace(d, ""), pat); p(s[a:b])
            break
