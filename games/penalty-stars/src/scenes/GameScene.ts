// GameScene — الملعب، الكرة، الحارس، السحب للتسديد، العداد والنجوم
// الأوضاع: بطولة (stage) / مباراة بلنتيات (match مع دفاع بالإصبع) / تدريب حر (training)
//          / تحدي الفاولات (freekick مع حائط وقوس) / تحدي اليوم (daily) / تحدي صديق (duel)

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
import { allPlayers, getPlayer, PlayerDef } from '../data/players';
import { audio } from '../utils/audio';
import { bouncePhrase, confetti, playerCelebration, starBurst } from '../utils/animations';
import { progress } from '../utils/progress';
import { coachPhrases } from '../data/phrases';
import { glassBehind, makeButton, makeChip, makeMuteChip } from '../utils/ui';
import { announcer } from '../utils/announcer';
import { fadeIn, go, goalZoom, kickPunch, slowMo } from '../utils/camera';

type ShotState = 'aiming' | 'shooting' | 'resolved' | 'defending' | 'paused';
type GameMode = 'tournament' | 'match' | 'training' | 'freekick' | 'daily' | 'duel';

interface GameInitData {
  training?: boolean;
  stage?: number;
  mode?: string;
}

const GOAL_TOP = GOAL.lineY - GOAL.height; // العارضة
const KEEPER_Y = GOAL.lineY - 42;
const KEEPER_RANGE = GOAL.width / 2 - 40; // مدى حركة الحارس
const WALL_Y = 430; // صف الحائط في تحدي الفاولات
const DEFENSE_REACH = 62; // مدى التصدي عندما يحرس الطفل بإصبعه (سخي)

