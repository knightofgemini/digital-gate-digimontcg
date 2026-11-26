# Prova su emulatore del simulatore (ramo `simulatore`, 26 novembre 2026). Il simulatore ha animazioni che non si
# fermano (bordi che pulsano, pulsante del turno che gira), quindi uiautomator non riesce a leggere lo schermo: niente
# ricerca dei testi, solo foto e tocchi a coordinate fisse.
# 1) partita dimostrativa (digitalgate://simulatore?demo=1: il telefono gioca da solo) fotografata di continuo, in
#    verticale e poi in orizzontale, per vedere le animazioni;
# 2) partita normale: tavolo, scheda di una carta della mano, Menu.
# Foto in OUT con il prefisso "s", poi ridotte a JPEG se c'è ImageMagick.
# Uso: python3 tools/rn_sim.py OUT  (adb già collegato all'emulatore, APK appena installato)
import glob, os, re, shutil, subprocess, sys, time

OUT = sys.argv[1]
PKG = "app.digimon.settracker"
os.makedirs(OUT, exist_ok=True)
N = [0]


def adb(*a):
    return subprocess.run(["adb", *a], capture_output=True, text=True).stdout


def shot(name):
    N[0] += 1
    with open(os.path.join(OUT, "s%03d_%s.png" % (N[0], name)), "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)
    print("foto", N[0], name, flush=True)


def size():
    out = adb("shell", "wm", "size")
    m = re.search(r"Override size: (\d+)x(\d+)", out) or re.search(r"(\d+)x(\d+)", out)
    return int(m.group(1)), int(m.group(2))


def tap(fx, fy, wait=1.2):
    W, H = size()
    if adb("shell", "settings", "get", "system", "user_rotation").strip() == "1":
        W, H = max(W, H), min(W, H)
    adb("shell", "input", "tap", str(int(W * fx)), str(int(H * fy)))
    time.sleep(wait)


def start(url):
    adb("shell", "am", "force-stop", PKG)
    time.sleep(1)
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
    time.sleep(12)
    shot("avvio")
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "'" + url + "'", PKG)
    time.sleep(2)


# permesso delle notifiche già dato: la sua finestra coprirebbe il tavolo e metterebbe l'app in pausa
adb("shell", "pm", "grant", PKG, "android.permission.POST_NOTIFICATIONS")
for k in ("animator_duration_scale", "transition_animation_scale", "window_animation_scale"):
    adb("shell", "settings", "put", "global", k, "1")
adb("shell", "settings", "put", "system", "accelerometer_rotation", "0")
adb("shell", "settings", "put", "system", "user_rotation", "0")

# 1) partita dimostrativa
start("digitalgate://simulatore?demo=1&l=v")
t0 = time.time()
while time.time() - t0 < 110:
    shot("demo_v")
# orizzontale scelto dal collegamento (?l=h: come Menu → Disposizione → Orizzontale)
start("digitalgate://simulatore?demo=1&l=h")
t0 = time.time()
while time.time() - t0 < 130:
    shot("demo_h")

# 2) partita normale
start("digitalgate://simulatore?l=v")
for k in range(4):  # moneta, mescolamento, pesca
    time.sleep(2.5)
    shot("preparazione%d" % k)
time.sleep(4)
shot("mulligan")
tap(0.38, 0.61)  # "Keep hand"
burst_t = time.time()
while time.time() - burst_t < 6:
    shot("sicurezza")
shot("normale")
for i in range(8):  # aspetta il proprio turno (l'avversario può iniziare)
    time.sleep(3)
shot("normale_turno")
tap(0.5, 0.92)  # carta al centro della mano
shot("scheda_carta")
tap(0.5, 0.08)  # tocco sul fondo scuro: chiude
# trascinamento: carte della mano trascinate sul proprio campo (gioca o digievolvi), foto mentre il dito si muove
def drag(x1, y1, x2, y2, name, ms=1400):
    W, H = size()
    pr = subprocess.Popen(["adb", "shell", "input", "swipe", str(int(W * x1)), str(int(H * y1)), str(int(W * x2)), str(int(H * y2)), str(ms)])
    time.sleep(ms / 1000 * 0.6)
    shot(name)
    pr.wait()
    time.sleep(0.3)
    shot(name + "_lasciata")
    time.sleep(4)


tap(0.87, 0.4225, 2)  # Avanti (fase di allevamento)
shot("prima_del_trascinamento")
for k, hx in enumerate((0.5, 0.38, 0.62)):
    drag(hx, 0.92, 0.5, 0.56, "trascina_mano%d" % k)
# attacco trascinando il primo Digimon del campo sulla Sicurezza avversaria (scudo in alto a destra)
drag(0.12, 0.6, 0.92, 0.18, "trascina_attacco")
time.sleep(4)
shot("dopo_attacco")
tap(0.91, 0.082)  # Menu
shot("menu")
tap(0.5, 0.06)
start("digitalgate://simulatore?l=h")
time.sleep(20)
shot("normale_orizzontale")
tap(0.85, 0.9)  # carta della mano in basso a destra
shot("scheda_orizzontale")
adb("shell", "settings", "put", "system", "user_rotation", "0")
time.sleep(2)

if shutil.which("mogrify"):
    subprocess.run(["mogrify", "-resize", "50%", "-quality", "72", "-format", "jpg", *glob.glob(os.path.join(OUT, "s*.png"))])
    for f in glob.glob(os.path.join(OUT, "s*.png")):
        os.remove(f)
print("fatto", N[0], "foto", flush=True)
