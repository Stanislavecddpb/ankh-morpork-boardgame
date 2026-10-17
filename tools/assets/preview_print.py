"""Рендерит страницы для_распечатки.pdf в tools/assets/preview/ для ручного разбора."""
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tools' / 'assets' / 'preview'
OUT.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(ROOT / 'source' / 'для_распечатки.pdf')
for i in range(20, 31):
    doc[i].get_pixmap(dpi=60).save(OUT / f'page-{i}.png')
print('ok', OUT)
