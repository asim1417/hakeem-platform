// PlayerSelectScene — بطاقات الشخصيات المرحة

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, rtl } from '../config/gameConfig';
import { PLAYERS, PlayerDef } from '../data/players';
import { audio } from '../utils/audio';
import { popIn } from '../utils/animations';
import { makeButton } from '../utils/ui';

export class PlayerSelectScene extends Phaser.Scene {
  constructor() {
    super('PlayerSelect');
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.grass);
    for (let i = 0; i < 7; i++) {
      this.add.rectangle(GAME_WIDTH / 2, i * 120, GAME_WIDTH, 60, COLORS.grassDark, 0.4);
    }

    const title = this.add
      .text(GAME_WIDTH / 2, 55, rtl('😃 اختر لاعبك المفضل'), {
        fontFamily: FONT,
        fontSize: '32px',
        color: '#ffd93d',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    popIn(title);

    // شبكة بطاقات 2×4
    PLAYERS.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_WIDTH / 2 + (col === 0 ? -112 : 112);
      const y = 175 + row * 150;
      const card = this.makeCard(p, x, y);
      popIn(card, 0.08 * i);
    });

    const backBtn = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 55, '🏠 رجوع', () => {
      this.scene.start('Menu');
    }, { width: 220, height: 60, fontSize: 24, color: COLORS.orange });
    popIn(backBtn, 0.6);
  }

  private makeCard(p: PlayerDef, x: number, y: number): Phaser.GameObjects.Container {
    const selected = this.registry.get('playerId') === p.id;
    const w = 208;
    const h = 136;

    const bg = this.add.rectangle(0, 0, w, h, COLORS.white, 0.95).setOrigin(0.5);
    bg.setStrokeStyle(selected ? 6 : 4, selected ? COLORS.yellow : p.color);
    const avatar = this.add.image(0, -22, `avatar-${p.id}`).setScale(0.72);
    const name = this.add
      .text(0, 32, rtl(`${p.name} ${p.emoji}`), {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#1a5c2e',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    // نقاط القوة كنجوم صغيرة
    const stats = this.add
      .text(0, 54, rtl(`⭐ قوة ${'●'.repeat(p.power)}  دقة ${'●'.repeat(p.accuracy)}`), {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#555555',
      })
      .setOrigin(0.5);

    const badge = selected
      ? this.add.text(0, -64, rtl('✅ مختار'), { fontFamily: FONT, fontSize: '16px', color: '#1a5c2e', fontStyle: 'bold', backgroundColor: '#ffd93d', padding: { x: 8, y: 3 } }).setOrigin(0.5)
      : null;

    const children: Phaser.GameObjects.GameObject[] = [bg, avatar, name, stats];
    if (badge) children.push(badge);
    const card = this.add.container(x, y, children);
    card.setSize(w, h);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerup', () => {
      audio.play('button');
      this.registry.set('playerId', p.id);
      this.scene.restart(); // إعادة الرسم لإظهار علامة الاختيار
    });
    return card;
  }
}
