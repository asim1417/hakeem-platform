// حركات احتفالية — GSAP فوق كائنات Phaser

import { gsap } from 'gsap';
import Phaser from 'phaser';

// ظهور مرن للعناصر (أزرار، عناوين)
export function popIn(target: Phaser.GameObjects.GameObject & { scale: number }, delay = 0): void {
  const finalScale = target.scale;
  target.scale = 0;
  gsap.to(target, { scale: finalScale, duration: 0.5, delay, ease: 'back.out(2)' });
}

// نبض مستمر لجذب الانتباه (زر ابدأ) — يبدأ بعد اكتمال popIn
export function pulse(target: { scale: number }): void {
  gsap.to(target, { scale: 1.07, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.1 });
}

// نجوم متطايرة عند الهدف
export function starBurst(scene: Phaser.Scene, x: number, y: number, count = 10): void {
  for (let i = 0; i < count; i++) {
    const star = scene.add.image(x, y, 'star').setDepth(50).setScale(0.4 + Math.random() * 0.6);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 90 + Math.random() * 140;
    gsap.to(star, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist - 40,
      angle: Math.random() * 360,
      alpha: 0,
      duration: 0.9 + Math.random() * 0.5,
      ease: 'power2.out',
      onComplete: () => star.destroy(),
    });
  }
}

// قصاصات ورقية ملونة تتساقط
export function confetti(scene: Phaser.Scene, count = 40): void {
  const colors = [0xffd93d, 0xff6b9d, 0x2f9bff, 0x35c96b, 0xff8c42, 0x9b6bff];
  const w = scene.scale.width;
  for (let i = 0; i < count; i++) {
    const piece = scene.add
      .rectangle(Math.random() * w, -20 - Math.random() * 150, 8 + Math.random() * 8, 6 + Math.random() * 6, colors[i % colors.length])
      .setDepth(60);
    gsap.to(piece, {
      y: scene.scale.height + 40,
      x: piece.x + (Math.random() * 160 - 80),
      angle: Math.random() * 720 - 360,
      duration: 1.6 + Math.random() * 1.4,
      ease: 'power1.in',
      onComplete: () => piece.destroy(),
    });
  }
}

// انفجار إيموجي — أساس الاحتفالات الخاصة
function emojiBurst(scene: Phaser.Scene, x: number, y: number, emoji: string, count = 8): void {
  for (let i = 0; i < count; i++) {
    const e = scene.add
      .text(x, y, emoji, { fontSize: `${22 + Math.random() * 16}px` })
      .setOrigin(0.5)
      .setDepth(55);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    gsap.to(e, {
      x: x + Math.cos(angle) * (70 + Math.random() * 110),
      y: y + Math.sin(angle) * (60 + Math.random() * 90) - 50,
      angle: Math.random() * 240 - 120,
      alpha: 0,
      duration: 1 + Math.random() * 0.5,
      ease: 'power2.out',
      onComplete: () => e.destroy(),
    });
  }
}

// إيموجي كبير يصعد فوق نقطة (كأس، علم، مصباح...)
function risingEmoji(scene: Phaser.Scene, x: number, y: number, emoji: string): void {
  const e = scene.add.text(x, y, emoji, { fontSize: '56px' }).setOrigin(0.5).setDepth(55).setScale(0);
  gsap
    .timeline()
    .to(e, { scale: 1, duration: 0.35, ease: 'back.out(2.5)' })
    .to(e, { angle: 14, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<')
    .to(e, { y: y - 70, alpha: 0, duration: 0.6, delay: 0.2, onComplete: () => e.destroy() });
}

// الاحتفال المرئي الخاص بكل لاعب عند الهدف
export function playerCelebration(
  scene: Phaser.Scene,
  type: string,
  avatar: Phaser.GameObjects.Image | undefined,
  goalX: number,
  goalY: number,
): void {
  switch (type) {
    case 'run': // يجري حول الكرة
      if (avatar) {
        const { x, y } = avatar;
        gsap.to(avatar, {
          keyframes: [
            { x: x - 70, y: y - 30 },
            { x: x, y: y - 60 },
            { x: x + 70, y: y - 30 },
            { x: x, y: y },
          ],
          duration: 1.1,
          ease: 'power1.inOut',
        });
      }
      emojiBurst(scene, goalX, goalY, '💨', 6);
      break;
    case 'cup': // يرفع الكأس
      if (avatar) risingEmoji(scene, avatar.x, avatar.y - 70, '🏆');
      break;
    case 'fire': // نار خلف الكرة
      emojiBurst(scene, goalX, goalY, '🔥', 12);
      break;
    case 'flag': // علم يرفرف
      if (avatar) risingEmoji(scene, avatar.x, avatar.y - 70, '🚩');
      emojiBurst(scene, goalX, goalY, '🎯', 5);
      break;
    case 'crowd': // تصفيق جماهيري
      for (let i = 0; i < 8; i++) {
        const clap = scene.add
          .text(40 + Math.random() * (scene.scale.width - 80), scene.scale.height - 30, '👏', { fontSize: '34px' })
          .setOrigin(0.5)
          .setDepth(55);
        gsap.to(clap, {
          y: scene.scale.height - 260 - Math.random() * 120,
          alpha: 0,
          duration: 1.2 + Math.random() * 0.6,
          delay: Math.random() * 0.4,
          onComplete: () => clap.destroy(),
        });
      }
      break;
    case 'stars': // نجوم مضيئة
      starBurst(scene, goalX, goalY, 18);
      emojiBurst(scene, goalX, goalY, '✨', 8);
      break;
    case 'dance': // رقصة الزعيم
      if (avatar) {
        gsap.to(avatar, { angle: 18, duration: 0.16, yoyo: true, repeat: 7, ease: 'sine.inOut' });
        gsap.to(avatar, { y: avatar.y - 22, duration: 0.32, yoyo: true, repeat: 3, ease: 'sine.inOut' });
      }
      emojiBurst(scene, goalX, goalY, '🎵', 7);
      break;
    case 'smart': // فكرة عبقرية
      if (avatar) risingEmoji(scene, avatar.x, avatar.y - 70, '💡');
      emojiBurst(scene, goalX, goalY, '🤓', 5);
      break;
  }
}

// عبارة تشجيعية تقفز في منتصف الشاشة ثم تختفي
export function bouncePhrase(text: Phaser.GameObjects.Text): void {
  text.setScale(0).setAlpha(1);
  gsap
    .timeline()
    .to(text, { scale: 1, duration: 0.45, ease: 'back.out(2.5)' })
    .to(text, { alpha: 0, y: text.y - 30, duration: 0.4, delay: 1.1 });
}
