// PlayerSelectScene — بطاقات لاعبين بأسلوب FIFA (FFPlayerCard): تقييم، صورة، أرقام قدرات
// + إضافة لاعب من العائلة (صورة واسم، على الجهاز فقط)

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING, rtl } from '../config/gameConfig';
import { MAX_CUSTOM_PLAYERS, progress } from '../utils/progress';
import { allPlayers, PlayerDef } from '../data/players';
import { audio } from '../utils/audio';
import { popIn } from '../utils/animations';
import { fadeIn, go } from '../utils/camera';
import { makeCircularAvatar } from '../utils/avatar';
import { makeChip } from '../utils/ui';

// شبكة بطاقات FIFA عمودية: ٣ أعمدة × ٤ صفوف (حتى ١٢ بطاقة)
const CW = 146;
const CH = 184;
const COL_X = [396, 240, 84]; // RTL: العمود الأول يمين
const ROW_Y = [142, 322, 502, 682];

export class PlayerSelectScene extends Phaser.Scene {
  constructor() {
    super('PlayerSelect');
  }

  create(): void {
    // خلفية الهوية الليلية السينمائية
    if (this.textures.exists('stadium-stars')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'stadium-stars').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.72);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy);
    }
    fadeIn(this);

    const title = this.add
      .text(GAME_WIDTH / 2, 40, rtl('اختر نجمك وابدأ فورًا! ⚡'), {
        fontFamily: HEADING,
        fontSize: '26px',
        color: '#c6ff00',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    popIn(title);

    // الشبكة: كل اللاعبين ثم بطاقة الإضافة إن بقي مكان
    const players = allPlayers();
    const cells: ('add' | PlayerDef)[] = [...players];
    if (progress.customPlayers().length < MAX_CUSTOM_PLAYERS) cells.push('add');

    cells.forEach((cell, i) => {
      const x = COL_X[i % 3];
      const y = ROW_Y[Math.floor(i / 3)];
      const card = cell === 'add' ? this.makeAddCard(x, y) : this.makeCard(cell, x, y);
      popIn(card, 0.04 * i);
    });

    // رقاقة رجوع صغيرة أعلى اليسار (بدل زر سفلي — الشبكة تملأ الشاشة)
    makeChip(this, 42, 40, 'ic-home', () => go(this, 'Menu'), 56);
  }

  // التقييم العام بأسلوب بطاقات المحترفين (٨٤-٩٦)
  private rating(p: PlayerDef): number {
    return Math.round(60 + ((p.speed + p.power + p.accuracy) / 3) * 4);
  }

  // 🃏 خامة بطاقة FIFA: تُرسم مرة واحدة لكل لاعب (خلفية متدرجة، صورة، تقييم، أرقام)
  private buildCardTexture(p: PlayerDef): string {
    const key = `ffcard-${p.id}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const W = 150;
    const H = 190;
    const tex = this.textures.createCanvas(key, W, H);
    if (!tex) return 'ffcard-missing';
    const ctx = tex.getContext();

    const round = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    // جسم البطاقة: تدرج غرافيت داكن + حد ليموني
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b2430');
    g.addColorStop(1, '#0b0f14');
    round(2, 2, W - 4, H - 4, 12);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(198,255,0,0.65)';
    ctx.stroke();
    // شريحة طاقة قطرية خافتة
    ctx.save();
    round(2, 2, W - 4, H - 4, 12);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,229,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(8, H);
    ctx.lineTo(46, 0);
    ctx.lineTo(66, 0);
    ctx.lineTo(28, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // صورة اللاعب: المربع الداخلي من دائرة الأفاتار (قصّة صدر)
    const avatarKey = this.textures.exists(`avatar-${p.id}`) ? `avatar-${p.id}` : 'avatar-hassouni';
    const src = this.textures.get(avatarKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const s = src.width * 0.6;
    const off = (src.width - s) / 2;
    ctx.save();
    round(28, 32, 94, 94, 10);
    ctx.clip();
    ctx.drawImage(src, off, off, s, s, 28, 32, 94, 94);
    // تلاشٍ سفلي يدمج الصورة بالبطاقة
    const fade = ctx.createLinearGradient(0, 100, 0, 126);
    fade.addColorStop(0, 'rgba(11,15,20,0)');
    fade.addColorStop(1, 'rgba(11,15,20,0.85)');
    ctx.fillStyle = fade;
    ctx.fillRect(28, 96, 94, 30);
    ctx.restore();
    round(28, 32, 94, 94, 10);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,229,255,0.5)';
    ctx.stroke();

    // التقييم + المركز أعلى اليمين (RTL)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c6ff00';
    ctx.font = '800 24px "Noto Kufi Arabic", Cairo, sans-serif';
    ctx.fillText(String(this.rating(p)), W - 8, 28);
    ctx.fillStyle = '#b2bcc6';
    ctx.font = '700 10px Inter, sans-serif';
    ctx.fillText('ST', W - 12, 42);
    // إيموجي الشخصية أعلى اليسار
    ctx.textAlign = 'left';
    ctx.font = '16px sans-serif';
    ctx.fillText(p.emoji, 8, 24);

    // اسم اللاعب
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fff7';
    ctx.font = '700 13px "Noto Kufi Arabic", Cairo, sans-serif';
    ctx.fillText(p.name, W / 2, 145);

    // أرقام القدرات الثلاثة بأسلوب فيفا (سرعة/قوة/دقة)
    const stat = (v: number) => Math.min(99, 40 + v * 6);
    const cols: [string, number, number][] = [
      ['سرعة', stat(p.speed), W - 28],
      ['قوة', stat(p.power), W / 2],
      ['دقة', stat(p.accuracy), 28],
    ];
    for (const [label, val, x] of cols) {
      ctx.fillStyle = '#c6ff00';
      ctx.font = '700 15px "Noto Kufi Arabic", Cairo, sans-serif';
      ctx.fillText(String(val), x, 165);
      ctx.fillStyle = '#b2bcc6';
      ctx.font = '600 9px "Noto Kufi Arabic", Cairo, sans-serif';
      ctx.fillText(label, x, 178);
    }

    // خط قاعدي متدرج ليموني→سماوي
    const base = ctx.createLinearGradient(12, 0, W - 12, 0);
    base.addColorStop(0, '#00e5ff');
    base.addColorStop(1, '#c6ff00');
    ctx.fillStyle = base;
    ctx.fillRect(12, H - 8, W - 24, 3);

    tex.refresh();
    return key;
  }

  private makeCard(p: PlayerDef, x: number, y: number): Phaser.GameObjects.Container {
    const selected = this.registry.get('playerId') === p.id;
    const isCustom = p.id.startsWith('custom-');

    const img = this.add.image(0, 0, this.buildCardTexture(p)).setDisplaySize(CW, CH);
    const children: Phaser.GameObjects.GameObject[] = [img];
    if (selected) {
      const glow = this.add.rectangle(0, 0, CW + 8, CH + 8, COLORS.lime, 0).setStrokeStyle(3, COLORS.gold);
      const badge = this.add
        .text(0, -CH / 2 - 2, rtl('✅ مختار'), {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#0b0f14',
          fontStyle: 'bold',
          backgroundColor: '#ffd23f',
          padding: { x: 7, y: 2 },
        })
        .setOrigin(0.5);
      children.push(glow, badge);
    }
    const card = this.add.container(x, y, children);
    card.setSize(CW, CH);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => card.setScale(0.97));
    card.on('pointerout', () => card.setScale(1));
    card.on('pointerup', () => {
      card.setScale(1);
      audio.play('button');
      this.registry.set('playerId', p.id);
      // انتقال مباشر للعب: وميض اختيار سريع ثم شجرة البطولة — بلا رجوع
      this.tweens.add({ targets: card, scale: 1.08, duration: 120, yoyo: true });
      audio.play('whistle');
      this.time.delayedCall(320, () => go(this, 'Tournament'));
    });

    // زر حذف للاعب العائلة — بتأكيد على ضغطتين
    if (isCustom) this.addDeleteBadge(p.id, x, y);
    return card;
  }

  // بطاقة "أضف لاعبك": صورة من الجهاز + اسم — تُحفظ محليًا فقط
  private makeAddCard(x: number, y: number): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, CW, CH, COLORS.graphite, 0.6).setOrigin(0.5);
    bg.setStrokeStyle(2, COLORS.lime, 0.8);
    const plus = this.add.text(0, -30, '➕', { fontSize: '36px' }).setOrigin(0.5);
    const label = this.add
      .text(0, 34, rtl('أضف لاعبك\nصورة من جهازك\nتبقى عندك 🔒'), {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#c6ff00',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    const card = this.add.container(x, y, [bg, plus, label]);
    card.setSize(CW, CH);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerup', () => {
      audio.play('button');
      this.pickPhoto();
    });
    this.tweens.add({ targets: plus, scale: 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    return card;
  }

  private addDeleteBadge(id: string, cardX: number, cardY: number): void {
    let armed = false;
    const badge = this.add
      .text(cardX - CW / 2 + 4, cardY - CH / 2 + 4, '✖', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#ff4d4d',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0, 0)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    badge.on('pointerup', () => {
      if (!armed) {
        armed = true;
        badge.setText(rtl('تأكيد؟'));
        this.time.delayedCall(2500, () => {
          if (badge.active) {
            armed = false;
            badge.setText('✖');
          }
        });
        return;
      }
      progress.removeCustomPlayer(id);
      if (this.registry.get('playerId') === id) this.registry.set('playerId', 'hassouni');
      audio.play('save');
      this.scene.restart();
    });
  }

  // ── إضافة لاعب: اختيار صورة → تصغير ٢٠٠×٢٠٠ → اسم → حفظ محلي ──

  private pickPhoto(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => this.shrinkPhoto(String(reader.result));
      reader.readAsDataURL(file);
    };
    input.click();
  }

  private shrinkPhoto(rawDataUrl: string): void {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 200, 200);
      this.askName(c.toDataURL('image/jpeg', 0.85));
    };
    img.src = rawDataUrl;
  }

  // نافذة اسم عربية فوق اللعبة (DOM) — أبسط وأوضح من لوحة مفاتيح داخل الكانفاس
  private askName(photo: string): void {
    const wrap = document.createElement('div');
    wrap.setAttribute('dir', 'rtl');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(11,15,20,.88);font-family:Cairo,Arial,sans-serif';
    wrap.innerHTML = `
      <div style="background:#111720;border:2px solid rgba(0,229,255,.45);border-radius:24px;padding:26px 30px;text-align:center;max-width:320px">
        <img src="${photo}" style="width:110px;height:110px;border-radius:50%;border:5px solid #c6ff00;object-fit:cover" alt="" />
        <div style="color:#f8fff7;font-size:19px;font-weight:bold;margin:14px 0 10px">ما اسم اللاعب الجديد؟</div>
        <input id="ps-name" type="text" maxlength="14" placeholder="اسم اللاعب"
          style="width:100%;box-sizing:border-box;padding:12px;font-size:18px;border-radius:14px;border:2px solid #00e5ff;background:#0b0f14;color:#f8fff7;text-align:center;font-family:inherit" />
        <div style="display:flex;gap:10px;margin-top:16px">
          <button id="ps-save" style="flex:1;padding:13px;font-size:17px;font-weight:bold;border:0;border-radius:14px;background:linear-gradient(135deg,#c6ff00,#9eeb00);color:#0b0f14;font-family:inherit">✅ حفظ</button>
          <button id="ps-cancel" style="flex:1;padding:13px;font-size:17px;font-weight:bold;border:2px solid rgba(255,255,255,.4);border-radius:14px;background:transparent;color:#f8fff7;font-family:inherit">إلغاء</button>
        </div>
        <div style="color:#b2bcc6;font-size:12px;margin-top:12px">🔒 الصورة والاسم يبقيان على هذا الجهاز فقط</div>
      </div>`;
    document.body.appendChild(wrap);
    const nameInput = wrap.querySelector<HTMLInputElement>('#ps-name');
    nameInput?.focus();
    wrap.querySelector('#ps-cancel')?.addEventListener('click', () => wrap.remove());
    wrap.querySelector('#ps-save')?.addEventListener('click', () => {
      const name = (nameInput?.value ?? '').trim() || 'نجم العائلة';
      wrap.remove();
      const saved = progress.addCustomPlayer(name, photo);
      if (!saved) return;
      // تجهيز الأفاتار فورًا ثم تحديث الشاشة
      const photoKey = `photo-${saved.id}`;
      this.textures.once(`addtexture-${photoKey}`, () => {
        makeCircularAvatar(this, `avatar-${saved.id}`, photoKey);
        audio.play('unlock');
        this.scene.restart();
      });
      this.textures.addBase64(photoKey, photo);
    });
  }
}
