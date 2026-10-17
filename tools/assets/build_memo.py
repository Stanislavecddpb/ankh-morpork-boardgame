"""Памятка игрока: две стороны (страницы 32 и 33 «для_распечатки.pdf», на каждой по две копии — берём верхнюю)."""
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
doc = pymupdf.open(ROOT / 'source' / 'для_распечатки.pdf')
OUT = ROOT / 'packages' / 'client' / 'public' / 'memo'
OUT.mkdir(parents=True, exist_ok=True)
DPI = 220
# Верхняя копия в долях страницы: x0, y0, x1, y1.
BOX = (0.045, 0.035, 0.957, 0.485)

for n, page in enumerate((31, 32), start=1):
    pix = doc[page].get_pixmap(dpi=DPI)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    w, h = img.size
    img = img.crop((int(BOX[0] * w), int(BOX[1] * h), int(BOX[2] * w), int(BOX[3] * h)))
    img.save(OUT / f'memo-{n}.webp', 'WEBP', quality=88)
    print(f'memo-{n}', img.size)
