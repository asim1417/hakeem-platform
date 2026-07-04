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

  // إطار الطاقة «فوتبول فيوتشر»: حلقة متدرجة ليموني→سماوي مثل بقية النجوم
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, '#c6ff00');
  grad.addColorStop(1, '#00e5ff');
  ctx.lineWidth = 14;
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#0b0f14';
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
  tex.refresh();
}
