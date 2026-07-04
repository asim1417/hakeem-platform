// ResultScene — نتيجة دور البطولة أو المباراة: تشجيع دائم، لا عبارات قاسية

import Phaser from 'phaser';
import { gsap } from 'gsap';
import {
  arabicNum,
  COLORS,
  DIFFICULTIES,
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
import { progress } from '../utils/progress';
import { resultMessage } from '../data/phrases';

type Outcome = 'championship' | 'advance' | 'retry' | 'matchWin' | 'matchClose';

export class ResultScene extends Phaser.Scene {
  private goals = 0;
  private stage = 0;
  private matchMode = false;
  private oppGoals = 0;
  private goldenWin = false;

  constructor() {
    super('Result');
  }

  init(data: { goals?: number; stage?: number; mode?: string; oppGoals?: number; goldenWin?: boolean }): void {
    this.goals = data.goals ?? 0;
    this.stage = data.stage ?? 0;
    this.matchMode = data.mode === 'match';
    this.oppGoals = data.oppGoals ?? 0;
    this.goldenWin = Boolean(data.goldenWin);
  }

  create(): void {
    // خلفية الملعب الواقعي بطبقة كحلية (دليل الهوية)
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.55);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.grass);
    }

    const player = getPlayer(this.registry.get('playerId') as string);

    // إضافة النجوم للرصيد مع كشف المكافآت المفتوحة حديثًا
    const starsBefore = progress.totalStars();
    if (this.goals > 0) progress.addStars(this.goals);
    const unlocked = progress.newUnlocks(starsBefore, progress.totalStars());

    const passed = this.goals >= PASS_GOALS;
    const isLastStage = this.stage >= STAGES.length - 1;
    const outcome: Outcome = this.matchMode
      ? this.goldenWin || this.goals > this.oppGoals
        ? 'matchWin'
        : 'matchClose'
      : passed
        ? isLastStage
          ? 'championship'
          : 'advance'
        : 'retry';

    if (outcome === 'championship') progress.winTrophy();

    // العنوان حسب النتيجة — لا عبارات قاسية أبدًا
    const titles: Record<Outcome, string> = {
      championship: '🏆 فزت بكأس النجوم! 🏆',
      advance: '🎉 اجتزت الدور! 🎉',
      retry: '💪 محاولة شجاعة!',
      matchWin: '⚔️ فزت بالمباراة! 🎉',
      matchClose: '⚔️ مباراة حماسية!',
    };
    const title = this.add
      .text(GAME_WIDTH / 2, 100, rtl(titles[outcome]), {
        fontFamily: FONT,
        fontSize: outcome === 'championship' ? '40px' : '36px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 9,
      })
      .setOrigin(0.5);
    popIn(title);

    // صورة اللاعب — مع كأس عند البطولة أو الفوز بالمباراة
    const avatar = this.add.image(GAME_WIDTH / 2, 210, `avatar-${player.id}`).setDisplaySize(150, 150);
    popIn(avatar, 0.15);
    if (outcome === 'championship' || outcome === 'matchWin') {
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

    // شارة الدور أو نتيجة المباراة
    const badge = this.matchMode
      ? `⚔️ أنت ${arabicNum(this.goals)} - ${arabicNum(this.oppGoals)} فريق الحارس${this.goldenWin ? ' • ⚡ ذهبية!' : ''}`
      : `${STAGES[this.stage].icon} ${STAGES[this.stage].label} — 🧤 ${DIFFICULTIES[STAGES[this.stage].difficulty].keeperName}`;
    this.add
      .text(GAME_WIDTH / 2, 337, rtl(badge), {
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
        .image(GAME_WIDTH / 2 - 130 + i * 65, 400, 'star')
        .setScale(earned ? 1.15 : 0.9)
        .setAlpha(earned ? 1 : 0.25);
      if (earned) {
        star.setScale(0);
        gsap.to(star, { scale: 1.15, duration: 0.5, delay: 0.4 + i * 0.22, ease: 'back.out(2.5)' });
        this.time.delayedCall(400 + i * 220, () => audio.play('button'));
      }
    }

    // الرسالة الرئيسية + سطر الحال — أسطر قصيرة حتى لا يكسر الالتفاف الاتجاه
    const nextKeeper = STAGES[this.stage + 1] ? DIFFICULTIES[STAGES[this.stage + 1].difficulty].keeperName : '';
    const stageNote: Record<Outcome, string> = {
      championship: 'أنت بطل كل الأدوار! 🏆',
      advance: `القادم: ${nextKeeper} 🧤\nمستعد يا بطل؟`,
      retry: `سجّل ${arabicNum(PASS_GOALS)} أهداف لتجتاز الدور\nأنت قادر يا نجم! 🌟`,
      matchWin: 'فريقك يحتفل بك يا بطل! 🎉',
      matchClose: 'اقتربت من الفوز يا بطل\nجرّب مرة ثانية! 🌟',
    };
    const msgText = this.add
      .text(GAME_WIDTH / 2, 478, rtl(`${resultMessage(this.goals)}\n${stageNote[outcome]}`), {
        fontFamily: FONT,
        fontSize: '23px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5);
    popIn(msgText, 0.7);

    this.add
      .text(GAME_WIDTH / 2, 545, rtl(`الأهداف: ${arabicNum(this.goals)} من ${arabicNum(SHOTS_PER_ROUND)}  •  رصيدك: ⭐ ${arabicNum(progress.totalStars())}`), {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#e8f6ff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // 🎁 بشارة المكافآت المفتوحة حديثًا
    if (unlocked.length > 0) {
      const gift = this.add
        .text(GAME_WIDTH / 2, 583, rtl(`🎁 فُتح: ${unlocked.join('، ')} — زر الخزنة!`), {
          fontFamily: FONT,
          fontSize: '18px',
          color: '#1a5c2e',
          fontStyle: 'bold',
          backgroundColor: '#ffd93d',
          padding: { x: 12, y: 5 },
        })
        .setOrigin(0.5)
        .setDepth(10);
      popIn(gift, 1.1);
      this.time.delayedCall(1100, () => audio.play('unlock'));
    }

    // احتفالات
    if (outcome === 'championship' || outcome === 'matchWin') {
      audio.play('trophy');
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
      advance: '▶️ الدور التالي',
      retry: '🔁 إعادة الدور',
      matchWin: '⚔️ مباراة جديدة',
      matchClose: '🔁 إعادة المباراة',
    };
    const mainBtn = makeButton(this, GAME_WIDTH / 2, 640, mainLabels[outcome], () => {
      if (this.matchMode) {
        this.scene.start('Game', { mode: 'match' });
      } else {
        const nextStage = outcome === 'advance' ? this.stage + 1 : outcome === 'retry' ? this.stage : 0;
        this.scene.start('Game', { stage: nextStage });
      }
    }, { width: 340, height: 74, fontSize: 26, variant: 'primary' });
    popIn(mainBtn, 0.9);

    const homeBtn = makeButton(this, GAME_WIDTH / 2, 726, '🏠 الرئيسية', () => {
      this.scene.start('Menu');
    }, { width: 340, height: 62, fontSize: 25, variant: 'glass' });
    popIn(homeBtn, 1.0);
  }
}
