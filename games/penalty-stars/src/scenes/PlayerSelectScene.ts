// PlayerSelectScene — بطاقات الشخصيات + إضافة لاعب من العائلة (صورة واسم، على الجهاز فقط)

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, rtl } from '../config/gameConfig';
import { MAX_CUSTOM_PLAYERS, progress } from '../utils/progress';
import { allPlayers, PlayerDef } from '../data/players';
import { audio } from '../utils/audio';
import { popIn } from '../utils/animations';
import { makeButton } from '../utils/ui';
import { fadeIn, go } from '../utils/camera';
import { makeCircularAvatar } from '../utils/avatar';

// شبكة مضغوطة: حتى ١٢ بطاقة (١٠ نجوم + لاعبا عائلة/بطاقة إضافة) في ٦ صفوف
const CARD_W = 208;
const CARD_H = 96;
const GRID_TOP = 126;
const ROW_GAP = 104;

export class PlayerSelectScene extends Phaser.Scene {
  constructor() {
    super('PlayerSelect');
  }

  create(): void {
    // خلفية الملعب الواقعي بطبقة كحلية زجاجية (دليل الهوية)
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.55);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.grass);
    }
    fadeIn(this);

    const title = this.add
      .text(GAME_WIDTH / 2, 46, rtl('😃 اختر لاعبك وابدأ اللعب فورًا!'), {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffd45a',
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
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_WIDTH / 2 + (col === 0 ? -112 : 112);
      const y = GRID_TOP + row * ROW_GAP;
      const card = cell === 'add' ? this.makeAddCard(x, y) : this.makeCard(cell, x, y);
      popIn(card, 0.05 * i);
    });

    const backBtn = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 36, '🏠 رجوع', () => {
      go(this, 'Menu');
    }, { width: 220, height: 52, fontSize: 23, variant: 'glass' });
    popIn(backBtn, 0.6);
  }

  private makeCard(p: PlayerDef, x: number, y: number): Phaser.GameObjects.Container {
    const selected = this.registry.get('playerId') === p.id;
    const isCustom = p.id.startsWith('custom-');

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.navy, 0.72).setOrigin(0.5);
    bg.setStrokeStyle(selected ? 5 : 3, selected ? COLORS.gold : p.color);
    const avatarKey = this.textures.exists(`avatar-${p.id}`) ? `avatar-${p.id}` : 'avatar-hassouni';
    const avatar = this.add.image(0, -16, avatarKey).setDisplaySize(52, 52);
    const name = this.add
      .text(0, 20, rtl(`${p.name} ${p.emoji}`), {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#f8fff7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    // المؤشرات الثلاثة وفق الدليل: سرعة، قوة، دقة
    const dots = (v: number) => '●'.repeat(Math.round(v / 2));
    const stats = this.add
      .text(0, 38, rtl(`سرعة ${dots(p.speed)}  قوة ${dots(p.power)}  دقة ${dots(p.accuracy)}`), {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#ffd45a',
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [bg, avatar, name, stats];
    if (selected) {
      children.push(
        this.add
          .text(0, -44, rtl('✅ مختار'), {
            fontFamily: FONT,
            fontSize: '13px',
            color: '#0b0f14',
            fontStyle: 'bold',
            backgroundColor: '#ffd93d',
            padding: { x: 7, y: 2 },
          })
          .setOrigin(0.5),
      );
    }
    const card = this.add.container(x, y, children);
    card.setSize(CARD_W, CARD_H);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerup', () => {
      audio.play('button');
      this.registry.set('playerId', p.id);
      // انتقال مباشر للعب: وميض اختيار سريع ثم شجرة البطولة — بلا رجوع
      bg.setStrokeStyle(6, COLORS.yellow);
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
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.navy, 0.45).setOrigin(0.5);
    bg.setStrokeStyle(3, COLORS.lime);
    const plus = this.add
      .text(0, -16, '➕', { fontSize: '34px' })
      .setOrigin(0.5);
    const label = this.add
      .text(0, 24, rtl('أضف لاعبك\nصورة من جهازك — تبقى عندك'), {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#c6ff00',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    const card = this.add.container(x, y, [bg, plus, label]);
    card.setSize(CARD_W, CARD_H);
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
      .text(cardX + CARD_W / 2 - 4, cardY - CARD_H / 2 + 4, '✖', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#ff3e3e',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 0)
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
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(7,17,31,.85);font-family:Cairo,Arial,sans-serif';
    wrap.innerHTML = `
      <div style="background:#0d1f33;border:2px solid rgba(255,255,255,.4);border-radius:24px;padding:26px 30px;text-align:center;max-width:320px">
        <img src="${photo}" style="width:110px;height:110px;border-radius:50%;border:5px solid #ffd45a;object-fit:cover" alt="" />
        <div style="color:#f8fff7;font-size:19px;font-weight:bold;margin:14px 0 10px">ما اسم اللاعب الجديد؟</div>
        <input id="ps-name" type="text" maxlength="14" placeholder="اسم اللاعب"
          style="width:100%;box-sizing:border-box;padding:12px;font-size:18px;border-radius:14px;border:2px solid #00e5ff;background:#0b0f14;color:#f8fff7;text-align:center;font-family:inherit" />
        <div style="display:flex;gap:10px;margin-top:16px">
          <button id="ps-save" style="flex:1;padding:13px;font-size:17px;font-weight:bold;border:0;border-radius:14px;background:linear-gradient(135deg,#c6ff00,#00e5ff);color:#0b0f14;font-family:inherit">✅ حفظ</button>
          <button id="ps-cancel" style="flex:1;padding:13px;font-size:17px;font-weight:bold;border:2px solid rgba(255,255,255,.5);border-radius:14px;background:transparent;color:#f8fff7;font-family:inherit">إلغاء</button>
        </div>
        <div style="color:#9fb3c8;font-size:12px;margin-top:12px">🔒 الصورة والاسم يبقيان على هذا الجهاز فقط</div>
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
