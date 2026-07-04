// MissionsScene — تبويب المهام: تحدي اليوم + إنجازات بتقدم مرئي
// كل شيء محلي من سجل اللعب — بلا خوادم

import Phaser from 'phaser';
import { arabicNum, COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING, rtl } from '../config/gameConfig';
import { progress } from '../utils/progress';
import { popIn } from '../utils/animations';
import { makeBottomNav, makeButton, makeMuteChip } from '../utils/ui';
import { fadeIn, go } from '../utils/camera';

interface Achievement {
  icon: string;
  name: string;
  desc: string;
  current: number;
  target: number;
}

export class MissionsScene extends Phaser.Scene {
  constructor() {
    super('Missions');
  }

  create(): void {
    this.drawBackground();
    fadeIn(this);
    const s = progress.stats();

    const title = this.add
      .text(GAME_WIDTH / 2, 46, rtl('🎯 المهام والإنجازات'), {
        fontFamily: HEADING,
        fontSize: '30px',
        color: '#c6ff00',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    popIn(title);

    // ── بطاقة تحدي اليوم ──
    const done = progress.dailyDoneToday();
    const dailyCard = this.add.container(GAME_WIDTH / 2, 136);
    const dBg = this.add.image(0, 0, done ? 'panel-glass' : 'btn-gold').setDisplaySize(416, 92);
    const dTitle = this.add
      .text(180, -20, rtl(done ? '✅ تحدي اليوم — أُنجز!' : '🎯 تحدي اليوم'), {
        fontFamily: HEADING,
        fontSize: '21px',
        color: done ? '#36f58a' : '#0b0f14',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);
    const dDesc = this.add
      .text(180, 12, rtl(done ? 'عُد غدًا لتحدٍّ جديد ومكافأة جديدة' : 'سجّل ٤ أهداف ضد صقر — المكافأة +٥ ⭐'), {
        fontFamily: FONT,
        fontSize: '14px',
        color: done ? '#b2bcc6' : '#111720',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);
    dailyCard.add([dBg, dTitle, dDesc]);
    if (!done) {
      const play = makeButton(this, -150, 0, '▶️ العب', () => {
        if (!this.registry.has('playerId')) go(this, 'PlayerSelect');
        else go(this, 'Game', { mode: 'daily' });
      }, { width: 96, height: 52, fontSize: 18, variant: 'glass' });
      dailyCard.add(play);
    }
    popIn(dailyCard, 0.1);

    // ── الإنجازات: تُحسب من سجل اللعب المحلي ──
    const list: Achievement[] = [
      { icon: '⚽', name: 'هدّاف صاعد', desc: 'سجّل ١٠ أهداف', current: s.goals, target: 10 },
      { icon: '🚀', name: 'صاروخ الملعب', desc: 'سجّل ٥٠ هدفًا', current: s.goals, target: 50 },
      { icon: '🧤', name: 'حارس أمين', desc: 'تصدَّ لـ ١٠ كرات بإصبعك', current: s.saves, target: 10 },
      { icon: '🔁', name: 'مثابر لا يتوقف', desc: 'أكمل ١٠ جولات', current: s.rounds, target: 10 },
      { icon: '⚡', name: 'نجم الذهبية', desc: 'افز بضربة ذهبية', current: s.goldenWins, target: 1 },
      { icon: '🏆', name: 'بطل كأس النجوم', desc: 'توّج بالبطولة كاملة', current: progress.hasTrophy() ? 1 : 0, target: 1 },
    ];

    list.forEach((a, i) => {
      const y = 232 + i * 78;
      const doneA = a.current >= a.target;
      const card = this.add.container(GAME_WIDTH / 2, y);
      const bg = this.add.image(0, 0, 'panel-glass').setDisplaySize(416, 68);
      const icon = this.add.text(176, 0, a.icon, { fontSize: '26px' }).setOrigin(0.5).setAlpha(doneA ? 1 : 0.65);
      const name = this.add
        .text(140, -16, rtl(`${a.name}${doneA ? ' ✅' : ''}`), {
          fontFamily: HEADING,
          fontSize: '17px',
          color: doneA ? '#36f58a' : '#f8fff7',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5);
      const desc = this.add
        .text(140, 8, rtl(a.desc), { fontFamily: FONT, fontSize: '12px', color: '#b2bcc6' })
        .setOrigin(1, 0.5);
      // شريط تقدم بتوهج ليموني
      const ratio = Phaser.Math.Clamp(a.current / a.target, 0, 1);
      const barBg = this.add.rectangle(-30, 22, 300, 8, 0x2a3442).setOrigin(1, 0.5);
      barBg.x = 140;
      const bar = this.add.rectangle(140, 22, 300 * ratio, 8, doneA ? 0x36f58a : 0xc6ff00).setOrigin(1, 0.5);
      const count = this.add
        .text(-160, 12, rtl(`${arabicNum(Math.min(a.current, a.target))}/${arabicNum(a.target)}`), {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#00e5ff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      card.add([bg, icon, name, desc, barBg, bar, count]);
      popIn(card, 0.18 + 0.05 * i);
    });

    makeMuteChip(this, GAME_WIDTH - 46, 46);
    makeBottomNav(this, 'missions', go);
  }

  private drawBackground(): void {
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.75);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy);
    }
  }
}
