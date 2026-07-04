// نظام الصوت — Howler.js: مؤثرات mp3 مولّدة (scripts/generate-sfx.py) + أصوات WAV برمجية
// يمكن لاحقًا استبدال أي ملف بتسجيل حقيقي بنفس الاسم في src/assets/sfx

import { Howl, Howler } from 'howler';
import kickImpactSrc from '../assets/sfx/kick-impact.mp3';
import crowdGoalSrc from '../assets/sfx/crowd-goal.mp3';
import crowdAmbientSrc from '../assets/sfx/crowd-ambient.mp3';
import whiffSrc from '../assets/sfx/whiff.mp3';
import whistleRealSrc from '../assets/sfx/whistle.mp3';
import punchSrc from '../assets/sfx/punch.mp3';

const RATE = 22050;

// ترميز عينات صوتية إلى WAV base64
function encodeWav(samples: Float32Array): string {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return 'data:audio/wav;base64,' + btoa(bin);
}

function synth(duration: number, fn: (t: number, i: number) => number): string {
  const n = Math.floor(RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE, i);
  return encodeWav(out);
}


// (صوت الركلة والجماهير صارا mp3 من scripts/generate-sfx.py)

// صوت الهدف: نغمات صاعدة فرحة
const goalSrc = synth(0.85, (t) => {
  const notes = [523, 659, 784, 1046];
  const idx = Math.min(3, Math.floor(t / 0.2));
  const lt = t - idx * 0.2;
  const env = Math.exp(-lt * 7) * 0.6;
  const f = notes[idx];
  return (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2 * t)) * env;
});

// صوت التصدي: نغمة هابطة لطيفة (غير محبطة)
const saveSrc = synth(0.4, (t) => {
  const f = 330 - 140 * t;
  return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 6) * 0.55;
});

// صوت زر لطيف
const buttonSrc = synth(0.09, (t) => Math.sin(2 * Math.PI * 620 * t) * Math.exp(-t * 40) * 0.5);

// نغمة الكأس: فانفار صاعد احتفالي
const trophySrc = synth(1.3, (t) => {
  const notes = [523, 659, 784, 1046, 1318];
  const idx = Math.min(4, Math.floor(t / 0.22));
  const lt = t - idx * 0.22;
  const env = Math.exp(-lt * 5) * 0.55;
  const f = notes[idx];
  return (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.5 * t)) * env;
});

// جرس فتح مكافأة: نغمتان لامعتان
const unlockSrc = synth(0.5, (t) => {
  const f = t < 0.18 ? 660 : 990;
  const lt = t < 0.18 ? t : t - 0.18;
  return Math.sin(2 * Math.PI * f * t) * Math.exp(-lt * 9) * 0.5;
});

// طنين القائم/العارضة: رنة معدنية قصيرة
const postSrc = synth(0.35, (t) => {
  const env = Math.exp(-t * 12);
  return (Math.sin(2 * Math.PI * 880 * t) + 0.6 * Math.sin(2 * Math.PI * 1320 * t)) * env * 0.5;
});

type SoundName = 'kick' | 'goal' | 'save' | 'crowd' | 'button' | 'whistle' | 'trophy' | 'unlock' | 'post' | 'whiff' | 'punch';

// أحجام متوازنة: المؤثرات تحت صوت المعلق حتى لا تطغى عليه
// kick وcrowd صارا mp3 (ارتطام مضغوط + هتاف هدف حقيقي الإحساس)
const sounds: Record<SoundName, Howl> = {
  kick: new Howl({ src: [kickImpactSrc], format: ['mp3'], volume: 0.85 }),
  goal: new Howl({ src: [goalSrc], format: ['wav'], volume: 0.65 }),
  save: new Howl({ src: [saveSrc], format: ['wav'], volume: 0.7 }),
  crowd: new Howl({ src: [crowdGoalSrc], format: ['mp3'], volume: 0.5 }),
  button: new Howl({ src: [buttonSrc], format: ['wav'], volume: 0.7 }),
  // صافرة الحكم الحقيقية (بِف-بِف) من حزمة nojoom_audio
  whistle: new Howl({ src: [whistleRealSrc], format: ['mp3'], volume: 0.65 }),
  trophy: new Howl({ src: [trophySrc], format: ['wav'], volume: 0.85 }),
  unlock: new Howl({ src: [unlockSrc], format: ['wav'], volume: 0.8 }),
  post: new Howl({ src: [postSrc], format: ['wav'], volume: 0.75 }),
  whiff: new Howl({ src: [whiffSrc], format: ['mp3'], volume: 0.6 }),
  punch: new Howl({ src: [punchSrc], format: ['mp3'], volume: 0.8 }), // التحام الحائط
};

// 🏟️ أجواء الملعب: حلقة جماهير خلفية مستمرة أثناء اللعب فقط
const ambient = new Howl({ src: [crowdAmbientSrc], format: ['mp3'], volume: 0.2, loop: true });

let muted = false;

export const audio = {
  play(name: SoundName): void {
    sounds[name].play();
  },
  // تشغيل/إيقاف حلقة أجواء الملعب — بدخول متدرج حتى لا تفاجئ الطفل
  setAmbient(on: boolean): void {
    if (on) {
      if (!ambient.playing()) {
        ambient.volume(0);
        ambient.play();
        ambient.fade(0, 0.2, 900);
      }
    } else if (ambient.playing()) {
      ambient.fade(ambient.volume(), 0, 350);
      setTimeout(() => ambient.stop(), 400);
    }
  },
  toggleMute(): boolean {
    muted = !muted;
    Howler.mute(muted);
    return muted;
  },
  isMuted(): boolean {
    return muted;
  },
};
