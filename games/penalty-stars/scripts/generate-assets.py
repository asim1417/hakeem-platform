# توليد أصول شبه واقعية للعبة — ملاعب وكرات
# الاستخدام: python3 scripts/generate-assets.py
# الناتج في src/assets/images/ — استبدلها بصور حقيقية بنفس الأسماء متى توفرت

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

W, H = 720, 1200
SKY_END = 260
STANDS_END = 345
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'images')
os.makedirs(OUT, exist_ok=True)
random.seed(42)


def vgrad(draw, y0, y1, c0, c1):
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0)
        c = tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
        draw.line([(0, y), (W, y)], fill=c)


def crowd(draw, y0, y1, palette, density=900, size=(3, 6)):
    for _ in range(density):
        x = random.randint(0, W)
        y = random.randint(y0, y1)
        r = random.randint(*size) // 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=random.choice(palette))


def pitch(draw, y0, night=False):
    base = (34, 120, 52) if night else (46, 145, 64)
    alt = (42, 138, 62) if night else (56, 162, 76)
    stripe = 72
    for y in range(y0, H, 4):
        band = ((y - y0) // stripe) % 2
        c = base if band == 0 else alt
        # تفتيح تدريجي نحو الأسفل لإيحاء القرب
        t = (y - y0) / (H - y0)
        c = tuple(min(255, int(ch * (1 + 0.10 * t))) for ch in c)
        draw.rectangle([0, y, W, y + 4], fill=c)
    # خطا التماس الجانبيان بمنظور خفيف
    draw.line([(30, H), (120, y0)], fill=(245, 245, 245), width=5)
    draw.line([(W - 30, H), (W - 120, y0)], fill=(245, 245, 245), width=5)


def floodlight(img, x, y):
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    for r, a in [(150, 40), (100, 60), (55, 90)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 250, 210, a))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))


def stadium(name, sky0, sky1, stand_fn, night=False, extra_fn=None):
    img = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(img)
    vgrad(d, 0, SKY_END, sky0, sky1)
    stand_fn(img, d)
    pitch(d, STANDS_END, night)
    if extra_fn:
        extra_fn(img, d)
    img.convert('RGB').save(os.path.join(OUT, f'{name}.jpg'), quality=72, optimize=True)
    print('saved', name)


CROWD_COLORS = [(230, 60, 60), (60, 130, 230), (250, 220, 90), (240, 240, 240), (90, 200, 120), (255, 150, 70), (200, 100, 220)]


def stands_real(img, d):
    d.rectangle([0, SKY_END - 12, W, SKY_END], fill=(210, 215, 222))  # السقف
    vgrad(d, SKY_END, STANDS_END, (72, 78, 92), (52, 57, 68))
    crowd(d, SKY_END + 4, STANDS_END - 4, CROWD_COLORS)


