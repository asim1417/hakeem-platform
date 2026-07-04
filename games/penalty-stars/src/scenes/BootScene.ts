// BootScene — توليد الأصول المؤقتة (أشكال بسيطة) بدل الصور
// لاستبدالها لاحقًا: ضع ملفات PNG في public/assets/images وحمّلها هنا بـ this.load.image

import Phaser from 'phaser';
import { COLORS } from '../config/gameConfig';
import { PLAYERS } from '../data/players';

// خريطة الأصول الموحّدة (الملاعب والكرات) — انظر src/data/assetsManifest.ts
import { assetsManifest } from '../data/assetsManifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // الملاعب والكرات — إن فشل تحميل أي صورة تبقى الأشكال المرسومة احتياطًا
    for (const [key, src] of Object.entries(assetsManifest)) {
      this.load.image(key, src);
    }
    // الصور الحقيقية للاعبين (مضمّنة كـ data URI عند البناء)
    for (const p of PLAYERS) {
      if (p.photo) this.load.image(`avatar-${p.id}`, p.photo);
    }
  }

  create(): void {
    this.makeBall();
    this.makeStar();
    this.makeKeeper();
    this.makeUiKit();
    // شكل مرسوم فقط لمن لا يملك صورة حقيقية
    for (const p of PLAYERS) {
      if (!this.textures.exists(`avatar-${p.id}`)) this.makeAvatar(p.id, p.color);
    }
    this.scene.start('Menu');
  }

  // ── عدة الواجهة وفق دليل الهوية: تدرج نيون، زجاج كحلي، أيقونات موحدة ──
  private makeUiKit(): void {
    this.gradientTexture('btn-primary', '#b7ff2a', '#00d7ff'); // زر أساسي: ليموني ← سماوي
    this.gradientTexture('btn-gold', '#ffd45a', '#ff9d2e'); // مكافآت
    this.glassTexture('btn-glass', 340, 80, 20); // زر ثانوي زجاجي
    this.glassTexture('panel-glass', 360, 120, 18); // لوحة HUD
    this.chipTexture(); // رقاقة دائرية للأيقونات
    this.makeGlyphs();
  }

  // مستطيل متدرج بزوايا دائرية عبر Canvas (تدرج حقيقي)
  private gradientTexture(key: string, c1: string, c2: string): void {
    const w = 340;
    const h = 80;
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    this.roundedPath(ctx, 3, 3, w - 6, h - 6, 20);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    // لمعة علوية خفيفة
    this.roundedPath(ctx, 8, 7, w - 16, h / 2 - 8, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    tex.refresh();
  }

  // طبقة زجاجية كحلية شفافة بحد أبيض ناعم
  private glassTexture(key: string, w: number, h: number, r: number): void {
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    this.roundedPath(ctx, 2, 2, w - 4, h - 4, r);
    ctx.fillStyle = 'rgba(7,17,31,0.62)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();
    tex.refresh();
  }

  private chipTexture(): void {
    const tex = this.textures.createCanvas('chip-glass', 90, 90);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.beginPath();
    ctx.arc(45, 45, 41, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(7,17,31,0.65)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    tex.refresh();
  }

  private roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // أيقونات مرسومة حادة (بيت، صوت، كتم) — أوضح من الإيموجي
  private makeGlyphs(): void {
    let g = this.add.graphics();
    g.fillStyle(0xf8fff7);
    g.fillTriangle(24, 5, 4, 23, 44, 23);
    g.fillRect(10, 23, 28, 18);
    g.fillStyle(0x07111f);
    g.fillRect(19, 29, 10, 12);
    g.generateTexture('ic-home', 48, 48);
    g.destroy();

    for (const [key, muted] of [['ic-sound', false], ['ic-mute', true]] as const) {
      g = this.add.graphics();
      g.fillStyle(0xf8fff7);
      g.fillPoints([
        new Phaser.Math.Vector2(6, 18), new Phaser.Math.Vector2(14, 18),
        new Phaser.Math.Vector2(25, 8), new Phaser.Math.Vector2(25, 40),
        new Phaser.Math.Vector2(14, 30), new Phaser.Math.Vector2(6, 30),
      ], true);
      if (muted) {
        g.lineStyle(4, 0xff3e3e);
        g.lineBetween(31, 16, 43, 32);
        g.lineBetween(43, 16, 31, 32);
      } else {
        g.lineStyle(3.5, 0xf8fff7);
        g.beginPath();
        g.arc(27, 24, 8, -0.85, 0.85);
        g.strokePath();
        g.beginPath();
        g.arc(27, 24, 14, -0.75, 0.75);
        g.strokePath();
      }
      g.generateTexture(key, 48, 48);
      g.destroy();
    }
  }

  // كرة: دائرة بيضاء ببقع سوداء
  private makeBall(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.white).fillCircle(24, 24, 22);
    g.lineStyle(2, 0x333333).strokeCircle(24, 24, 22);
    g.fillStyle(0x333333);
    g.fillCircle(24, 24, 7);
    g.fillCircle(10, 18, 4);
    g.fillCircle(38, 18, 4);
    g.fillCircle(17, 38, 4);
    g.fillCircle(31, 38, 4);
    g.generateTexture('ball', 48, 48);
    g.destroy();
  }

  // نجمة صفراء للاحتفالات والنتائج
  private makeStar(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.yellow);
    const cx = 24;
    const cy = 24;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 22 : 9;
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      pts.push(new Phaser.Math.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
    g.fillPoints(pts, true);
    g.lineStyle(2, 0xe8a800).strokePoints(pts, true);
    g.generateTexture('star', 48, 48);
    g.destroy();
  }

  // الحارس بحالتين (استعداد/ارتماء) ونسختين: عادي (برتقالي) وحديدي (فولاذي)
  private makeKeeper(): void {
    this.keeperVariant('keeper', COLORS.orange, 0xffe066);
    this.keeperVariant('keeper-iron', 0x8a8f98, 0xd0d4da);
  }

  private keeperVariant(key: string, body: number, gloves: number): void {
    // وضع الاستعداد: يدان مرفوعتان جانبًا
    let g = this.add.graphics();
    g.fillStyle(body).fillRoundedRect(20, 34, 60, 66, 14);
    g.fillStyle(gloves);
    g.fillCircle(12, 48, 11);
    g.fillCircle(88, 48, 11);
    this.keeperFace(g, 50, 20);
    g.generateTexture(key, 100, 104);
    g.destroy();

    // وضع الارتماء: ذراعان ممدودتان بالكامل والجسم متمدد
    g = this.add.graphics();
    g.fillStyle(body).fillRoundedRect(14, 42, 72, 56, 16);
    // الذراعان الممدودتان
    g.fillStyle(body);
    g.fillRoundedRect(0, 46, 22, 12, 6);
    g.fillRoundedRect(78, 46, 22, 12, 6);
    g.fillStyle(gloves);
    g.fillCircle(6, 52, 10);
    g.fillCircle(94, 52, 10);
    this.keeperFace(g, 50, 26);
    g.generateTexture(`${key}-dive`, 100, 104);
    g.destroy();
  }

  private keeperFace(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.fillStyle(0xffd7b3).fillCircle(cx, cy, 17);
    g.fillStyle(0x333333);
    g.fillCircle(cx - 6, cy - 3, 2.4);
    g.fillCircle(cx + 6, cy - 3, 2.4);
    g.lineStyle(2.5, 0x333333);
    g.beginPath();
    g.arc(cx, cy + 2, 7, 0.25, Math.PI - 0.25);
    g.strokePath();
  }

  // صورة رمزية للاعب: وجه مبتسم بقميص ملون
  private makeAvatar(id: string, color: number): void {
    const g = this.add.graphics();
    // القميص
    g.fillStyle(color).fillRoundedRect(14, 54, 72, 42, 12);
    // الرأس
    g.fillStyle(0xffd7b3).fillCircle(50, 32, 26);
    // العينان
    g.fillStyle(0x333333);
    g.fillCircle(41, 28, 3.5);
    g.fillCircle(59, 28, 3.5);
    // ابتسامة كبيرة
    g.lineStyle(3.5, 0x333333);
    g.beginPath();
    g.arc(50, 36, 11, 0.2, Math.PI - 0.2);
    g.strokePath();
    g.generateTexture(`avatar-${id}`, 100, 100);
    g.destroy();
  }
}
