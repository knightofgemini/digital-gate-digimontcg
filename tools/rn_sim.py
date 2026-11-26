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
    # richiesta del permesso delle notifiche: "Non consentire" a coordinate (finestra di sistema al centro in basso)
    shot("avvio")
    adb("shell", "input", "keyevent", "4")
    time.sleep(1)
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "'" + url + "'", PKG)
    time.sleep(2)


for k in ("animator_duration_scale", "transition_animation_scale", "window_animation_scale"):
    adb("shell", "settings", "put", "global", k, "1")
adb("shell", "settings", "put", "system", "accelerometer_rotation", "0")
adb("shell", "settings", "put", "system", "user_rotation", "0")

# 1) partita dimostrativa
start("digitalgate://simulatore?demo=1")
t0 = time.time()
while time.time() - t0 < 130:
    shot("demo_v")
adb("shell", "settings", "put", "system", "user_rotation", "1")
time.sleep(2)
t0 = time.time()
while time.time() - t0 < 110:
    shot("demo_h")
adb("shell", "settings", "put", "system", "user_rotation", "0")
time.sleep(2)

# 2) partita normale
start("digitalgate://simulatore")
time.sleep(10)
shot("normale")
for i in range(8):  # aspetta il proprio turno (l'avversario può iniziare)
    time.sleep(3)
shot("normale_turno")
tap(0.5, 0.92)  # carta al centro della mano
shot("scheda_carta")
tap(0.5, 0.08)  # tocco sul fondo scuro: chiude
tap(0.91, 0.082)  # Menu
shot("menu")
tap(0.5, 0.06)
adb("shell", "settings", "put", "system", "user_rotation", "1")
time.sleep(3)
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
