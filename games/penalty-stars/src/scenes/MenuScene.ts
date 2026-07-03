// MenuScene — واجهة البداية: الشعار والأزرار الكبيرة واختيار الصعوبة

import Phaser from 'phaser';
import { arabicNum, COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, rtl, STAGES, VERSION } from '../config/gameConfig';
import { getPlayer } from '../data/players';
import { audio } from '../utils/audio';
import { popIn, pulse } from '../utils/animations';
import { makeButton } from '../utils/ui';
import { progress } from '../utils/progress';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    // القيم الافتراضية في أول تشغيل
    if (!this.registry.has('playerId')) this.registry.set('playerId', 'hassouni');

    this.drawBackground();

    // الشعار
    const title = this.add
      .text(GAME_WIDTH / 2, 130, rtl('⭐ نجوم البلنتيات ⭐'), {
        fontFamily: FONT,
        fontSize: '46px',
        color: '#ffd93d',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    popIn(title, 0.1);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 190, rtl('⚽ سدّد وكن البطل! ⚽'), {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    popIn(subtitle, 0.25);

    // كرة متحركة للزينة
    const ballKey = this.textures.exists(progress.selectedBall()) ? progress.selectedBall() : 'ball';
    const ball = this.add.image(GAME_WIDTH / 2, 265, ballKey).setDisplaySize(62, 62);
    this.tweens.add({ targets: ball, y: 245, duration: 700, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.tweens.add({ targets: ball, angle: 360, duration: 3000, repeat: -1 });

    // اللاعب المختار حاليًا
    const player = getPlayer(this.registry.get('playerId') as string);
    const chosen = this.add
      .text(GAME_WIDTH / 2, 330, rtl(`اللاعب: ${player.name} ${player.emoji}`), {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    popIn(chosen, 0.35);

    // الأزرار الرئيسية — البطولة (٤ أدوار) والمباراة والتدريب والخزنة
    const startBtn = makeButton(this, GAME_WIDTH / 2, 408, '🏆 بطولة نجوم البلنتيات', () => {
      this.scene.start('Game', { stage: 0 });
    }, { width: 340, height: 76, color: COLORS.blue, fontSize: 28 });
    popIn(startBtn, 0.45);
    pulse(startBtn);

    // خريطة أدوار البطولة
    const stagesHint = this.add
      .text(GAME_WIDTH / 2, 462, rtl(STAGES.map((s) => `${s.icon} ${s.label}`).join(' ← ')), {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    popIn(stagesHint, 0.5);

    const matchBtn = makeButton(this, GAME_WIDTH / 2, 518, '⚔️ مباراة البلنتيات', () => {
      this.scene.start('Game', { mode: 'match' });
    }, { width: 340, height: 66, fontSize: 26, color: 0x35c96b });
    popIn(matchBtn, 0.55);

    const selectBtn = makeButton(this, GAME_WIDTH / 2, 592, '😃 اختيار اللاعب', () => {
      this.scene.start('PlayerSelect');
    }, { width: 340, height: 62, fontSize: 25, color: COLORS.orange });
    popIn(selectBtn, 0.62);

    const trainBtn = makeButton(this, GAME_WIDTH / 2, 662, '🏋️ التدريب', () => {
      this.scene.start('Game', { training: true });
    }, { width: 340, height: 62, fontSize: 25, color: COLORS.pink });
    popIn(trainBtn, 0.69);

    const lockerBtn = makeButton(this, GAME_WIDTH / 2, 732, '🎒 الخزنة — كرات وملاعب', () => {
      this.scene.start('Locker');
    }, { width: 340, height: 62, fontSize: 24, color: 0x9b6bff });
    popIn(lockerBtn, 0.76);

    // مجموع النجوم المكتسبة
    const starsLabel = this.add
      .text(20, 128, rtl(`⭐ ${arabicNum(progress.totalStars())}${progress.hasTrophy() ? '  🏆' : ''}`), {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffd93d',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
      })
      .setOrigin(0, 0.5);
    popIn(starsLabel, 0.3);

    // رقم الإصدار — للتحقق من تحديث النسخة على الجهاز
    this.add
      .text(GAME_WIDTH - 8, GAME_HEIGHT - 8, rtl(VERSION), {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#1a5c2e',
        strokeThickness: 3,
      })
      .setOrigin(1, 1)
      .setAlpha(0.85);

    // زر كتم الصوت
    const muteBtn = makeButton(this, GAME_WIDTH - 55, 50, audio.isMuted() ? '🔇' : '🔊', () => {
      const muted = audio.toggleMute();
      const label = muteBtn.getAt(2) as Phaser.GameObjects.Text;
      label.setText(muted ? '🔇' : '🔊');
    }, { width: 72, height: 72, fontSize: 32, color: 0x27893f });
  }

  private drawBackground(): void {
    // خلفية الملعب شبه الواقعية + طبقة تعتيم خفيفة لوضوح الواجهة المرحة فوقها
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.18);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 4, GAME_WIDTH, GAME_HEIGHT / 2, COLORS.sky);
      this.add.rectangle(GAME_WIDTH / 2, (GAME_HEIGHT * 3) / 4, GAME_WIDTH, GAME_HEIGHT / 2, COLORS.grass);
      for (let i = 0; i < 5; i++) {
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40 + i * 80, GAME_WIDTH, 40, COLORS.grassDark, 0.5);
      }
    }
    // شمس مبتسمة
    const sun = this.add.circle(70, 70, 36, COLORS.yellow);
    this.tweens.add({ targets: sun, scale: 1.1, duration: 1200, yoyo: true, repeat: -1 });
    // غيوم
    for (const [x, y] of [[180, 60], [360, 110]] as const) {
      const cloud = this.add.container(x, y, [
        this.add.ellipse(0, 0, 80, 36, COLORS.white),
        this.add.ellipse(-28, 8, 50, 26, COLORS.white),
        this.add.ellipse(28, 8, 50, 26, COLORS.white),
      ]);
      this.tweens.add({ targets: cloud, x: x + 24, duration: 4000, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
  }
}
