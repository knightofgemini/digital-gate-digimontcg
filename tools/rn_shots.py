# Foto della nuova app (React Native) su emulatore: apre le schede carta indicate con il collegamento
# digitalgate://carta/<chiave>, scorre e fotografa; tocca una keyword (se indicata) per mostrarne la spiegazione.
# Uso: python3 tools/rn_shots.py OUT "chiave[@keyword],..."  (adb già collegato all'emulatore)
import os, re, subprocess, sys, time, urllib.parse

OUT = sys.argv[1]
SPECS = [x for x in sys.argv[2].split(",") if x]
PKG = "app.digimon.settracker"
os.makedirs(OUT, exist_ok=True)


def adb(*a, check=False):
    return subprocess.run(["adb", *a], capture_output=True, text=True, check=check).stdout


def shot(name):
    with open(os.path.join(OUT, name + ".png"), "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)
    print("foto", name, flush=True)


def size():
    m = re.search(r"(\d+)x(\d+)", adb("shell", "wm", "size"))
    return int(m.group(1)), int(m.group(2))


W, H = size()


def swipe_up(px):
    adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.8)), str(W // 2), str(int(H * 0.8) - px), "900")
    time.sleep(1.2)


def tap_text(word):
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    xml = adb("shell", "cat", "/sdcard/ui.xml")
    for m in re.finditer(r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
        t, x1, y1, x2, y2 = m.group(1), *map(int, m.groups()[1:])
        # "~testo": basta che la scritta contenga il testo (domande lunghe)
        if (word[1:] in t if word.startswith("~") else t.strip() == word) and y1 > H * 0.12 and y2 < H * 0.88:
            adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
            time.sleep(1.2)
            return True
    print("keyword non trovata:", word, flush=True)
    return False


# avvio (tema scuro come le foto della vecchia app): intro e recupero dati
adb("shell", "cmd", "uimode", "night", "yes")
time.sleep(2)
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
time.sleep(25)
adb("shell", "input", "tap", str(W // 2), str(H // 2))
time.sleep(4)
shot("00_avvio")

for i, spec in enumerate(SPECS):
    key, _, kw = spec.partition("@")
    name = "%02d_%s" % (i + 1, re.sub(r"[^A-Za-z0-9_-]+", "_", key.split("|")[-1]))
    # "pagina:regole" apre una pagina dell'app invece di una carta
    url = "digitalgate://" + key[7:] if key.startswith("pagina:") else "digitalgate://carta/" + urllib.parse.quote(key, safe="")
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "'" + url + "'", PKG)
    time.sleep(7)
    shot(name + "_1")
    if key.startswith("pagina:") and kw:
        # pagina: prima i tocchi (separati da "+"; "%x;y" = punto dello schermo in frazioni), poi si scorre
        for j, w in enumerate(kw.split("+")):
            if w.startswith("%"):
                fx, fy = map(float, w[1:].split(";"))
                adb("shell", "input", "tap", str(int(W * fx)), str(int(H * fy)))
                time.sleep(1.2)
            else:
                tap_text(w)
            shot(name + "_kw" + ("" if not j else str(j)))
        kw = ""
    swipe_up(int(H * 0.38))
    shot(name + "_2")
    swipe_up(int(H * 0.45))
    shot(name + "_3")
    # più in basso (domande e risposte ufficiali, 27 novembre 2026)
    for k in (4, 5, 6):
        swipe_up(int(H * 0.5))
        shot(name + "_%d" % k)
    if kw:
        # torna alla prima foto con la keyword e la tocca
        for _ in range(3):
            if tap_text(kw):
                shot(name + "_kw")
                break
            adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.3)), str(W // 2), str(int(H * 0.6)), "700")
            time.sleep(1)
    adb("shell", "input", "keyevent", "4")
    time.sleep(2)

# tema chiaro: la prima carta di nuovo
adb("shell", "cmd", "uimode", "night", "no")
time.sleep(3)
if SPECS:
    key = SPECS[0].partition("@")[0]
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "'digitalgate://carta/" + urllib.parse.quote(key, safe="") + "'", PKG)
    time.sleep(7)
    swipe_up(int(H * 0.38))
    shot("99_chiaro")
