# Prova su emulatore del riquadro "Carte nuove" (rn/src/News.tsx). L'APK ha i dati di prima degli spoiler del 3 novembre
# 2026 (prova-emulatore.yml con "novita"), così all'apertura l'app scarica dal sito i dati pubblicati e trova le carte
# arrivate da allora (BT27). Foto in OUT con il prefisso "n":
#  n1  riquadro appena scaricate (dati non ancora in uso), n2 elenco scorso
#  n3  app chiusa senza toccare niente e riaperta: riquadro subito, con le carte già in uso
#  n4  "Apri BT27" → pagina del prodotto; n5 riaperta: niente riquadro (già visto)
#  n6  dati dell'APK di nuovo (pm clear) → riquadro → tocco su una carta → riavvio veloce e scheda della carta
#  n7  di nuovo → "Mostra le carte" → riavvio veloce, senza intro, e pagina del prodotto; n8 tema chiaro
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


# testo esatto dei pulsanti (la nota sopra i pulsanti cita anche "Mostra le carte")
SHOW = r"^\s*Mostra le carte\s*$"
OPEN = r"^\s*Apri BT27\s*$"


def log(msg):
    print(msg, flush=True)


adb("shell", "cmd", "uimode", "night", "yes")
time.sleep(2)

# 1) prima apertura: dati dell'APK vecchi, quelli del sito più recenti → riquadro con "Mostra le carte"
t0 = time.time()
launch()
p = wait_for(SHOW, 60)
log("riquadro dopo %.1f s dall'apertura" % (time.time() - t0))
time.sleep(1.5)
shot("n1_riquadro")
adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.7)), str(W // 2), str(int(H * 0.3)), "700")
time.sleep(1.5)
shot("n2_scorso")

# 2) chiusa senza toccare niente e riaperta: riquadro subito (carte in uso, pulsante "Apri BT27")
stop()
t0 = time.time()
launch()
p = wait_for(OPEN, 30)
log("riquadro all'apertura dopo %.1f s" % (time.time() - t0))
time.sleep(1)
shot("n3_apertura")

# 3) "Apri BT27" → pagina del prodotto
tap(OPEN, 4)
shot("n4_prodotto")

# riaperta: niente riquadro (già visto)
stop()
launch()
time.sleep(12)
log("riquadro alla riapertura: " + ("SÌ (errore)" if find("Carte nuove|CARTE NUOVE") else "no"))
shot("n5_riaperta")

# 4) di nuovo i dati dell'APK: tocco su una carta del riquadro → riavvio veloce e scheda della carta
stop()
adb("shell", "pm", "clear", PKG)
time.sleep(2)
launch()
if wait_for(SHOW, 60):
    time.sleep(1.5)
    t0 = time.time()
    tap("Apri Kapurimon|Apri Solarmon|Apri Meramon", 6)
    shot("n6_carta")

# 5) "Mostra le carte" → riavvio veloce senza intro e pagina del prodotto
stop()
adb("shell", "pm", "clear", PKG)
time.sleep(2)
launch()
if wait_for(SHOW, 60):
    time.sleep(1.5)
    t0 = time.time()
    tap(SHOW, 0.4)
    shot("n7a_riavvio")
    time.sleep(5)
    log("pagina del prodotto dopo il riavvio: %.1f s" % (time.time() - t0))
    shot("n7_mostra")

# 6) tema chiaro: riquadro all'apertura
stop()
adb("shell", "pm", "clear", PKG)
adb("shell", "cmd", "uimode", "night", "no")
time.sleep(2)
launch()
if wait_for(SHOW, 60):
    time.sleep(1.5)
    shot("n8_chiaro")
stop()
adb("shell", "cmd", "uimode", "night", "yes")
