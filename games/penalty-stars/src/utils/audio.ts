// نظام الصوت — Howler.js مع أصوات مولّدة برمجيًا (WAV data URI)
// يمكن لاحقًا استبدالها بملفات mp3 حقيقية في public/assets/audio

import { Howl, Howler } from 'howler';

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

const rnd = () => Math.random() * 2 - 1;

// صوت ركل الكرة: ضربة منخفضة + نبضة ضجيج قصيرة
const kickSrc = synth(0.16, (t) => {
  const env = Math.exp(-t * 34);
  return (Math.sin(2 * Math.PI * 95 * t) * 0.8 + rnd() * 0.35) * env;
});

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

// صوت الجمهور: هدير ضجيج متموج
const crowdSrc = synth(1.6, (t) => {
  const swell = Math.sin((Math.PI * t) / 1.6);
  return rnd() * 0.28 * swell * (0.7 + 0.3 * Math.sin(2 * Math.PI * 3 * t));
});

// صوت زر لطيف
const buttonSrc = synth(0.09, (t) => Math.sin(2 * Math.PI * 620 * t) * Math.exp(-t * 40) * 0.5);

// صفارة الحكم
const whistleSrc = synth(0.45, (t) => {
  const vib = 1 + 0.02 * Math.sin(2 * Math.PI * 30 * t);
  const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 5);
  return Math.sin(2 * Math.PI * 2100 * vib * t) * env * 0.4;
});

type SoundName = 'kick' | 'goal' | 'save' | 'crowd' | 'button' | 'whistle';

const sounds: Record<SoundName, Howl> = {
  kick: new Howl({ src: [kickSrc], format: ['wav'] }),
  goal: new Howl({ src: [goalSrc], format: ['wav'], volume: 0.9 }),
  save: new Howl({ src: [saveSrc], format: ['wav'] }),
  crowd: new Howl({ src: [crowdSrc], format: ['wav'], volume: 0.8 }),
  button: new Howl({ src: [buttonSrc], format: ['wav'] }),
  whistle: new Howl({ src: [whistleSrc], format: ['wav'] }),
};

let muted = false;

export const audio = {
  play(name: SoundName): void {
    sounds[name].play();
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
