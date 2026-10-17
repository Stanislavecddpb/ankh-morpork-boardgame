"""Вырезает жетоны по tokens.json: фон ячейки (цвет угла) и белый делаются прозрачными, края обрезаются."""
import json
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'tools' / 'assets'
cfg = json.loads((HERE / 'tokens.json').read_text(encoding='utf-8'))
doc = pymupdf.open(ROOT / 'source' / 'для_распечатки.pdf')
OUT = ROOT / 'packages' / 'client' / 'public' / 'tokens'
OUT.mkdir(parents=True, exist_ok=True)
EXPECTED = {f'{k}-{c}' for k in ('minion', 'building') for c in ('red', 'yellow', 'green', 'blue')} | {'trouble', 'demon', 'troll'}
KEY_DISTANCE = 40  # насколько цвет пикселя должен отличаться от фона, чтобы остаться

pages: dict[tuple[int, int], Image.Image] = {}
for name, t in cfg['tokens'].items():
    key = (t['page'], t['rotate'])
    if key not in pages:
        pix = doc[t['page']].get_pixmap(dpi=cfg['dpi'])
        pages[key] = Image.frombytes('RGB', (pix.width, pix.height), pix.samples).rotate(t['rotate'], expand=True)
    rgb = np.asarray(pages[key].crop(tuple(t['crop']))).astype(int)
    bg = rgb[2, 2]
    dist = np.abs(rgb - bg).sum(axis=2)
    white = rgb.min(axis=2) > 235
    alpha = np.where((dist < KEY_DISTANCE) | white, 0, 255).astype(np.uint8)
    img = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), 'RGBA')
    img = img.crop(img.getbbox())
    img.save(OUT / f'{name}.webp', 'WEBP', quality=90)

missing = EXPECTED - set(cfg['tokens'])
assert not missing, f'Не хватает жетонов: {sorted(missing)}'
print('tokens', len(cfg['tokens']))
