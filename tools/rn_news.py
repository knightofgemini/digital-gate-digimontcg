# Prova su emulatore del riquadro "Carte nuove" (rn/src/News.tsx) con le carte messe in uso ad app aperta, senza riavvio.
# L'APK ha i dati di prima degli spoiler del 3 novembre 2026 (prova-emulatore.yml con "novita"), così all'apertura l'app
# scarica dal sito i dati pubblicati e trova le carte arrivate da allora (BT27). Foto in OUT con il prefisso "n":
#  n1  riquadro dopo l'apertura (stesso processo: niente riavvio), n2 elenco scorso
#  n3  tocco su una carta del riquadro → la sua scheda
#  n4  riaperta: niente riquadro (già visto)
#  n5  dati dell'APK di nuovo (pm clear) → riquadro → "Vai a BT27" → pagina del prodotto con le carte nuove
#  n6  di nuovo, app chiusa senza toccare il riquadro → riaperta: riquadro subito
#  n7  tema chiaro
# Uso: python3 tools/rn_news.py OUT  (adb già collegato all'emulatore, APK installato)
import os, re, subprocess, sys, time

OUT = sys.argv[1]
PKG = "app.digimon.settracker"
os.makedirs(OUT, exist_ok=True)


def adb(*a):
    return subprocess.run(["adb", *a], capture_output=True, text=True).stdout


def shot(name):
    with open(os.path.join(OUT, name + ".png"), "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)
    print("foto", name, flush=True)


m = re.search(r"(\d+)x(\d+)", adb("shell", "wm", "size"))
W, H = int(m.group(1)), int(m.group(2))


def texts():
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    xml = adb("shell", "cat", "/sdcard/ui.xml")
    out = []
    for n in re.finditer(r"<node [^>]*>", xml):
        s = n.group(0)
        t = re.search(r' text="([^"]*)"', s)
        d = re.search(r' content-desc="([^"]*)"', s)
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
        if b:
            out.append(((t.group(1) if t else "") + " " + (d.group(1) if d else ""), tuple(map(int, b.groups()))))
    return out


def find(pat):
    for t, (x1, y1, x2, y2) in texts():
        if re.search(pat, t):
            return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def wait_for(pat, secs=40):
    end = time.time() + secs
    while time.time() < end:
        p = find(pat)
        if p:
            return p
        time.sleep(1)
    print("non trovato:", pat, flush=True)
    return None


def tap(pat, wait=2.0):
    p = find(pat)
    if not p:
        print("non trovato:", pat, flush=True)
        return False
    adb("shell", "input", "tap", str(p[0]), str(p[1]))
    time.sleep(wait)
    return True


def launch():
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")


def stop():
    adb("shell", "am", "force-stop", PKG)
    time.sleep(2)


# testo esatto del pulsante in fondo al riquadro
GO = r"^\s*Vai a BT27\s*$"


def pid():
    return adb("shell", "pidof", PKG).strip()


def log(msg):
    print(msg, flush=True)


adb("shell", "cmd", "uimode", "night", "yes")
time.sleep(2)

# 1) prima apertura: dati dell'APK vecchi, quelli del sito più recenti → carte in uso e riquadro, nello stesso processo
t0 = time.time()
launch()
time.sleep(1)
p0 = pid()
wait_for(GO, 60)
log("riquadro dopo %.1f s dall'apertura · processo %s → %s (%s)" % (time.time() - t0, p0, pid(), "nessun riavvio" if p0 == pid() else "RIAVVIATA"))
time.sleep(1.5)
shot("n1_riquadro")
adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.7)), str(W // 2), str(int(H * 0.3)), "700")
time.sleep(1.5)
shot("n2_scorso")

# 2) tocco su una carta del riquadro → scheda della carta
adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.3)), str(W // 2), str(int(H * 0.8)), "500")
time.sleep(1)
tap("Apri Kapurimon|Apri Solarmon|Apri Meramon|Apri Spinomon", 4)
shot("n3_carta")

# riaperta: niente riquadro (già visto)
stop()
launch()
time.sleep(12)
log("riquadro alla riapertura: " + ("SÌ (errore)" if find(GO) else "no"))
shot("n4_riaperta")

# 3) di nuovo i dati dell'APK: "Vai a BT27" → pagina del prodotto con le carte nuove
stop()
adb("shell", "pm", "clear", PKG)
time.sleep(2)
launch()
if wait_for(GO, 60):
    time.sleep(1.5)
    tap(GO, 4)
    shot("n5_prodotto")
    adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.75)), str(W // 2), str(int(H * 0.3)), "700")
    time.sleep(1.5)
    shot("n5b_prodotto")

# 4) app chiusa senza toccare il riquadro → riaperta: riquadro subito, con le carte già in uso
stop()
adb("shell", "pm", "clear", PKG)
time.sleep(2)
launch()
if wait_for(GO, 60):
    time.sleep(1)
    stop()
    t0 = time.time()
    launch()
    wait_for(GO, 30)
    log("riquadro all'apertura successiva dopo %.1f s" % (time.time() - t0))
    time.sleep(1)
    shot("n6_apertura")

# 5) tema chiaro
stop()
adb("shell", "pm", "clear", PKG)
adb("shell", "cmd", "uimode", "night", "no")
time.sleep(2)
launch()
if wait_for(GO, 60):
    time.sleep(1.5)
    shot("n7_chiaro")
stop()
adb("shell", "cmd", "uimode", "night", "yes")
