// GameScene — الملعب، الكرة، الحارس، السحب للتسديد، العداد والنجوم
// الأوضاع: بطولة (stage) / مباراة بلنتيات (match) / تدريب حر (training)

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
type GameMode = 'tournament' | 'match' | 'training';

const GOAL_TOP = GOAL.lineY - GOAL.height; // العارضة
const KEEPER_Y = GOAL.lineY - 42;
const KEEPER_RANGE = GOAL.width / 2 - 40; // مدى حركة الحارس

export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'tournament';
  private stadiumKey = 'stadium-real';
  private stage = 0; // دور البطولة الحالي
  private golden = false; // الضربة الذهبية في المباراة
  private player!: PlayerDef;
  private ball!: Phaser.Physics.Arcade.Image;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private keeper!: Phaser.GameObjects.Image;
  private keeperShadow!: Phaser.GameObjects.Ellipse;
  private keeperTween?: Phaser.Tweens.Tween;
  private state: ShotState = 'aiming';
  private shotIndex = 0;
  private goals = 0;
  private oppGoals = 0; // أهداف فريق الحارس في المباراة
  private dragStart: Phaser.Math.Vector2 | null = null;
  private aimArrow!: Phaser.GameObjects.Graphics;
  private shooter!: Phaser.GameObjects.Image;
  private shotText!: Phaser.GameObjects.Text;
  private starIcons: Phaser.GameObjects.Image[] = [];
  private phraseText!: Phaser.GameObjects.Text;
  private resolveTimer?: Phaser.Time.TimerEvent;
  private trajectory: { x: number; y: number }[] = []; // مسار الكرة لإعادة الهدف

  constructor() {
    super('Game');
  }

  init(data: { training?: boolean; stage?: number; mode?: string }): void {
    this.mode = data.training ? 'training' : data.mode === 'match' ? 'match' : 'tournament';
    this.stage = data.stage ?? 0;
    this.golden = false;
    this.state = 'aiming';
    this.shotIndex = 0;
    this.goals = 0;
    this.oppGoals = 0;
    this.dragStart = null;
    this.starIcons = [];
    this.trajectory = [];
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
    // في البطولة لكل دور ملعبه؛ وإلا ملعب الخزنة المختار — مع تعتيم خفيف لوضوح النصوص
    const stadiumKey = this.mode === 'tournament' ? STAGES[this.stage].stadium : progress.selectedStadium();
    this.stadiumKey = stadiumKey;
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
    // طبقة إضاءة خفيفة أعلى الملعب
    this.add.rectangle(GAME_WIDTH / 2, 90, GAME_WIDTH, 180, 0xffffff, 0.06);
    // منطقة الجزاء — الملعب الحقيقي يحمل خطوطه الفوتوغرافية
    const g = this.add.graphics();
    if (this.stadiumKey !== 'stadium-real') {
      g.lineStyle(4, COLORS.white, 0.8);
      g.strokeRect(GAME_WIDTH / 2 - 210, GOAL.lineY - 6, 420, 330);
    }
    // نقطة الجزاء
    g.fillStyle(COLORS.white, 0.9).fillCircle(BALL_START.x, BALL_START.y, 6);
  }

  private drawGoal(): void {
    // مرمى الصورة الحقيقية منطبق على هندسة اللعبة — لا حاجة لرسم فوقه
    if (this.stadiumKey === 'stadium-real') return;
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

  // مفتاح صورة الحارس حسب الصعوبة (الحديدي في نهائي البطولة)
  private keeperTexture(dive = false): string {
    const base = this.difficulty().key === 'iron' ? 'keeper-iron' : 'keeper';
    return dive ? `${base}-dive` : base;
  }

  private createKeeper(): void {
    // ظل الحارس
    this.keeperShadow = this.add.ellipse(GOAL.centerX, KEEPER_Y + 54, 72, 14, 0x000000, 0.28).setDepth(4);
    this.keeper = this.add.image(GOAL.centerX, KEEPER_Y, this.keeperTexture()).setDepth(5);
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
    this.keeper.setTexture(this.keeperTexture());
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
    // ظل الكرة
    this.ballShadow = this.add.ellipse(BALL_START.x, BALL_START.y + 20, 36, 11, 0x000000, 0.3).setDepth(4);
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
    // عداد التسديدات / نتيجة المباراة / شارة التدريب
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

    // نجوم الأهداف (في البطولة والمباراة)
    if (this.mode !== 'training') {
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
    if (this.mode === 'training') {
      this.shotText.setText(rtl('🏋️ تدريب حر'));
      return;
    }
    const shotLine = this.golden
      ? '⚡ الضربة الذهبية!'
      : `التسديدة ${arabicNum(Math.min(this.shotIndex + 1, SHOTS_PER_ROUND))} من ${arabicNum(SHOTS_PER_ROUND)}`;
    if (this.mode === 'match') {
      this.shotText.setText(rtl(`⚔️ أنت ${arabicNum(this.goals)} - ${arabicNum(this.oppGoals)} فريق الحارس\n${shotLine}`));
    } else {
      const st = STAGES[this.stage];
      this.shotText.setText(rtl(`${st.icon} ${st.label}\n${shotLine}`));
    }
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
      this.dragStart = null;
      // سحب قصير جدًا أو ليس نحو الأعلى → تجاهل
      if (drag.length() < SHOT.minDrag || drag.y > -10) return;
      this.shoot(drag);
    });
  }

  // سهم التصويب — لونه يتغير مع القوة
  private drawAimArrow(p: Phaser.Input.Pointer): void {
    if (!this.dragStart) return;
    const dir = new Phaser.Math.Vector2(p.x - this.dragStart.x, p.y - this.dragStart.y);
    this.aimArrow.clear();
    if (dir.length() < SHOT.minDrag || dir.y > -10) return;
    const powerRatio = Phaser.Math.Clamp((dir.length() * SHOT.dragToPower) / SHOT.maxPower, 0, 1);
    const color = powerRatio < 0.5 ? COLORS.lime : powerRatio < 0.8 ? COLORS.gold : 0xff3e3e;
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
    this.trajectory = [];
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
    this.keeper.setTexture(this.keeperTexture(true)); // وضعية الارتماء

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

  // ── كل إطار: الظلال + حسم التسديدة ──

  update(): void {
    // الظلال تتبع الكرة والحارس دائمًا
    this.ballShadow.setPosition(this.ball.x, this.ball.y + 20);
    this.ballShadow.setDisplaySize(Math.max(20, this.ball.displayWidth * 0.8), 10);
    this.keeperShadow.setPosition(this.keeper.x, KEEPER_Y + 54);

    if (this.state !== 'shooting') return;
    const diff = this.difficulty();

    // تسجيل مسار الكرة لإعادة الهدف
    if (this.trajectory.length < 240) this.trajectory.push({ x: this.ball.x, y: this.ball.y });

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
      if (this.mode !== 'training' && !this.golden && this.starIcons[this.shotIndex]) {
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
      this.updateShotText();
      // إعادة الهدف القصيرة (خارج التدريب) ثم المتابعة
      if (this.mode !== 'training') {
        this.time.delayedCall(1400, () => this.showReplay());
        this.time.delayedCall(3100, () => this.afterShot(result));
        return;
      }
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

    this.time.delayedCall(1700, () => this.afterShot(result));
  }

  // 🎬 إعادة قصيرة وبطيئة لمسار الكرة
  private showReplay(): void {
    if (this.trajectory.length < 8) return;
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.35).setDepth(38);
    const label = this.add
      .text(GAME_WIDTH / 2, 320, rtl('🎬 إعادة الهدف'), {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(41);
    const ghost = this.add.image(this.trajectory[0].x, this.trajectory[0].y, this.ball.texture.key).setDisplaySize(40, 40).setDepth(40);

    // عينات من المسار بسرعة نصفية
    const pts = this.trajectory.filter((_, i) => i % 3 === 0);
    const tl = gsap.timeline({
      onComplete: () => {
        overlay.destroy();
        label.destroy();
        ghost.destroy();
      },
    });
    const per = 1.15 / pts.length;
    for (const pt of pts) tl.to(ghost, { x: pt.x, y: pt.y, duration: per, ease: 'none' });
    tl.to(ghost, { alpha: 0, duration: 0.2 });
  }

  // بعد حسم تسديدة اللاعب: دور فريق الحارس في المباراة، أو التسديدة التالية
  private afterShot(result: 'goal' | 'save' | 'miss'): void {
    if (this.mode === 'match' && !this.golden) {
      this.opponentTurn();
      return;
    }
    if (this.golden) {
      // الضربة الذهبية: هدف اللاعب يحسم فورًا، وإلا يسدد الخصم
      if (result === 'goal') {
        this.scene.start('Result', { mode: 'match', goals: this.goals, oppGoals: this.oppGoals, goldenWin: true });
      } else {
        this.opponentTurn();
      }
      return;
    }
    this.nextShot();
  }

  // 🤖 تسديدة فريق الحارس (آلية وسريعة) في وضع المباراة
  private opponentTurn(): void {
    const banner = this.add
      .text(GAME_WIDTH / 2, 500, rtl('🤖 فريق الحارس يسدد...'), {
        fontFamily: FONT,
        fontSize: '25px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#1a5c2ecc',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(35)
      .setAlpha(0);
    gsap.to(banner, { alpha: 1, duration: 0.3 });

    this.time.delayedCall(1200, () => {
      const scored = Math.random() < 0.5; // فرصة عادلة وممتعة
      if (scored) {
        this.oppGoals++;
        audio.play('goal');
        banner.setText(rtl('🥅 سجّل فريق الحارس!'));
      } else {
        audio.play('save');
        banner.setText(rtl('🧤 تصديت لكرة فريق الحارس!'));
        starBurst(this, GOAL.centerX, GOAL.lineY - 40, 6);
      }
      this.updateShotText();
      this.time.delayedCall(1100, () => {
        banner.destroy();
        if (this.golden) {
          // خصم سجل في الذهبية → انتهت؛ لم يسجل → جولة ذهبية جديدة
          if (this.oppGoals > this.goals) {
            this.scene.start('Result', { mode: 'match', goals: this.goals, oppGoals: this.oppGoals });
          } else {
            this.showPhrase('جولة ذهبية جديدة! ⚡');
            this.nextShot(true);
          }
          return;
        }
        this.nextShot();
      });
    });
  }

  private nextShot(stayGolden = false): void {
    if (!stayGolden) this.shotIndex++;
    // نهاية الجولة
    if (this.mode !== 'training' && !this.golden && this.shotIndex >= SHOTS_PER_ROUND) {
      if (this.mode === 'match') {
        if (this.goals === this.oppGoals) {
          // تعادل → الضربة الذهبية
          this.golden = true;
          audio.play('whistle');
          this.showPhrase('⚡ تعادل! الضربة الذهبية تحسم');
        } else {
          this.scene.start('Result', { mode: 'match', goals: this.goals, oppGoals: this.oppGoals });
          return;
        }
      } else {
        this.scene.start('Result', { goals: this.goals, stage: this.stage });
        return;
      }
    }
    // إعادة التجهيز
    this.ball.setVelocity(0, 0);
    this.ball.setPosition(BALL_START.x, BALL_START.y);
    this.ball.setDisplaySize(44, 44);
    this.keeper.setPosition(GOAL.centerX, KEEPER_Y);
    this.keeper.setScale(1);
    this.startKeeperIdle();
    this.updateShotText();
    this.state = 'aiming';
    if (Math.random() < 0.35) this.coachTip();
  }

  // 🧑‍🏫 المدرب الصغير: شخصية في الزاوية بفقاعة نصيحة
  private coachTip(): void {
    const tip = Phaser.Utils.Array.GetRandom(coachPhrases);
    const face = this.add.circle(0, 0, 26, 0xffffff).setStrokeStyle(4, COLORS.blue);
    const emoji = this.add.text(0, 0, '🧑‍🏫', { fontSize: '30px' }).setOrigin(0.5);
    const bubble = this.add
      .text(38, 0, rtl(tip), {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#1a5c2e',
        fontStyle: 'bold',
        backgroundColor: '#ffffffee',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0, 0.5);
    const coach = this.add.container(-60, GAME_HEIGHT - 92, [face, emoji, bubble]).setDepth(25);
    gsap
      .timeline()
      .to(coach, { x: 34, duration: 0.45, ease: 'back.out(1.6)' })
      .to(coach, { x: -320, duration: 0.4, delay: 2.4, ease: 'power2.in', onComplete: () => coach.destroy() });
  }

  private showPhrase(phrase: string): void {
    this.phraseText.setText(rtl(phrase));
    this.phraseText.y = 420;
    bouncePhrase(this.phraseText);
  }

  private difficulty() {
    const key: DifficultyKey = this.mode === 'tournament' ? STAGES[this.stage].difficulty : this.mode === 'match' ? 'medium' : 'easy';
    return DIFFICULTIES[key];
  }
}
