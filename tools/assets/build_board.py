"""Склеивает поле из фрагментов для_распечатки.pdf по board_layout.json."""
import json
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'tools' / 'assets'
layout = json.loads((HERE / 'board_layout.json').read_text(encoding='utf-8'))
doc = pymupdf.open(ROOT / 'source' / 'для_распечатки.pdf')

canvas = Image.new('RGB', tuple(layout['canvas']), 'white')
for piece in layout['pieces']:
    pix = doc[piece['page']].get_pixmap(dpi=layout['dpi'])
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    img = img.rotate(piece['rotate'], expand=True)
    canvas.paste(img.crop(tuple(piece['crop'])), tuple(piece['at']))

canvas.save(ROOT / 'packages' / 'client' / 'public' / 'board.webp', 'WEBP', quality=82)
(HERE / 'preview').mkdir(exist_ok=True)
canvas.resize((canvas.width // 4, canvas.height // 4)).save(HERE / 'preview' / 'board-small.png')
print('board', canvas.size)
