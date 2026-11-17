# Fluidità dell'intro all'avvio (17 novembre 2026, segnalato dall'utente: la parte finale va a scatti).
# 1 avvio di riscaldamento + 6 avvi a freddo: fotogrammi lenti dall'avvio a 7 s (intro + primi istanti della Home)
# e, con framestats, i fotogrammi più lunghi dell'ultimo tratto.
import os, re, subprocess, sys, time
sys.argv = [sys.argv[0], sys.argv[1]]
exec(open(os.path.join(os.path.dirname(__file__), "rn_perf_base.py")).read())

for k in ("animator_duration_scale", "transition_animation_scale", "window_animation_scale"):
    adb("shell", "settings", "put", "global", k, "1")
adb("shell", "settings", "put", "global", "hide_error_dialogs", "1")


def launch_once(n, wait):
    adb("shell", "am", "force-stop", PKG)
    time.sleep(2)
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
    time.sleep(wait)


launch_once(0, 25)
for _ in range(3):
    if not tap("^(Don.t allow|Allow|Non consentire|Consenti|Chiudi)$"):
        break
launch_once(0, 20)
calm()
tot = []
for n in range(1, 7):
    launch_once(n, 7)
    g = gfx()
    fs = adb("shell", "dumpsys", "gfxinfo", PKG, "framestats")
    durs = []
    for line in fs.splitlines():
        p = line.split(",")
        if len(p) > 14 and p[0] == "0" and p[1].isdigit():
            try:
                durs.append((int(p[13]) - int(p[1])) / 1e6)  # FrameCompleted - IntendedVsync
            except ValueError:
                pass
    long = sorted(durs, reverse=True)[:5]
    say("avvio %d: fotogrammi %s, lenti %s, 90/99 %s/%s, i 5 più lunghi (ms) %s" % (n, g["Total frames rendered"], g["Janky frames"], g["90th percentile"], g["99th percentile"], ", ".join("%.0f" % d for d in long)))
    if n == 1:
        shot("i_dopo")
    calm()
