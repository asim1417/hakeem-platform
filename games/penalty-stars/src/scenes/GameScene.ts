// GameScene — الملعب، الكرة، الحارس، السحب للتسديد، العداد والنجوم

import Phaser from 'phaser';
import { gsap } from 'gsap';
import {
  arabicNum,
  rtl,
  BALL_START,
  COLORS,
  DIFFICULTIES,
  DifficultyKey,
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
  GOAL,
  PHRASES,
  SHOT,
  SHOTS_PER_ROUND,
  STAGES,
} from '../config/gameConfig';
import { getPlayer, PlayerDef } from '../data/players';
import { audio } from '../utils/audio';
import { bouncePhrase, confetti, playerCelebration, starBurst } from '../utils/animations';
import { progress } from '../utils/progress';
import { coachPhrases } from '../data/phrases';
import { makeButton } from '../utils/ui';
import { announcer } from '../utils/announcer';

type ShotState = 'aiming' | 'shooting' | 'resolved';

const GOAL_TOP = GOAL.lineY - GOAL.height; // العارضة
const KEEPER_Y = GOAL.lineY - 42;
const KEEPER_RANGE = GOAL.width / 2 - 40; // مدى حركة الحارس

export class GameScene extends Phaser.Scene {
  private training = false;
  private stage?: number; // رقم المرحلة في رحلة المراحل — undefined في التدريب
  private player!: PlayerDef;
  private ball!: Phaser.Physics.Arcade.Image;
  private keeper!: Phaser.GameObjects.Image;
  private keeperTween?: Phaser.Tweens.Tween;
  private state: ShotState = 'aiming';
  private shotIndex = 0;
  private goals = 0;
  private dragStart: Phaser.Math.Vector2 | null = null;
  private aimArrow!: Phaser.GameObjects.Graphics;
  private shooter!: Phaser.GameObjects.Image;
  private shotText!: Phaser.GameObjects.Text;
  private starIcons: Phaser.GameObjects.Image[] = [];
  private phraseText!: Phaser.GameObjects.Text;
  private resolveTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Game');
  }

  init(data: { training?: boolean; stage?: number }): void {
    this.training = Boolean(data.training);
    this.stage = data.stage;
    this.state = 'aiming';
    this.shotIndex = 0;
    this.goals = 0;
    this.dragStart = null;
    this.starIcons = [];
  }

  create(): void {
    this.player = getPlayer(this.registry.get('playerId') as string);
    this.drawField();
    this.drawGoal();
    this.createKeeper();
    this.createBall();
    this.createHud();
    this.setupInput();
    audio.play('whistle');
    this.coachTip();
  }

  // ── الرسم ──

  private drawField(): void {
    // خلفية الملعب شبه الواقعية المختارة — مع طبقة تعتيم خفيفة لوضوح النصوص
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.1);
    } else {
      // fallback مرسوم إذا غابت الصور
      this.add.rectangle(GAME_WIDTH / 2, 60, GAME_WIDTH, 120, COLORS.sky);
      this.add.rectangle(GAME_WIDTH / 2, (GAME_HEIGHT + 120) / 2, GAME_WIDTH, GAME_HEIGHT - 120, COLORS.grass);
      for (let i = 0; i < 6; i++) {
        this.add.rectangle(GAME_WIDTH / 2, 180 + i * 110, GAME_WIDTH, 55, COLORS.grassDark, 0.45);
      }
    }
    // منطقة الجزاء
    const g = this.add.graphics();
    g.lineStyle(4, COLORS.white, 0.8);
    g.strokeRect(GAME_WIDTH / 2 - 210, GOAL.lineY - 6, 420, 330);
    // نقطة الجزاء
    g.fillStyle(COLORS.white, 0.9).fillCircle(BALL_START.x, BALL_START.y, 6);
  }

  private drawGoal(): void {
    const g = this.add.graphics();
    const left = GOAL.centerX - GOAL.width / 2;
    const right = GOAL.centerX + GOAL.width / 2;
    // الشبكة
    g.lineStyle(1.5, COLORS.net, 0.7);
    for (let x = left; x <= right; x += 22) g.lineBetween(x, GOAL_TOP, x, GOAL.lineY);
    for (let y = GOAL_TOP; y <= GOAL.lineY; y += 20) g.lineBetween(left, y, right, y);
    // القائمان والعارضة
    g.fillStyle(COLORS.white);
    g.fillRect(left - GOAL.postWidth, GOAL_TOP - GOAL.postWidth, GOAL.postWidth, GOAL.height + GOAL.postWidth);
    g.fillRect(right, GOAL_TOP - GOAL.postWidth, GOAL.postWidth, GOAL.height + GOAL.postWidth);
    g.fillRect(left - GOAL.postWidth, GOAL_TOP - GOAL.postWidth, GOAL.width + GOAL.postWidth * 2, GOAL.postWidth);
  }

  private createKeeper(): void {
    this.keeper = this.add.image(GOAL.centerX, KEEPER_Y, 'keeper').setDepth(5);
    // اسم الحارس المرح فوق المرمى
    this.add
      .text(GOAL.centerX, GOAL_TOP + 26, rtl(`🧤 ${this.difficulty().keeperName}`), {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.startKeeperIdle();
  }

  // تأرجح الحارس يمينًا ويسارًا قبل التسديدة
  private startKeeperIdle(): void {
    const diff = this.difficulty();
    this.keeperTween?.remove();
    this.keeper.setAngle(0);
    this.keeperTween = this.tweens.add({
      targets: this.keeper,
      x: { from: GOAL.centerX - KEEPER_RANGE * 0.55, to: GOAL.centerX + KEEPER_RANGE * 0.55 },
      duration: diff.keeperIdleSpeed * 1000,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  private createBall(): void {
    // كرة اللاعب المختارة من الخزنة — 'ball' المرسومة احتياطًا
    const ballKey = this.textures.exists(progress.selectedBall()) ? progress.selectedBall() : 'ball';
    this.ball = this.physics.add.image(BALL_START.x, BALL_START.y, ballKey).setDepth(6);
    this.ball.setCircle(this.ball.width / 2);
    this.ball.setDisplaySize(44, 44);
    // اللاعب المسدد بجانب الكرة
    this.shooter = this.add.image(BALL_START.x + 85, BALL_START.y + 20, `avatar-${this.player.id}`).setDepth(6).setDisplaySize(105, 105);
    this.tweens.add({ targets: this.shooter, y: this.shooter.y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.aimArrow = this.add.graphics().setDepth(7);
  }

  private createHud(): void {
    // عداد التسديدات أو شارة التدريب
    this.shotText = this.add
      .text(16, 14, '', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 5,
      })
      .setDepth(20);
    this.updateShotText();

    // نجوم الأهداف (في اللعب فقط)
    if (!this.training) {
      for (let i = 0; i < SHOTS_PER_ROUND; i++) {
        const icon = this.add
          .image(GAME_WIDTH / 2 - 80 + i * 40, 100, 'star')
          .setScale(0.55)
          .setAlpha(0.28)
          .setDepth(20);
        this.starIcons.push(icon);
      }
    }

    // عبارة تشجيعية وسط الشاشة
    this.phraseText = this.add
      .text(GAME_WIDTH / 2, 420, '', {
        fontFamily: FONT,
        fontSize: '34px',
        color: '#ffd93d',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 8,
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);

    // إرشاد اللعب
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, rtl('✋ اسحب من الكرة نحو المرمى ثم أفلت'), {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: hint, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });

    // زر الرجوع للرئيسية
    makeButton(this, GAME_WIDTH - 50, 44, '🏠', () => this.scene.start('Menu'), {
      width: 64,
      height: 64,
      fontSize: 28,
      color: COLORS.orange,
    }).setDepth(20);

    // زر كتم الصوت
    const muteBtn = makeButton(this, GAME_WIDTH - 122, 44, audio.isMuted() ? '🔇' : '🔊', () => {
      const muted = audio.toggleMute();
      (muteBtn.getAt(2) as Phaser.GameObjects.Text).setText(muted ? '🔇' : '🔊');
    }, { width: 64, height: 64, fontSize: 26, color: 0x27893f });
    muteBtn.setDepth(20);
  }

  private updateShotText(): void {
    const stageTag = this.stage !== undefined ? `${STAGES[this.stage].icon} ${STAGES[this.stage].label}\n` : '';
    this.shotText.setText(
      this.training
        ? rtl('🏋️ تدريب حر')
        : rtl(`${stageTag}التسديدة ${arabicNum(Math.min(this.shotIndex + 1, SHOTS_PER_ROUND))} من ${arabicNum(SHOTS_PER_ROUND)}`),
    );
  }

  // ── الإدخال: السحب للتسديد ──

  private setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state !== 'aiming') return;
      // يبدأ السحب قرب الكرة (منطقة واسعة لأصابع الأطفال)
      if (Phaser.Math.Distance.Between(p.x, p.y, this.ball.x, this.ball.y) < 150) {
        this.dragStart = new Phaser.Math.Vector2(p.x, p.y);
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || this.state !== 'aiming') return;
      this.drawAimArrow(p);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || this.state !== 'aiming') return;
      const drag = new Phaser.Math.Vector2(p.x - this.dragStart.x, p.y - this.dragStart.y);
      this.aimArrow.clear();
      const start = this.dragStart;
      this.dragStart = null;
      // سحب قصير جدًا أو ليس نحو الأعلى → تجاهل
      if (drag.length() < SHOT.minDrag || drag.y > -10) return;
      this.shoot(drag);
      void start;
    });
  }

  // سهم التصويب — لونه يتغير مع القوة
  private drawAimArrow(p: Phaser.Input.Pointer): void {
    if (!this.dragStart) return;
    const dir = new Phaser.Math.Vector2(p.x - this.dragStart.x, p.y - this.dragStart.y);
    this.aimArrow.clear();
    if (dir.length() < SHOT.minDrag || dir.y > -10) return;
    const powerRatio = Phaser.Math.Clamp((dir.length() * SHOT.dragToPower) / SHOT.maxPower, 0, 1);
    const color = powerRatio < 0.5 ? COLORS.yellow : powerRatio < 0.8 ? COLORS.orange : 0xff5d5d;
    const end = new Phaser.Math.Vector2(this.ball.x, this.ball.y).add(dir.clone().setLength(60 + powerRatio * 130));
    this.aimArrow.lineStyle(8, color, 0.9);
    this.aimArrow.lineBetween(this.ball.x, this.ball.y, end.x, end.y);
    // رأس السهم
    const angle = dir.angle();
    this.aimArrow.fillStyle(color, 0.95);
    this.aimArrow.fillTriangle(
      end.x + Math.cos(angle) * 20,
      end.y + Math.sin(angle) * 20,
      end.x + Math.cos(angle + 2.5) * 14,
      end.y + Math.sin(angle + 2.5) * 14,
      end.x + Math.cos(angle - 2.5) * 14,
      end.y + Math.sin(angle - 2.5) * 14,
    );
  }

  // ── التسديد ──

  private shoot(drag: Phaser.Math.Vector2): void {
    this.state = 'shooting';
    audio.play('kick');
    announcer.onShot(this, this.player);

    // القوة: طول السحب × معامل + تعزيز حسب قوة اللاعب
    const powerBoost = 1 + (this.player.power - 7) * 0.03;
    const power = Phaser.Math.Clamp(drag.length() * SHOT.dragToPower * powerBoost, SHOT.minPower, SHOT.maxPower);

    // الدقة: انحراف عشوائي أقل كلما زادت دقة اللاعب
    const noiseDeg = (10 - this.player.accuracy) * 0.8;
    const angle = drag.angle() + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-noiseDeg, noiseDeg));

    this.ball.setVelocity(Math.cos(angle) * power, Math.sin(angle) * power);
    // تصغير الكرة قليلًا لإيحاء العمق
    this.tweens.add({ targets: this.ball, displayWidth: 28, displayHeight: 28, duration: 600 });

    this.keeperDive(angle, power);

    // مهلة أمان: لو لم تُحسم التسديدة خلال ٣ ثوانٍ
    this.resolveTimer = this.time.delayedCall(3000, () => this.resolve('miss'));
  }

  // الحارس يختار جهة: تخمين صحيح باحتمال محدود حتى يشعر الطفل بالإنجاز
  private keeperDive(shotAngle: number, power: number): void {
    const diff = this.difficulty();
    this.keeperTween?.remove();

    // النقطة المتوقعة لوصول الكرة عند خط المرمى
    const vy = Math.sin(shotAngle) * power;
    const vx = Math.cos(shotAngle) * power;
    const t = Math.abs((this.ball.y - KEEPER_Y) / vy);
    const predictedX = Phaser.Math.Clamp(this.ball.x + vx * t, GOAL.centerX - KEEPER_RANGE, GOAL.centerX + KEEPER_RANGE);

    let targetX: number;
    if (Math.random() < diff.guessChance) {
      // تخمين صحيح مع خطأ بسيط
      targetX = predictedX + Phaser.Math.FloatBetween(-25, 25);
    } else {
      // يرتمي للجهة الأخرى أو مكان عشوائي
      const wrongSide = predictedX < GOAL.centerX ? 1 : -1;
      targetX = GOAL.centerX + wrongSide * Phaser.Math.FloatBetween(KEEPER_RANGE * 0.3, KEEPER_RANGE);
    }

    gsap.to(this.keeper, { x: targetX, duration: diff.diveDuration, ease: 'power2.out' });
    gsap.to(this.keeper, { angle: targetX > this.keeper.x ? 22 : -22, duration: diff.diveDuration });
  }

  // ── الحسم في كل إطار ──

  update(): void {
    if (this.state !== 'shooting') return;
    const diff = this.difficulty();

    // تصدي: الكرة لمست الحارس
    if (
      Math.abs(this.ball.x - this.keeper.x) < diff.reach &&
      Math.abs(this.ball.y - this.keeper.y) < 58
    ) {
      this.resolve('save');
      return;
    }

    // الكرة وصلت خط المرمى
    if (this.ball.y <= GOAL.lineY - 20) {
      const halfW = GOAL.width / 2 - 14;
      const inGoal = Math.abs(this.ball.x - GOAL.centerX) < halfW && this.ball.y > GOAL_TOP - 10;
      this.resolve(inGoal ? 'goal' : 'miss');
      return;
    }

    // خرجت من الشاشة جانبيًا
    if (this.ball.x < -40 || this.ball.x > GAME_WIDTH + 40 || this.ball.y < -40) {
      this.resolve('miss');
    }
  }

  // ── النتيجة ──

  private resolve(result: 'goal' | 'save' | 'miss'): void {
    if (this.state !== 'shooting') return;
    this.state = 'resolved';
    this.resolveTimer?.remove();

    if (result === 'goal') {
      audio.play('goal');
      audio.play('crowd');
      this.goals++;
      this.cameras.main.shake(220, 0.008); // اهتزاز بسيط
      starBurst(this, this.ball.x, this.ball.y, 12);
      confetti(this, 36);
      playerCelebration(this, this.player.celebrationType, this.shooter, this.ball.x, this.ball.y);
      // إضاءة نجمة في العداد
      if (!this.training && this.starIcons[this.shotIndex]) {
        const icon = this.starIcons[this.shotIndex];
        icon.setAlpha(1);
        gsap.fromTo(icon, { scale: 1.4 }, { scale: 0.55, duration: 0.5, ease: 'bounce.out' });
      }
      // عبارة الاحتفال — أحيانًا عبارة اللاعب الخاصة
      const phrase = Math.random() < 0.3 ? this.player.celebration : Phaser.Utils.Array.GetRandom(PHRASES.goal);
      this.showPhrase(phrase);
      announcer.onOutcome('goal', phrase);
      this.ball.setVelocity(0, 0);
      this.ball.setPosition(this.ball.x, GOAL.lineY - 50);
    } else if (result === 'save') {
      audio.play('save');
      // الكرة ترتد من الحارس
      this.ball.setVelocity(Phaser.Math.FloatBetween(-160, 160), Phaser.Math.FloatBetween(220, 320));
      gsap.to(this.keeper, { scale: 1.12, duration: 0.12, yoyo: true, repeat: 1 });
      const savePhrase = Phaser.Utils.Array.GetRandom(PHRASES.save);
      this.showPhrase(savePhrase);
      announcer.onOutcome('save', savePhrase);
    } else {
      const missPhrase = Phaser.Utils.Array.GetRandom(PHRASES.miss);
      this.showPhrase(missPhrase);
      announcer.onOutcome('miss', missPhrase);
    }

    this.time.delayedCall(1700, () => this.nextShot(result === 'goal' && !this.training));
  }

  private showPhrase(phrase: string): void {
    this.phraseText.setText(rtl(phrase));
    this.phraseText.y = 420;
    bouncePhrase(this.phraseText);
  }

  private nextShot(_wasGoal: boolean): void {
    this.shotIndex++;
    // انتهت الجولة (٥ تسديدات) — التدريب لا ينتهي
    if (!this.training && this.shotIndex >= SHOTS_PER_ROUND) {
      this.scene.start('Result', { goals: this.goals, stage: this.stage });
      return;
    }
    // إعادة التجهيز
    this.ball.setVelocity(0, 0);
    this.ball.setPosition(BALL_START.x, BALL_START.y);
    this.ball.setDisplaySize(44, 44);
    this.keeper.setPosition(GOAL.centerX, KEEPER_Y);
    this.startKeeperIdle();
    this.updateShotText();
    this.state = 'aiming';
    if (Math.random() < 0.35) this.coachTip();
  }

  // نصيحة مدرب لطيفة أسفل الشاشة
  private coachTip(): void {
    const tip = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 84, rtl(`🧑‍🏫 ${Phaser.Utils.Array.GetRandom(coachPhrases)}`), {
        fontFamily: FONT,
        fontSize: '19px',
        color: '#1a5c2e',
        fontStyle: 'bold',
        backgroundColor: '#ffffffee',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setAlpha(0);
    gsap
      .timeline()
      .to(tip, { alpha: 1, duration: 0.3 })
      .to(tip, { alpha: 0, duration: 0.4, delay: 2.2, onComplete: () => tip.destroy() });
  }

  private difficulty() {
    const key: DifficultyKey = this.stage !== undefined ? STAGES[this.stage].difficulty : 'easy';
    return DIFFICULTIES[key];
  }
}
