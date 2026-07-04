// LockerScene — الخزنة 🎒: كرات وملاعب تُفتح بالنجوم المكتسبة
// بلا مشتريات، بلا إعلانات — النجوم تأتي من الأهداف فقط

import Phaser from 'phaser';
import { arabicNum, COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, rtl } from '../config/gameConfig';
import { audio } from '../utils/audio';
import { popIn } from '../utils/animations';
import { makeButton } from '../utils/ui';
import { BALLS, progress, STADIUMS } from '../utils/progress';
import { fadeIn, go } from '../utils/camera';

export class LockerScene extends Phaser.Scene {
  constructor() {
    super('Locker');
  }

  create(): void {
    // خلفية الملعب المختار مع تعتيم أوضح للقوائم
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a2818, 0.55);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.grass);
    }
    fadeIn(this);

    const title = this.add
      .text(GAME_WIDTH / 2, 48, rtl('🎒 الخزنة'), {
        fontFamily: FONT,
        fontSize: '34px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    popIn(title);

    this.add
      .text(GAME_WIDTH / 2, 92, rtl(`نجومك: ⭐ ${arabicNum(progress.totalStars())} — كل هدف يعطيك نجمة!`), {
        fontFamily: FONT,
        fontSize: '19px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // ── الكرات ──
    this.sectionTitle(140, '⚽ الكرات');
    BALLS.forEach((b, i) => {
      const x = 60 + i * 90;
      const y = 205;
      const unlocked = progress.isUnlocked(b.cost);
      const selected = progress.selectedBall() === b.key;

      const ring = this.add.circle(x, y, 38, selected ? COLORS.yellow : 0xffffff, selected ? 0.95 : 0.35);
      const img = this.textures.exists(b.key)
        ? this.add.image(x, y, b.key).setDisplaySize(60, 60)
        : this.add.image(x, y, 'ball').setDisplaySize(60, 60);
      if (!unlocked) img.setAlpha(0.35).setTint(0x777777);

      const caption = unlocked ? b.name : `🔒 ⭐ ${arabicNum(b.cost)}`;
      this.add
        .text(x, y + 52, rtl(caption), {
          fontFamily: FONT,
          fontSize: '13px',
          color: unlocked ? '#ffffff' : '#ffd93d',
          fontStyle: 'bold',
          stroke: '#1a5c2e',
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: 86 },
        })
        .setOrigin(0.5, 0);

      const hit = this.add.circle(x, y, 42, 0xffffff, 0.001).setInteractive({ useHandCursor: unlocked });
      hit.on('pointerup', () => {
        if (!unlocked) return;
        audio.play('button');
        progress.selectBall(b.key);
        this.scene.restart();
      });
      popIn(ring, 0.05 * i);
    });

    // ── الملاعب ──
    this.sectionTitle(310, '🏟️ الملاعب');
    STADIUMS.forEach((st, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_WIDTH / 2 + (col === 0 ? -112 : 112);
      const y = 395 + row * 110;
      const unlocked = progress.isUnlocked(st.cost);
      const selected = progress.selectedStadium() === st.key;

      const frame = this.add.rectangle(x, y, 204, 96, COLORS.white, 0.95);
      frame.setStrokeStyle(selected ? 6 : 3, selected ? COLORS.yellow : COLORS.white);
      // قصاصة من منتصف صورة الملعب (منطقة المرمى) بدل تكديس الصورة كاملة
      let thumb: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
      if (this.textures.exists(st.key)) {
        const src = this.textures.get(st.key).getSourceImage() as HTMLImageElement;
        const bandH = Math.round(src.width * (84 / 192));
        const img = this.add.image(x, y, st.key);
        img.setCrop(0, Math.max(0, Math.round(src.height * 0.22)), src.width, bandH);
        // setCrop لا يغيّر الإطار — نضبط المقياس ثم نزيح الصورة حتى تتمركز القصاصة
        const scale = 192 / src.width;
        img.setScale(scale);
        img.y = y + (src.height / 2 - src.height * 0.22 - bandH / 2) * scale;
        thumb = img;
      } else {
        thumb = this.add.rectangle(x, y, 192, 84, COLORS.grass);
      }
      if (!unlocked && 'setTint' in thumb) (thumb as Phaser.GameObjects.Image).setTint(0x555555);

      const caption = unlocked ? st.name : `🔒 ${st.name} — ⭐ ${arabicNum(st.cost)}`;
      this.add
        .text(x, y + 34, rtl(caption), {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#1a5c2e',
          strokeThickness: 4,
          backgroundColor: '#00000055',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5);
      if (selected) {
        this.add
          .text(x, y - 34, rtl('✅ مختار'), {
            fontFamily: FONT,
            fontSize: '13px',
            color: '#1a5c2e',
            fontStyle: 'bold',
            backgroundColor: '#ffd93d',
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0.5);
      }

      const hit = this.add.rectangle(x, y, 204, 96, 0xffffff, 0.001).setInteractive({ useHandCursor: unlocked });
      hit.on('pointerup', () => {
        if (!unlocked) return;
        audio.play('button');
        progress.selectStadium(st.key);
        this.scene.restart();
      });
      popIn(frame, 0.06 * i);
    });

    const backBtn = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 55, '🏠 رجوع', () => {
      go(this, 'Menu');
    }, { width: 220, height: 60, fontSize: 24, variant: 'glass' });
    popIn(backBtn, 0.5);
  }

  private sectionTitle(y: number, text: string): void {
    this.add
      .text(GAME_WIDTH / 2, y, rtl(text), {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
  }
}
