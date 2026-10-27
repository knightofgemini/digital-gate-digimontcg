# Prova dei gesti della nuova app (React Native) su emulatore, dopo tools/rn_shots.py (app già avviata):
# scheda carta tirata giù (a metà e fino a chiuderla), Alt-Art di un altro prodotto (chiudendo si va a quel prodotto),
# fila delle versioni centrata, foglio di ricerca del mazzo trascinato (alto / chiuso), pila inquadrata,
# tendina dei Filtri tirata giù, cronologia della scansione tirata giù. Foto in OUT con il prefisso "g".
# Uso: python3 tools/rn_gestures.py OUT
import json, os, re, subprocess, sys, time, urllib.parse

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


def find(pat, last=False):
    hits = [(x1, y1, x2, y2) for t, d, (x1, y1, x2, y2) in nodes() if re.search(pat, t) or re.search(pat, d)]
    if not hits:
        print("non trovato:", pat, flush=True)
        return None
    x1, y1, x2, y2 = hits[-1] if last else hits[0]
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap(pat, last=False, wait=1.5):
    p = find(pat, last)
    if p:
        adb("shell", "input", "tap", str(p[0]), str(p[1]))
        time.sleep(wait)
    return p


def link(path):
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "'digitalgate://" + path + "'", PKG)
    time.sleep(6)


def card(key):
    link("carta/" + urllib.parse.quote(key, safe=""))


def hold_drag(x, y0, y1, name=None, release=True, steps=12):
    # dito appoggiato, spostato a passi; foto con il dito ancora giù, poi (se indicato) rilascio
    adb("shell", "input", "motionevent", "DOWN", str(x), str(y0))
    for i in range(1, steps + 1):
        adb("shell", "input", "motionevent", "MOVE", str(x), str(int(y0 + (y1 - y0) * i / steps)))
        time.sleep(0.03)
    time.sleep(0.4)
    if name:
        shot(name)
    if release:
        adb("shell", "input", "motionevent", "UP", str(x), str(y1))
        time.sleep(1.5)


def back():
    adb("shell", "input", "keyevent", "4")
    time.sleep(1.5)


def tabs():
    # torna alle schede principali (la barra in basso con "Carte")
    for _ in range(5):
        if find("^Carte$"):
            return
        back()


adb("shell", "cmd", "uimode", "night", "yes")
time.sleep(2)
tabs()

# --- 6) Salva in… (preferite) tirato giù dal contenuto
card("bt5|BT5-109")
adb("logcat", "-c")
tap("Liste e avviso di prezzo", wait=3.5)
shot("g18b_salva_in")
for n in nodes():
    if "Salva" in n[0] or "Preferite" in n[0]:
        print("nodo", n, flush=True)
