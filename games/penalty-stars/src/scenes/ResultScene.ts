// ResultScene — النتيجة بالنجوم وعبارة تشجيعية (لا خسارة قاسية أبدًا)

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { arabicNum, COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, rtl, SHOTS_PER_ROUND } from '../config/gameConfig';
import { getPlayer } from '../data/players';
import { audio } from '../utils/audio';
import { confetti, popIn } from '../utils/animations';
import { makeButton } from '../utils/ui';

export class ResultScene extends Phaser.Scene {
  private goals = 0;

  constructor() {
    super('Result');
  }

  init(data: { goals?: number }): void {
    this.goals = data.goals ?? 0;
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.grass);
    for (let i = 0; i < 7; i++) {
      this.add.rectangle(GAME_WIDTH / 2, i * 120, GAME_WIDTH, 60, COLORS.grassDark, 0.4);
    }

    const player = getPlayer(this.registry.get('playerId') as string);

    const title = this.add
      .text(GAME_WIDTH / 2, 110, rtl('🎉 انتهت الجولة! 🎉'), {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#ffd93d',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 9,
      })
      .setOrigin(0.5);
    popIn(title);

    // صورة اللاعب
    const avatar = this.add.image(GAME_WIDTH / 2, 220, `avatar-${player.id}`).setScale(1.5);
    popIn(avatar, 0.15);
    this.add
      .text(GAME_WIDTH / 2, 300, rtl(`${player.name} ${player.emoji}`), {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // النجوم — نجمة لكل هدف
    for (let i = 0; i < SHOTS_PER_ROUND; i++) {
      const earned = i < this.goals;
      const star = this.add
        .image(GAME_WIDTH / 2 - 130 + i * 65, 390, 'star')
        .setScale(earned ? 1.15 : 0.9)
        .setAlpha(earned ? 1 : 0.25);
      if (earned) {
        star.setScale(0);
        gsap.to(star, { scale: 1.15, duration: 0.5, delay: 0.4 + i * 0.22, ease: 'back.out(2.5)' });
        this.time.delayedCall(400 + i * 220, () => audio.play('button'));
      }
    }

    // عبارة النتيجة — تشجيعية دائمًا
    const message =
      this.goals >= 3
        ? '⭐ أنت نجم البلنتيات اليوم! ⭐'
        : this.goals >= 1
          ? 'أحسنت يا بطل! 💪 جرّب مرة ثانية لتجمع نجومًا أكثر'
          : 'محاولات ممتازة يا كابتن المستقبل! 🌟 حاول مرة ثانية';
    const msgText = this.add
      .text(GAME_WIDTH / 2, 475, rtl(message), {
        fontFamily: FONT,
        fontSize: '27px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5);
    popIn(msgText, 0.7);

    this.add
      .text(GAME_WIDTH / 2, 540, rtl(`الأهداف: ${arabicNum(this.goals)} من ${arabicNum(SHOTS_PER_ROUND)}`), {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#e8f6ff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // احتفالية كبيرة عند ٣ أهداف أو أكثر
    if (this.goals >= 3) {
      audio.play('goal');
      audio.play('crowd');
      confetti(this, 60);
      this.time.addEvent({ delay: 1500, repeat: 2, callback: () => confetti(this, 30) });
    } else {
      audio.play('crowd');
    }

    // الأزرار
    const replayBtn = makeButton(this, GAME_WIDTH / 2, 630, '🔁 إعادة اللعب', () => {
      this.scene.start('Game', { training: false });
    }, { width: 300, height: 78, color: COLORS.blue, fontSize: 30 });
    popIn(replayBtn, 0.9);

    const homeBtn = makeButton(this, GAME_WIDTH / 2, 720, '🏠 الرئيسية', () => {
      this.scene.start('Menu');
    }, { width: 300, height: 66, color: COLORS.orange, fontSize: 26 });
    popIn(homeBtn, 1.0);
  }
}
