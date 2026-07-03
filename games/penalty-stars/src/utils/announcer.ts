// المذيع الصغير 🎤 — فقاعة تعليق مرحة مع كل تسديدة
// يعرض العبارة بصريًا، وينطقها بصوت عربي إن توفر في المتصفح (Web Speech API)

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { COLORS, FONT, GAME_WIDTH, rtl } from '../config/gameConfig';
import { PlayerDef } from '../data/players';
import { audio } from './audio';

// عبارات عامة تتناوب مع عبارة اللاعب حتى لا يمل الطفل
const GENERIC_CHEERS = [
  'الجمهور يشجع بحماس!',
  'يا لها من لحظة!',
  'الكل يحبس أنفاسه!',
  'تسديدة قوية قادمة!',
];

const GOAL_CALLS = ['قوووووول!', 'الشباك تهتز!', 'هدف عالمي!'];
const SAVE_CALLS = ['تصدٍّ رائع من الحارس!', 'الحارس يتألق اليوم!'];
const MISS_CALLS = ['قريبة من القائم!', 'كادت أن تدخل!'];

const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
let speechUnlocked = false;

// iOS وبعض المتصفحات لا تسمح بالنطق إلا بعد لمسة من المستخدم —
// نفتح المحرك بعبارة صامتة عند أول لمسة (يُستدعى من main.ts)
export function unlockSpeech(): void {
  if (!speechSupported || speechUnlocked) return;
  speechUnlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {
    /* لا شيء */
  }
}

// قوائم الأصوات تُحمّل بشكل غير متزامن — نعيد السؤال عند كل نطق حتى نجد صوتًا عربيًا
let arabicVoice: SpeechSynthesisVoice | null = null;
function pickArabicVoice(): SpeechSynthesisVoice | null {
  if (arabicVoice) return arabicVoice;
  const voices = speechSynthesis.getVoices();
  arabicVoice =
    voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ar-sa')) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('ar')) ??
    null;
  return arabicVoice;
}
if (speechSupported) {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    arabicVoice = null;
    pickArabicVoice();
  });
}

// نطق العبارة بصوت مرح (يتجاهل الإيموجي) — يصمت مع كتم الصوت
function speak(text: string): void {
  if (!speechSupported || audio.isMuted()) return;

  const doSpeak = () => {
    try {
      const utter = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s!؟،]/gu, '').trim());
      utter.lang = 'ar-SA';
      const voice = pickArabicVoice();
      if (voice) utter.voice = voice;
      utter.rate = 1.05;
      utter.pitch = 1.15; // نبرة طفولية مرحة
      utter.volume = 1;
      speechSynthesis.resume(); // كروم يعلق المحرك أحيانًا بعد الخمول
      speechSynthesis.speak(utter);
    } catch {
      // المتصفح لا يدعم النطق — الفقاعة البصرية تكفي
    }
  };

  // خلل معروف في كروم: cancel() ثم speak() فورًا يبتلع العبارة —
  // نلغي فقط إن كان يتكلم فعلًا وننتظر لحظة قبل النطق الجديد
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      setTimeout(doSpeak, 80);
    } else {
      doSpeak();
    }
  } catch {
    /* لا شيء */
  }
}

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
  // عند التسديد: عبارة اللاعب غالبًا، وعبارة عامة أحيانًا
  onShot(scene: Phaser.Scene, player: PlayerDef): void {
    const text = Math.random() < 0.65 ? player.cheer : Phaser.Utils.Array.GetRandom(GENERIC_CHEERS);
    showBubble(scene, text, player.color);
    speak(text);
  },

  // عند الحسم: نطق صوتي فقط — العبارة الوسطى الموجودة تكفي بصريًا
  onOutcome(result: 'goal' | 'save' | 'miss', phrase: string): void {
    const call =
      result === 'goal'
        ? Phaser.Utils.Array.GetRandom(GOAL_CALLS)
        : result === 'save'
          ? Phaser.Utils.Array.GetRandom(SAVE_CALLS)
          : Phaser.Utils.Array.GetRandom(MISS_CALLS);
    speak(`${call} ${phrase}`);
  },
};