open(os.path.join(OUT, "logcat.txt"), "w").write(adb("logcat", "-d", "-s", "ReactNativeJS:V"))
hold_drag(W // 2, int(H * 0.75), int(H * 0.97), steps=8)
shot("g18c_salva_in_chiuso")
tabs()

# --- 1) scheda carta tirata giù: sotto si vede Ricerca carte
tap("^Carte$")
card("bt5|BT5-109")
shot("g01_scheda")
hold_drag(W // 2, int(H * 0.07), int(H * 0.45), "g02_tirata_meta", release=False)
# torna un po' su e rilascia: la scheda torna al suo posto
for y in (0.35, 0.2, 0.1):
    adb("shell", "input", "motionevent", "MOVE", str(W // 2), str(int(H * y)))
    time.sleep(0.05)
adb("shell", "input", "motionevent", "UP", str(W // 2), str(int(H * 0.1)))
time.sleep(1.5)
shot("g03_tornata")
# dal contenuto (pagina in cima): a metà la scheda segue il dito, poi fino in fondo si chiude
hold_drag(W // 2, int(H * 0.35), int(H * 0.6), "g03b_tirata_dal_contenuto", release=False)
for y in (0.7, 0.8, 0.92):
    adb("shell", "input", "motionevent", "MOVE", str(W // 2), str(int(H * y)))
    time.sleep(0.05)
adb("shell", "input", "motionevent", "UP", str(W // 2), str(int(H * 0.92)))
time.sleep(1.5)
time.sleep(1)
shot("g04_chiusa")

# --- 2) Alt-Art di un altro prodotto: chiudendo si va a quel prodotto
card("bt11|BT11-064")
tap("^BT25")
shot("g05_altart_bt25")
tap("^Chiudi$", wait=2.5)
shot("g06_dopo_chiusura_bt25")
back()
shot("g07_indietro")

# --- 3) fila delle versioni: aprendo un'Alt-Art in fondo alla fila la fila scorre fino a lei
d = json.load(open("src/data.json"))
C = d["cards"]
own, alts = {}, []
for s in d["sets"]:
    for e in s["v"]:
        if isinstance(e, int):
            own.setdefault(e, s["id"])
for s in d["sets"]:
    for e in s["v"]:
        if isinstance(e, list) and e[1] and C[e[0]][0] == "BT5-086" and own.get(e[0]) != s["id"]:
            alts.append((own[e[0]], e[1]))
if alts:
    card(alts[-1][0] + "|BT5-086~" + alts[-1][1])
    shot("g08_versioni_centrate")
    tap("^Chiudi$", wait=2.5)
    shot("g09_dopo_chiusura")

# --- 4) mazzo: foglio di ricerca e pila
tabs()
tap("^Mazzi$")
tap("^Nuovo mazzo$", wait=2.5)
tap("Cerca e aggiungi carte", wait=2)
adb("shell", "input", "text", "Agumon")
time.sleep(2)
tap("^Una in più", wait=1.5)
adb("shell", "input", "keyevent", "111")  # chiude la tastiera
time.sleep(1.5)
shot("g10_foglio_meta")
p = find("Ingrandisci o riduci la ricerca")
if p:
    hold_drag(W // 2, p[1], int(H * 0.15), "g11_foglio_tirato_su")
    shot("g12_foglio_alto")
    p = find("Ingrandisci o riduci la ricerca")
    if p:
        hold_drag(W // 2, p[1], int(H * 0.97), steps=8)
        shot("g13_foglio_chiuso")
# di nuovo: risultati in cima tirati giù fino a chiudere
tap("Cerca e aggiungi carte", wait=2)
adb("shell", "input", "text", "Gabumon")
time.sleep(2)
adb("shell", "input", "keyevent", "111")
time.sleep(1.5)
hold_drag(W // 2, int(H * 0.62), int(H * 0.8), "g13b_risultati_tirati", release=False)
for y in (0.88, 0.95):
    adb("shell", "input", "motionevent", "MOVE", str(W // 2), str(int(H * y)))
    time.sleep(0.05)
adb("shell", "input", "motionevent", "UP", str(W // 2), str(int(H * 0.95)))
time.sleep(1.5)
shot("g13c_risultati_chiuso")
tap("Agumon.*cop", wait=2)
shot("g14_pila_scelta")
back()

# --- 5) tendina dei Filtri tirata giù
tabs()
tap("^Carte$")
tap("^Filtri", wait=2)
tap("^Attributo", wait=1.5)
shot("g15_tendina")
p = find("^Vaccine$")
if p:
    hold_drag(p[0], p[1], p[1] + int(H * 0.2), "g16_tendina_tirata")
    shot("g17_tendina_chiusa")
# foglio Filtri tirato giù dal centro
hold_drag(W // 2, int(H * 0.6), int(H * 0.95), steps=8)
shot("g18_filtri_chiusi")

# --- 7) cronologia della scansione tirata giù
adb("shell", "pm", "grant", PKG, "android.permission.CAMERA")
tap("Scansiona una carta", wait=4)
tap("Cronologia", last=True, wait=2)
shot("g19_cronologia")
hold_drag(W // 2, int(H * 0.45), int(H * 0.95), steps=8)
shot("g20_cronologia_chiusa")
back()
shot("g21_fine")
