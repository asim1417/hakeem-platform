// ResultScene — نتيجة البطولة/المباراة/الفاولات/تحدي اليوم/تحدي صديق: تشجيع دائم، لا عبارات قاسية

import Phaser from 'phaser';
import { gsap } from 'gsap';
import {
  arabicNum,
  COLORS,
  DIFFICULTIES,
  FONT,
  HEADING,
  GAME_HEIGHT,
  GAME_WIDTH,
  PASS_GOALS,
  rtl,
  SHOTS_PER_ROUND,
  STAGES,
} from '../config/gameConfig';
import { getPlayer } from '../data/players';
import { audio } from '../utils/audio';
import { announcer } from '../utils/announcer';
import { confetti, popIn } from '../utils/animations';
import { makeButton } from '../utils/ui';
import { progress } from '../utils/progress';
import { resultMessage } from '../data/phrases';
import { fadeIn, go } from '../utils/camera';

type Outcome =
  | 'championship'
  | 'advance'
  | 'retry'
  | 'matchWin'
  | 'matchClose'
  | 'freekick'
  | 'dailyWin'
  | 'dailyClose'
  | 'duel';

interface ResultData {
  goals?: number;
  stage?: number;
  mode?: string;
  oppGoals?: number;
  goldenWin?: boolean;
  p1Name?: string;
  p2Name?: string;
  p1Goals?: number;
  p2Goals?: number;
}

