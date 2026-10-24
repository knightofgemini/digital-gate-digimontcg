#!/usr/bin/env python3
"""Anteprime degli spoiler (TakaOtaku "-Sample"): la carta sta su uno sfondo bianco con un margine intorno e gli angoli
arrotondati. Qui si ritaglia la sola carta, nelle proporzioni delle immagini ufficiali (430x600), e si riempiono i quattro
angoli bianchi con i colori del bordo della carta, così l'immagine è un rettangolo pieno come quelle ufficiali.
Uso da riga di comando (prova): python3 tools/spoiler_trim.py ENTRATA USCITA"""
import sys
import numpy as np
from PIL import Image
RATIO = 600 / 430   # altezza / larghezza delle immagini ufficiali
def _edges(g):
    """bordi della carta: colonne/righe che non sono quasi tutte bianche (il bianco del margine è 255)"""
    h, w = g.shape
    colw = (g < 246).mean(0); roww = (g < 246).mean(1)
    xs = np.where(colw > 0.35)[0]; ys = np.where(roww > 0.35)[0]
    if len(xs) < w * 0.5 or len(ys) < h * 0.5: return None
    return xs[0], xs[-1], ys[0], ys[-1]
def _fill(a, mask, it=60):
    """riempie i pixel di `mask` con la media dei vicini già pieni, un anello alla volta"""
    a = a.astype(np.float32); m = mask.copy()
    for _ in range(it):
        if not m.any(): break
        known = ~m
        s = np.zeros_like(a); n = np.zeros(m.shape, np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            k = np.roll(np.roll(known, dy, 0), dx, 1); v = np.roll(np.roll(a, dy, 0), dx, 1)
            s += v * k[..., None]; n += k
        grow = m & (n > 0)
        a[grow] = s[grow] / n[grow][:, None]; m &= ~grow
    return a.clip(0, 255).astype(np.uint8)
def trim(im):
    """restituisce la carta ritagliata (RGB) oppure l'immagine così com'è se il margine non si riconosce"""
    im = im.convert("RGB"); a = np.asarray(im); g = np.asarray(im.convert("L")).astype(int)
    e = _edges(g)
    if not e: return im
    x0, x1, y0, y1 = e
    w = x1 - x0 + 1
    # i lati della carta si riconoscono sempre (cornice colorata o grigia); sopra e sotto invece le carte dal fondo bianco
    # (Digi-Egg, Tamer…) si confondono con il margine: la carta è centrata nell'immagine, quindi l'altezza si ricava
    # dalla larghezza (proporzioni ufficiali) e la posizione dal centro
    H = g.shape[0]; h = int(round(w * RATIO)); top = max(0, (H - h) // 2)
    c = a[top:top + h, x0:x1 + 1].copy()
    ch, cw = c.shape[:2]
    if ch < cw: return im
    # angoli: pixel quasi bianchi collegati all'angolo, dentro un quadrato del 7% della larghezza
    r = max(4, int(cw * 0.07)); mask = np.zeros((ch, cw), bool)
    cg = c.mean(2)
    for cy, cx, sy, sx in ((0, 0, 1, 1), (0, cw - 1, 1, -1), (ch - 1, 0, -1, 1), (ch - 1, cw - 1, -1, -1)):
        for i in range(r):
            for j in range(r - i):
                y, x = cy + sy * i, cx + sx * j
                # dentro il triangolo dell'angolo, solo il bianco esterno alla curva
                if cg[y, x] >= 244 and (i == 0 or mask[y - sy, x] or j == 0 or mask[y, x - sx]): mask[y, x] = True
    if mask.any():
        # si allarga la zona di qualche pixel: il bordo della curva è sfumato verso il bianco e darebbe angoli pallidi
        d = max(2, int(cw * 0.006)); grow = mask.copy()
        for _ in range(d):
            g2 = grow.copy()
            g2[1:] |= grow[:-1]; g2[:-1] |= grow[1:]; g2[:, 1:] |= grow[:, :-1]; g2[:, :-1] |= grow[:, 1:]
            grow = g2
        box = np.zeros_like(mask)
        for ys, xs in ((slice(0, r + d), slice(0, r + d)), (slice(0, r + d), slice(cw - r - d, cw)), (slice(ch - r - d, ch), slice(0, r + d)), (slice(ch - r - d, ch), slice(cw - r - d, cw))):
            box[ys, xs] = True
        c = _fill(c, grow & box)
    return Image.fromarray(c)
if __name__ == "__main__":
    t = trim(Image.open(sys.argv[1])); t.save(sys.argv[2]); print(t.size)
