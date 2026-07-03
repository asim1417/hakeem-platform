// MenuScene — واجهة البداية: الشعار والأزرار الكبيرة واختيار الصعوبة

import Phaser from 'phaser';
import { COLORS, DIFFICULTIES, FONT, GAME_HEIGHT, GAME_WIDTH, rtl, STAGES } from '../config/gameConfig';
import { getPlayer } from '../data/players';
import { audio } from '../utils/audio';
import { popIn, pulse } from '../utils/animations';
import { makeButton } from '../utils/ui';

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
    const ball = this.add.image(GAME_WIDTH / 2, 265, 'ball').setScale(1.3);
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

    // الأزرار الرئيسية — ابدأ اللعب يطلق رحلة المراحل الثلاث
    const startBtn = makeButton(this, GAME_WIDTH / 2, 420, '🎮 ابدأ اللعب', () => {
      this.scene.start('Game', { stage: 0 });
    }, { width: 320, height: 84, color: COLORS.blue, fontSize: 34 });
    popIn(startBtn, 0.45);
    pulse(startBtn);

    // خريطة المراحل الصغيرة تحت زر البداية
    const stagesHint = this.add
      .text(GAME_WIDTH / 2, 485, rtl(STAGES.map((s) => `${s.icon} ${DIFFICULTIES[s.difficulty].label}`).join('  ←  ')), {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    popIn(stagesHint, 0.5);

    const selectBtn = makeButton(this, GAME_WIDTH / 2, 560, '😃 اختيار اللاعب', () => {
      this.scene.start('PlayerSelect');
    }, { width: 320, color: COLORS.orange });
    popIn(selectBtn, 0.55);

    const trainBtn = makeButton(this, GAME_WIDTH / 2, 650, '🏋️ التدريب', () => {
      this.scene.start('Game', { training: true });
    }, { width: 320, color: COLORS.pink });
    popIn(trainBtn, 0.65);

    // زر كتم الصوت
    const muteBtn = makeButton(this, GAME_WIDTH - 55, 50, audio.isMuted() ? '🔇' : '🔊', () => {
      const muted = audio.toggleMute();
      const label = muteBtn.getAt(2) as Phaser.GameObjects.Text;
      label.setText(muted ? '🔇' : '🔊');
    }, { width: 72, height: 72, fontSize: 32, color: 0x27893f });
  }

  private drawBackground(): void {
    // سماء وملعب
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 4, GAME_WIDTH, GAME_HEIGHT / 2, COLORS.sky);
    this.add.rectangle(GAME_WIDTH / 2, (GAME_HEIGHT * 3) / 4, GAME_WIDTH, GAME_HEIGHT / 2, COLORS.grass);
    // خطوط عشب
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40 + i * 80, GAME_WIDTH, 40, COLORS.grassDark, 0.5);
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