export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'tournament';
  private initData: GameInitData = {};
  private stadiumKey = 'stadium-real';
  private stage = 0; // دور البطولة الحالي
  private golden = false; // الضربة الذهبية في المباراة
  private player!: PlayerDef; // المسدد الحالي
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
  private dragPath: { x: number; y: number }[] = []; // مسار الإصبع — لحساب القوس
  private aimArrow!: Phaser.GameObjects.Graphics;
  private shooter!: Phaser.GameObjects.Image;
  private shotText!: Phaser.GameObjects.Text;
  private starIcons: Phaser.GameObjects.Image[] = [];
  private phraseText!: Phaser.GameObjects.Text;
  private resolveTimer?: Phaser.Time.TimerEvent;
  private hudPanel!: Phaser.GameObjects.Image & { sync: () => void };
  private trajectory: { x: number; y: number }[] = []; // مسار الكرة لإعادة الهدف
  // فيزياء إضافية
  private curve = 0; // تسارع جانبي من قوس السحبة (تسديدة موز 🍌)
  private powerRatio = 0;
  private bounced = false; // ارتدت من قائم/عارضة/حائط — تُحسم ضائعة
  private pendingMissPhrase: string | null = null;
  // تحدي الفاولات
  private wall: Phaser.GameObjects.Image[] = [];
  private wallX = GOAL.centerX;
  private passedWall = false;
  // دفاع الإصبع في المباراة
  private oppBall: Phaser.GameObjects.Image | null = null;
  private oppShotFlying = false;
  private oppTargetInGoal = true;
  // تحدي صديق
  private duelPlayers: [PlayerDef, PlayerDef] | null = null;
  private duelTurn: 0 | 1 = 0;
  private duelGoals: [number, number] = [0, 0];
  private duelShots: [number, number] = [0, 0];

  constructor() {
    super('Game');
  }

  init(data: GameInitData): void {
    this.initData = data;
    const m = data.mode as GameMode | undefined;
    this.mode = data.training ? 'training' : m && ['match', 'freekick', 'daily', 'duel'].includes(m) ? m : 'tournament';
    this.stage = data.stage ?? 0;
    this.golden = false;
    this.state = 'aiming';
    this.shotIndex = 0;
    this.goals = 0;
    this.oppGoals = 0;
    this.dragStart = null;
    this.dragPath = [];
    this.starIcons = [];
    this.trajectory = [];
    this.curve = 0;
    this.bounced = false;
    this.pendingMissPhrase = null;
    this.wall = [];
    this.passedWall = false;
    this.oppBall = null;
    this.oppShotFlying = false;
    this.duelPlayers = null;
    this.duelTurn = 0;
    this.duelGoals = [0, 0];
    this.duelShots = [0, 0];
  }

  create(): void {
    this.player = getPlayer(this.registry.get('playerId') as string);
    if (this.mode === 'duel') {
      // اللاعب الثاني: الشخصية التالية في القائمة (تشمل لاعبي العائلة) — صديقك على نفس الجهاز
      const list = allPlayers();
      const i = list.findIndex((p) => p.id === this.player.id);
      this.duelPlayers = [this.player, list[(i + 1) % list.length]];
    }
    this.drawField();
    this.drawGoal();
    this.createKeeper();
    this.createBall();
    if (this.mode === 'freekick') this.createWall();
    this.createHud();
    this.setupInput();
    fadeIn(this);
    audio.play('whistle');
    this.coachTip();

    // 🧹 تنظيف شامل عند مغادرة المشهد — لا مؤقتات ولا حركات معلّقة تلاحق الشاشة التالية
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup(): void {
    this.resolveTimer?.remove();
    announcer.stop();
    gsap.globalTimeline.getChildren(true, true, true).forEach((t) => t.kill());
    // بعض المدراء قد يكونون مفككين لحظة الإغلاق — إعادة الزمن بحذر
    if (this.time) this.time.timeScale = 1;
    if (this.tweens) this.tweens.timeScale = 1;
    if (this.physics && this.physics.world) this.physics.world.timeScale = 1;
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

  // مفتاح صورة الحارس حسب الصعوبة والحالة (الحديدي في نهائي البطولة)
  private keeperTexture(state: '' | '-dive' | '-save' | '-sad' | '-happy' = ''): string {
    const base = this.difficulty().key === 'iron' ? 'keeper-iron' : 'keeper';
    return `${base}${state}`;
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
    this.keeper.clearTint();
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

  // 🧱 حائط الفاولات: ثلاثة لاعبين يقفزون لحظة التسديد — التفّ حولهم بالقوس
  private createWall(): void {
    for (let i = 0; i < 3; i++) {
      this.wall.push(this.add.image(0, WALL_Y, 'wall-player').setDepth(5));
    }
    this.repositionWall();
  }

  private repositionWall(): void {
    this.wallX = GOAL.centerX + Phaser.Math.FloatBetween(-70, 70);
    this.wall.forEach((p, i) => p.setPosition(this.wallX + (i - 1) * 48, WALL_Y));
    this.passedWall = false;
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
    this.hudPanel = glassBehind(this, this.shotText) as Phaser.GameObjects.Image & { sync: () => void };
    this.hudPanel.setDepth(19);
    this.updateShotText();

    // نجوم الأهداف (٥ تسديدات لكل الأوضاع عدا التدريب الحر وتحدي الصديق)
    if (this.mode !== 'training' && this.mode !== 'duel') {
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
    const hintText = this.mode === 'freekick' ? '🌀 اسحب بقوس حول الحائط ثم أفلت' : '✋ اسحب من الكرة نحو المرمى ثم أفلت';
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, rtl(hintText), {
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

    // رقاقات النظام: رئيسية وصوت واستراحة
    makeChip(this, GAME_WIDTH - 44, 44, 'ic-home', () => go(this, 'Menu')).setDepth(20);
    makeMuteChip(this, GAME_WIDTH - 112, 44).setDepth(20);
    makeChip(this, GAME_WIDTH - 180, 44, 'ic-pause', () => this.openPause()).setDepth(20);
  }

  private updateShotText(): void {
    if (this.mode === 'training') {
      this.shotText.setText(rtl('🏋️ تدريب حر'));
      this.hudPanel.sync();
      return;
    }
    const shotLine = this.golden
      ? '⚡ الضربة الذهبية!'
      : `التسديدة ${arabicNum(Math.min(this.shotIndex + 1, SHOTS_PER_ROUND))} من ${arabicNum(SHOTS_PER_ROUND)}`;
    if (this.mode === 'match') {
      this.shotText.setText(rtl(`⚔️ أنت ${arabicNum(this.goals)} - ${arabicNum(this.oppGoals)} فريق الحارس\n${shotLine}`));
    } else if (this.mode === 'duel' && this.duelPlayers) {
      const [p1, p2] = this.duelPlayers;
      const cur = this.duelPlayers[this.duelTurn];
      const shot = `التسديدة ${arabicNum(Math.min(this.duelShots[this.duelTurn] + 1, SHOTS_PER_ROUND))} من ${arabicNum(SHOTS_PER_ROUND)}`;
      this.shotText.setText(
        rtl(`🤝 ${p1.emoji} ${arabicNum(this.duelGoals[0])} - ${arabicNum(this.duelGoals[1])} ${p2.emoji}\nدور ${cur.name} — ${shot}`),
      );
    } else if (this.mode === 'freekick') {
      this.shotText.setText(rtl(`🌀 تحدي الفاولات\n${shotLine}`));
    } else if (this.mode === 'daily') {
      this.shotText.setText(rtl(`🎯 تحدي اليوم — سجّل ٤ لتفوز\n${shotLine}`));
    } else {
      const st = STAGES[this.stage];
      this.shotText.setText(rtl(`${st.icon} ${st.label}\n${shotLine}`));
    }
    this.hudPanel.sync();
  }

  // ── الإدخال: السحب للتسديد ──

  private setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state !== 'aiming') return;
      // يبدأ السحب قرب الكرة (منطقة واسعة لأصابع الأطفال)
      if (Phaser.Math.Distance.Between(p.x, p.y, this.ball.x, this.ball.y) < 150) {
        this.dragStart = new Phaser.Math.Vector2(p.x, p.y);
        this.dragPath = [{ x: p.x, y: p.y }];
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || this.state !== 'aiming') return;
      if (this.dragPath.length < 60) this.dragPath.push({ x: p.x, y: p.y });
      this.drawAimArrow(p);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || this.state !== 'aiming') return;
      const drag = new Phaser.Math.Vector2(p.x - this.dragStart.x, p.y - this.dragStart.y);
      this.aimArrow.clear();
      const path = this.dragPath;
      this.dragStart = null;
      this.dragPath = [];
      // سحب قصير جدًا أو ليس نحو الأعلى → تجاهل
      if (drag.length() < SHOT.minDrag || drag.y > -10) return;
      this.shoot(drag, path);
    });
  }

  // سهم التصويب — لونه يتغير مع القوة، مرفوع فوق الإصبع حتى لا يحجبه
  private drawAimArrow(p: Phaser.Input.Pointer): void {
    if (!this.dragStart) return;
    const dir = new Phaser.Math.Vector2(p.x - this.dragStart.x, p.y - this.dragStart.y);
    this.aimArrow.clear();
    if (dir.length() < SHOT.minDrag || dir.y > -10) return;
    const powerRatio = Phaser.Math.Clamp((dir.length() * SHOT.dragToPower) / SHOT.maxPower, 0, 1);
    const color = powerRatio < 0.5 ? COLORS.lime : powerRatio < 0.8 ? COLORS.gold : COLORS.dangerRed;
    // إزاحة ٣٠ بكسل للأعلى: رأس السهم يظهر فوق الإصبع لا تحته
    const end = new Phaser.Math.Vector2(this.ball.x, this.ball.y - 30).add(dir.clone().setLength(60 + powerRatio * 130));
    this.aimArrow.lineStyle(8, color, 0.9);
    this.aimArrow.lineBetween(this.ball.x, this.ball.y - 30, end.x, end.y);
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

  // 🍌 قوس السحبة: انحراف منتصف المسار عن الخط المستقيم = تسديدة موز
  private computeCurve(path: { x: number; y: number }[]): number {
    if (path.length < 6) return 0;
    const a = path[0];
    const b = path[path.length - 1];
    const mid = path[Math.floor(path.length / 2)];
    const devX = mid.x - (a.x + b.x) / 2;
    // في الفاولات القوس أقوى — هو سر تخطي الحائط
    const k = this.mode === 'freekick' ? 11 : 7;
    return Phaser.Math.Clamp(devX * k, -520, 520);
  }

  private shoot(drag: Phaser.Math.Vector2, path: { x: number; y: number }[]): void {
    this.state = 'shooting';
    this.trajectory = [];
    this.bounced = false;
    this.pendingMissPhrase = null;
    this.curve = this.computeCurve(path);
    audio.play('kick');
    kickPunch(this);
    announcer.onShot(this, this.player);

    // القوة: طول السحب × معامل + تعزيز حسب قوة اللاعب
    const powerBoost = 1 + (this.player.power - 7) * 0.03;
    const power = Phaser.Math.Clamp(drag.length() * SHOT.dragToPower * powerBoost, SHOT.minPower, SHOT.maxPower);
    this.powerRatio = power / SHOT.maxPower;

    // الدقة: انحراف عشوائي أقل كلما زادت دقة اللاعب
    const noiseDeg = (10 - this.player.accuracy) * 0.8;
    const angle = drag.angle() + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-noiseDeg, noiseDeg));

    this.ball.setVelocity(Math.cos(angle) * power, Math.sin(angle) * power);
    // تصغير الكرة قليلًا لإيحاء العمق
    this.tweens.add({ targets: this.ball, displayWidth: 28, displayHeight: 28, duration: 600 });

    // الحائط يقفز لحظة التسديدة
    if (this.mode === 'freekick') {
      this.wall.forEach((w, i) => {
        this.tweens.add({ targets: w, y: WALL_Y - 36, duration: 260, yoyo: true, delay: i * 30, ease: 'sine.out' });
      });
    }

    this.keeperDive(angle, power);

    // مهلة أمان: لو لم تُحسم التسديدة خلال ٣ ثوانٍ
    this.resolveTimer = this.time.delayedCall(3000, () => this.resolve('miss'));
  }

  // الحارس يختار جهة: تخمين صحيح باحتمال محدود حتى يشعر الطفل بالإنجاز
  private keeperDive(shotAngle: number, power: number): void {
    const diff = this.difficulty();
    this.keeperTween?.remove();
    this.keeper.setTexture(this.keeperTexture('-dive')); // وضعية الارتماء

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

  // ── كل إطار: الظلال + القوس + الحائط + القائم + حسم التسديدة ──

  update(_time: number, delta: number): void {
    // الظلال تتبع الكرة والحارس دائمًا
    this.ballShadow.setPosition(this.ball.x, this.ball.y + 20);
    this.ballShadow.setDisplaySize(Math.max(20, this.ball.displayWidth * 0.8), 10);
    this.keeperShadow.setPosition(this.keeper.x, KEEPER_Y + 54);

    // 🧤 دفاع الإصبع: الحارس يتبع إصبع الطفل
    if (this.state === 'defending') {
      this.updateDefense();
      return;
    }

    if (this.state !== 'shooting') return;
    const diff = this.difficulty();
    const body = this.ball.body as Phaser.Physics.Arcade.Body;

    // تسديدة الموز: تسارع جانبي من قوس السحبة
    if (this.curve !== 0 && !this.bounced) body.velocity.x += this.curve * (delta / 1000);

    // تسجيل مسار الكرة لإعادة الهدف
    if (this.trajectory.length < 240) this.trajectory.push({ x: this.ball.x, y: this.ball.y });

    // كرة مرتدة (قائم/عارضة/حائط): تسقط وتُحسم ضائعة بمؤقت — لا فحوصات أخرى
    if (this.bounced) return;

    // 🧱 حائط الفاولات يعترض ما لم تلتف الكرة حوله
    if (this.mode === 'freekick' && !this.passedWall && this.ball.y <= WALL_Y + 24) {
      if (this.ball.y >= WALL_Y - 30 && Math.abs(this.ball.x - this.wallX) < 76) {
        this.bounced = true;
        audio.play('kick');
        this.cameras.main.shake(110, 0.005);
        body.velocity.y = Math.abs(body.velocity.y) * 0.4;
        body.velocity.x *= 0.5;
        this.pendingMissPhrase = 'الحائط صدّها! وسّع القوس أكثر 🌀';
        this.time.delayedCall(750, () => this.resolve('miss'));
        return;
      }
      if (this.ball.y < WALL_Y - 30) this.passedWall = true;
    }

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
      const dxAbs = Math.abs(this.ball.x - GOAL.centerX);
      const halfW = GOAL.width / 2 - 14;

      // 🥅 القائم: الكرة على حافة العارض الجانبي → رنّة معدنية وارتداد
      if (Math.abs(dxAbs - GOAL.width / 2) < 11) {
        this.hitWoodwork('vertical', body);
        return;
      }
      // 🥅 العارضة: قوة قصوى داخل الإطار — أحيانًا تطنّ من العارضة وتعود
      if (dxAbs < halfW && this.powerRatio > 0.96 && Math.random() < 0.35) {
        this.hitWoodwork('horizontal', body);
        return;
      }

      const inGoal = dxAbs < halfW && this.ball.y > GOAL_TOP - 10;
      this.resolve(inGoal ? 'goal' : 'miss');
      return;
    }

    // خرجت من الشاشة جانبيًا
    if (this.ball.x < -40 || this.ball.x > GAME_WIDTH + 40 || this.ball.y < -40) {
      this.resolve('miss');
    }
  }

  // رنّة القائم/العارضة: صوت معدني + ارتداد درامي + عبارة مواسية
  private hitWoodwork(kind: 'vertical' | 'horizontal', body: Phaser.Physics.Arcade.Body): void {
    this.bounced = true;
    audio.play('post');
    this.cameras.main.shake(140, 0.006);
    if (kind === 'vertical') {
      body.velocity.x *= -0.55;
      body.velocity.y = Math.abs(body.velocity.y) * 0.35;
      this.pendingMissPhrase = 'القائم! كانت قريييبة 😍';
    } else {
      body.velocity.y = Math.abs(body.velocity.y) * 0.5;
      body.velocity.x *= 0.6;
      this.pendingMissPhrase = 'العارضة تطنّ! خفّف القوة قليلًا 💪';
    }
    this.time.delayedCall(750, () => this.resolve('miss'));
  }

  // ── النتيجة ──

  private resolve(result: 'goal' | 'save' | 'miss'): void {
    if (this.state !== 'shooting') return;
    this.state = 'resolved';
    this.resolveTimer?.remove();

    if (result === 'goal') {
      audio.play('goal');
      audio.play('crowd');
      if (this.mode === 'duel') this.duelGoals[this.duelTurn]++;
      else this.goals++;
      this.keeper.setTexture(this.keeperTexture('-sad'));
      this.keeper.setAngle(0);
      goalZoom(this, this.ball.x, GOAL.lineY - 50);
      this.cameras.main.shake(220, 0.008); // اهتزاز بسيط
      starBurst(this, this.ball.x, this.ball.y, 12);
      confetti(this, 36);
      playerCelebration(this, this.player.celebrationType, this.shooter, this.ball.x, this.ball.y);
      // إضاءة نجمة في العداد
      if (this.starIcons.length && !this.golden && this.starIcons[this.shotIndex]) {
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
        this.time.delayedCall(1500, () => this.showReplay());
        this.time.delayedCall(3200, () => this.afterShot(result));
        return;
      }
    } else if (result === 'save') {
      audio.play('save');
      slowMo(this); // ⏱️ لقطة بطيئة للتصدي
      // الحارس يمسك الكرة فخورًا ثم الكرة ترتد
      this.keeper.setTexture(this.keeperTexture('-save'));
      this.keeper.setAngle(0);
      this.ball.setVelocity(Phaser.Math.FloatBetween(-160, 160), Phaser.Math.FloatBetween(220, 320));
      gsap.to(this.keeper, { scale: 1.12, duration: 0.12, yoyo: true, repeat: 1 });
      const savePhrase = Phaser.Utils.Array.GetRandom(PHRASES.save);
      this.showPhrase(savePhrase);
      announcer.onOutcome('save', savePhrase);
    } else {
      this.keeper.setTexture(this.keeperTexture('-happy'));
      this.keeper.setAngle(0);
      const missPhrase = this.pendingMissPhrase ?? Phaser.Utils.Array.GetRandom(PHRASES.miss);
      this.pendingMissPhrase = null;
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
        skip.destroy();
      },
    });
    const per = 1.15 / pts.length;
    for (const pt of pts) tl.to(ghost, { x: pt.x, y: pt.y, duration: per, ease: 'none' });
    tl.to(ghost, { alpha: 0, duration: 0.2 });

    // ⏭️ زر تخطي الإعادة (الدليل §12)
    const skip = this.add
      .text(GAME_WIDTH / 2, 560, rtl('⏭️ تخطي'), {
        fontFamily: FONT,
        fontSize: '19px',
        color: '#f8fff7',
        fontStyle: 'bold',
        backgroundColor: '#07111faa',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(42)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerup', () => {
      audio.play('button');
      tl.progress(1); // يقفز للنهاية — onComplete ينظف كل شيء
    });
  }

  // بعد حسم تسديدة اللاعب: دور الحراسة في المباراة، أو التسديدة التالية
  private afterShot(result: 'goal' | 'save' | 'miss'): void {
    if (this.mode === 'duel') {
      this.duelNext();
      return;
    }
    if (this.mode === 'match' && !this.golden) {
      this.startDefense();
      return;
    }
    if (this.golden) {
      // الضربة الذهبية: هدف اللاعب يحسم فورًا، وإلا يحرس ضد تسديدة الخصم
      if (result === 'goal') {
        go(this, 'Result', { mode: 'match', goals: this.goals, oppGoals: this.oppGoals, goldenWin: true });
      } else {
        this.startDefense();
      }
      return;
    }
    this.nextShot();
  }

  // ── 🧤 دور الحراسة: الطفل يحرك الحارس بإصبعه ليصد تسديدة فريق الخصم ──

  private startDefense(): void {
    this.state = 'defending';
    this.oppShotFlying = false;
    // الحارس بين يدي الطفل: توهج سماوي وموقع البداية في المنتصف
    this.keeperTween?.remove();
    this.keeper.setTexture(this.keeperTexture());
    this.keeper.setAngle(0).setScale(1).setPosition(GOAL.centerX, KEEPER_Y);
    this.keeper.setTint(0x9be8ff);
    // الكرة الأصلية جانبًا حتى لا تشوش
    this.ball.setVelocity(0, 0);
    this.ball.setPosition(BALL_START.x, BALL_START.y);
    this.ball.setDisplaySize(44, 44);

    const banner = this.add
      .text(GAME_WIDTH / 2, 500, rtl('🧤 دورك في الحراسة!\nحرّك إصبعك يمينًا ويسارًا لتصد'), {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        backgroundColor: '#07111fcc',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(35)
      .setAlpha(0);
    gsap.to(banner, { alpha: 1, duration: 0.3 });

    // كرة الخصم تنطلق بعد لحظة استعداد
    this.oppBall = this.add.image(BALL_START.x, BALL_START.y, 'ball').setDisplaySize(44, 44).setDepth(6);
    this.time.delayedCall(1300, () => {
      gsap.to(banner, { alpha: 0, duration: 0.25, onComplete: () => banner.destroy() });
      audio.play('kick');
      // ١٥٪ من تسديدات الخصم تطيش وحدها — نَفَس للطفل
      this.oppTargetInGoal = Math.random() > 0.15;
      const halfW = GOAL.width / 2 - 30;
      const targetX = this.oppTargetInGoal
        ? GOAL.centerX + Phaser.Math.FloatBetween(-halfW, halfW)
        : GOAL.centerX + (Math.random() < 0.5 ? -1 : 1) * (GOAL.width / 2 + Phaser.Math.FloatBetween(30, 70));
      this.oppShotFlying = true;
      if (this.oppBall) {
        gsap.to(this.oppBall, { x: targetX, y: GOAL.lineY - 32, displayWidth: 28, displayHeight: 28, duration: 0.85, ease: 'power1.in' });
      }
    });
  }

  private updateDefense(): void {
    // الحارس يتبع الإصبع (أو مؤشر الفأرة)
    const px = this.input.activePointer.x;
    this.keeper.x = Phaser.Math.Clamp(px, GOAL.centerX - KEEPER_RANGE, GOAL.centerX + KEEPER_RANGE);
    if (!this.oppBall || !this.oppShotFlying) return;
    // تصدٍّ!
    if (Math.abs(this.oppBall.x - this.keeper.x) < DEFENSE_REACH && Math.abs(this.oppBall.y - this.keeper.y) < 58) {
      this.finishDefense('saved');
      return;
    }
    // وصلت خط المرمى
    if (this.oppBall.y <= GOAL.lineY - 26) {
      this.finishDefense(this.oppTargetInGoal ? 'goal' : 'wide');
    }
  }

  private finishDefense(outcome: 'saved' | 'goal' | 'wide'): void {
    this.state = 'resolved';
    this.oppShotFlying = false;
    if (this.oppBall) gsap.killTweensOf(this.oppBall);

    if (outcome === 'saved') {
      audio.play('save');
      slowMo(this);
      this.keeper.setTexture(this.keeperTexture('-save'));
      starBurst(this, this.keeper.x, this.keeper.y, 10);
      this.showPhrase('🧤 تصدٍّ خرافي! أنت حارس عظيم');
      this.oppBall?.destroy();
      this.oppBall = null;
    } else if (outcome === 'wide') {
      this.showPhrase('طاشت منهم! 😅');
      gsap.to(this.oppBall, { alpha: 0, duration: 0.4, delay: 0.3 });
    } else {
      this.oppGoals++;
      audio.play('goal');
      this.keeper.setTexture(this.keeperTexture('-sad'));
      this.showPhrase('سجّلوا... عوّضها بتسديدتك! 💪');
    }
    this.updateShotText();

    this.time.delayedCall(1400, () => {
      this.oppBall?.destroy();
      this.oppBall = null;
      this.keeper.clearTint();
      if (this.golden) {
        // في الذهبية: هدف الخصم يحسم الخسارة، وإلا جولة ذهبية جديدة
        if (this.oppGoals > this.goals) {
          go(this, 'Result', { mode: 'match', goals: this.goals, oppGoals: this.oppGoals });
        } else {
          this.showPhrase('جولة ذهبية جديدة! ⚡');
          this.nextShot(true);
        }
        return;
      }
      this.nextShot();
    });
  }

  // ── 🤝 تحدي صديق: تبادل الأدوار على نفس الجهاز ──

  private duelNext(): void {
    if (!this.duelPlayers) return;
    this.duelShots[this.duelTurn]++;
    if (this.duelShots[0] >= SHOTS_PER_ROUND && this.duelShots[1] >= SHOTS_PER_ROUND) {
      const [p1, p2] = this.duelPlayers;
      go(this, 'Result', {
        mode: 'duel',
        p1Name: p1.name,
        p2Name: p2.name,
        p1Goals: this.duelGoals[0],
        p2Goals: this.duelGoals[1],
      });
      return;
    }
    // تبديل الدور مع شاشة تسليم الجهاز
    this.duelTurn = this.duelTurn === 0 ? 1 : 0;
    this.player = this.duelPlayers[this.duelTurn];
    this.duelHandoff();
  }

  private duelHandoff(): void {
    this.state = 'paused';
    const next = this.player;
    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.78)
      .setDepth(70)
      .setInteractive();
    const avatar = this.add.image(GAME_WIDTH / 2, 300, `avatar-${next.id}`).setDisplaySize(130, 130).setDepth(71);
    const label = this.add
      .text(GAME_WIDTH / 2, 402, rtl(`🔄 سلّم الجهاز إلى\n${next.emoji} ${next.name}`), {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(71);
    const btn = makeButton(
      this,
      GAME_WIDTH / 2,
      520,
      '✅ جاهز — هات الكرة!',
      () => {
        [overlay, avatar, label, btn].forEach((o) => o.destroy());
        this.shooter.setTexture(`avatar-${next.id}`);
        this.resetForNextShot();
      },
      { width: 330, height: 78, variant: 'primary', fontSize: 26 },
    );
    btn.setDepth(72);
    gsap.from(avatar, { scale: 0, duration: 0.45, ease: 'back.out(2)' });
  }

  // ── التسديدة التالية ──

  private nextShot(stayGolden = false): void {
    if (!stayGolden) this.shotIndex++;
    // نهاية الجولة
    if (this.mode !== 'training' && this.mode !== 'duel' && !this.golden && this.shotIndex >= SHOTS_PER_ROUND) {
      if (this.mode === 'match') {
        if (this.goals === this.oppGoals) {
          // تعادل → الضربة الذهبية
          this.golden = true;
          audio.play('whistle');
          this.showPhrase('⚡ تعادل! الضربة الذهبية تحسم');
        } else {
          go(this, 'Result', { mode: 'match', goals: this.goals, oppGoals: this.oppGoals });
          return;
        }
      } else if (this.mode === 'freekick' || this.mode === 'daily') {
        go(this, 'Result', { mode: this.mode, goals: this.goals });
        return;
      } else {
        go(this, 'Result', { goals: this.goals, stage: this.stage });
        return;
      }
    }
    this.resetForNextShot();
  }

  // إعادة تجهيز الملعب لتسديدة جديدة
  private resetForNextShot(): void {
    this.ball.setVelocity(0, 0);
    this.ball.setPosition(BALL_START.x, BALL_START.y);
    this.ball.setDisplaySize(44, 44);
    this.curve = 0;
    this.bounced = false;
    this.keeper.setPosition(GOAL.centerX, KEEPER_Y);
    this.keeper.setScale(1);
    this.startKeeperIdle();
    if (this.mode === 'freekick') this.repositionWall();
    this.updateShotText();
    this.state = 'aiming';
    if (Math.random() < 0.35) this.coachTip();
  }

  // ── ⏸️ الاستراحة ──

  private openPause(): void {
    if (this.state !== 'aiming') return;
    this.state = 'paused';
    const items: Phaser.GameObjects.GameObject[] = [];
    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.7)
      .setDepth(70)
      .setInteractive();
    const panel = this.add.image(GAME_WIDTH / 2, 400, 'panel-glass').setDisplaySize(360, 360).setDepth(71);
    const title = this.add
      .text(GAME_WIDTH / 2, 280, rtl('⏸️ استراحة'), { fontFamily: FONT, fontSize: '34px', color: '#ffd45a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(72);
    items.push(overlay, panel, title);
    const close = () => items.forEach((o) => o.destroy());
    const b1 = makeButton(this, GAME_WIDTH / 2, 360, '▶️ متابعة اللعب', () => {
      close();
      this.state = 'aiming';
    }, { width: 300, height: 68, variant: 'primary', fontSize: 24 });
    const b2 = makeButton(this, GAME_WIDTH / 2, 444, '🔁 إعادة الجولة', () => {
      this.scene.restart(this.initData);
    }, { width: 300, height: 68, variant: 'glass', fontSize: 24 });
    const b3 = makeButton(this, GAME_WIDTH / 2, 528, '🏠 الرئيسية', () => go(this, 'Menu'), {
      width: 300,
      height: 68,
      variant: 'glass',
      fontSize: 24,
    });
    [b1, b2, b3].forEach((b) => {
      b.setDepth(72);
      items.push(b);
    });
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
    const key: DifficultyKey =
      this.mode === 'tournament' ? STAGES[this.stage].difficulty : this.mode === 'training' ? 'easy' : 'medium';
    return DIFFICULTIES[key];
  }
}
