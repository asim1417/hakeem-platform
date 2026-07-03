# توليد مقاطع صوت المعلق الصغير — espeak-ng (عربي مُشكَّل بالكامل) + ffmpeg (mp3)
# الاستخدام: python3 scripts/generate-voice.py
# الناتج في src/assets/audio/ — استبدلها بتسجيلات حقيقية بنفس الأسماء متى توفرت
# التشكيل الكامل يحسّن النطق كثيرًا — عدّله هنا إن سمعت لفظًا غير سليم
# ملاحظة: أسماء الملفات يجب أن تطابق src/data/players.ts و src/utils/announcer.ts

import os
import re
import subprocess

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'audio')
os.makedirs(OUT, exist_ok=True)

# عبارات اللاعبين — مُشكَّلة للنطق (النص المعروض في اللعبة يبقى بلا تشكيل)
PLAYER_CHEERS = {
    'saloumi': 'يا سَلامْ يا سَلُّومِي!',
    'hassouni': 'كابْتِن حَسُّونِي يُسَدِّدْ!',
    'hammad': 'العَبْقَرِي حَمَّادْ يَحْسِبُها صَحّ!',
    'mohammed': 'الأُسْطُورَة مُحَمَّدْ لا يَرْحَمْ!',
    'aws': 'المُعَلِّمْ أَوْسْ يَعْرِفُ الزَّاوِيَة!',
    'azzam': 'العُمْدَة عَزَّامْ قائِدُ المَلْعَبْ!',
    'sheikh': 'الشَّيْخُ الهَدَّافْ بِكُلِّ هُدُوءْ!',
    'assoumi': 'الزَّعِيمْ عَصُّومِي نَجْمُ المُبارات!',
}

GENERIC_CHEERS = [
    'الجُمْهُورُ يُشَجِّعُ بِحَماسْ!',
    'يا لَها مِنْ لَحْظَة!',
    'الكُلُّ يَحْبِسُ أَنْفاسَهْ!',
    'تَسْدِيدَةٌ قَوِيَّةٌ قادِمَة!',
]

GOAL_CALLS = ['قُووووولْ!', 'الشَّباكُ تَهْتَزّ! قُوولْ!', 'هَدَفٌ عالَمِيّ!']
SAVE_CALLS = ['تَصَدٍّ رائِعٌ مِنَ الحارِسْ!', 'الحارِسُ يَتَأَلَّقُ اليَوْمْ!']
MISS_CALLS = ['قَرِيبَةٌ مِنَ القائِمْ!', 'كادَتْ أَنْ تَدْخُلْ!']


def clean(text: str) -> str:
    # إبقاء العربية بتشكيلها وعلامات الوقف التي يفهمها المحرك
    return re.sub(r'[^؀-ۿ\s!؟،.a-zA-Z0-9]', '', text).strip()


def synth(name: str, text: str) -> None:
    wav = os.path.join(OUT, f'{name}.wav')
    mp3 = os.path.join(OUT, f'{name}.mp3')
    # سرعة معتدلة ونبرة متوسطة = إلقاء أوضح وأقل حدة
    subprocess.run(
        ['espeak-ng', '-v', 'ar', '-s', '135', '-p', '58', '-a', '180', '-g', '2', '-w', wav, clean(text)],
        check=True,
    )
    # mp3 أحادي 32kbps + قص الصمت الزائد في النهاية + موازنة الصوت
    subprocess.run(
        [
            'ffmpeg', '-y', '-loglevel', 'error', '-i', wav,
            '-ac', '1', '-ar', '22050', '-b:a', '32k',
            '-af', 'silenceremove=stop_periods=1:stop_threshold=-42dB:stop_duration=0.18,volume=1.35',
            mp3,
        ],
        check=True,
    )
    os.remove(wav)
    print('saved', f'{name}.mp3', os.path.getsize(mp3), 'bytes')


for pid, text in PLAYER_CHEERS.items():
    synth(f'cheer-{pid}', text)
for i, text in enumerate(GENERIC_CHEERS):
    synth(f'cheer-gen-{i}', text)
for i, text in enumerate(GOAL_CALLS):
    synth(f'call-goal-{i}', text)
for i, text in enumerate(SAVE_CALLS):
    synth(f'call-save-{i}', text)
for i, text in enumerate(MISS_CALLS):
    synth(f'call-miss-{i}', text)
