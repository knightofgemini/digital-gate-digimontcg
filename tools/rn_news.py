# Prova su emulatore del riquadro "Carte nuove" (rn/src/News.tsx) con le carte messe in uso ad app aperta, senza riavvio.
# L'APK ha i dati di prima degli spoiler del 3 novembre 2026 (prova-emulatore.yml con "novita"), così all'apertura l'app
# scarica dal sito i dati pubblicati e trova le carte arrivate da allora (BT27). Il primo avvio dopo l'installazione (o
# pm clear) recupera i dati della vecchia app e lì il riquadro aspetta: prima di ogni prova un avvio senza rete (prep).
# Foto in OUT con il prefisso "n":
#  n1  riquadro dopo l'apertura (stesso processo: niente riavvio), n2 elenco scorso
#  n3  tocco su una carta del riquadro → la sua scheda
#  n4  riaperta: niente riquadro (già visto)
#  n5  dati dell'APK di nuovo (pm clear) → riquadro → "Vai a BT27" → pagina del prodotto con le carte nuove
#  n6  di nuovo, app chiusa senza toccare il riquadro → riaperta: riquadro subito
#  n7  tema chiaro
#  n0  controllo in sottofondo ad app chiusa (bgTask.ts, 12 novembre 2026): notifica (n0_notifica), tocco senza rete →
#      app aperta (n0t_2s…6s) con il riquadro e le miniature scaricate in sottofondo (n0b_riquadro)
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
GO = r"^\s*(CARTE NUOVE|Carte nuove)\s*$"


def pid():
    return adb("shell", "pidof", PKG).strip()


def log(msg):
    print(msg, flush=True)


def logcat(name):
    # errori dell'app (JS e Android) dall'ultima pulizia: file in OUT e righe principali nel log della prova
    out = adb("logcat", "-d", "-v", "time", "*:W", "ReactNativeJS:V", "ActivityManager:I", "lmkd:V", "libc:V", "DEBUG:V")
    with open(os.path.join(OUT, name + ".txt"), "w") as f:
        f.write(out)
    for line in out.splitlines():
        if re.search(r"(?i)fatal|exception|ReactNativeJS|anr in|kill|died|lowmem|digimon|signal", line):
            print("  logcat:", line[:400], flush=True)
    adb("logcat", "-c")


def net(on):
    adb("shell", "svc", "wifi", "enable" if on else "disable")
    adb("shell", "svc", "data", "enable" if on else "disable")
    time.sleep(4)


def prep(clear):
    # installazione "usata": primo avvio (recupero dei dati della vecchia app) senza rete, così niente carte nuove
    stop()
    if clear:
        adb("shell", "pm", "clear", PKG)
        time.sleep(2)
    # permesso delle notifiche già dato (pm clear lo toglie), così non compare la richiesta durante le foto
    adb("shell", "pm", "grant", PKG, "android.permission.POST_NOTIFICATIONS")
    net(False)
    launch()
    time.sleep(14)
    stop()
    net(True)


adb("shell", "cmd", "uimode", "night", "yes")
time.sleep(2)
adb("logcat", "-c")

# 0) controllo in sottofondo: app aperta una volta senza rete (iscrive il compito), poi in sottofondo e processo chiuso;
# con la rete si fa partire subito il compito di Android (di solito lo decide il telefono) → notifica
prep(True)
net(False)
launch()
time.sleep(12)
adb("shell", "input", "keyevent", "3")
time.sleep(2)
adb("shell", "am", "kill", PKG)
time.sleep(2)
log("processo dopo la chiusura: " + (pid() or "nessuno"))
net(True)
def jobs_now():
    dump = adb("shell", "dumpsys", "jobscheduler")
    # Android 14: "JOB androidx.work.systemjobscheduler:u0a192/0: … app.digimon.settracker/…" (spazio dei nomi : utente/numero)
    return sorted(set(re.findall(r"JOB #?(?:([\w.]+):)?\S+?/(\d+): \S+ @?[\w.@]*?" + re.escape(PKG) + "/", dump)))


def bglog():
    for line in adb("logcat", "-d", "-s", "ReactNativeJS:V").splitlines():
        if "[bg]" in line:
            log("  " + line[:200])


