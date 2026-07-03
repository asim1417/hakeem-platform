// ResultScene — نتيجة المرحلة: اجتياز، فوز بالبطولة، أو إعادة محاولة لطيفة

import Phaser from 'phaser';
import { gsap } from 'gsap';
import {
  arabicNum,
  COLORS,
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
  PASS_GOALS,
  rtl,
  SHOTS_PER_ROUND,
  STAGES,
} from '../config/gameConfig';
import { getPlayer } from '../data/players';
import { audio } from '../utils/audio';
import { confetti, popIn } from '../utils/animations';
import { makeButton } from '../utils/ui';

type Outcome = 'championship' | 'advance' | 'retry';

export class ResultScene extends Phaser.Scene {
  private goals = 0;
  private stage = 0;

  constructor() {
    super('Result');
  }

  init(data: { goals?: number; stage?: number }): void {
    this.goals = data.goals ?? 0;
    this.stage = data.stage ?? 0;
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.grass);
    for (let i = 0; i < 7; i++) {
      this.add.rectangle(GAME_WIDTH / 2, i * 120, GAME_WIDTH, 60, COLORS.grassDark, 0.4);
    }

    const player = getPlayer(this.registry.get('playerId') as string);
    const passed = this.goals >= PASS_GOALS;
    const isLastStage = this.stage >= STAGES.length - 1;
    const outcome: Outcome = passed ? (isLastStage ? 'championship' : 'advance') : 'retry';

    // العنوان حسب النتيجة — لا عبارات قاسية أبدًا
    const titles: Record<Outcome, string> = {
      championship: '🏆 فزت بالبطولة! 🏆',
      advance: '🎉 أكملت المرحلة! 🎉',
      retry: '💪 محاولة شجاعة!',
    };
    const title = this.add
      .text(GAME_WIDTH / 2, 100, rtl(titles[outcome]), {
        fontFamily: FONT,
        fontSize: outcome === 'championship' ? '42px' : '38px',
        color: '#ffd93d',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 9,
      })
      .setOrigin(0.5);
    popIn(title);

    // صورة اللاعب — مع كأس عند الفوز بالبطولة
    const avatar = this.add.image(GAME_WIDTH / 2, 210, `avatar-${player.id}`).setDisplaySize(150, 150);
    popIn(avatar, 0.15);
    if (outcome === 'championship') {
      const trophy = this.add
        .text(GAME_WIDTH / 2 + 85, 160, '🏆', { fontSize: '52px' })
        .setOrigin(0.5)
        .setAngle(15);
      popIn(trophy, 0.5);
      gsap.to(trophy, { angle: -15, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1 });
    }
    this.add
      .text(GAME_WIDTH / 2, 297, rtl(`${player.name} ${player.emoji}`), {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // شارة المرحلة
    const stageDef = STAGES[this.stage];
    this.add
      .text(GAME_WIDTH / 2, 337, rtl(`${stageDef.icon} ${stageDef.label}`), {
        fontFamily: FONT,
        fontSize: '19px',
        color: '#e8f6ff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // النجوم — نجمة لكل هدف
    for (let i = 0; i < SHOTS_PER_ROUND; i++) {
      const earned = i < this.goals;
      const star = this.add
        .image(GAME_WIDTH / 2 - 130 + i * 65, 405, 'star')
        .setScale(earned ? 1.15 : 0.9)
        .setAlpha(earned ? 1 : 0.25);
      if (earned) {
        star.setScale(0);
        gsap.to(star, { scale: 1.15, duration: 0.5, delay: 0.4 + i * 0.22, ease: 'back.out(2.5)' });
        this.time.delayedCall(400 + i * 220, () => audio.play('button'));
      }
    }

    // الرسالة — تشجيعية دائمًا
    const messages: Record<Outcome, string> = {
      championship: '⭐ أنت نجم البلنتيات وبطل كل المراحل! ⭐',
      advance: `رائع يا بطل! الحارس أصبح أسرع في ${STAGES[this.stage + 1]?.label ?? ''} — هل أنت مستعد؟`,
      retry: `اقتربت كثيرًا! سجّل ${arabicNum(PASS_GOALS)} أهداف لتكمل المرحلة، أنت قادر يا نجم! 🌟`,
    };
    const msgText = this.add
      .text(GAME_WIDTH / 2, 483, rtl(messages[outcome]), {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: 410 },
      })
      .setOrigin(0.5);
    popIn(msgText, 0.7);

    this.add
      .text(GAME_WIDTH / 2, 550, rtl(`الأهداف: ${arabicNum(this.goals)} من ${arabicNum(SHOTS_PER_ROUND)}`), {
        fontFamily: FONT,
        fontSize: '21px',
        color: '#e8f6ff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // احتفالات
    if (outcome === 'championship') {
      audio.play('goal');
      audio.play('crowd');
      confetti(this, 70);
      this.time.addEvent({ delay: 1300, repeat: 3, callback: () => confetti(this, 35) });
    } else if (outcome === 'advance') {
      audio.play('goal');
      audio.play('crowd');
      confetti(this, 40);
    } else {
      audio.play('crowd');
    }

    // الأزرار حسب النتيجة
    const mainLabels: Record<Outcome, string> = {
      championship: '🔁 العب البطولة من جديد',
      advance: '▶️ المرحلة التالية',
      retry: '🔁 إعادة المرحلة',
    };
    const nextStage = outcome === 'advance' ? this.stage + 1 : outcome === 'retry' ? this.stage : 0;
    const mainBtn = makeButton(this, GAME_WIDTH / 2, 635, mainLabels[outcome], () => {
      this.scene.start('Game', { stage: nextStage });
    }, { width: 340, height: 78, color: COLORS.blue, fontSize: 27 });
    popIn(mainBtn, 0.9);

    const homeBtn = makeButton(this, GAME_WIDTH / 2, 725, '🏠 الرئيسية', () => {
      this.scene.start('Menu');
    }, { width: 340, height: 64, color: COLORS.orange, fontSize: 25 });
    popIn(homeBtn, 1.0);
  }
}
