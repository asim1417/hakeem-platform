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

// عبارة تشجيعية تقفز في منتصف الشاشة ثم تختفي
export function bouncePhrase(text: Phaser.GameObjects.Text): void {
  text.setScale(0).setAlpha(1);
  gsap
    .timeline()
    .to(text, { scale: 1, duration: 0.45, ease: 'back.out(2.5)' })
    .to(text, { alpha: 0, y: text.y - 30, duration: 0.4, delay: 1.1 });
}