NOTE = r"carte nuove|carta nuova|carte corrette|carta corretta"
note = None
adb("shell", "cmd", "statusbar", "expand-notifications")
for tries in range(3):
    jobs = jobs_now()
    log("compiti di Android dell'app: " + (", ".join(ns + "/" + j for ns, j in jobs) or "NESSUNO"))
    for ns, j in jobs:
        log("  run " + j + ": " + adb("shell", "cmd", "jobscheduler", "run", "-f", *(["-n", ns] if ns else []), PKG, j).strip())
    note = wait_for(NOTE, 30)
    if note:
        break
bglog()
log("notifica: " + ("sì" if note else "NESSUNA") + " · processo " + (pid() or "nessuno"))
logcat("logcat0")
shot("n0_notifica")
if note:
    # senza rete: le miniature del riquadro devono venire dalle immagini scaricate in sottofondo; foto a 2, 3, 4 e 6 s
    # dal tocco per vedere quando compare il riquadro rispetto all'intro
    time.sleep(20)
    net(False)
    adb("shell", "cmd", "statusbar", "expand-notifications")
    time.sleep(2)
    note = find(NOTE) or note
    adb("shell", "input", "tap", str(note[0]), str(note[1]))
    t0 = time.time()
    for sec in (2, 3, 4, 6):
        time.sleep(max(0, t0 + sec - time.time()))
        shot("n0t_%ds" % sec)
    if wait_for(GO, 60):
        log("riquadro dopo il tocco sulla notifica: %.1f s" % (time.time() - t0))
        time.sleep(1.5)
        shot("n0b_riquadro")
adb("shell", "cmd", "statusbar", "collapse")
net(True)

# 1) apertura con l'app già usata: dati dell'APK vecchi, quelli del sito più recenti → carte in uso e riquadro, nello
# stesso processo (niente riavvio)
prep(True)
t0 = time.time()
launch()
time.sleep(1)
p0 = pid()
seen = None
for i in range(30):
    time.sleep(1.5)
    if not pid():
        log("app chiusa dopo %.1f s" % (time.time() - t0))
        shot("n0_chiusa")
        break
    if find(GO):
        seen = time.time() - t0
        break
log("riquadro %s · processo %s → %s (%s)" % ("dopo %.1f s dall'apertura" % seen if seen else "NON COMPARSO", p0, pid(), "nessun riavvio" if p0 == pid() else "RIAVVIATA O CHIUSA"))
time.sleep(1.5)
shot("n1_riquadro")
logcat("logcat1")
adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.7)), str(W // 2), str(int(H * 0.3)), "700")
time.sleep(1.5)
shot("n2_scorso")

# 2) tocco su una carta del riquadro → scheda della carta (già con i dati nuovi)
adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.3)), str(W // 2), str(int(H * 0.8)), "500")
time.sleep(1)
tap("Apri Kapurimon|Apri Solarmon|Apri Meramon|Apri Spinomon", 4)
shot("n3_carta")
adb("shell", "input", "keyevent", "4")
time.sleep(2)
shot("n3b_dopo")

# riaperta: niente riquadro (già visto), carte nuove già in uso
stop()
launch()
time.sleep(12)
log("riquadro alla riapertura: " + ("SÌ (errore)" if find(GO) else "no"))
shot("n4_riaperta")

# 3) di nuovo i dati dell'APK: "Vai a BT27" → pagina del prodotto con le carte nuove
prep(True)
launch()
if wait_for(GO, 60):
    time.sleep(1.5)
    tap(GO, 4)
    shot("n5_prodotto")
    adb("shell", "input", "swipe", str(W // 2), str(int(H * 0.75)), str(W // 2), str(int(H * 0.3)), "700")
    time.sleep(1.5)
    shot("n5b_prodotto")

# 4) app chiusa senza toccare il riquadro → riaperta: riquadro subito, con le carte già in uso
prep(True)
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
logcat("logcat2")

# 5) tema chiaro
adb("shell", "cmd", "uimode", "night", "no")
prep(True)
launch()
if wait_for(GO, 60):
    time.sleep(1.5)
    shot("n7_chiaro")
stop()
adb("shell", "cmd", "uimode", "night", "yes")
