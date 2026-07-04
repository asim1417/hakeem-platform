# توليد مؤثرات الملعب — جماهير محيطية (حلقة)، هتاف هدف، وارتطام ركلة قوي
# الاستخدام: python3 scripts/generate-sfx.py
# الناتج mp3 مضغوطة صغيرة في src/assets/sfx/ — أصلية بالكامل (لا قصّ من ألعاب تجارية)

import os
import subprocess

import numpy as np

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'sfx')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def lowpass(x, alpha):
    # مرشح بسيط أحادي القطب — يحول الضجيج الأبيض إلى همهمة جمهور
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha * (x[i] - acc)
        y[i] = acc
    return y


def bandnoise(n, alpha_lo, alpha_hi):
    w = rng.standard_normal(n)
    return lowpass(w, alpha_hi) - lowpass(w, alpha_lo)


def save_mp3(name, samples, gain=1.0, bitrate='40k'):
    x = np.clip(samples * gain, -1, 1)
    wav = os.path.join(OUT, f'{name}.wav')
    mp3 = os.path.join(OUT, f'{name}.mp3')
    pcm = (x * 32767).astype('<i2')
    import wave
    with wave.open(wav, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', str(RATE), '-b:a', bitrate, mp3], check=True)
    os.remove(wav)
    print('saved', f'{name}.mp3', os.path.getsize(mp3), 'bytes')


# ── ١) جماهير محيطية — حلقة ٦ ثوانٍ سلسة الالتفاف ──
def crowd_ambient():
    n = RATE * 6
    t = np.arange(n) / RATE
    base = bandnoise(n, 0.010, 0.16)  # همهمة متوسطة الحدة
    deep = bandnoise(n, 0.003, 0.03)  # هدير منخفض بعيد
    # تموّج بطيء بعدد دورات صحيح حتى تلتف الحلقة بلا نقرة
    swell = 0.75 + 0.25 * np.sin(2 * np.pi * 2 * t / 6.0) * np.sin(2 * np.pi * 3 * t / 6.0 + 1.3)
    x = (base * 0.8 + deep * 0.6) * swell
    # مزج نهاية الحلقة ببدايتها (crossfade ٠٫٢٥ ثانية)
    xf = int(RATE * 0.25)
    fade = np.linspace(0, 1, xf)
    x[:xf] = x[:xf] * fade + x[-xf:] * (1 - fade)
    x = x[: n - xf]
    save_mp3('crowd-ambient', x / (np.abs(x).max() + 1e-9), gain=0.9, bitrate='40k')


# ── ٢) هتاف هدف — انفجار حماسي مع صافرات وتصفيق ──
def crowd_goal():
    n = int(RATE * 2.4)
    t = np.arange(n) / RATE
    roar = bandnoise(n, 0.02, 0.35)
    env = np.minimum(t / 0.06, 1.0) * np.exp(-np.maximum(t - 1.1, 0) * 1.8)
    x = roar * env * 1.1
    # صافرات فرح تنزلق نزولًا
    for f0, st in [(2600, 0.15), (3100, 0.55), (2300, 0.95)]:
        seg = (t >= st) & (t < st + 0.5)
        ts = t[seg] - st
        x[seg] += 0.16 * np.sin(2 * np.pi * (f0 - 700 * ts) * ts) * np.exp(-ts * 5)
    # رشقات تصفيق قصيرة
    for st in rng.uniform(0.1, 1.6, 22):
        i0 = int(st * RATE)
        ln = int(0.02 * RATE)
        if i0 + ln < n:
            x[i0 : i0 + ln] += rng.standard_normal(ln) * np.exp(-np.arange(ln) / (0.004 * RATE)) * 0.35
    save_mp3('crowd-goal', x / (np.abs(x).max() + 1e-9), gain=0.95, bitrate='40k')


# ── ٣) ارتطام الركلة — ضربة عميقة بنقرة حادة (مضغوطة بقسوة للإحساس بالقوة) ──
def kick_impact():
    n = int(RATE * 0.34)
    t = np.arange(n) / RATE
    freq = 150 * np.exp(-t * 14) + 48  # جسم الضربة: انزلاق حاد نحو الأسفل
    body = np.sin(2 * np.pi * np.cumsum(freq) / RATE) * np.exp(-t * 16)
    click = rng.standard_normal(n) * np.exp(-t * 260) * 0.9  # نقرة الجلد
    thud = rng.standard_normal(n) * np.exp(-t * 40) * 0.25
    x = body * 1.1 + lowpass(click, 0.5) + lowpass(thud, 0.08)
    x = np.tanh(x * 2.2)  # ضغط/تشبع = لكمة أثقل
    save_mp3('kick-impact', x / (np.abs(x).max() + 1e-9), gain=0.95, bitrate='48k')


crowd_ambient()
crowd_goal()
kick_impact()