def stands_school(img, d):
    # سور مدرسة أخضر مع أشجار
    d.rectangle([0, SKY_END, W, STANDS_END], fill=(58, 125, 68))
    for x in range(0, W, 26):
        d.rectangle([x, SKY_END, x + 4, STANDS_END], fill=(48, 105, 58))
    for x in range(40, W, 150):
        r = random.randint(28, 40)
        d.ellipse([x - r, SKY_END - r, x + r, SKY_END + r // 2], fill=(60, 150, 70))


def stands_street(img, d):
    # جدار حارة بطوب ورسومات ملونة
    d.rectangle([0, SKY_END - 20, W, STANDS_END], fill=(180, 118, 86))
    for y in range(SKY_END - 20, STANDS_END, 18):
        off = 0 if (y // 18) % 2 == 0 else 22
        for x in range(-22 + off, W, 44):
            d.rectangle([x, y, x + 40, y + 15], outline=(150, 92, 64))
    for x, c in [(90, (255, 210, 80)), (280, (90, 200, 230)), (470, (250, 130, 160)), (620, (140, 230, 120))]:
        d.ellipse([x, SKY_END + 5, x + 60, STANDS_END - 12], outline=c, width=6)


def stands_night(img, d):
    vgrad(d, SKY_END, STANDS_END, (38, 44, 66), (26, 30, 46))
    crowd(d, SKY_END + 4, STANDS_END - 4, CROWD_COLORS + [(255, 255, 255)] * 3, density=1100, size=(2, 5))


def stands_cup(img, d):
    d.rectangle([0, SKY_END - 12, W, SKY_END], fill=(228, 200, 120))
    vgrad(d, SKY_END, STANDS_END, (86, 70, 40), (60, 50, 32))
    crowd(d, SKY_END + 4, STANDS_END - 4, CROWD_COLORS, density=1200, size=(2, 5))
    # لافتات ذهبية
    for x in range(20, W, 180):
        d.rectangle([x, SKY_END + 8, x + 130, SKY_END + 30], fill=(245, 197, 66))


def sky_night_extra(img, d):
    for _ in range(90):
        x, y = random.randint(0, W), random.randint(0, SKY_END - 40)
        d.ellipse([x, y, x + 2, y + 2], fill=(255, 255, 255))
    floodlight(img, 60, SKY_END - 30)
    floodlight(img, W - 60, SKY_END - 30)


def sky_cup_extra(img, d):
    for _ in range(160):  # قصاصات في السماء
        x, y = random.randint(0, W), random.randint(0, SKY_END)
        d.rectangle([x, y, x + 6, y + 4], fill=random.choice(CROWD_COLORS))


stadium('stadium-real', (110, 190, 240), (168, 224, 250), stands_real)
stadium('stadium-school', (140, 210, 246), (190, 234, 252), stands_school)
stadium('stadium-street', (126, 200, 242), (180, 228, 250), stands_street)
stadium('stadium-stars', (10, 20, 58), (32, 46, 96), stands_night, night=True, extra_fn=sky_night_extra)
stadium('stadium-cup', (96, 180, 236), (160, 218, 248), stands_cup, extra_fn=sky_cup_extra)


# ── الكرات ──
BS = 256
CX = CY = BS // 2
R = 112


def ball_base(base=(250, 250, 250), pattern=(30, 30, 34)):
    img = Image.new('RGBA', (BS, BS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # تظليل كروي: دوائر متدرجة نحو الأسفل اليمين
    for i in range(R, 0, -1):
        t = i / R
        c = tuple(int(ch * (0.62 + 0.38 * (1 - t))) for ch in base)
        off = int((1 - t) * 18)
        d.ellipse([CX - i - off // 2, CY - i - off // 2, CX + i - off // 2 + off, CY + i - off // 2 + off], fill=c)

    def pent(cx, cy, r, rot=0.0, squash=1.0):
        pts = []
        for k in range(5):
            a = rot + k * 2 * math.pi / 5 - math.pi / 2
            pts.append((cx + r * math.cos(a), cy + r * squash * math.sin(a)))
        d.polygon(pts, fill=pattern)

    pent(CX, CY, 38)
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2
        px, py = CX + 92 * math.cos(a), CY + 92 * math.sin(a)
        pent(px, py, 26, rot=a, squash=0.75)
    # لمعة
    hl = Image.new('RGBA', (BS, BS), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([CX - 70, CY - 85, CX - 6, CY - 40], fill=(255, 255, 255, 120))
    img.alpha_composite(hl.filter(ImageFilter.GaussianBlur(10)))
    # قص دائري نظيف
    mask = Image.new('L', (BS, BS), 0)
    ImageDraw.Draw(mask).ellipse([CX - R, CY - R, CX + R, CY + R], fill=255)
    img.putalpha(mask)
    return img


def save_ball(name, img):
    img.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print('saved', name)


save_ball('ball-real', ball_base())

stars = ball_base((255, 240, 170), (240, 170, 30))
d = ImageDraw.Draw(stars)
for a in range(0, 360, 72):
    x = CX + 70 * math.cos(math.radians(a + 36))
    y = CY + 70 * math.sin(math.radians(a + 36))
    d.text((x - 10, y - 12), '★', fill=(200, 120, 10))
save_ball('ball-stars', stars)

save_ball('ball-fire', ball_base((255, 190, 120), (200, 50, 20)))
save_ball('ball-bolt', ball_base((190, 240, 255), (20, 110, 200)))
save_ball('ball-gold', ball_base((250, 215, 110), (150, 105, 20)))
