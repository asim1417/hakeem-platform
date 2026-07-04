// المذيع الصغير 🎤 — فقاعة تعليق مرئية مرحة مع كل تسديدة
// الصوت المُولَّد (espeak) حُذف لأنه ضعيف — عند توفر تسجيلات حقيقية للمعلق
// أعِد بناء المقاطع في src/assets/audio/ وأعد ربط التشغيل هنا (انظر git history)

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { COLORS, FONT, GAME_WIDTH, rtl } from '../config/gameConfig';
import { PlayerDef } from '../data/players';

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
  // لا صوت معلّق حاليًا — لا شيء يحتاج إيقافًا عند مغادرة المشهد
  stop(): void {
    /* المؤثرات تُدار في audio.ts */
  },

  // عند التسديد: فقاعة عبارة اللاعب غالبًا، وعبارة عامة أحيانًا
  onShot(scene: Phaser.Scene, player: PlayerDef): void {
    if (Math.random() < 0.65) {
      showBubble(scene, player.cheer, player.color);
    } else {
      showBubble(scene, Phaser.Utils.Array.GetRandom(GENERIC_CHEERS), player.color);
    }
  },

  // عند الحسم: عبارة النتيجة الكبيرة في GameScene تكفي — لا فقاعة إضافية
  onOutcome(_result: 'goal' | 'save' | 'miss', _phrase: string): void {
    /* لا صوت */
  },
};
