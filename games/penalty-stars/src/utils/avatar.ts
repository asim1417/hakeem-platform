// بناء أفاتار دائري بإطار ذهبي من صورة خام (للاعبين الذين يضيفهم الأهل من الجهاز)
// صور اللاعبين الأساسيين تأتي جاهزة من خط الأصول — هذه للأصول المضافة وقت التشغيل فقط

import Phaser from 'phaser';

const SIZE = 200;

export function makeCircularAvatar(scene: Phaser.Scene, avatarKey: string, photoKey: string): void {
  if (scene.textures.exists(avatarKey) || !scene.textures.exists(photoKey)) return;
  const src = scene.textures.get(photoKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const tex = scene.textures.createCanvas(avatarKey, SIZE, SIZE);
  if (!tex) return;
  const ctx = tex.getContext();

  // قص دائري يملأ الإطار (cover) من مركز الصورة
  const side = Math.min(src.width, src.height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 8, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  ctx.restore();

  // إطار ذهبي مزدوج مثل بقية النجوم
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#ffd45a';
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 3, 0, Math.PI * 2);
  ctx.stroke();
  tex.refresh();
}
