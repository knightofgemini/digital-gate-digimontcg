# Prova su emulatore della nuova Home (6 novembre 2026): foto nei due temi, con e senza collezione e mazzi, senza rete
# (immagini mancanti), larghezze 320/360/430 dp e testo ingrandito, più i collegamenti principali (Cerca una carta,
# Mancanti, banner in evidenza, Calendario, mazzo). Foto in OUT con il prefisso "h".
# Uso: python3 tools/rn_home.py OUT  (adb già collegato all'emulatore, APK appena installato)
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


def size():
    m = re.search(r"Override size: (\d+)x(\d+)", adb("shell", "wm", "size")) or re.search(r"(\d+)x(\d+)", adb("shell", "wm", "size"))
    return int(m.group(1)), int(m.group(2))


W, H = size()


def nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    xml = adb("shell", "cat", "/sdcard/ui.xml")
    out = []
    for n in re.finditer(r"<node [^>]*>", xml):
        s = n.group(0)
        t = re.search(r' text="([^"]*)"', s)
        d = re.search(r' content-desc="([^"]*)"', s)
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
        if b:
            out.append(((t.group(1) if t else ""), (d.group(1) if d else ""), tuple(map(int, b.groups()))))
    return out


def finds(pat, ymin=0.0, ymax=1.0):
    hits = []
    for t, d, (x1, y1, x2, y2) in nodes():
        if (re.search(pat, t) or re.search(pat, d)) and y1 >= H * ymin and y2 <= H * ymax and x2 > x1 and y2 > y1:
            hits.append(((x1 + x2) // 2, (y1 + y2) // 2, (x1, y1, x2, y2)))
    return hits


def tap_at(x, y, wait=1.5):
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(wait)


def tap(pat, wait=1.5, ymin=0.0, ymax=1.0, last=False):
    h = finds(pat, ymin, ymax)
    if not h:
        print("non trovato:", pat, flush=True)
        return None
    p = h[-1] if last else h[0]
    tap_at(p[0], p[1], wait)
    return p


def back(wait=1.5):
    adb("shell", "input", "keyevent", "4")
    time.sleep(wait)


def swipe(dy, ms=700):
    y0 = int(H * 0.72)
    adb("shell", "input", "swipe", str(W // 2), str(y0), str(W // 2), str(y0 - dy), str(ms))
    time.sleep(1.4)


def top():
    for _ in range(4):
        adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.3)), str(W // 2), str(int(H * 0.9)), "250")
        time.sleep(0.5)
    time.sleep(1)


def close_news():
    # riquadro "Carte nuove" (se i dati del sito sono più recenti di quelli dell'APK)
    if finds("^Carte nuove"):
        tap("^Chiudi$", wait=2)


def launch(wait=10):
    adb("shell", "am", "force-stop", PKG)
    time.sleep(1)
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
    time.sleep(wait)
    tap_at(W // 2, H // 2, 3)  # chiude l'intro
    close_news()


def pages(prefix, n=3):
    top()
    shot(prefix + "_1")
    for i in range(2, n + 1):
        swipe(int(H * 0.55))
        shot(prefix + "_%d" % i)
    top()


def tabs():
    for _ in range(6):
        if finds("^Home$", 0.85):
            return
        back()


adb("shell", "settings", "put", "secure", "show_ime_with_hard_keyboard", "1")
adb("shell", "cmd", "uimode", "night", "yes")
time.sleep(2)

# 1) primo avvio senza rete: recupero dei dati della vecchia app, nessuna immagine scaricata (illustrazioni mancanti)
adb("shell", "svc", "wifi", "disable")
adb("shell", "svc", "data", "disable")
time.sleep(2)
launch(28)
shot("h00_senza_rete")
adb("shell", "svc", "wifi", "enable")
adb("shell", "svc", "data", "enable")
time.sleep(6)

# 2) con la rete: collezione vuota e nessun mazzo
launch(14)
time.sleep(4)
pages("h01_vuota_scura")

# 3) qualche carta di EX13 e di BT26 nella collezione
for key, rounds in (("ex13", 3), ("bt26", 1)):
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "digitalgate://prodotto/" + key, PKG)
    time.sleep(5)
    for r in range(rounds):
        for x, y, _ in finds("^Una in più", 0.12, 0.74):
            tap_at(x, y, 0.8)
        swipe(int(H * 0.4))
    tabs()

# 4) un mazzo da riprendere
tap("^Mazzi$", wait=2)
tap("^Nuovo mazzo$", wait=2.5)
tap("Cerca e aggiungi carte", wait=2.5)
def edit_field():
    # campo di ricerca del foglio: l'ultimo EditText
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    xml = adb("shell", "cat", "/sdcard/ui.xml")
    m = None
    for nd in re.finditer(r"<node [^>]*>", xml):
        s = nd.group(0)
        if 'class="android.widget.EditText"' in s:
            m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
    if m:
        x1, y1, x2, y2 = map(int, m.groups())
        tap_at((x1 + x2) // 2, (y1 + y2) // 2, 0.8)


for w, n in (("Koromon", 2), ("Agumon", 4), ("Greymon", 3), ("WarGreymon", 2)):
    edit_field()
    adb("shell", "input", "keyevent", "123")
    for _ in range(3):
        adb("shell", "input", "keyevent", *(["67"] * 12))
    adb("shell", "input", "text", w)
    time.sleep(2.2)
    for _ in range(n):
        tap("^Una in più", wait=1.0)
back()
back()
tabs()
tap("^Home$", wait=2.5)

# 5) Home con collezione e mazzo, tema scuro e chiaro
pages("h02_scura")
adb("shell", "cmd", "uimode", "night", "no")
time.sleep(3)
pages("h03_chiara")

# 6) collegamenti
tap("^Cerca una carta$", wait=2.5)
shot("h10_cerca_una_carta")
back()
tabs()
tap("^Home$", wait=2)
top()
swipe(int(H * 0.3))
tap("^Mancanti", wait=3)
shot("h11_mancanti")
tabs()
tap("^Home$", wait=2)
top()
tap("^In evidenza", wait=3)
shot("h12_in_evidenza")
tabs()
tap("^Home$", wait=2)
top()
swipe(int(H * 0.55))
swipe(int(H * 0.3))
if not tap("^Calendario", wait=3):
    swipe(int(H * 0.3))
    tap("^Calendario", wait=3)
shot("h13_calendario")
tabs()
tap("^Home$", wait=2)
top()
swipe(int(H * 0.55))
swipe(int(H * 0.55))
tap("^Riprendi il mazzo ", wait=3)
shot("h14_mazzo")
tabs()
tap("^Home$", wait=2)

# 7) larghezze (dp = 1080 px * 160 / densità) e testo ingrandito
for dp, dens, fs in ((320, 540, "1.0"), (360, 480, "1.3"), (430, 402, "1.0")):
    adb("shell", "wm", "density", str(dens))
    adb("shell", "settings", "put", "system", "font_scale", fs)
    time.sleep(2)
    W, H = size()
    launch(12)
    pages("h2%d_%ddp%s" % (dp // 100, dp, "_testo130" if fs != "1.0" else ""), 3)
adb("shell", "wm", "density", "reset")
adb("shell", "settings", "put", "system", "font_scale", "1.0")
time.sleep(2)

# 8) pagina intera in un'unica foto (schermo virtuale molto alto), tema scuro e chiaro
adb("shell", "wm", "size", "1080x5600")
time.sleep(2)
W, H = 1080, 5600
launch(12)
top()
shot("h90_intera_chiara")
adb("shell", "cmd", "uimode", "night", "yes")
time.sleep(3)
shot("h91_intera_scura")
adb("shell", "wm", "size", "reset")
