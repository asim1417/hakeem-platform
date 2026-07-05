// PlayerSelectScene — عرض احترافي: لاعب واحد في كل شاشة بطقم فوتبول فيوتشر الكامل
// (قميص وشورت بألوان الهوية + وجه الطفل الحقيقي) — تقليب بالسحب أو الأسهم
// + إضافة لاعب من العائلة (صورة واسم، على الجهاز فقط)

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING, rtl } from '../config/gameConfig';
import { MAX_CUSTOM_PLAYERS, progress } from '../utils/progress';
import { allPlayers, PlayerDef } from '../data/players';
import { audio } from '../utils/audio';
import { popIn } from '../utils/animations';
import { fadeIn, go } from '../utils/camera';
import { makeCircularAvatar } from '../utils/avatar';
import { makeButton, makeChip } from '../utils/ui';

const CARD_Y = 368; // مركز بطاقة العرض

export class PlayerSelectScene extends Phaser.Scene {
  private index = 0;
  private pageItems: Phaser.GameObjects.GameObject[] = [];
  private swipeX = 0;

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
      .text(GAME_WIDTH / 2, 34, rtl('اختر نجمك ⚡'), {
        fontFamily: HEADING,
        fontSize: '26px',
        color: '#c6ff00',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    popIn(title);

    // أسهم التقليب (RTL: السهم الأيمن يرجع، الأيسر يتقدم)
    const mkArrow = (x: number, dir: 1 | -1, glyph: string) => {
      const chip = this.add.container(x, CARD_Y);
      const bg = this.add.image(0, 0, 'chip-glass').setDisplaySize(56, 56);
      const t = this.add.text(0, -2, glyph, { fontFamily: HEADING, fontSize: '26px', color: '#00e5ff', fontStyle: 'bold' }).setOrigin(0.5);
      chip.add([bg, t]);
      chip.setSize(56, 56);
      chip.setInteractive({ useHandCursor: true });
      chip.on('pointerup', () => this.flip(dir));
      chip.setDepth(20);
      return chip;
    };
    mkArrow(GAME_WIDTH - 34, 1, '‹');
    mkArrow(34, -1, '›');

    // سحب لليمين/اليسار للتقليب
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.swipeX = p.x));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - this.swipeX;
      if (Math.abs(dx) > 60) this.flip(dx > 0 ? 1 : -1);
    });

    makeChip(this, 42, 38, 'ic-home', () => go(this, 'Menu'), 54);

    // ابدأ من اللاعب المختار حاليًا إن وُجد
    const cells = this.cells();
    const cur = this.registry.get('playerId') as string | undefined;
    const found = cells.findIndex((c) => c !== 'add' && c.id === cur);
    this.index = found >= 0 ? found : 0;
    this.renderPage(0);
  }

  private cells(): ('add' | PlayerDef)[] {
    const list: ('add' | PlayerDef)[] = [...allPlayers()];
    if (progress.customPlayers().length < MAX_CUSTOM_PLAYERS) list.push('add');
    return list;
  }

  private flip(dir: 1 | -1): void {
    const n = this.cells().length;
    this.index = (this.index + dir + n) % n;
    audio.play('button');
    this.renderPage(dir);
  }

  // التقييم العام بأسلوب بطاقات المحترفين (٨٤-٩٦)
  private rating(p: PlayerDef): number {
    return Math.round(60 + ((p.speed + p.power + p.accuracy) / 3) * 4);
  }

  // 🧍 رسم اللاعب من لوحة الهوية الأصلية + وجه الطفل مركّبًا بحواف ناعمة
  // (الوجه من الأفاتار يوضع مكان وجه رسم «علي» بنفس المقاس — مواءمة كاملة)
  private buildCardArt(p: PlayerDef): string {
    const key = `cardart-${p.id}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const W = 390;
    const H = 570;
    const tex = this.textures.createCanvas(key, W, H);
    if (!tex) return 'card-base';
    const ctx = tex.getContext();

    // رسم الهوية الأساسي (اللاعب بالطقم والكرة وخلفية الطاقة)
    const baseSrc = this.textures.get('card-base').getSourceImage() as HTMLImageElement;
    ctx.drawImage(baseSrc, 0, 0, W, H);

    // من لا صورة حقيقية له يبقى وجه رسم الهوية الأصلي كما هو
    if (!p.photo) {
      tex.refresh();
      return key;
    }
    // 🎨 دمج ذكي: قناع بيضاوي بشكل الوجه + مطابقة لونية مع إضاءة الرسم + حافة متلاشية
    const avatarKey = this.textures.exists(`avatar-${p.id}`) ? `avatar-${p.id}` : 'avatar-hassouni';
    const src = this.textures.get(avatarKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const FW = 148; // عرض البيضاوي
    const FH = 176; // ارتفاعه (الوجه أطول من عرضه)
    const CXF = 210; // مركز وجه الرسم
    const CYF = 148;

    // متوسط لون بشرة الرسم (منطقة الخد/الجبهة) — لمطابقة الإضاءة
    const artPix = ctx.getImageData(CXF - 26, CYF - 6, 52, 34).data;
    let ar = 0;
    let ag = 0;
    let ab = 0;
    for (let i = 0; i < artPix.length; i += 4) {
      ar += artPix[i];
      ag += artPix[i + 1];
      ab += artPix[i + 2];
    }
    const an = artPix.length / 4;
    ar /= an;
    ag /= an;
    ab /= an;

    const face = document.createElement('canvas');
    face.width = FW;
    face.height = FH;
    const fctx = face.getContext('2d');
    if (fctx) {
      // قصاصة بيضاوية من داخل الأفاتار (بعيدًا عن حلقته)
      fctx.save();
      fctx.beginPath();
      fctx.ellipse(FW / 2, FH / 2, FW / 2, FH / 2, 0, 0, Math.PI * 2);
      fctx.clip();
      const inner = src.width * 0.72;
      const off = (src.width - inner) / 2;
      fctx.drawImage(src, off, off, inner, inner, -(FH - FW) / 2, 0, FH, FH);
      fctx.restore();

      // مطابقة لونية: كسب لكل قناة نحو متوسط بشرة الرسم
      const fd = fctx.getImageData(0, 0, FW, FH);
      const d = fd.data;
      let cr = 0;
      let cg = 0;
      let cb = 0;
      let cn = 0;
      for (let y = 55; y < 130; y += 3) {
        for (let x = 38; x < FW - 38; x += 3) {
          const i = (y * FW + x) * 4;
          if (d[i + 3] > 200) {
            cr += d[i];
            cg += d[i + 1];
            cb += d[i + 2];
            cn++;
          }
        }
      }
      if (cn > 0) {
        const gr = Phaser.Math.Clamp(ar / (cr / cn), 0.72, 1.35);
        const gg = Phaser.Math.Clamp(ag / (cg / cn), 0.72, 1.35);
        const gb = Phaser.Math.Clamp(ab / (cb / cn), 0.72, 1.35);
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, d[i] * gr);
          d[i + 1] = Math.min(255, d[i + 1] * gg);
          d[i + 2] = Math.min(255, d[i + 2] * gb);
        }
        fctx.putImageData(fd, 0, 0);
      }

      // حافة متلاشية بيضاوية قوية — لا حدود مرئية
      fctx.globalCompositeOperation = 'destination-in';
      fctx.save();
      fctx.translate(FW / 2, FH / 2);
      fctx.scale(1, FH / FW);
      const fade = fctx.createRadialGradient(0, 0, (FW / 2) * 0.5, 0, 0, FW / 2);
      fade.addColorStop(0, 'rgba(0,0,0,1)');
      fade.addColorStop(0.72, 'rgba(0,0,0,1)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = fade;
      fctx.fillRect(-FW / 2, -FW / 2, FW, FW);
      fctx.restore();
    }
    ctx.drawImage(face, CXF - FW / 2, CYF - FH / 2);

    tex.refresh();
    return key;
  }

  // ── صفحة عرض اللاعب الواحد ──

  private renderPage(dir: number): void {
    this.pageItems.forEach((o) => o.destroy());
    this.pageItems = [];
    const cells = this.cells();
    const cell = cells[this.index];

    // مؤشر الصفحات
    const dots = this.add.container(GAME_WIDTH / 2, 64);
    cells.forEach((_, i) => {
      dots.add(this.add.circle((i - cells.length / 2) * 16, 0, i === this.index ? 5 : 3, i === this.index ? COLORS.lime : COLORS.silver, i === this.index ? 1 : 0.5));
    });
    this.pageItems.push(dots);

    if (cell === 'add') {
      this.renderAddPage();
      return;
    }
    const p = cell;
    const selected = this.registry.get('playerId') === p.id;

    // 🃏 من له بطاقة رسمية كاملة (تصميم فوتبول فيوتشر) تُعرض كما هي — فيها التقييم والاسم والأرقام
    if (p.card && this.textures.exists(`card-${p.id}`)) {
      const official = this.add.image(GAME_WIDTH / 2, CARD_Y - 4, `card-${p.id}`).setDisplaySize(452, 565);
      official.x += dir * 60;
      official.setAlpha(0);
      this.tweens.add({ targets: official, x: GAME_WIDTH / 2, alpha: 1, duration: 240, ease: 'Sine.easeOut' });
      const btnO = makeButton(
        this,
        GAME_WIDTH / 2,
        726,
        selected ? '✅ نجمك الحالي — العب!' : '⚡ اختر هذا النجم',
        () => {
          audio.play('whistle');
          this.registry.set('playerId', p.id);
          this.time.delayedCall(200, () => go(this, 'Tournament'));
        },
        { width: 360, height: 66, fontSize: 26, variant: 'primary' },
      );
      this.pageItems.push(official, btnO);
      return;
    }

    // لوحة البطاقة الكبيرة
    const panel = this.add.image(GAME_WIDTH / 2, CARD_Y, 'panel-glass').setDisplaySize(392, 560);
    // التقييم الكبير + المركز
    // 🧍 اللاعب برسم الهوية الأصلي ووجه الطفل
    const figure = this.add.image(GAME_WIDTH / 2, CARD_Y - 44, this.buildCardArt(p)).setDisplaySize(320, 468);
    figure.x += dir * 60;
    figure.setAlpha(0);
    this.tweens.add({ targets: figure, x: GAME_WIDTH / 2, alpha: 1, duration: 240, ease: 'Sine.easeOut' });

    const artL = GAME_WIDTH / 2 - 160; // حافة الرسم اليسرى (٣٢٠ عرضًا)
    const artT = CARD_Y - 44 - 234; // حافته العليا
    const ratingNum = this.add
      .text(artL + 48, artT + 34, rtl(String(this.rating(p))), {
        fontFamily: HEADING,
        fontSize: '34px',
        color: '#c6ff00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    const pos = this.add
      .text(artL + 48, artT + 78, 'ST', { fontFamily: HEADING, fontSize: '13px', color: '#b2bcc6' })
      .setOrigin(0.5, 0);
    const emoji = this.add.text(GAME_WIDTH / 2 + 168, 122, p.emoji, { fontSize: '32px' }).setOrigin(1, 0);

    // الاسم + الأرقام الثلاثة
    const name = this.add
      .text(GAME_WIDTH / 2, CARD_Y + 178, rtl(`${p.name} ${p.emoji}`), {
        fontFamily: HEADING,
        fontSize: '26px',
        color: '#f8fff7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const stat = (v: number) => Math.min(99, 40 + v * 6);
    const statCols: [string, number][] = [
      ['سرعة', stat(p.speed)],
      ['قوة', stat(p.power)],
      ['دقة', stat(p.accuracy)],
    ];
    const statObjs: Phaser.GameObjects.GameObject[] = [];
    statCols.forEach(([label, val], i) => {
      const x = GAME_WIDTH / 2 + (1 - i) * 110;
      statObjs.push(
        this.add.text(x, CARD_Y + 222, rtl(String(val)), { fontFamily: HEADING, fontSize: '24px', color: '#00e5ff', fontStyle: 'bold' }).setOrigin(0.5),
        this.add.text(x, CARD_Y + 250, rtl(label), { fontFamily: FONT, fontSize: '13px', color: '#b2bcc6' }).setOrigin(0.5),
      );
    });

    // زر الاختيار
    const btn = makeButton(
      this,
      GAME_WIDTH / 2,
      726,
      selected ? '✅ نجمك الحالي — العب!' : '⚡ اختر هذا النجم',
      () => {
        audio.play('whistle');
        this.registry.set('playerId', p.id);
        this.time.delayedCall(200, () => go(this, 'Tournament'));
      },
      { width: 360, height: 66, fontSize: 26, variant: 'primary' },
    );

    this.pageItems.push(panel, ratingNum, pos, emoji, figure, name, ...statObjs, btn);

    // حذف لاعب العائلة
    if (p.id.startsWith('custom-')) this.addDeleteBadge(p.id);
  }

  private renderAddPage(): void {
    const panel = this.add.image(GAME_WIDTH / 2, CARD_Y, 'panel-glass').setDisplaySize(392, 560);
    const plus = this.add.text(GAME_WIDTH / 2, CARD_Y - 80, '➕', { fontSize: '72px' }).setOrigin(0.5);
    this.tweens.add({ targets: plus, scale: 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    const label = this.add
      .text(GAME_WIDTH / 2, CARD_Y + 40, rtl('أضف لاعبًا من عائلتك\nبصورته الحقيقية'), {
        fontFamily: HEADING,
        fontSize: '24px',
        color: '#c6ff00',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    const note = this.add
      .text(GAME_WIDTH / 2, CARD_Y + 110, rtl('🔒 الصورة تبقى على هذا الجهاز فقط'), {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#b2bcc6',
      })
      .setOrigin(0.5);
    const btn = makeButton(this, GAME_WIDTH / 2, 726, '📷 اختر صورة من جهازك', () => this.pickPhoto(), {
      width: 360,
      height: 66,
      fontSize: 24,
      variant: 'primary',
    });
    this.pageItems.push(panel, plus, label, note, btn);
  }

  private addDeleteBadge(id: string): void {
    let armed = false;
    const badge = this.add
      .text(GAME_WIDTH / 2 - 186, 100, '✖', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#ff4d4d',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 0)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    badge.on('pointerup', () => {
      if (!armed) {
        armed = true;
        badge.setText(rtl('تأكيد الحذف؟'));
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
      this.index = 0;
      this.scene.restart();
    });
    this.pageItems.push(badge);
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
      // تجهيز الأفاتار فورًا ثم عرض اللاعب الجديد
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
