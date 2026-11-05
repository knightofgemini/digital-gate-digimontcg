# Prova su emulatore del foglio di ricerca del mazzo con la tastiera aperta (dopo rn_shots.py, app già avviata):
# si apre a metà con la tastiera, resta a metà sopra la tastiera, la carta aggiunta viene inquadrata sopra il foglio,
# scorrendo i risultati la tastiera si chiude, toccando il campo il mazzo torna alla prima carta, "alto" non va oltre
# lo schermo, indietro chiude prima la tastiera e poi il foglio, "+ Aggiungi" apre senza tastiera.
# Foto in OUT con il prefisso "m". Uso: python3 tools/rn_mazzo.py OUT
import os, re, subprocess, sys, time

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)


def adb(*a):
    return subprocess.run(["adb", *a], capture_output=True, text=True).stdout


def shot(name):
    with open(os.path.join(OUT, name + ".png"), "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)
    print("foto", name, "· tastiera", "aperta" if kbd() else "chiusa", flush=True)


def kbd():
    out = adb("shell", "dumpsys", "input_method")
    return bool(re.search(r"mInputShown=true|isInputViewShown=true", out))


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
        c = re.search(r' class="([^"]*)"', s)
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
        if b:
            out.append(((t.group(1) if t else ""), (d.group(1) if d else ""), (c.group(1) if c else ""), tuple(map(int, b.groups()))))
    return out


def find(pat, last=False, cls=None):
    hits = [(x1, y1, x2, y2) for t, d, c, (x1, y1, x2, y2) in nodes() if (cls and c == cls) or (not cls and (re.search(pat, t) or re.search(pat, d)))]
    if not hits:
        print("non trovato:", pat or cls, flush=True)
        return None
    x1, y1, x2, y2 = hits[-1] if last else hits[0]
    return (x1 + x2) // 2, (y1 + y2) // 2, y1, y2


def tap_at(p, wait=1.5):
    adb("shell", "input", "tap", str(p[0]), str(p[1]))
    time.sleep(wait)


def tap(pat, last=False, wait=1.5):
    p = find(pat, last)
    if p:
        tap_at(p, wait)
    return p


def back(wait=1.5):
    adb("shell", "input", "keyevent", "4")
    time.sleep(wait)


def tabs():
    for _ in range(6):
        if find("^Mazzi$"):
            return
        back()


def search(word):
    # svuota il campo e scrive (il campo è l'unico EditText del foglio)
    f = find("", cls="android.widget.EditText", last=True)
    if f:
        tap_at(f, 0.8)
    adb("shell", "input", "keyevent", "123")
    for _ in range(3):
        adb("shell", "input", "keyevent", *(["67"] * 12))
    adb("shell", "input", "text", word)
    time.sleep(2.2)


def add_first(n=1):
    for _ in range(n):
        tap("^Una in più", wait=1.2)


# tastiera sullo schermo anche se l'emulatore ha una tastiera fisica
adb("shell", "settings", "put", "secure", "show_ime_with_hard_keyboard", "1")
tabs()
tap("^Mazzi$", wait=2)
tap("^Nuovo mazzo$", wait=2.5)

# 1) dalla barra: foglio a metà e tastiera già aperta
tap("Cerca e aggiungi carte", wait=2.5)
shot("m01_aperto_con_tastiera")
# riempie il mazzo: un Digi-Egg e sei Lv.3 (due file di pile), un Lv.4
for w, n in (("Koromon", 2), ("Agumon", 4), ("Gabumon", 2), ("Patamon", 1), ("Tentomon", 1), ("Greymon", 2)):
    search(w)
    add_first(n)
shot("m02_dopo_aggiunta_greymon")
search("Biyomon")
shot("m03_scrivendo")
add_first(1)
shot("m04_biyomon_inquadrata")

# 2) scorrendo i risultati la tastiera si chiude
f = find("", cls="android.widget.EditText", last=True)
if f:
    y0 = min(H - 40, f[3] + int(H * 0.16))
    adb("shell", "input", "swipe", str(W // 2), str(y0), str(W // 2), str(y0 - int(H * 0.08)), "350")
    time.sleep(1.5)
shot("m05_scorrendo_tastiera_chiusa")

# 3) toccando di nuovo il campo: tastiera e mazzo alla prima carta
f = find("", cls="android.widget.EditText", last=True)
if f:
    tap_at(f, 2)
shot("m06_campo_toccato")

# 4) maniglia: alto, con la tastiera aperta non va oltre lo schermo
tap("Ingrandisci o riduci la ricerca", wait=1.5)
shot("m07_alto_con_tastiera")
tap("Ingrandisci o riduci la ricerca", wait=1.5)
shot("m08_di_nuovo_a_meta")

# 5) indietro: prima la tastiera, poi il foglio
back()
shot("m09_indietro_1")
back()
shot("m10_indietro_2")

# 6) "+ Aggiungi" di un gruppo: foglio filtrato, senza tastiera
tap("^Aggiungi carte a Lv\\.4$", wait=2.5)
shot("m11_aggiungi_lv4")
back()
back()

# 7) spazio sotto il campo: "Omni" in vista a immagini, elenco scorso (le carte non devono arrivare a filo del campo)
tap("Cerca e aggiungi carte", wait=2.5)
search("Omni")
tap("^Vista a immagini$", wait=1.5)
f = find("", cls="android.widget.EditText", last=True)
if f:
    y0 = min(H - 40, f[3] + int(H * 0.3))
    adb("shell", "input", "swipe", str(W // 2), str(y0), str(W // 2), str(y0 - int(H * 0.13)), "600")
    time.sleep(1.5)
shot("m12_spazio_sotto_il_campo")
tap("Ingrandisci o riduci la ricerca", wait=1.5)
shot("m13_spazio_alto")
tap("^Vista a elenco$", wait=1.2)
back()
back()
