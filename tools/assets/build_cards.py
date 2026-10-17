"""Вырезает карты из PDF «ForPrint» в WebP и генерирует каталог для движка.

Запуск из корня репозитория: python tools/assets/build_cards.py
"""
import json
import re
import sys
from pathlib import Path

import openpyxl
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'source'
PDF = SRC / 'Ankh-Morpork Discworld final PDF cards ForPrint' / 'ForPrint'
XLSX = SRC / 'Ankh-Morpork Discworld cardForge' / 'Ankh-Morpork Translation sheet.xlsx'
PUBLIC = ROOT / 'packages' / 'client' / 'public'
OUT_JSON = ROOT / 'packages' / 'engine' / 'src' / 'data' / 'cards.json'
DPI = 150

FOLDERS = {
    'Зелёные карты': ('Playcards/GreenDeck', 'cards/green'),
    'Рыжие карты': ('Playcards/OrangeDeck', 'cards/brown'),
    'Персонажи': ('Personalities deck', 'personalities'),
    'случайные события': ('Events', 'events'),
}
BACKS = {
    'Playcards/Playcards !_BACK.pdf': 'cards/back-play.webp',
    'Events/Events !_BACK.pdf': 'events/back.webp',
    'Personalities deck/Personalities !_BACK.pdf': 'personalities/back.webp',
    'Districts/Districts !_BACK.pdf': 'districts/back.webp',
}
SYMBOLS = {
    'Агент': 'minion', 'Дом': 'building', 'Череп': 'assassinate', 'Значок': 'removeTrouble',
    'Текст': 'scroll', 'Магия': 'event', 'Продолжить': 'playAnother', 'Рука': 'interrupt',
}
# Английское имя в таблице → ключ имени файла (если они не совпадают).
ALIASES = {
    'Wallace Sonky': 'sonky',
    'Ankh-Morpork Sunshine Dragon Sanctuary': 'sunshinesanctuary',
    "Gimlet's Hole Food Delicatessen": 'delicatessen',
    "Harga's house of ribs": 'hargas',
    'Mr. Pin and Mr. Tulip': 'mrpinmrtulip',
    'The Royal Mint': 'royalmint',
    'Zorgo the Retrophrenologist': 'zorgo',
    'Captain Carrot': 'cataincarrot',
    'Dragon King of Arms': 'dragon',
    'Commander Vimes': 'vimes',
    'Lord Vetinari': 'vetinari',
    'Archchancellor Ridcully': 'ridcully',
    'Clack Towers': 'clacks',
    'Dean (of Pentacles)': 'dean',
    'Lecturer in recent runes': 'lecturer',
    'The Mob': 'mob',
    'Bloody stupid Johnson': 'johnson',
    'Demons from Dungeon Dimensions': 'demons',
    'Earthquake': 'quake',
    'Mysterious Murders': 'murders',
    'The Dragon': 'dragon',
}


def key(s: str) -> str:
    return re.sub(r'[^a-z]', '', s.lower())


def slug(s: str) -> str:
    s = re.sub(r"['\".()]", '', s.lower().strip())
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def file_key(stem: str) -> str:
    stem = re.sub(r'^(Districts|Events|Personalities)\s+', '', stem)
    stem = re.sub(r'^\d+\s+', '', stem)
    return key(stem)


def render(pdf: Path, out: Path) -> None:
    page = pymupdf.open(pdf)[0]
    pix = page.get_pixmap(dpi=DPI)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=85)


def parse_symbol(raw: str) -> dict:
    raw = raw.strip()
    m = re.match(r'(\d+)\s*бакс', raw)
    if m:
        return {'kind': 'money', 'amount': int(m.group(1))}
    return {'kind': SYMBOLS[raw]}


def main() -> None:
    ws = openpyxl.load_workbook(XLSX).worksheets[0]
    catalog = {'cards': [], 'personalities': [], 'events': []}

    for row in ws.iter_rows(min_row=2, values_only=True):
        en, kind = row[2], row[5]
        if not en or kind not in FOLDERS:
            continue
        name = (row[4] if row[3] else row[1] or en).strip()
        folder, out_dir = FOLDERS[kind]
        want = ALIASES.get(en, key(en))
        files = [f for f in (PDF / folder).glob('*.pdf') if 'BACK' not in f.name and file_key(f.stem) == want]
        if len(files) != 1:
            sys.exit(f'Не найден PDF для «{en}» в {folder}: {files}')
        cid = slug(en)
        render(files[0], PUBLIC / out_dir / f'{cid}.webp')
        if kind in ('Зелёные карты', 'Рыжие карты'):
            symbols = [parse_symbol(s) for s in row[11:15] if s]
            catalog['cards'].append({
                'id': cid, 'deck': 'green' if kind == 'Зелёные карты' else 'brown',
                'name': name, 'nameEn': en.strip(), 'symbols': symbols,
            })
        elif kind == 'Персонажи':
            catalog['personalities'].append({'id': cid, 'name': name})
        else:
            catalog['events'].append({'id': cid, 'name': name})

    for f in sorted((PDF / 'Districts').glob('Districts [0-9]*.pdf')):
        if f.stem.endswith(' '):
            continue  # дубль «Seven Sleepers .pdf»
        n = int(f.stem.split()[1])
        render(f, PUBLIC / 'districts' / f'{n}.webp')

    for src, out in BACKS.items():
        render(PDF / src, PUBLIC / out)

    green = sum(c['deck'] == 'green' for c in catalog['cards'])
    brown = sum(c['deck'] == 'brown' for c in catalog['cards'])
    districts = len(list((PUBLIC / 'districts').glob('[0-9]*.webp')))
    print(f'green={green} brown={brown} personalities={len(catalog["personalities"])} '
          f'events={len(catalog["events"])} districts={districts}')
    assert (green, brown, len(catalog['personalities']), len(catalog['events']), districts) == (48, 53, 7, 12, 12)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
