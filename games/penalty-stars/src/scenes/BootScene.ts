// BootScene — توليد الأصول المؤقتة (أشكال بسيطة) بدل الصور
// لاستبدالها لاحقًا: ضع ملفات PNG في public/assets/images وحمّلها هنا بـ this.load.image

import Phaser from 'phaser';
import { COLORS } from '../config/gameConfig';
import { PLAYERS } from '../data/players';
import { progress } from '../utils/progress';
import { makeCircularAvatar } from '../utils/avatar';

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
    // صور لاعبي العائلة المضافين — من ذاكرة الجهاز، تُقصّ دائريًا في create
    for (const c of progress.customPlayers()) {
      this.load.image(`photo-${c.id}`, c.photo);
    }
  }

  create(): void {
    this.makeBall();
    this.makeStar();
    this.makeKeeper();
    this.makeUiKit();
    this.makeShieldLogo();
    this.makeExtraGlyphs();
    // شكل مرسوم فقط لمن لا يملك صورة حقيقية
    for (const p of PLAYERS) {
      if (!this.textures.exists(`avatar-${p.id}`)) this.makeAvatar(p.id, p.color);
    }
    // أفاتار دائري بإطار ذهبي للاعبي العائلة
    for (const c of progress.customPlayers()) {
      makeCircularAvatar(this, `avatar-${c.id}`, `photo-${c.id}`);
    }
    // أول شاشة: اختيار اللاعب — كل من يفتح اللعبة يختار لاعبه بنفسه، لا لاعب افتراضي
    this.scene.start('PlayerSelect');
  }

  // ── عدة الواجهة وفق دليل الهوية: تدرج نيون، زجاج كحلي، أيقونات موحدة ──
  private makeUiKit(): void {
    this.gradientTexture('btn-primary', '#b7ff2a', '#00d7ff'); // زر أساسي: ليموني ← سماوي
    this.gradientTexture('btn-gold', '#ffd45a', '#ff9d2e'); // مكافآت
    this.glassTexture('btn-glass', 340, 80, 20, true); // زر ثانوي: أبيض شفاف بحد خفيف (الدليل §7)
    this.glassTexture('panel-glass', 360, 120, 18); // لوحة HUD كحلية للوضوح فوق الملاعب
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

  // طبقة زجاجية شفافة بحد ناعم — كحلية للوحات، بيضاء للأزرار الثانوية (وفق الدليل)
  private glassTexture(key: string, w: number, h: number, r: number, light = false): void {
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    this.roundedPath(ctx, 2, 2, w - 4, h - 4, r);
    // زجاج أبيض فوق تعتيم خفيف يضمن قراءة النص الأبيض على الملاعب المضيئة
    ctx.fillStyle = light ? 'rgba(7,17,31,0.35)' : 'rgba(7,17,31,0.62)';
    ctx.fill();
    if (light) {
      this.roundedPath(ctx, 2, 2, w - 4, h - 4, r);
      ctx.fillStyle = 'rgba(248,255,247,0.16)';
      ctx.fill();
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = light ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.5)';
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

  // شعار الدرع الكروي (هوية §4): درع كحلي بحد ذهبي + كرة + نجمة + خط ضوء
  private makeShieldLogo(): void {
    const g = this.add.graphics();
    const pts = [
      new Phaser.Math.Vector2(60, 4), new Phaser.Math.Vector2(112, 20),
      new Phaser.Math.Vector2(112, 74), new Phaser.Math.Vector2(60, 128),
      new Phaser.Math.Vector2(8, 74), new Phaser.Math.Vector2(8, 20),
    ];
    g.fillStyle(0x07111f, 0.96);
    g.fillPoints(pts, true);
    g.lineStyle(5, 0xffd45a);
    g.strokePoints(pts, true);
    // خط ضوء مائل
    g.fillStyle(0xb7ff2a, 0.22);
    g.fillPoints([
      new Phaser.Math.Vector2(20, 14), new Phaser.Math.Vector2(44, 10),
      new Phaser.Math.Vector2(96, 110), new Phaser.Math.Vector2(72, 116),
    ], true);
    // الكرة
    g.fillStyle(0xf8fff7);
    g.fillCircle(60, 62, 24);
    g.fillStyle(0x07111f);
    g.fillCircle(60, 62, 8);
    for (let k = 0; k < 5; k++) {
      const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
      g.fillCircle(60 + 17 * Math.cos(a), 62 + 17 * Math.sin(a), 4.5);
    }
    // النجمة الذهبية أعلى الكرة
    g.fillStyle(0xffd45a);
    const star: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 11 : 4.5;
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      star.push(new Phaser.Math.Vector2(60 + r * Math.cos(a), 26 + r * Math.sin(a)));
    }
    g.fillPoints(star, true);
    g.generateTexture('logo-shield', 120, 132);
    g.destroy();
  }

  private makeExtraGlyphs(): void {
    // إيقاف مؤقت
    let g = this.add.graphics();
    g.fillStyle(0xf8fff7);
    g.fillRoundedRect(12, 8, 9, 32, 3);
    g.fillRoundedRect(27, 8, 9, 32, 3);
    g.generateTexture('ic-pause', 48, 48);
    g.destroy();
    // ترس الإعدادات
    g = this.add.graphics();
    g.fillStyle(0xf8fff7);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillRoundedRect(24 + Math.cos(a) * 15 - 4, 24 + Math.sin(a) * 15 - 4, 8, 8, 2);
    }
    g.fillCircle(24, 24, 13);
    g.fillStyle(0x07111f);
    g.fillCircle(24, 24, 5.5);
    g.generateTexture('ic-gear', 48, 48);
    g.destroy();
    // كأس ذهبي مرسوم
    g = this.add.graphics();
    g.fillStyle(0xffd45a);
    g.fillRoundedRect(14, 6, 20, 18, { tl: 4, tr: 4, bl: 9, br: 9 });
    g.lineStyle(4, 0xffd45a);
    g.strokeCircle(10, 12, 5);
    g.strokeCircle(38, 12, 5);
    g.fillRect(21, 24, 6, 7);
    g.fillRoundedRect(14, 31, 20, 6, 2);
    g.fillStyle(0xb8860b);
    g.fillRect(16, 33, 16, 2);
    g.generateTexture('ic-trophy', 48, 42);
    g.destroy();
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

  // ── الحارس: شخصية كاملة بخمس حالات × نسختين (عادي/حديدي) ──
  private makeKeeper(): void {
    const kits = [
      { key: 'keeper', jersey: 0xff8c42, dark: 0xd96f2a, glove: 0xffe066, shorts: 0x2b2b3a },
      { key: 'keeper-iron', jersey: 0x8a8f98, dark: 0x6b7078, glove: 0xd0d4da, shorts: 0x2b2f36 },
    ];
    const states = ['', '-dive', '-save', '-sad', '-happy'] as const;
    for (const kit of kits) {
      for (const st of states) this.drawKeeperState(kit, st);
    }
    this.makeWallPlayer();
  }

  private drawKeeperState(
    kit: { key: string; jersey: number; dark: number; glove: number; shorts: number },
    state: '' | '-dive' | '-save' | '-sad' | '-happy',
  ): void {
    const g = this.add.graphics();
    const cx = 55;
    const skin = 0xffd7b3;
    const isDive = state === '-dive';

    // الساقان والجوارب والأحذية (في الارتماء تتجهان جانبًا)
    g.fillStyle(skin);
    if (isDive) {
      g.fillRoundedRect(cx - 6, 96, 40, 11, 5);
    } else {
      g.fillRect(cx - 16, 92, 11, 20);
      g.fillRect(cx + 5, 92, 11, 20);
      g.fillStyle(0xffffff);
      g.fillRect(cx - 16, 104, 11, 8);
      g.fillRect(cx + 5, 104, 11, 8);
      g.fillStyle(0x222222);
      g.fillRoundedRect(cx - 19, 111, 16, 8, 3);
      g.fillRoundedRect(cx + 3, 111, 16, 8, 3);
    }

    // الشورت
    g.fillStyle(kit.shorts);
    if (isDive) g.fillRoundedRect(cx - 14, 84, 34, 16, 6);
    else g.fillRoundedRect(cx - 19, 78, 38, 18, 6);

    // القميص بأكمام
    g.fillStyle(kit.jersey);
    if (isDive) g.fillRoundedRect(cx - 26, 52, 52, 38, 12);
    else g.fillRoundedRect(cx - 22, 44, 44, 40, 10);
    g.fillStyle(kit.dark);
    if (!isDive) {
      g.fillRect(cx - 22, 44, 44, 7); // ياقة
    }

    // الذراعان والقفازات حسب الحالة
    g.fillStyle(kit.jersey);
    const glove = (x: number, y: number) => {
      g.fillStyle(kit.glove);
      g.fillCircle(x, y, 9);
      g.fillStyle(kit.jersey);
    };
    if (state === '' ) {
      // استعداد: ذراعان مرفوعتان جانبًا
      g.fillRoundedRect(cx - 40, 46, 20, 10, 5);
      g.fillRoundedRect(cx + 20, 46, 20, 10, 5);
      glove(cx - 44, 42);
      glove(cx + 44, 42);
    } else if (isDive) {
      // ارتماء: ذراعان ممدودتان بالكامل
      g.fillRoundedRect(cx - 52, 56, 26, 10, 5);
      g.fillRoundedRect(cx + 26, 56, 26, 10, 5);
      glove(cx - 52, 60);
      glove(cx + 52, 60);
    } else if (state === '-save') {
      // التقاط: الذراعان أمام الصدر تحضنان الكرة
      g.fillRoundedRect(cx - 30, 58, 16, 10, 5);
      g.fillRoundedRect(cx + 14, 58, 16, 10, 5);
      glove(cx - 14, 64);
      glove(cx + 14, 64);
      // الكرة بين القفازين
      g.fillStyle(0xffffff);
      g.fillCircle(cx, 64, 11);
      g.fillStyle(0x333333);
      g.fillCircle(cx, 64, 4);
    } else if (state === '-sad') {
      // إحباط لطيف: ذراعان متدليتان
      g.fillRoundedRect(cx - 30, 60, 12, 24, 5);
      g.fillRoundedRect(cx + 18, 60, 12, 24, 5);
      glove(cx - 24, 86);
      glove(cx + 24, 86);
    } else {
      // احتفال: ذراعان مرفوعتان V
      g.fillRoundedRect(cx - 38, 30, 14, 24, 6);
      g.fillRoundedRect(cx + 24, 30, 14, 24, 6);
      glove(cx - 34, 26);
      glove(cx + 34, 26);
    }

    // الرأس والشعر والوجه
    const hy = isDive ? 36 : 26;
    g.fillStyle(skin);
    g.fillCircle(cx, hy, 16);
    g.fillStyle(0x4a3520);
    g.beginPath();
    g.arc(cx, hy - 4, 15, Math.PI, 0);
    g.fillPath();
    g.fillStyle(0x333333);
    g.fillCircle(cx - 6, hy - 1, 2.3);
    g.fillCircle(cx + 6, hy - 1, 2.3);
    g.lineStyle(2.5, 0x333333);
    g.beginPath();
    if (state === '-sad') {
      g.arc(cx, hy + 10, 6, Math.PI + 0.4, -0.4); // فم حزين مقلوب
    } else if (state === '-happy' || state === '-save') {
      g.arc(cx, hy + 4, 8, 0.15, Math.PI - 0.15); // ابتسامة كبيرة
    } else {
      g.arc(cx, hy + 5, 6, 0.25, Math.PI - 0.25);
    }
    g.strokePath();

    g.generateTexture(`${kit.key}${state}`, 110, 122);
    g.destroy();
  }

  // لاعب الحائط الدفاعي (ظهر) لوضع الفاولات
  private makeWallPlayer(): void {
    const g = this.add.graphics();
    // الرأس من الخلف
    g.fillStyle(0x4a3520);
    g.fillCircle(28, 14, 12);
    // القميص
    g.fillStyle(0x3567c9);
    g.fillRoundedRect(10, 24, 36, 34, 8);
    // الذراعان محميتان أماميًا (تظهران جانبًا)
    g.fillRoundedRect(2, 28, 10, 22, 5);
    g.fillRoundedRect(44, 28, 10, 22, 5);
    // الشورت والساقان
    g.fillStyle(0x1f2a44);
    g.fillRoundedRect(13, 56, 30, 12, 4);
    g.fillStyle(0xffd7b3);
    g.fillRect(17, 68, 8, 14);
    g.fillRect(31, 68, 8, 14);
    g.fillStyle(0x222222);
    g.fillRoundedRect(15, 81, 12, 6, 2);
    g.fillRoundedRect(29, 81, 12, 6, 2);
    g.generateTexture('wall-player', 56, 88);
    g.destroy();
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
