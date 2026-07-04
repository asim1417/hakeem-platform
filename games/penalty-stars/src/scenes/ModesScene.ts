// ModesScene — تبويب الأوضاع: كل طرق اللعب في بطاقات واضحة + الخزنة

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING, rtl } from '../config/gameConfig';
import { progress } from '../utils/progress';
import { audio } from '../utils/audio';
import { popIn } from '../utils/animations';
import { makeBottomNav, makeMuteChip } from '../utils/ui';
import { fadeIn, go } from '../utils/camera';

interface ModeDef {
  icon: string;
  name: string;
  desc: string;
  data: object | null; // null = الخزنة
  scene: string;
}

const MODES: ModeDef[] = [
  { icon: '🏆', name: 'البطولة', desc: 'أربعة أدوار نحو كأس النجوم', scene: 'Tournament', data: {} },
  { icon: '⚔️', name: 'مباراة البلنتيات', desc: 'سدّد واحرس بإصبعك ضد فريق الحارس', scene: 'Game', data: { mode: 'match' } },
  { icon: '🌀', name: 'تحدي الفاولات', desc: 'حائط يقفز وتسديدة موز بالقوس', scene: 'Game', data: { mode: 'freekick' } },
  { icon: '🎯', name: 'تحدي اليوم', desc: 'سجّل ٤ ضد صقر واكسب +٥ نجوم', scene: 'Game', data: { mode: 'daily' } },
  { icon: '🤝', name: 'تحدي صديق', desc: 'لاعبان يتناوبان على نفس الجهاز', scene: 'Game', data: { mode: 'duel' } },
  { icon: '🏋️', name: 'التدريب الحر', desc: 'تسديد بلا حساب — للتعلم والمرح', scene: 'Game', data: { training: true } },
  { icon: '🎒', name: 'الخزنة', desc: 'افتح كرات وملاعب جديدة بنجومك', scene: 'Locker', data: null },
];

export class ModesScene extends Phaser.Scene {
  constructor() {
    super('Modes');
  }

  create(): void {
    this.drawBackground();
    fadeIn(this);

    const title = this.add
      .text(GAME_WIDTH / 2, 46, rtl('⚽ أوضاع اللعب'), {
        fontFamily: HEADING,
        fontSize: '30px',
        color: '#c6ff00',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    popIn(title);

    MODES.forEach((m, i) => {
      const y = 118 + i * 82;
      const card = this.add.container(GAME_WIDTH / 2, y);
      const bg = this.add.image(0, 0, 'btn-glass').setDisplaySize(416, 72);
      const icon = this.add.text(172, 0, m.icon, { fontSize: '32px' }).setOrigin(0.5);
      const name = this.add
        .text(130, -14, rtl(m.name), { fontFamily: HEADING, fontSize: '20px', color: '#f8fff7', fontStyle: 'bold' })
        .setOrigin(1, 0.5);
      const desc = this.add
        .text(130, 15, rtl(m.desc), { fontFamily: FONT, fontSize: '13px', color: '#b2bcc6' })
        .setOrigin(1, 0.5);
      const arrow = this.add.text(-186, 0, '◀', { fontSize: '18px', color: '#00e5ff' }).setOrigin(0.5);
      card.add([bg, icon, name, desc, arrow]);
      card.setSize(416, 72);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => card.setScale(0.97));
      card.on('pointerout', () => card.setScale(1));
      card.on('pointerup', () => {
        card.setScale(1);
        audio.play('button');
        // اللعب يتطلب لاعبًا مختارًا — الخزنة لا
        if (m.data !== null && !this.registry.has('playerId')) {
          go(this, 'PlayerSelect');
          return;
        }
        go(this, m.scene, m.data ?? undefined);
      });
      popIn(card, 0.06 * i);
    });

    makeMuteChip(this, GAME_WIDTH - 46, 46);
    makeBottomNav(this, 'modes', go);
  }

  private drawBackground(): void {
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.72);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy);
    }
  }
}
