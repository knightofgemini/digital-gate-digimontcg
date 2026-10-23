#!/usr/bin/env python3
"""Riconosce la scritta "SAMPLE" che Bandai stampa sulle immagini delle carte appena uscite.
La maschera tools/sample_mask.png (430x600) è la forma della scritta, ricavata confrontando la stessa carta con e senza.
Punteggio = luminosità media dentro le lettere meno quella del bordo intorno: con la scritta 35-130, senza circa -6..17."""
import pathlib
from PIL import Image, ImageFilter
_M = None
SOGLIA = 25
def _mask():
    global _M
    if _M is None:
        mi = Image.open(pathlib.Path(__file__).with_name("sample_mask.png")).convert("L")
        inner = mi.point(lambda v: 255 if v > 127 else 0)
        ring = mi.filter(ImageFilter.MaxFilter(9)).point(lambda v: 255 if v > 127 else 0)
        near = mi.filter(ImageFilter.MaxFilter(3)).point(lambda v: 255 if v > 127 else 0)
        ring = Image.composite(Image.new("L", mi.size, 0), ring, near)
        _M = (inner, ring)
    return _M
def score(im):
    """im: PIL.Image della carta intera. None se la misura non permette un confronto affidabile."""
    w, h = im.size
    if w < 400 or abs(h / w - 600 / 430) > 0.02: return None
    inner, ring = _mask()
    g = im.convert("L").resize((430, 600))
    from PIL import ImageStat
    a = ImageStat.Stat(g, inner).mean[0]; b = ImageStat.Stat(g, ring).mean[0]
    return a - b
def has_sample(im):
    s = score(im)
    return s is not None and s > SOGLIA
