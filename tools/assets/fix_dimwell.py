"""Мраколодец (Dimwell) на поле и карточке русского издания подписан «7а» — по кубику это район 8.

Стирает «7а» (заливает фон из окрестности) и рисует «8». Запускать после build_board.py и build_cards.py.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'packages' / 'client' / 'public'
FONTS = Path('C:/Windows/Fonts')


def erase(img: Image.Image, box: tuple[int, int, int, int], dark: int = 120) -> None:
    """Тёмные пиксели надписи в box заменяются фоном: диффузия от соседних светлых пикселей."""
    x0, y0, x1, y1 = box
    a = np.asarray(img.crop(box).convert('RGB')).astype(float)
    mask = a.mean(axis=2) < dark
    # Расширить маску на пиксель: сглаженные края букв тоже тёмные.
    for _ in range(1):
        m = mask.copy()
        m[1:] |= mask[:-1]; m[:-1] |= mask[1:]; m[:, 1:] |= mask[:, :-1]; m[:, :-1] |= mask[:, 1:]
        mask = m
    out = a.copy()
    # Заливка от краёв внутрь: каждый шаг берёт среднее по уже известным соседям.
    known = ~mask
    while not known.all():
        acc = np.zeros_like(out)
        cnt = np.zeros(mask.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            k = np.roll(known, (dy, dx), (0, 1))
            acc += np.roll(out, (dy, dx), (0, 1)) * k[..., None]
            cnt += k
        new = ~known & (cnt > 0)
        out[new] = acc[new] / cnt[new][:, None]
        known = known | new
    # Лёгкое сглаживание залитого, чтобы не было полос.
    for _ in range(20):
        avg = (np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 4
        out[mask] = avg[mask]
    img.paste(Image.fromarray(out.astype(np.uint8)), (x0, y0))


def draw_digit(img: Image.Image, center: tuple[int, int], text: str, font: ImageFont.FreeTypeFont, fill: tuple[int, int, int]) -> None:
    d = ImageDraw.Draw(img)
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    d.text((center[0] - (l + r) / 2, center[1] - (t + b) / 2), text, font=font, fill=fill)


def fix(path: Path, box, center, font: ImageFont.FreeTypeFont, fill) -> None:
    img = Image.open(path).convert('RGB')
    erase(img, box)
    draw_digit(img, center, '8', font, fill)
    img.save(path, 'WEBP', quality=85)
    print('fixed', path.relative_to(ROOT))


# Поле: цифры районов — книжная антиква; «7а» в пятиугольнике у Мраколодца.
fix(PUBLIC / 'board.webp', (793, 2113, 847, 2166), (820, 2139),
    ImageFont.truetype(str(FONTS / 'BOOKOSB.TTF'), 46), (24, 16, 10))
# Карточка района 8: цифра шрифтом карточек (Folkard).
fix(PUBLIC / 'districts' / '8.webp', (43, 343, 82, 375), (61, 361),
    ImageFont.truetype(str(PUBLIC / 'fonts' / 'FolkardCyr.ttf'), 34), (20, 14, 10))
