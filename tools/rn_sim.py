# Prova su emulatore del simulatore (ramo `simulatore`, 26 novembre 2026): apre la schermata (digitalgate://simulatore),
# gioca qualche turno toccando come una persona (uovo, carta dalla mano, attacco, fine turno) e fotografa il tavolo
# durante le animazioni, in verticale e in orizzontale. Foto in OUT con il prefisso "s".
# Uso: python3 tools/rn_sim.py OUT  (adb già collegato all'emulatore, APK appena installato)
import os, re, subprocess, sys, time

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


def nodes():
    for _ in range(3):
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
        xml = adb("shell", "cat", "/sdcard/ui.xml")
        out = []
        for n in re.finditer(r"<node [^>]*>", xml):
            s = n.group(0)
            t = re.search(r' text="([^"]*)"', s)
            b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
            if b:
                out.append(((t.group(1) if t else ""), tuple(map(int, b.groups()))))
        if any(re.search(r"isn.t responding|non risponde", t) for t, _ in out):
            for t, (x1, y1, x2, y2) in out:
                if t in ("Wait", "Attendi"):
                    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
                    time.sleep(1.5)
            continue
        if out:
            return out
        time.sleep(1)
    return []


def find(pat):
    for t, (x1, y1, x2, y2) in nodes():
        if re.search(pat, t) and x2 > x1:
            return ((x1 + x2) // 2, (y1 + y2) // 2)
    return None


def tap_at(x, y, wait=1.0):
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(wait)


def tap(pat, wait=1.0):
    p = find(pat)
    if p:
        tap_at(p[0], p[1], wait)
    else:
        print("non trovato:", pat, flush=True)
    return p


def burst(name, n, gap=0.15):
    for i in range(n):
        shot("%s_%d" % (name, i))
        time.sleep(gap)


def my_turn(limit=90):
    # aspetta i pulsanti della fase di allevamento o la fine della partita
    t0 = time.time()
    while time.time() - t0 < limit:
        if find("^(Schiudi|Sposta in campo|Avanti)$") or find("^Nuova partita$"):
            return True
        time.sleep(2)
    return False


def turn(tag):
    if find("^Nuova partita$"):
        shot(tag + "_fine")
        return False
    if not my_turn():
        shot(tag + "_attesa")
        return True
    shot(tag + "_allevamento")
    if not tap("^Schiudi$", 0.2) and not tap("^Sposta in campo$", 0.2):
        tap("^Avanti$", 0.2)
    burst(tag + "_dopo_allev", 4)
    time.sleep(1.5)
    # carte dalla mano: si tocca la mano in basso e si sceglie la prima azione (gioca o digievolvi)
    for k in range(3):
        W, H = size_now()
        hx, hy = hand_point(W, H, k)
        tap_at(hx, hy, 1.2)
        if k == 0:
            shot(tag + "_scheda")
        p = find("^(Digievolvi|Gioca|Usa)")
        if p:
            tap_at(p[0], p[1], 0.1)
            burst(tag + "_gioca%d" % k, 6, 0.1)
            time.sleep(1.5)
            # domande degli effetti: prima scelta
            for _ in range(3):
                q = find("^(Nessuno|Non bloccare)$")
                if not find("^Chiudi$") and not q:
                    break
                if q:
                    tap_at(q[0], q[1], 1)
                else:
                    tap("^Chiudi$", 0.8)
        else:
            tap("^Chiudi$", 0.8)
        if not find("^Termina il turno$"):
            break
    # attacchi: si tocca ogni Digimon col bordo azzurro (non si sa dove: si prova il campo)
    a = find("^Attacca il giocatore$")
    if not a:
        W, H = size_now()
        for fx in (0.15, 0.3, 0.45):
            tap_at(int(W * fx), field_y(W, H), 1.0)
            a = find("^Attacca il giocatore$")
            if a:
                break
            if find("^Chiudi$"):
                tap("^Chiudi$", 0.6)
    if a:
        tap_at(a[0], a[1], 0.05)
        burst(tag + "_attacco", 14, 0.05)
        time.sleep(1)
    if find("^Termina il turno$"):
        tap("^Termina il turno$", 0.2)
        burst(tag + "_avversario", 16, 0.4)
    return True


def size_now():
    return size()


def landscape():
    W, H = size()
    return W > H


def hand_point(W, H, k):
    if landscape():
        return int(W * (0.78 + 0.05 * k)), int(H * 0.88)
    return int(W * (0.42 + 0.08 * k)), int(H * 0.9)


def field_y(W, H):
    return int(H * (0.72 if landscape() else 0.55))


for k in ("animator_duration_scale", "transition_animation_scale", "window_animation_scale"):
    adb("shell", "settings", "put", "global", k, "1")
adb("shell", "settings", "put", "system", "accelerometer_rotation", "0")
adb("shell", "settings", "put", "system", "user_rotation", "0")
adb("shell", "am", "force-stop", PKG)
time.sleep(1)
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
time.sleep(12)
for _ in range(3):
    if not tap("^(Don.t allow|Allow|Non consentire|Consenti)$", 2):
        break
if find("^Carte nuove"):
    tap("^Chiudi$", 2)
adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "digitalgate://simulatore", PKG)
burst("apertura", 6, 0.3)

# verticale
for t in range(3):
    if not turn("v%d" % t):
        break

# menu e registro
tap("^Menu$", 1.2)
shot("menu")
tap("^Chiudi$", 1)
tap("^Registro$", 1.2)
shot("registro")
tap("^Chiudi$", 1)

# orizzontale (la schermata segue il telefono)
adb("shell", "settings", "put", "system", "user_rotation", "1")
time.sleep(3)
shot("orizzontale")
for t in range(4):
    if not turn("h%d" % t):
        break
shot("orizzontale_fine")
adb("shell", "settings", "put", "system", "user_rotation", "0")
time.sleep(2)
back_ok = adb("shell", "input", "keyevent", "4")
time.sleep(2)
shot("uscita")
