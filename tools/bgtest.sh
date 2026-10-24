#!/bin/bash
# Prova su emulatore: lo scaricamento "Tutto in HD" continua a schermo spento e in risparmio profondo (Doze)?
# Parametri: $1 = APK da provare, $2 = nome della prova. Risultato in bgtest-$2.txt
APK="$1"; NAME="$2"; PKG=app.digimon.settracker; OUT="bgtest-$NAME.txt"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$OUT"; }
adb uninstall $PKG >/dev/null 2>&1
adb install -r "$APK" | tail -1
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null
adb shell dumpsys deviceidle unforce >/dev/null; adb shell dumpsys battery reset >/dev/null
adb shell input keyevent KEYCODE_WAKEUP; adb shell wm dismiss-keyguard 2>/dev/null
adb logcat -c
adb shell am start -n $PKG/.MainActivity >/dev/null; sleep 20
PID=$(adb shell pidof $PKG | tr -d '\r')
SOCK=$(adb shell cat /proc/net/unix | tr -d '\r' | grep -o "webview_devtools_remote_[0-9]*" | head -1)
log "app pid=$PID socket=$SOCK"
adb forward --remove-all; adb forward tcp:9222 localabstract:$SOCK
log "$(python3 tools/bgtest_cdp.py start)"
(adb logcat -v time -s DGBG:I > "logcat-$NAME.txt" &)
sleep 45
C0=$(python3 tools/bgtest_cdp.py count); log "a schermo acceso dopo 45 s: $C0 immagini"
# schermo spento + risparmio profondo forzato
adb shell dumpsys battery unplug; adb shell input keyevent KEYCODE_SLEEP; sleep 5
adb shell dumpsys deviceidle force-idle | tee -a "$OUT"
log "schermo spento, Doze forzato"
for i in 1 2 3 4 5 6; do
  sleep 40
  ST=$(adb shell dumpsys activity processes 2>/dev/null | tr -d '\r' | grep -A2 "sandboxed_process\|$PKG" | grep -o "procState=[A-Z_]*\|curProcState=[0-9]*\|frozen=[a-z]*" | sort | uniq -c | tr '\n' ' ')
  log "dopo $((i*40)) s a schermo spento · processi: $ST · ultima riga: $(tail -1 logcat-$NAME.txt 2>/dev/null)"
done
C1=$(timeout 20 python3 tools/bgtest_cdp.py count 2>/dev/null || echo "?")
log "subito al risveglio (senza riaccendere lo schermo): $C1 immagini"
adb shell dumpsys deviceidle unforce >/dev/null; adb shell dumpsys battery reset >/dev/null
adb shell input keyevent KEYCODE_WAKEUP
sleep 3
C2=$(python3 tools/bgtest_cdp.py count); log "schermo riacceso: $C2 immagini"
log "RISULTATO $NAME: acceso $C0 -> dopo 4 minuti spento $C1 (riacceso $C2)"
pkill -f "logcat -v time" || true
