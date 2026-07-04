// ProfileScene — تبويب الملف: بطاقة اللاعب وسجل أرقامه وأوسمته
// كل الأرقام محلية من الجهاز — بلا حسابات

import Phaser from 'phaser';
import { arabicNum, COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING, rtl } from '../config/gameConfig';
import { getPlayer } from '../data/players';
import { progress } from '../utils/progress';
import { popIn } from '../utils/animations';
import { makeBottomNav, makeButton, makeMuteChip } from '../utils/ui';
import { fadeIn, go } from '../utils/camera';

export class ProfileScene extends Phaser.Scene {
  constructor() {
    super('Profile');
  }

  create(): void {
    this.drawBackground();
    fadeIn(this);
    const hasPlayer = this.registry.has('playerId');
    const player = getPlayer(this.registry.get('playerId') as string);
    const s = progress.stats();

    const title = this.add
      .text(GAME_WIDTH / 2, 46, rtl('👤 ملف اللاعب'), {
        fontFamily: HEADING,
        fontSize: '30px',
        color: '#c6ff00',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    popIn(title);

    // ── بطاقة اللاعب الكبيرة ──
    const card = this.add.container(GAME_WIDTH / 2, 190);
    const bg = this.add.image(0, 0, 'panel-glass').setDisplaySize(416, 200);
    card.add(bg);
    if (hasPlayer) {
      const avatar = this.add.image(-130, -10, `avatar-${player.id}`).setDisplaySize(120, 120);
      const ring = this.add.circle(-130, -10, 64, 0x000000, 0).setStrokeStyle(4, player.color);
      const name = this.add
        .text(150, -55, rtl(`${player.name} ${player.emoji}`), {
          fontFamily: HEADING,
          fontSize: '24px',
          color: '#f8fff7',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5);
      // مؤشرات القدرات الثلاثة
      const dots = (v: number) => '●'.repeat(Math.round(v / 2)) + '○'.repeat(5 - Math.round(v / 2));
      const statLines = [
        `سرعة  ${dots(player.speed)}`,
        `قوة    ${dots(player.power)}`,
        `دقة    ${dots(player.accuracy)}`,
      ];
      statLines.forEach((line, i) => {
        card.add(
          this.add
            .text(150, -18 + i * 26, rtl(line), { fontFamily: FONT, fontSize: '15px', color: '#00e5ff', fontStyle: 'bold' })
            .setOrigin(1, 0.5),
        );
      });
      const rank = progress.hasTrophy() ? '🏆 بطل كأس النجوم' : '⭐ نجم صاعد';
      const rankTag = this.add
        .text(-130, 70, rtl(rank), {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#ffd45a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      card.add([avatar, ring, name, rankTag]);
    } else {
      card.add(
        this.add
          .text(0, -10, rtl('👤\nلم تختر لاعبًا بعد'), {
            fontFamily: FONT,
            fontSize: '22px',
            color: '#b2bcc6',
            fontStyle: 'bold',
            align: 'center',
          })
          .setOrigin(0.5),
      );
    }
    popIn(card, 0.1);

    const changeBtn = makeButton(this, GAME_WIDTH / 2, 322, hasPlayer ? '🔄 تغيير اللاعب' : '😃 اختر لاعبك', () => go(this, 'PlayerSelect'), {
      width: 260,
      height: 54,
      fontSize: 21,
      variant: hasPlayer ? 'glass' : 'primary',
    });
    popIn(changeBtn, 0.2);

    // ── سجل الأرقام ──
    this.add
      .text(GAME_WIDTH / 2, 386, rtl('📊 سجلك في الملعب'), {
        fontFamily: HEADING,
        fontSize: '20px',
        color: '#f8fff7',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    const acc = s.shots > 0 ? Math.round((s.goals / s.shots) * 100) : 0;
    const statsGrid: [string, string][] = [
      ['⚽ الأهداف', arabicNum(s.goals)],
      ['👟 التسديدات', arabicNum(s.shots)],
      ['🧤 التصديات', arabicNum(s.saves)],
      ['🔁 الجولات', arabicNum(s.rounds)],
      ['🎯 دقة التسجيل', `٪${arabicNum(acc)}`],
      ['⭐ رصيد النجوم', arabicNum(progress.totalStars())],
    ];
    statsGrid.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = GAME_WIDTH / 2 + (1 - col) * 140;
      const y = 452 + row * 86;
      const chip = this.add.container(x, y);
      const cBg = this.add.image(0, 0, 'panel-glass').setDisplaySize(128, 74);
      const v = this.add
        .text(0, -12, rtl(value), { fontFamily: HEADING, fontSize: '22px', color: '#c6ff00', fontStyle: 'bold' })
        .setOrigin(0.5);
      const l = this.add.text(0, 18, rtl(label), { fontFamily: FONT, fontSize: '12px', color: '#b2bcc6' }).setOrigin(0.5);
      chip.add([cBg, v, l]);
      popIn(chip, 0.25 + i * 0.04);
    });

    // ── وسام الكأس ──
    if (progress.hasTrophy()) {
      const trophy = this.add.image(GAME_WIDTH / 2, 636, 'ic-trophy').setDisplaySize(52, 46);
      const tLabel = this.add
        .text(GAME_WIDTH / 2, 672, rtl('بطل كأس النجوم 🏆'), {
          fontFamily: FONT,
          fontSize: '15px',
          color: '#ffd45a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      popIn(trophy, 0.5);
      popIn(tLabel, 0.55);
    } else {
      this.add
        .text(GAME_WIDTH / 2, 650, rtl('🔒 كأس النجوم بانتظارك في البطولة'), {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#b2bcc6',
        })
        .setOrigin(0.5);
    }

    makeMuteChip(this, GAME_WIDTH - 46, 46);
    makeBottomNav(this, 'profile', go);
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
