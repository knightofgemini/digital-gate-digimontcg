# Prova su emulatore della nuova Home (6 novembre 2026): foto nei due temi, con e senza collezione e mazzi, senza rete
# (immagini mancanti), larghezze 320/360/390/430 dp e testo ingrandito, file scorrevoli e collegamenti principali (banner,
# Mancanti, banner in evidenza, Calendario, mazzo). Foto in OUT con il prefisso "h"; "h9x_intera_*" = pagina intera
# (schermo virtuale alto 5600 px).
# Uso: python3 tools/rn_home.py OUT  (adb già collegato all'emulatore, APK appena installato)
# Di solito prova rapida (7 novembre 2026, per accorciare i tempi): solo tema scuro con collezione e mazzo, pagina
# intera e banner in evidenza. Con HOME_COMPLETA=1 (prova-emulatore.yml con "completa") anche senza rete, collezione
# vuota, tema chiaro, collegamenti e larghezze.
import os, re, subprocess, sys, time
FULL = os.environ.get("HOME_COMPLETA") == "1"

OUT = sys.argv[1]
PKG = "app.digimon.settracker"
os.makedirs(OUT, exist_ok=True)


def adb(*a):
    return subprocess.run(["adb", *a], capture_output=True, text=True).stdout


def shot(name):
    nodes()  # chiude prima eventuali avvisi di sistema dell'emulatore
    with open(os.path.join(OUT, name + ".png"), "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)
    print("foto", name, flush=True)


def size():
    out = adb("shell", "wm", "size")
    m = re.search(r"Override size: (\d+)x(\d+)", out) or re.search(r"(\d+)x(\d+)", out)
    return int(m.group(1)), int(m.group(2))


W, H = size()


def nodes():
    # a volte uiautomator non trova lo schermo fermo (immagini che compaiono): si riprova
    for _ in range(4):
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
        xml = adb("shell", "cat", "/sdcard/ui.xml")
        out = []
        for n in re.finditer(r"<node [^>]*>", xml):
            s = n.group(0)
            t = re.search(r' text="([^"]*)"', s)
            d = re.search(r' content-desc="([^"]*)"', s)
            c = re.search(r' class="([^"]*)"', s)
            b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
            if b:
                out.append(((t.group(1) if t else ""), (d.group(1) if d else ""), (c.group(1) if c else ""), tuple(map(int, b.groups()))))
        # avviso di sistema dell'emulatore ("Pixel Launcher isn't responding"): "Wait" e si rilegge lo schermo
        if any(re.search(r"isn.t responding|non risponde", t) for t, _, _, _ in out):
            for t, _, _, (x1, y1, x2, y2) in out:
                if t in ("Wait", "Attendi"):
                    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
                    print("chiuso un avviso di sistema", flush=True)
                    time.sleep(1.5)
                    break
            continue
        if out:
            return out
        time.sleep(1.5)
    print("uiautomator: schermo non letto", flush=True)
    return []


def finds(pat, ymin=0.0, ymax=1.0, cls=None):
    hits = []
    for t, d, c, (x1, y1, x2, y2) in nodes():
        ok = (c == cls) if cls else (re.search(pat, t) or re.search(pat, d))
        if ok and y1 >= H * ymin and y2 <= H * ymax and x2 > x1 and y2 > y1:
            hits.append(((x1 + x2) // 2, (y1 + y2) // 2))
    return hits


def tap_at(x, y, wait=1.5):
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(wait)


def tap(pat, wait=1.5, ymin=0.0, ymax=1.0):
    h = finds(pat, ymin, ymax)
    if not h:
        print("non trovato:", pat, flush=True)
        return None
    tap_at(h[0][0], h[0][1], wait)
    return h[0]


def back(wait=1.5):
    adb("shell", "input", "keyevent", "4")
    time.sleep(wait)


def swipe(frac, ms=700):
    y0 = int(H * 0.72)
    adb("shell", "input", "swipe", str(W // 2), str(y0), str(W // 2), str(y0 - int(H * frac)), str(ms))
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


def launch(wait=12):
    # niente tocco per chiudere l'intro (sparisce da sola in poco più di un secondo): toccando al centro si aprirebbe il
    # banner in evidenza
    adb("shell", "am", "force-stop", PKG)
    time.sleep(1)
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
    time.sleep(wait)
    close_news()


def pages(prefix, n=3):
    top()
    shot(prefix + "_1")
    for i in range(2, n + 1):
        swipe(0.55)
        shot(prefix + "_%d" % i)
    top()


def tabs():
    for _ in range(6):
        if finds("^Home$", 0.85):
            return
        back()


def home():
    tabs()
    tap("^Home$", wait=2)
    top()


def full(name):
    # pagina intera: schermo virtuale alto, la Home si ridisegna senza riavvio
    global W, H
    adb("shell", "wm", "size", "1080x5600")
    time.sleep(4)
    W, H = size()
    top()
    shot(name)
    adb("shell", "wm", "size", "reset")
    time.sleep(4)
    W, H = size()


adb("shell", "settings", "put", "secure", "show_ime_with_hard_keyboard", "1")
adb("shell", "cmd", "uimode", "night", "yes")
time.sleep(2)

if not FULL:
    launch(16)
# 1) primo avvio senza rete: recupero dei dati della vecchia app, nessuna immagine scaricata (illustrazioni mancanti)
if FULL:
    adb("shell", "svc", "wifi", "disable")
    adb("shell", "svc", "data", "disable")
    time.sleep(2)
    launch(28)
    shot("h00_senza_rete")
    adb("shell", "svc", "wifi", "enable")
    adb("shell", "svc", "data", "enable")
    time.sleep(6)

    # 2) con la rete: collezione vuota e nessun mazzo
    launch(16)
    pages("h01_vuota_scura")
    full("h95_intera_vuota_scura")

# 3) qualche carta di EX13 e di BT26 nella collezione (pagina del prodotto con la ricerca del suo codice: senza
#    intestazione le carte sono subito in vista)
for key, rounds in (("ex13", 4), ("bt26", 2)) if FULL else (("ex13", 2),):
    url = "digitalgate://prodotto/%s?q=%s" % (key, key)
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "'" + url + "'", PKG)
    time.sleep(6)
    shot("h04_" + key)
    n = 0
    for r in range(rounds):
        for x, y in finds("^Una in più", 0.12, 0.72):
            tap_at(x, y, 0.8)
            n += 1
        swipe(0.4)
    print(key, "carte aggiunte:", n, flush=True)
    back()
    tabs()

# 4) un mazzo da riprendere
tap("^Mazzi$", wait=2)
tap("^Nuovo mazzo$", wait=2.5)
tap("Cerca e aggiungi carte", wait=2.5)
for w, n in (("Koromon", 2), ("Agumon", 4), ("Greymon", 3), ("WarGreymon", 2)) if FULL else (("Agumon", 4),):
    f = finds("", cls="android.widget.EditText")
    if f:
        tap_at(f[-1][0], f[-1][1], 0.8)
    adb("shell", "input", "keyevent", "123")
    for _ in range(3):
        adb("shell", "input", "keyevent", *(["67"] * 12))
    adb("shell", "input", "text", w)
    time.sleep(2.2)
    for _ in range(n):
        tap("^Una in più", wait=1.0)
back()
back()
home()

# 5) Home con collezione e mazzo, tema scuro e chiaro (anche a pagina intera)
pages("h02_scura")
full("h91_intera_scura")
if FULL:
    adb("shell", "cmd", "uimode", "night", "no")
    time.sleep(3)
    pages("h03_chiara")
    full("h90_intera_chiara")

# 6) collegamenti e file scorrevoli
def hswipe(y, n=1):
    for _ in range(n):
        adb("shell", "input", "swipe", str(int(W * 0.85)), str(y), str(int(W * 0.15)), str(y), "350")
        time.sleep(1.6)


home()
h = finds("^(nuovi spoiler|in arrivo|uscito di recente):")
if h:
    for i in range(1, 6):
        shot("h15_evidenza_%d" % i)
        hswipe(h[0][1])
if not FULL:
    sys.exit(0)
home()
tap("^nuovi spoiler:", wait=3)
shot("h12_in_evidenza")
home()
for _ in range(4):
    if tap("Ti mancan", wait=3, ymax=0.85):
        break
    swipe(0.35)
shot("h11_mancanti")
home()
for _ in range(4):
    r = finds("^EX13 Chivalrous XIII, nuovo", ymax=0.85)
    if r:
        hswipe(r[0][1], 2)
        shot("h16_recenti_scorsi")
        break
    swipe(0.35)
home()
for _ in range(4):
    if tap("^Calendario", wait=3, ymax=0.85):
        break
    swipe(0.35)
shot("h13_calendario")
home()
for _ in range(5):
    if tap("^Riprendi il mazzo ", wait=3, ymax=0.9):
        break
    swipe(0.35)
shot("h14_mazzo")
home()

# 7) larghezze (dp = 1080 px * 160 / densità) e testo ingrandito, tema chiaro
for dp, dens, fs in ((320, 540, "1.0"), (360, 480, "1.3"), (390, 443, "1.0"), (430, 402, "1.0")):
    adb("shell", "wm", "density", str(dens))
    adb("shell", "settings", "put", "system", "font_scale", fs)
    time.sleep(2)
    launch(12)
    pages("h2_%ddp%s" % (dp, "_testo130" if fs != "1.0" else ""), 3)
adb("shell", "wm", "density", "reset")
adb("shell", "settings", "put", "system", "font_scale", "1.0")
