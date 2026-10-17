"""Подгоняет границы районов (areas.json) к берегам реки: река ничейная.

1. Река: «гладкие» пиксели скана (мало мелкой текстуры) внутри коридора вдоль русла, заданного вручную.
2. Из каждого района вычитается река; мостики (тонкие перемычки) срезаются, остаётся главный кусок.
3. Остальная суша города (щели, клочки за рекой) отходит ближайшему району.
4. Контуры упрощаются и записываются обратно в areas.json (якоря и зоны надписей не трогаются).

python tools/assets/fit_areas.py [--preview]
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
GEO = ROOT / 'packages' / 'client' / 'src' / 'table' / 'areas.json'
BOARD = ROOT / 'packages' / 'client' / 'public' / 'board.webp'
S = 2  # работаем в половинном масштабе

# Русло: ломаные (x, y, ширина коридора) в координатах поля. Широкий коридор — гладкость скана уточнит берег.
CHANNELS = [
    # С севера вниз, вокруг «языка» Внедвижимости и над Островом Богов, затем восточный рукав.
    [(1122, 280, 70), (1125, 350, 70), (1140, 400, 80), (1190, 440, 90), (1220, 490, 90), (1222, 550, 85),
     (1195, 600, 90), (1140, 635, 90), (1090, 670, 90), (1070, 730, 85), (1065, 800, 85), (1075, 860, 100),
     (1075, 930, 110), (1040, 990, 100), (960, 1030, 90), (930, 1095, 90), (955, 1160, 90), (1020, 1195, 100),
     (1120, 1200, 100), (1220, 1195, 100), (1320, 1185, 100), (1390, 1205, 100), (1405, 1270, 95),
     (1400, 1350, 90), (1385, 1430, 85), (1355, 1490, 85), (1300, 1530, 90), (1200, 1530, 90), (1100, 1530, 90),
     (1040, 1530, 100)],
    # Западный рукав у Острова Богов и низовье до городской стены.
    [(1000, 1200, 90), (1030, 1270, 90), (1030, 1350, 90), (1030, 1450, 90), (1035, 1530, 100), (1040, 1620, 120),
     (1045, 1700, 125), (1048, 1800, 115), (1075, 1900, 100), (1144, 2000, 125), (1152, 2100, 120),
     (1193, 2200, 190), (1209, 2300, 225), (1200, 2400, 210)],
]
SMOOTH_STD = 16  # порог «гладкости» (СКО яркости в окне 21×21)


def corridor(shape) -> np.ndarray:
    m = np.zeros(shape, np.uint8)
    for ch in CHANNELS:
        for (x0, y0, w0), (x1, y1, w1) in zip(ch, ch[1:]):
            n = max(2, int(np.hypot(x1 - x0, y1 - y0) / 6))
            for t in np.linspace(0, 1, n):
                x, y, w = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w0 + (w1 - w0) * t
                cv2.circle(m, (int(x / S), int(y / S)), int(w / 2 / S), 255, -1)
    return m


def river_mask(gray: np.ndarray) -> np.ndarray:
    g = gray.astype(np.float32)
    mu = cv2.blur(g, (11, 11))
    std = np.sqrt(np.maximum(cv2.blur(g * g, (11, 11)) - mu * mu, 0))
    smooth = (std < SMOOTH_STD).astype(np.uint8) * 255
    core = corridor(gray.shape)
    m = cv2.bitwise_and(smooth, core)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # Внутри узкой осевой части коридора — река целиком (мосты и тени на воде не дробят русло).
    thin = np.zeros_like(core)
    for ch in CHANNELS:
        pts = np.array([(x / S, y / S) for x, y, _ in ch], np.int32)
        cv2.polylines(thin, [pts], False, 255, max(6, int(min(w for *_, w in ch) * 0.35 / S)))
    m = cv2.bitwise_or(m, thin)
    # Оставить только связную часть, касающуюся русла.
    n, lab = cv2.connectedComponents(m)
    keep = set(np.unique(lab[thin > 0])) - {0}
    return np.isin(lab, list(keep)).astype(np.uint8) * 255


def main() -> None:
    geo = json.loads(GEO.read_text(encoding='utf-8'))
    img = np.asarray(Image.open(BOARD).convert('RGB'))
    small = cv2.resize(img, (img.shape[1] // S, img.shape[0] // S), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
    river = river_mask(gray)
    h, w = gray.shape
    ids = sorted(geo['areas'], key=int)

    masks = {}
    for k in ids:
        m = np.zeros((h, w), np.uint8)
        pts = (np.array(geo['areas'][k]['points'], np.float32) / S).astype(np.int32)
        cv2.fillPoly(m, [pts], 255)
        masks[k] = m
    city = np.zeros((h, w), np.uint8)
    for m in masks.values():
        city = cv2.bitwise_or(city, m)
    city = cv2.morphologyEx(city, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    # Береговая полоса: суша между районом и рекой, которую старые контуры не захватывали.
    # Только внутри городской стены: выпуклая оболочка старых контуров.
    hull = np.zeros_like(city)
    cs, _ = cv2.findContours(city, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.fillPoly(hull, [cv2.convexHull(np.vstack(cs))], 255)
    hull = cv2.erode(hull, np.ones((9, 9), np.uint8))
    near = cv2.bitwise_and(cv2.dilate(city, np.ones((61, 61), np.uint8)), cv2.dilate(river, np.ones((61, 61), np.uint8)))
    city = cv2.bitwise_or(city, cv2.bitwise_and(near, hull))
    land = cv2.bitwise_and(city, cv2.bitwise_not(river))

    # Главный кусок каждого района без реки и мостиков.
    owner = np.full((h, w), -1, np.int32)
    for i, k in enumerate(ids):
        m = cv2.bitwise_and(masks[k], land)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((13, 13), np.uint8))
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
        if n > 1:
            big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            owner[(lab == big) & (owner < 0)] = i
    # Остальная суша — району, до которого можно «дойти по суше»: районы растут по очереди, через реку не перескакивают.
    best = owner.copy()
    free = (best < 0) & (land > 0)
    k3 = np.ones((3, 3), np.uint8)
    while free.any():
        grown = False
        for i in range(len(ids)):
            g = cv2.dilate((best == i).astype(np.uint8), k3).astype(bool) & free
            if g.any():
                best[g] = i
                free &= ~g
                grown = True
        if not grown:
            break

    out = {}
    for i, k in enumerate(ids):
        m = ((best == i) & (land > 0)).astype(np.uint8) * 255
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        c = max(cs, key=cv2.contourArea)
        c = cv2.approxPolyDP(c, 2.5, True)
        out[k] = [[int(p[0][0] * S), int(p[0][1] * S)] for p in c]
        print(k, len(geo['areas'][k]['points']), '->', len(out[k]))

    if '--preview' in sys.argv:
        vis = small.copy()
        vis[river > 0] = (0.5 * vis[river > 0] + [0, 60, 120]).astype(np.uint8)
        for k in ids:
            pts = (np.array(out[k]) / S).astype(np.int32)
            cv2.polylines(vis, [pts], True, (255, 200, 0), 2)
        Image.fromarray(vis).save(sys.argv[sys.argv.index('--preview') + 1])
    else:
        for k in ids:
            geo['areas'][k]['points'] = out[k]
        GEO.write_text(json.dumps(geo, ensure_ascii=False, indent=1), encoding='utf-8')
        print('записано', GEO.relative_to(ROOT))


main()
