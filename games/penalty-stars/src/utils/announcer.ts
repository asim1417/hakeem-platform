// المذيع الصغير 🎤 — فقاعة تعليق مرحة مع كل تسديدة
// الصوت مقاطع mp3 مضمّنة تُشغَّل عبر Howler (نفس قناة بقية الأصوات) —
// لا اعتماد على محرك نطق المتصفح غير الموثوق على الجوالات.
// المقاطع مولّدة عبر scripts/generate-voice.py وقابلة للاستبدال بتسجيلات حقيقية.

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { Howl } from 'howler';
import { COLORS, FONT, GAME_WIDTH, rtl } from '../config/gameConfig';
import { PlayerDef } from '../data/players';
import { audio } from './audio';
import { progress } from './progress';

// تحميل كل مقاطع المعلق — تُضمّن data URI عند البناء
const clipModules = import.meta.glob('../assets/audio/*.mp3', { eager: true, import: 'default' }) as Record<string, string>;

const clips = new Map<string, Howl>();
for (const [path, src] of Object.entries(clipModules)) {
  const name = path.split('/').pop()!.replace('.mp3', '');
  clips.set(name, new Howl({ src: [src], format: ['mp3'], volume: 1.0 }));
}

// قناة واحدة للمعلق: مقطع جديد يوقف السابق — لا تراكب أبدًا
let currentClip: Howl | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function playClip(name: string, delayMs = 0): void {
  if (!progress.announcerEnabled()) return;
  const clip = clips.get(name);
  if (!clip) return;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    currentClip?.stop();
    currentClip = clip;
    clip.play(); // كتم Howler العام (زر 🔊) يشمل المقاطع تلقائيًا
  }, delayMs);
}

// عبارات عامة تتناوب مع عبارة اللاعب حتى لا يمل الطفل
// (النصوص تطابق المقاطع cheer-gen-* في scripts/generate-voice.py)
const GENERIC_CHEERS = [
  'الجمهور يشجع بحماس!',
  'يا لها من لحظة!',
  'الكل يحبس أنفاسه!',
  'تسديدة قوية قادمة!',
  'تسديييدة!',
];

// goal-3 = «جوووووول!» الممدودة، save-2 = «يا إلهي! ما هذا التصدي!»
const CALL_COUNTS = { goal: 4, save: 3, miss: 2 } as const;

// فقاعة المذيع: تنزلق من الأعلى، تثبت لحظة، ثم تختفي
function showBubble(scene: Phaser.Scene, text: string, color: number): void {
  const y = 150;
  const label = scene.add
    .text(0, 0, rtl(`🎤 ${text}`), {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#1a5c2e',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  const w = label.width + 44;
  const bg = scene.add.rectangle(0, 0, w, 52, COLORS.white, 0.97).setOrigin(0.5);
  bg.setStrokeStyle(4, color);
  const bubble = scene.add.container(GAME_WIDTH / 2, y, [bg, label]).setDepth(45);

  bubble.y = y - 70;
  bubble.setAlpha(0);
  gsap
    .timeline()
    .to(bubble, { y, alpha: 1, duration: 0.4, ease: 'back.out(2)' })
    .to(bubble, { y: y - 40, alpha: 0, duration: 0.35, delay: 1.5, onComplete: () => bubble.destroy() });
}

export const announcer = {
  // إيقاف كامل — يُستدعى عند مغادرة المشهد حتى لا يصدح المعلق في الشاشة التالية
  stop(): void {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
    currentClip?.stop();
    currentClip = null;
  },

  // عند التسديد: عبارة اللاعب غالبًا، وعبارة عامة أحيانًا — الفقاعة والصوت معًا
  // تأخير قصير حتى لا يتراكب مع صوت الركلة
  onShot(scene: Phaser.Scene, player: PlayerDef): void {
    if (Math.random() < 0.65) {
      showBubble(scene, player.cheer, player.color);
      // لاعبو العائلة بلا مقطع خاص — يهتف لهم المعلق بعبارة عامة
      if (clips.has(`cheer-${player.id}`)) playClip(`cheer-${player.id}`, 220);
      else playClip(`cheer-gen-${Math.floor(Math.random() * GENERIC_CHEERS.length)}`, 220);
    } else {
      const i = Math.floor(Math.random() * GENERIC_CHEERS.length);
      showBubble(scene, GENERIC_CHEERS[i], player.color);
      playClip(`cheer-gen-${i}`, 220);
    }
  },

  // عند الحسم: يوقف عبارة التسديدة وينادي بعد أن يهدأ مؤثر الهدف/التصدي
  onOutcome(result: 'goal' | 'save' | 'miss', _phrase: string): void {
    if (audio.isMuted()) return;
    const i = Math.floor(Math.random() * CALL_COUNTS[result]);
    playClip(`call-${result}-${i}`, 550);
  },
};
