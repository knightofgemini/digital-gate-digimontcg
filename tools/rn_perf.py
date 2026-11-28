# Misura della fluidità della Home (16 novembre 2026, segnalato dall'utente: animazioni appesantite).
# Uso: python3 tools/rn_perf.py OUT  (adb collegato, APK installato). Animazioni del telefono accese come su un telefono vero.
# Scrive OUT/perf.txt: CPU dell'app ferma sulla Home, fotogrammi lenti mentre si scorre (gfxinfo), per 3 giri.
import os, re, subprocess, sys, time
OUT = sys.argv[1]
PKG = "app.digimon.settracker"
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "perf.txt"), "w")


def adb(*a):
    return subprocess.run(["adb", *a], capture_output=True, text=True).stdout


def say(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    LOG.write(s + "\n")
    LOG.flush()


def size():
    out = adb("shell", "wm", "size")
    m = re.search(r"(\d+)x(\d+)", out)
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


def tap(pat):
    for t, d, (x1, y1, x2, y2) in nodes():
        if re.search(pat, t) or re.search(pat, d):
            adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
            time.sleep(2)
            return True
    return False


def calm():
    # avviso di sistema dell'emulatore ("Pixel Launcher isn't responding") che copre l'app: "Wait"
    for _ in range(3):
        if not tap(r"^(Wait|Attendi)$"):
            return


def shot(name):
    with open(os.path.join(OUT, name + ".png"), "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)


def pid():
    return adb("shell", "pidof", PKG).strip().split(" ")[0]


def cpu_ticks(p):
    s = adb("shell", "cat", "/proc/%s/stat" % p)
    f = s[s.rfind(")") + 2:].split()
    return int(f[11]) + int(f[12])  # utime + stime


def threads(p):
    # tempo di CPU per thread (mqt_js = JavaScript, RenderThread, main)
    out = {}
    for tid in adb("shell", "ls", "/proc/%s/task" % p).split():
        s = adb("shell", "cat", "/proc/%s/task/%s/stat" % (p, tid))
        if ")" not in s:
            continue
        name = s[s.find("(") + 1:s.rfind(")")]
        f = s[s.rfind(")") + 2:].split()
        out[tid] = (name, int(f[11]) + int(f[12]))
    return out


def gfx():
    s = adb("shell", "dumpsys", "gfxinfo", PKG)
    r = {}
    for k in ("Total frames rendered", "Janky frames", "50th percentile", "90th percentile", "95th percentile", "99th percentile", "Number Slow UI thread", "Number Slow bitmap uploads", "Number Slow issue draw commands", "Number Frame deadline missed"):
        m = re.search(re.escape(k) + r":\s*([^\n]+)", s)
        r[k] = m.group(1).strip() if m else "?"
    return r


def swipe_v(up=True, ms=350):
    y0, y1 = int(H * 0.75), int(H * 0.25)
    if not up:
        y0, y1 = y1, y0
    adb("shell", "input", "swipe", str(W // 2), str(y0), str(W // 2), str(y1), str(ms))


for k in ("animator_duration_scale", "transition_animation_scale", "window_animation_scale"):
    adb("shell", "settings", "put", "global", k, "1")
adb("shell", "am", "force-stop", PKG)
time.sleep(1)
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
time.sleep(15)
for _ in range(3):
    if not tap("^(Don.t allow|Allow|Non consentire|Consenti)$"):
        break
for _ in range(2):
    if not tap("^Chiudi$"):
        break
time.sleep(20)  # immagini e controlli dell'avvio
calm()
shot("p0_home")
p = pid()
say("pid", p)
HZ = 100
for giro in (1, 2, 3):
    calm()
    # 1) Home ferma per 20 s: CPU dell'app e per thread, fotogrammi disegnati
    adb("shell", "dumpsys", "gfxinfo", PKG, "reset")
    t0 = cpu_ticks(p); th0 = threads(p); time.sleep(20); t1 = cpu_ticks(p); th1 = threads(p)
    g = gfx()
    top = sorted(((th1[k][1] - th0.get(k, (0, 0))[1], th1[k][0]) for k in th1), reverse=True)[:5]
    say("giro %d FERMA 20s: CPU app %.1f%%, fotogrammi %s, lenti %s" % (giro, (t1 - t0) / HZ / 20 * 100, g["Total frames rendered"], g["Janky frames"]))
    say("   thread:", ", ".join("%s %.1f%%" % (n, d / HZ / 20 * 100) for d, n in top))
    calm()
    # 2) scorrimento della Home: 6 volte giù e su
    adb("shell", "dumpsys", "gfxinfo", PKG, "reset")
    t0 = cpu_ticks(p); th0 = threads(p); a = time.time()
    for _ in range(6):
        swipe_v(True); time.sleep(0.9)
    for _ in range(6):
        swipe_v(False); time.sleep(0.9)
    dt = time.time() - a; t1 = cpu_ticks(p); th1 = threads(p)
    g = gfx()
    top = sorted(((th1[k][1] - th0.get(k, (0, 0))[1], th1[k][0]) for k in th1), reverse=True)[:5]
    shot("g%d_dopo_scorre" % giro)
    say("pid ora", pid(), "finestra", re.findall(r"mCurrentFocus=[^\n]*", adb("shell", "dumpsys", "window"))[:1])
    say("giro %d SCORRE %.0fs: CPU app %.1f%%, fotogrammi %s, lenti %s, 50/90/95/99 %s/%s/%s/%s, UI lento %s, scadenze mancate %s" % (giro, dt, (t1 - t0) / HZ / dt * 100, g["Total frames rendered"], g["Janky frames"], g["50th percentile"], g["90th percentile"], g["95th percentile"], g["99th percentile"], g["Number Slow UI thread"], g["Number Frame deadline missed"]))
    say("   thread:", ", ".join("%s %.1f%%" % (n, d / HZ / dt * 100) for d, n in top))
    # 3) file orizzontali: In evidenza e Ultimi spoiler col dito
    adb("shell", "dumpsys", "gfxinfo", PKG, "reset")
    for y in (0.3, 0.68):
        for _ in range(3):
            adb("shell", "input", "swipe", str(int(W * 0.85)), str(int(H * y)), str(int(W * 0.15)), str(int(H * y)), "300"); time.sleep(1.2)
    g = gfx()
    say("giro %d FILE: fotogrammi %s, lenti %s, 50/90/95/99 %s/%s/%s/%s" % (giro, g["Total frames rendered"], g["Janky frames"], g["50th percentile"], g["90th percentile"], g["95th percentile"], g["99th percentile"]))
    # 4) cambio di scheda: Prodotti e ritorno alla Home
    adb("shell", "dumpsys", "gfxinfo", PKG, "reset")
    a = time.time()
    tap("^Prodotti$"); tap("^Home$")
    g = gfx()
    say("giro %d SCHEDE: fotogrammi %s, lenti %s, 90/99 %s/%s" % (giro, g["Total frames rendered"], g["Janky frames"], g["90th percentile"], g["99th percentile"]))
calm()
shot("p1_fine")
open(os.path.join(OUT, "logcat.txt"), "w").write(adb("logcat", "-d", "-t", "3000"))
open(os.path.join(OUT, "anr.txt"), "w").write(adb("shell", "dumpsys", "activity", "processes")[:20000])
for k in ("animator_duration_scale", "transition_animation_scale", "window_animation_scale"):
    adb("shell", "settings", "put", "global", k, "0")
