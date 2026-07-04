// المذيع الصغير 🎤 — فقاعة تعليق + صوت من حزمة nojoom_audio (تعليق عربي قصير)
// قناة واحدة: مقطع جديد يوقف السابق — لا تراكب أبدًا
// لاستبدال أي مقطع بصوت بشري: ضع mp3 بنفس الاسم في src/assets/audio/ وأعد البناء

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { Howl } from 'howler';
import { COLORS, FONT, GAME_WIDTH, rtl } from '../config/gameConfig';
import { PlayerDef } from '../data/players';
import shootSrc from '../assets/audio/shoot.mp3';
import goalSrc from '../assets/audio/goal.mp3';
import greatGoalSrc from '../assets/audio/great-goal.mp3';
import savedSrc from '../assets/audio/saved.mp3';
import ohMySrc from '../assets/audio/oh-my.mp3';
import outSrc from '../assets/audio/out.mp3';
import penaltySrc from '../assets/audio/penalty.mp3';
import getReadySrc from '../assets/audio/get-ready.mp3';
import wellDoneSrc from '../assets/audio/well-done.mp3';

type ClipName = 'shoot' | 'goal' | 'great-goal' | 'saved' | 'oh-my' | 'out' | 'penalty' | 'get-ready' | 'well-done';

const clips: Record<ClipName, Howl> = {
  shoot: new Howl({ src: [shootSrc], format: ['mp3'], volume: 1.0 }),
  goal: new Howl({ src: [goalSrc], format: ['mp3'], volume: 1.0 }),
  'great-goal': new Howl({ src: [greatGoalSrc], format: ['mp3'], volume: 1.0 }),
  saved: new Howl({ src: [savedSrc], format: ['mp3'], volume: 1.0 }),
  'oh-my': new Howl({ src: [ohMySrc], format: ['mp3'], volume: 1.0 }),
  out: new Howl({ src: [outSrc], format: ['mp3'], volume: 1.0 }),
  penalty: new Howl({ src: [penaltySrc], format: ['mp3'], volume: 1.0 }),
  'get-ready': new Howl({ src: [getReadySrc], format: ['mp3'], volume: 1.0 }),
  'well-done': new Howl({ src: [wellDoneSrc], format: ['mp3'], volume: 1.0 }),
};

let currentClip: Howl | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function playClip(name: ClipName, delayMs = 0): void {
  const clip = clips[name];
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    currentClip?.stop();
    currentClip = clip;
    clip.play(); // كتم Howler العام (زر 🔊) يشمل المقاطع تلقائيًا
  }, delayMs);
}

// عبارات عامة تتناوب مع عبارة اللاعب حتى لا يمل الطفل
const GENERIC_CHEERS = [
  'الجمهور يشجع بحماس!',
  'يا لها من لحظة!',
  'الكل يحبس أنفاسه!',
  'تسديدة قوية قادمة!',
  'تسديييدة!',
];

// فقاعة المذيع: تنزلق من الأعلى، تثبت لحظة، ثم تختفي
function showBubble(scene: Phaser.Scene, text: string, color: number): void {
  const y = 150;
  const label = scene.add
    .text(0, 0, rtl(`🎤 ${text}`), {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#0b0f14',
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
  // إيقاف كامل — عند مغادرة المشهد حتى لا يصدح المعلق في الشاشة التالية
  stop(): void {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
    currentClip?.stop();
    currentClip = null;
  },

  // بداية الجولة: «ضربة جزاء!» بعد الصافرة
  onReady(): void {
    playClip('penalty', 600);
  },

  // عند التسديد: فقاعة عبارة اللاعب + نداء «تسديدة!»
  onShot(scene: Phaser.Scene, player: PlayerDef): void {
    if (Math.random() < 0.65) showBubble(scene, player.cheer, player.color);
    else showBubble(scene, Phaser.Utils.Array.GetRandom(GENERIC_CHEERS), player.color);
    playClip('shoot', 180);
  },

  // عند الحسم: نداء النتيجة بعد أن يهدأ مؤثر الهدف/التصدي
  onOutcome(result: 'goal' | 'save' | 'miss', _phrase: string): void {
    const pick: Record<typeof result, ClipName[]> = {
      goal: ['goal', 'great-goal'],
      save: ['saved', 'oh-my'],
      miss: ['out', 'oh-my'],
    };
    playClip(Phaser.Utils.Array.GetRandom(pick[result]), 550);
  },

  // احتفال نهاية الجولة الناجحة: «أحسنت!»
  onCelebrate(): void {
    playClip('well-done', 700);
  },
};
