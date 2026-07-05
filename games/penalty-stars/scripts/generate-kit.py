# توليد جسم اللاعب بطقم «فوتبول فيوتشر» بجودة عالية — تظليل ناعم وتوهج نيون
# يُرسم 4× ثم يُصغّر لنعومة الحواف — الناتج src/assets/images/kit-body.webp (بلا رأس)

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 4  # معامل الدقة
W, H = 240 * S, 350 * S
cx = W // 2

GRAPHITE = (17, 23, 32)
JERSEY = (22, 29, 40)
JERSEY_HI = (42, 52, 66)
LIME = (198, 255, 0)
CYAN = (0, 229, 255)
SKIN = (224, 180, 140)
SKIN_SH = (176, 132, 96)

img = Image.new('RGBA', (W, H), (0, 0, 0, 0))

def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))

def poly(d, pts, fill):
    d.polygon([(int(x * S), int(y * S)) for x, y in pts], fill=fill)

def soft_shade(base_mask_pts, shade_pts_list, blur, alpha):
    """تظليل ناعم مقصوص داخل شكل"""
    mask = Image.new('L', (W, H), 0)
    poly(ImageDraw.Draw(mask), base_mask_pts, 255)
    sh = layer()
    dsh = ImageDraw.Draw(sh)
    for pts in shade_pts_list:
        poly(dsh, pts, (0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(blur * S))
    img.paste(Image.composite(sh, layer(), mask), (0, 0), Image.composite(sh, layer(), mask))

def cyl(x0, y0, x1, y1, w0, w1, base, shade):
    """أسطوانة (ذراع/ساق) بتظليل جانبي"""
    l = layer(); d = ImageDraw.Draw(l)
    pts = [(x0 - w0/2, y0), (x0 + w0/2, y0), (x1 + w1/2, y1), (x1 - w1/2, y1)]
    poly(d, pts, base + (255,))
    img.alpha_composite(l)
    soft_shade(pts, [[(x0 - w0/2, y0), (x0 - w0/2 + w0*0.3, y0), (x1 - w1/2 + w1*0.3, y1), (x1 - w1/2, y1)]], 3, 110)

# ═══ الساقان ═══
for side in (-1, 1):
    lx = cx / S + side * 22
    cyl(lx, 238, lx, 285, 25, 22, SKIN, SKIN_SH)
    # الجورب
    l = layer(); d = ImageDraw.Draw(l)
    poly(d, [(lx - 12, 280), (lx + 12, 280), (lx + 12, 320), (lx - 12, 320)], GRAPHITE + (255,))
    poly(d, [(lx - 12, 286), (lx + 12, 286), (lx + 12, 293), (lx - 12, 293)], CYAN + (255,))
    img.alpha_composite(l)
    # الحذاء الليموني بلمعة
    l = layer(); d = ImageDraw.Draw(l)
    d.ellipse([int((lx - 22 - side*6) * S), int(314 * S), int((lx + 22 - side*6 + 8) * S), int(338 * S)], fill=LIME + (255,))
    d.ellipse([int((lx - 14 - side*6) * S), int(317 * S), int((lx + 2 - side*6) * S), int(325 * S)], fill=(255, 255, 255, 130))
    d.rectangle([int((lx - 24 - side*6) * S), int(332 * S), int((lx + 28 - side*6) * S), int(340 * S)], fill=(11, 15, 20, 255))
    img.alpha_composite(l)

# ═══ الشورت ═══
short_pts = [(cx/S - 54, 196), (cx/S + 54, 196), (cx/S + 48, 250), (cx/S + 8, 250), (cx/S, 226), (cx/S - 8, 250), (cx/S - 48, 250)]
l = layer(); poly(ImageDraw.Draw(l), short_pts, GRAPHITE + (255,)); img.alpha_composite(l)
soft_shade(short_pts, [
    [(cx/S - 54, 196), (cx/S - 36, 196), (cx/S - 32, 250), (cx/S - 48, 250)],
    [(cx/S + 36, 196), (cx/S + 54, 196), (cx/S + 48, 250), (cx/S + 32, 250)],
], 4, 130)
l = layer(); d = ImageDraw.Draw(l)
poly(d, [(cx/S - 54, 196), (cx/S - 47, 196), (cx/S - 41, 250), (cx/S - 48, 250)], LIME + (255,))
poly(d, [(cx/S + 47, 196), (cx/S + 54, 196), (cx/S + 48, 250), (cx/S + 41, 250)], LIME + (255,))
img.alpha_composite(l)

# ═══ الذراعان ═══
for side in (-1, 1):
    sx = cx/S + side * 66
    cyl(sx + side*8, 152, sx + side*16, 200, 21, 18, SKIN, SKIN_SH)
    # قبضة
    l = layer(); d = ImageDraw.Draw(l)
    hx = sx + side*16
    d.ellipse([int((hx-11)*S), int((196)*S), int((hx+11)*S), int((218)*S)], fill=SKIN + (255,))
    img.alpha_composite(l)

# ═══ القميص ═══
jersey_pts = [(cx/S - 54, 106), (cx/S + 54, 106), (cx/S + 86, 130), (cx/S + 76, 162),
              (cx/S + 52, 148), (cx/S + 54, 202), (cx/S - 54, 202), (cx/S - 52, 148),
              (cx/S - 76, 162), (cx/S - 86, 130)]
l = layer(); poly(ImageDraw.Draw(l), jersey_pts, JERSEY + (255,)); img.alpha_composite(l)
# تظليل جانبي + تحت الإبط
soft_shade(jersey_pts, [
    [(cx/S - 54, 106), (cx/S - 34, 106), (cx/S - 36, 202), (cx/S - 54, 202)],
    [(cx/S + 34, 106), (cx/S + 54, 106), (cx/S + 54, 202), (cx/S + 36, 202)],
    [(cx/S - 60, 140), (cx/S - 40, 148), (cx/S - 44, 168), (cx/S - 64, 158)],
    [(cx/S + 40, 140), (cx/S + 60, 148), (cx/S + 64, 158), (cx/S + 44, 168)],
], 5, 150)
# لمعة صدر علوية
hi = layer(); dh = ImageDraw.Draw(hi)
poly(dh, [(cx/S - 40, 108), (cx/S + 20, 108), (cx/S + 4, 140), (cx/S - 34, 136)], (255, 255, 255, 46))
hi = hi.filter(ImageFilter.GaussianBlur(6 * S))
mask = Image.new('L', (W, H), 0); poly(ImageDraw.Draw(mask), jersey_pts, 255)
img.paste(hi, (0, 0), Image.composite(hi.split()[3], Image.new('L', (W, H), 0), mask))

# شريحة الطاقة القطرية: توهج ليموني + خط سماوي (مقصوصة داخل القميص)
slash = layer(); ds = ImageDraw.Draw(slash)
poly(ds, [(cx/S - 62, 202), (cx/S - 20, 106), (cx/S - 6, 106), (cx/S - 48, 202)], LIME + (235,))
poly(ds, [(cx/S - 44, 202), (cx/S - 2, 106), (cx/S + 4, 106), (cx/S - 38, 202)], CYAN + (215,))
glow = slash.filter(ImageFilter.GaussianBlur(4 * S))
torso_mask = Image.new('L', (W, H), 0)
poly(ImageDraw.Draw(torso_mask), [(cx/S - 54, 106), (cx/S + 54, 106), (cx/S + 54, 202), (cx/S - 54, 202)], 255)
for lyr in (glow, slash):
    img.paste(lyr, (0, 0), Image.composite(lyr.split()[3], Image.new('L', (W, H), 0), torso_mask))

# أطراف الأكمام سماوية
l = layer(); d = ImageDraw.Draw(l)
poly(d, [(cx/S - 80, 154), (cx/S - 58, 143), (cx/S - 54, 152), (cx/S - 76, 163)], CYAN + (255,))
poly(d, [(cx/S + 58, 143), (cx/S + 80, 154), (cx/S + 76, 163), (cx/S + 54, 152)], CYAN + (255,))
img.alpha_composite(l)

# الياقة V سماوية
l = layer(); d = ImageDraw.Draw(l)
for i in range(2):
    d.line([int((cx/S - 17)*S), int((107+i)*S), int(cx), int((121+i)*S)], fill=CYAN + (255,), width=int(2.4*S))
    d.line([int(cx), int((121+i)*S), int((cx/S + 17)*S), int((107+i)*S)], fill=CYAN + (255,), width=int(2.4*S))
img.alpha_composite(l)

# الرقبة
l = layer(); d = ImageDraw.Draw(l)
poly(d, [(cx/S - 10, 88), (cx/S + 10, 88), (cx/S + 9, 110), (cx/S - 9, 110)], SKIN + (255,))
img.alpha_composite(l)

# ظل أرضي ناعم
sh = layer(); ImageDraw.Draw(sh).ellipse([int((cx/S-58)*S), int(330*S), int((cx/S+58)*S), int(348*S)], fill=(0, 0, 0, 110))
final = Image.new('RGBA', (W, H), (0, 0, 0, 0))
final.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4 * S)))
final.alpha_composite(img)

final = final.resize((240, 350), Image.LANCZOS)
final.save('src/assets/images/kit-body.webp', quality=95, method=6)
print('saved kit-body.webp')
