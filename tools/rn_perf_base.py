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


RAW = open(os.path.join(OUT, "gfx_raw.txt"), "w")


def gfx():
    s = adb("shell", "dumpsys", "gfxinfo", PKG)
    RAW.write(s[:1500] + "\n-----\n")
    RAW.flush()
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




def setup():
    for k in ("animator_duration_scale", "transition_animation_scale", "window_animation_scale"):
        adb("shell", "settings", "put", "global", k, "1")
    # niente finestre "… isn't responding" dell'emulatore sopra l'app (bloccano i gesti e falsano la misura)
    adb("shell", "settings", "put", "global", "hide_error_dialogs", "1")
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
