# Prova della scansione senza rete sull'emulatore (prova-emulatore.yml con "scansione"): l'app deve preparare il motore
# di lettura dai file dentro l'APK (niente internet) e leggere una foto della carta scelta da "Usa una foto".
# Uso: python3 tools/rn_scan.py OUT  (adb già collegato, APK installato, carta.jpg nella cartella corrente)
import os, re, subprocess, sys, time

OUT = sys.argv[1]
PKG = "app.digimon.settracker"
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "scansione.txt"), "w")


def say(*a):
    print(*a, flush=True)
    print(*a, file=LOG, flush=True)


def adb(*a):
    return subprocess.run(["adb", *a], capture_output=True, text=True).stdout


def shot(name):
    with open(os.path.join(OUT, name + ".png"), "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)
    say("foto", name)


def nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    xml = adb("shell", "cat", "/sdcard/ui.xml")
    out = []
    for m in re.finditer(r'<node [^>]*>', xml):
        n = m.group(0)
        g = lambda k: (re.search(k + r'="([^"]*)"', n) or [None, ""])[1]
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        out.append({"text": g("text"), "desc": g("content-desc"), "cls": g("class"), "pkg": g("package"), "b": tuple(map(int, b.groups())) if b else None})
    return out


def texts():
    return [n["text"] for n in nodes() if n["text"].strip()]


def tap(n):
    x1, y1, x2, y2 = n["b"]
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


# avvio con la rete (intro e prima apertura), permesso della fotocamera già dato
adb("logcat", "-c")
adb("shell", "pm", "grant", PKG, "android.permission.CAMERA")
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
time.sleep(25)
W, H = map(int, re.search(r"(\d+)x(\d+)", adb("shell", "wm", "size")).groups())
adb("shell", "input", "tap", str(W // 2), str(H // 2))
time.sleep(3)
shot("00_avvio")

# foto della carta nella galleria
adb("push", "carta.jpg", "/sdcard/Pictures/carta.jpg")
adb("shell", "content", "call", "--uri", "content://media", "--method", "scan_volume", "--arg", "external_primary")
adb("shell", "am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", "file:///sdcard/Pictures/carta.jpg")
time.sleep(3)

# niente rete: modalità aereo, Wi-Fi e dati spenti
adb("shell", "cmd", "connectivity", "airplane-mode", "enable")
adb("shell", "svc", "wifi", "disable")
adb("shell", "svc", "data", "disable")
time.sleep(4)
say("rete:", adb("shell", "ping", "-c", "1", "-W", "2", "8.8.8.8").strip().splitlines()[-1:] or "nessuna risposta")

# apertura della scansione: il motore deve essere pronto senza rete
adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "'digitalgate://scansiona'", PKG)
pronto = False
for i in range(30):
    time.sleep(2)
    t = texts()
    if any("Non riesco ad aprire la fotocamera" in x or "Inquadra la carta" in x for x in t):
        pronto = True
        break
    if any("Non riesco a preparare" in x for x in t):
        break
say("stato dopo %d s:" % (2 * (i + 1)), [x for x in t if len(x) > 12][:4])
shot("01_scansione")
say("RISULTATO motore senza rete:", "PRONTO" if pronto else "NON PRONTO")

# lettura di una foto scelta con "Usa una foto"
f = [n for n in nodes() if "foto" in n["text"].lower() and "usa" in n["text"].lower()]
if not f:
    say("pulsante Usa una foto non trovato:", texts()[:12])
else:
    tap(f[0])
    time.sleep(5)
    shot("02_galleria")
    say("in primo piano:", [l.strip() for l in adb("shell", "dumpsys", "activity", "activities").splitlines() if "topResumedActivity" in l or "ResumedActivity:" in l][:3])
    say("chiusure dell'app:", adb("logcat", "-d", "-b", "crash")[-3000:] or "nessuna")
    say("registro:", "\n".join([l for l in adb("logcat", "-d").splitlines() if re.search(r"FATAL|AndroidRuntime|ImagePicker|PhotoPicker|photopicker|PICK_IMAGES|ActivityTaskManager: START", l)][-25:]))
    ns = nodes()
    pics = [n for n in ns if n["b"] and (re.search(r"(Photo|Foto|Image|Immagine)", n["desc"]) or n["cls"].endswith("ImageView")) and n["pkg"] != PKG and (n["b"][2] - n["b"][0]) > 150]
    say("immagini nella galleria:", len(pics), [p["desc"][:40] for p in pics[:3]])
    if pics:
        tap(pics[0])
        time.sleep(3)
        # alcune gallerie chiedono di confermare la scelta
        ok = [n for n in nodes() if n["text"].strip().lower() in ("done", "fine", "ok", "add", "aggiungi", "select", "seleziona")]
        if ok:
            tap(ok[0])
        for i in range(20):
            time.sleep(2)
            t = texts()
            if not any("Leggo la foto" in x for x in t):
                break
        shot("03_risultato")
        letto = [x for x in t if re.search(r"BT10-086|Imperialdramon|Non ho riconosciuto|Non riesco", x)]
        say("testi dopo la foto:", t[:16])
        say("RISULTATO lettura della foto:", letto[:3] or "nessun testo atteso")

adb("shell", "cmd", "connectivity", "airplane-mode", "disable")