export class ResultScene extends Phaser.Scene {
  private goals = 0;
  private stage = 0;
  private mode = 'tournament';
  private oppGoals = 0;
  private goldenWin = false;
  private duel = { p1Name: '', p2Name: '', p1Goals: 0, p2Goals: 0 };

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.goals = data.goals ?? 0;
    this.stage = data.stage ?? 0;
    this.mode = data.mode ?? 'tournament';
    this.oppGoals = data.oppGoals ?? 0;
    this.goldenWin = Boolean(data.goldenWin);
    this.duel = {
      p1Name: data.p1Name ?? '',
      p2Name: data.p2Name ?? '',
      p1Goals: data.p1Goals ?? 0,
      p2Goals: data.p2Goals ?? 0,
    };
  }

  create(): void {
    // خلفية الملعب الواقعي بطبقة كحلية (دليل الهوية)
    if (this.textures.exists('stadium-stars')) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'stadium-stars').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.68);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy);
    }
    fadeIn(this);

    const player = getPlayer(this.registry.get('playerId') as string);

    // إضافة النجوم للرصيد مع كشف المكافآت المفتوحة حديثًا
    const starsBefore = progress.totalStars();
    const earnedStars = this.mode === 'duel' ? Math.max(this.duel.p1Goals, this.duel.p2Goals) : this.goals;
    if (earnedStars > 0) progress.addStars(earnedStars);

    // 🎯 مكافأة تحدي اليوم: +٥ نجوم مرة واحدة يوميًا
    const dailyPassed = this.mode === 'daily' && this.goals >= 4;
    let dailyBonus = false;
    if (dailyPassed && !progress.dailyDoneToday()) {
      progress.addStars(5);
      progress.markDailyDone();
      dailyBonus = true;
    }
    const unlocked = progress.newUnlocks(starsBefore, progress.totalStars());

    const outcome = this.computeOutcome();
    if (outcome === 'championship') progress.winTrophy();
    // سجل الملف الشخصي: جولة مكتملة + انتصار الذهبية
    progress.recordRound();
    if (this.goldenWin) progress.recordGolden();

    // العنوان حسب النتيجة — لا عبارات قاسية أبدًا
    const titles: Record<Outcome, string> = {
      championship: '🏆 فزت بكأس النجوم! 🏆',
      advance: '🎉 اجتزت الدور! 🎉',
      retry: '💪 محاولة شجاعة!',
      matchWin: '⚔️ فزت بالمباراة! 🎉',
      matchClose: '⚔️ مباراة حماسية!',
      freekick: '🌀 تحدي الفاولات!',
      dailyWin: '🎯 أنجزت تحدي اليوم! 🎉',
      dailyClose: '🎯 تحدٍّ شجاع!',
      duel: this.duelTitle(),
    };
    const title = this.add
      .text(GAME_WIDTH / 2, 100, rtl(titles[outcome]), {
        fontFamily: HEADING,
        fontSize: outcome === 'championship' ? '38px' : '32px',
        color: '#c6ff00',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 9,
        align: 'center',
      })
      .setOrigin(0.5);
    popIn(title);

    // صورة اللاعب — مع كأس الهوية المرسوم عند البطولة أو الفوز
    const avatar = this.add.image(GAME_WIDTH / 2, 210, `avatar-${player.id}`).setDisplaySize(150, 150);
    popIn(avatar, 0.15);
    if (outcome === 'championship' || outcome === 'matchWin' || outcome === 'dailyWin') {
      const big = outcome === 'championship';
      const trophy = this.add
        .image(GAME_WIDTH / 2 + 88, 158, 'ic-trophy')
        .setDisplaySize(big ? 76 : 56, big ? 76 : 56)
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
        stroke: '#0b0f14',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // شارة السياق: الدور / نتيجة المباراة / نتيجة الصديقين
    this.add
      .text(GAME_WIDTH / 2, 337, rtl(this.badgeText()), {
        fontFamily: FONT,
        fontSize: '19px',
        color: '#e8f6ff',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // النجوم — نجمة لكل هدف (في تحدي الصديق: أهداف الفائز)
    const starGoals = this.mode === 'duel' ? Math.max(this.duel.p1Goals, this.duel.p2Goals) : this.goals;
    for (let i = 0; i < SHOTS_PER_ROUND; i++) {
      const earned = i < starGoals;
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
    const msgText = this.add
      .text(GAME_WIDTH / 2, 478, rtl(`${resultMessage(starGoals)}\n${this.stageNote(outcome, dailyBonus)}`), {
        fontFamily: FONT,
        fontSize: '23px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5);
    popIn(msgText, 0.7);

    this.add
      .text(GAME_WIDTH / 2, 545, rtl(`الأهداف: ${arabicNum(starGoals)} من ${arabicNum(SHOTS_PER_ROUND)}  •  رصيدك: ⭐ ${arabicNum(progress.totalStars())}`), {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#e8f6ff',
        fontStyle: 'bold',
        stroke: '#0b0f14',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    // 🎁 بشارة المكافآت المفتوحة حديثًا
    if (unlocked.length > 0) {
      const gift = this.add
        .text(GAME_WIDTH / 2, 583, rtl(`🎁 فُتح: ${unlocked.join('، ')} — زر الخزنة!`), {
          fontFamily: FONT,
          fontSize: '18px',
          color: '#0b0f14',
          fontStyle: 'bold',
          backgroundColor: '#ffd23f',
          padding: { x: 12, y: 5 },
        })
        .setOrigin(0.5)
        .setDepth(10);
      popIn(gift, 1.1);
      this.time.delayedCall(1100, () => audio.play('unlock'));
    }

    // احتفالات
    if (outcome === 'championship' || outcome === 'matchWin' || outcome === 'dailyWin') {
      audio.play('trophy');
      audio.play('crowd');
      announcer.onCelebrate(); // 🎤 «أحسنت!»
      confetti(this, 70);
      this.time.addEvent({ delay: 1300, repeat: 3, callback: () => confetti(this, 35) });
    } else if (outcome === 'advance' || (outcome === 'duel' && this.duel.p1Goals !== this.duel.p2Goals)) {
      audio.play('goal');
      audio.play('crowd');
      confetti(this, 40);
    } else {
      audio.play('crowd');
    }

    // الأزرار حسب النتيجة
    const mainLabels: Record<Outcome, string> = {
      championship: '🔁 العب البطولة من جديد',
      advance: '▶️ شجرة البطولة',
      retry: '🔁 إعادة الدور',
      matchWin: '⚔️ مباراة جديدة',
      matchClose: '🔁 إعادة المباراة',
      freekick: '🌀 إعادة تحدي الفاولات',
      dailyWin: '🏆 شجرة البطولة',
      dailyClose: '🔁 حاول مرة أخرى',
      duel: '🤝 مباراة أخرى',
    };
    const mainBtn = makeButton(this, GAME_WIDTH / 2, 640, mainLabels[outcome], () => this.mainAction(outcome), {
      width: 340,
      height: 74,
      fontSize: 25,
      variant: 'primary',
    });
    popIn(mainBtn, 0.9);

    const homeBtn = makeButton(this, GAME_WIDTH / 2, 726, '🏠 الرئيسية', () => go(this, 'Menu'), {
      width: 340,
      height: 62,
      fontSize: 25,
      variant: 'glass',
    });
    popIn(homeBtn, 1.0);
  }

  private computeOutcome(): Outcome {
    if (this.mode === 'match') return this.goldenWin || this.goals > this.oppGoals ? 'matchWin' : 'matchClose';
    if (this.mode === 'freekick') return 'freekick';
    if (this.mode === 'daily') return this.goals >= 4 ? 'dailyWin' : 'dailyClose';
    if (this.mode === 'duel') return 'duel';
    const passed = this.goals >= PASS_GOALS;
    if (!passed) return 'retry';
    return this.stage >= STAGES.length - 1 ? 'championship' : 'advance';
  }

  private duelTitle(): string {
    const { p1Name, p2Name, p1Goals, p2Goals } = this.duel;
    if (p1Goals === p2Goals) return '🤝 تعادل الأبطال!';
    return `🎉 فاز ${p1Goals > p2Goals ? p1Name : p2Name}!`;
  }

  private badgeText(): string {
    if (this.mode === 'match') {
      return `⚔️ أنت ${arabicNum(this.goals)} - ${arabicNum(this.oppGoals)} فريق الحارس${this.goldenWin ? ' • ⚡ ذهبية!' : ''}`;
    }
    if (this.mode === 'duel') {
      return `🤝 ${this.duel.p1Name} ${arabicNum(this.duel.p1Goals)} - ${arabicNum(this.duel.p2Goals)} ${this.duel.p2Name}`;
    }
    if (this.mode === 'freekick') return '🌀 حائط يقفز وقوس ذكي — تحدي الكبار!';
    if (this.mode === 'daily') return `🎯 تحدي اليوم ضد ${DIFFICULTIES.medium.keeperName}`;
    return `${STAGES[this.stage].icon} ${STAGES[this.stage].label} — 🧤 ${DIFFICULTIES[STAGES[this.stage].difficulty].keeperName}`;
  }

  private stageNote(outcome: Outcome, dailyBonus: boolean): string {
    const nextKeeper = STAGES[this.stage + 1] ? DIFFICULTIES[STAGES[this.stage + 1].difficulty].keeperName : '';
    const notes: Record<Outcome, string> = {
      championship: 'أنت بطل كل الأدوار! 🏆',
      advance: `القادم: ${nextKeeper} 🧤\nمستعد يا بطل؟`,
      retry: `سجّل ${arabicNum(PASS_GOALS)} أهداف لتجتاز الدور\nأنت قادر يا نجم! 🌟`,
      matchWin: 'فريقك يحتفل بك يا بطل! 🎉',
      matchClose: 'اقتربت من الفوز يا بطل\nجرّب مرة ثانية! 🌟',
      freekick: 'القوس سلاحك — كل فاولة أجمل من التي قبلها 🌀',
      dailyWin: dailyBonus ? '🎁 +٥ نجوم مكافأة التحدي!\nعُد غدًا لتحدٍّ جديد' : 'أنجزته اليوم من قبل — بطل مثابر! 🌟',
      dailyClose: 'تحتاج ٤ أهداف — قريبة جدًا\nعُد وجرّب ثانية! 💪',
      duel: this.duel.p1Goals === this.duel.p2Goals ? 'مباراة ممتعة — كلاكما نجم! ⭐' : 'صافحا بعضكما — هكذا يفعل الأبطال 🤝',
    };
    return notes[outcome];
  }

  private mainAction(outcome: Outcome): void {
    switch (outcome) {
      case 'championship':
        this.registry.set('tournamentStage', 0);
        go(this, 'Tournament', { stage: 0 });
        break;
      case 'advance':
        go(this, 'Tournament', { stage: this.stage + 1 });
        break;
      case 'retry':
        go(this, 'Game', { stage: this.stage });
        break;
      case 'matchWin':
      case 'matchClose':
        go(this, 'Game', { mode: 'match' });
        break;
      case 'freekick':
        go(this, 'Game', { mode: 'freekick' });
        break;
      case 'dailyWin':
        go(this, 'Tournament');
        break;
      case 'dailyClose':
        go(this, 'Game', { mode: 'daily' });
        break;
      case 'duel':
        go(this, 'Game', { mode: 'duel' });
        break;
    }
  }
}
