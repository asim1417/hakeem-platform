// TournamentScene — شجرة البطولة: أربعة أدوار ببطاقات ✓ / ▶ / 🔒 وزر متابعة
// تقدم البطولة يعيش في registry خلال الجلسة — الدور الحالي يأتي من Result بعد كل اجتياز

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { arabicNum, COLORS, DIFFICULTIES, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING, PASS_GOALS, rtl, STAGES } from '../config/gameConfig';
import { progress, STADIUMS } from '../utils/progress';
import { makeButton, makeChip, makeMuteChip } from '../utils/ui';
import { popIn, pulse } from '../utils/animations';
import { fadeIn, go } from '../utils/camera';

export class TournamentScene extends Phaser.Scene {
  private stage = 0; // الدور القادم الذي سيُلعب

  constructor() {
    super('Tournament');
  }

  init(data: { stage?: number }): void {
    if (typeof data.stage === 'number') this.registry.set('tournamentStage', data.stage);
    this.stage = Phaser.Math.Clamp((this.registry.get('tournamentStage') as number) ?? 0, 0, STAGES.length - 1);
  }

  create(): void {
    this.drawBackground();
    fadeIn(this);

    const logo = this.add.image(GAME_WIDTH / 2, 72, 'logo-shield').setDisplaySize(84, 92);
    popIn(logo, 0.05);
    const title = this.add
      .text(GAME_WIDTH / 2, 148, rtl('🏆 بطولة نجوم البلنتيات'), {
        fontFamily: HEADING,
        fontSize: '34px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 9,
      })
      .setOrigin(0.5);
    popIn(title, 0.1);
    this.add
      .text(GAME_WIDTH / 2, 190, rtl(`سجّل ${arabicNum(PASS_GOALS)} أهداف في كل دور لتتقدم نحو الكأس`), {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#e8f6ff',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // بطاقات الأدوار الأربعة
    STAGES.forEach((st, i) => {
      const y = 258 + i * 96;
      const done = i < this.stage;
      const current = i === this.stage;
      const card = this.add.container(GAME_WIDTH / 2, y);

      const bg = this.add.image(0, 0, 'panel-glass').setDisplaySize(400, 84);
      const stateIcon = done ? '✅' : current ? '▶️' : '🔒';
      const icon = this.add.text(-168, 0, stateIcon, { fontSize: '30px' }).setOrigin(0.5);
      const stadiumName = STADIUMS.find((s) => s.key === st.stadium)?.name ?? '';
      const label = this.add
        .text(30, -14, rtl(`${st.icon} ${st.label}`), {
          fontFamily: FONT,
          fontSize: '23px',
          color: done ? '#9fffb9' : current ? '#ffd45a' : '#cfd8e3',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const sub = this.add
        .text(30, 17, rtl(`🧤 ${DIFFICULTIES[st.difficulty].keeperName} • 🏟️ ${stadiumName}`), {
          fontFamily: FONT,
          fontSize: '15px',
          color: '#e8f6ff',
        })
        .setOrigin(0.5)
        .setAlpha(done || current ? 0.95 : 0.55);
      card.add([bg, icon, label, sub]);
      if (!done && !current) card.setAlpha(0.75);
      popIn(card, 0.18 + i * 0.08);
      if (current) {
        bg.setTint(0xbfffd9);
        gsap.to(icon, { scale: 1.25, duration: 0.55, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.9 });
      }
    });

    // زر متابعة الدور الحالي
    const st = STAGES[this.stage];
    const playBtn = makeButton(
      this,
      GAME_WIDTH / 2,
      680,
      `⚽ العب ${st.label} ضد ${DIFFICULTIES[st.difficulty].keeperName}`,
      () => go(this, 'Game', { stage: this.stage }),
      { width: 420, height: 80, fontSize: 23, variant: 'primary' },
    );
    popIn(playBtn, 0.55);
    pulse(playBtn);

    makeButton(this, GAME_WIDTH / 2, 756, '🏠 الرئيسية', () => go(this, 'Menu'), {
      width: 260,
      height: 54,
      fontSize: 21,
      variant: 'glass',
    });

    makeMuteChip(this, GAME_WIDTH - 46, 46);
    makeChip(this, 46, 46, 'ic-home', () => go(this, 'Menu'));
  }

  private drawBackground(): void {
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.6);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy);
    }
  }
}
