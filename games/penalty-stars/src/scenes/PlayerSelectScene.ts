// PlayerSelectScene — بطاقات الشخصيات المرحة

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, rtl } from '../config/gameConfig';
import { progress } from '../utils/progress';
import { PLAYERS, PlayerDef } from '../data/players';
import { audio } from '../utils/audio';
import { popIn } from '../utils/animations';
import { makeButton } from '../utils/ui';
import { fadeIn, go } from '../utils/camera';

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
      .text(GAME_WIDTH / 2, 55, rtl('😃 اختر لاعبك وابدأ اللعب فورًا!'), {
        fontFamily: FONT,
        fontSize: '32px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    popIn(title);

    // شبكة بطاقات 2×5
    PLAYERS.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_WIDTH / 2 + (col === 0 ? -112 : 112);
      const y = 154 + row * 126;
      const card = this.makeCard(p, x, y);
      popIn(card, 0.06 * i);
    });

    const backBtn = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 42, '🏠 رجوع', () => {
      go(this, 'Menu');
    }, { width: 220, height: 56, fontSize: 24, variant: 'glass' });
    popIn(backBtn, 0.6);
  }

  private makeCard(p: PlayerDef, x: number, y: number): Phaser.GameObjects.Container {
    const selected = this.registry.get('playerId') === p.id;
    const w = 208;
    const h = 116;

    const bg = this.add.rectangle(0, 0, w, h, COLORS.navy, 0.72).setOrigin(0.5);
    bg.setStrokeStyle(selected ? 5 : 3, selected ? COLORS.gold : p.color);
    const avatar = this.add.image(0, -20, `avatar-${p.id}`).setDisplaySize(60, 60);
    const name = this.add
      .text(0, 26, rtl(`${p.name} ${p.emoji}`), {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#f8fff7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    // نقاط القوة كنجوم صغيرة
    const stats = this.add
      .text(0, 46, rtl(`⭐ قوة ${'●'.repeat(Math.round(p.power / 2))}  دقة ${'●'.repeat(Math.round(p.accuracy / 2))}`), {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#ffd45a',
      })
      .setOrigin(0.5);

    const badge = selected
      ? this.add.text(0, -54, rtl('✅ مختار'), { fontFamily: FONT, fontSize: '16px', color: '#1a5c2e', fontStyle: 'bold', backgroundColor: '#ffd93d', padding: { x: 8, y: 3 } }).setOrigin(0.5)
      : null;

    const children: Phaser.GameObjects.GameObject[] = [bg, avatar, name, stats];
    if (badge) children.push(badge);
    const card = this.add.container(x, y, children);
    card.setSize(w, h);
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
    return card;
  }
}
