// MenuScene — الشاشة الأولية: هوية قوية، صورة اللاعب المختار، وبطاقتا وضعين

import Phaser from 'phaser';
import { arabicNum, COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, rtl, STAGES, VERSION } from '../config/gameConfig';
import { getPlayer } from '../data/players';
import { audio } from '../utils/audio';
import { popIn, pulse } from '../utils/animations';
import { makeButton, makeMuteChip } from '../utils/ui';
import { progress } from '../utils/progress';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    // القيم الافتراضية في أول تشغيل
    if (!this.registry.has('playerId')) this.registry.set('playerId', 'hassouni');

    this.drawBackground();
    const player = getPlayer(this.registry.get('playerId') as string);

    // ── الشعار ──
    const titleShadow = this.add
      .text(GAME_WIDTH / 2 + 3, 88 + 4, rtl('نجوم البلنتيات'), {
        fontFamily: FONT,
        fontSize: '54px',
        color: '#0c3a1c',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.55);
    const title = this.add
      .text(GAME_WIDTH / 2, 88, rtl('نجوم البلنتيات'), {
        fontFamily: FONT,
        fontSize: '54px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 12,
      })
      .setOrigin(0.5);
    popIn(titleShadow, 0.05);
    popIn(title, 0.05);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 140, rtl('⚽ سدّد… واصنع المجد! ⚽'), {
        fontFamily: FONT,
        fontSize: '21px',
        color: '#00d7ff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    popIn(subtitle, 0.15);

    // كرتان تتقافزان حول الشعار
    const ballKey = this.textures.exists(progress.selectedBall()) ? progress.selectedBall() : 'ball';
    for (const [bx, delay] of [[52, 0], [GAME_WIDTH - 52, 350]] as const) {
      const b = this.add.image(bx, 150, ballKey).setDisplaySize(44, 44);
      this.tweens.add({ targets: b, y: 126, duration: 650, yoyo: true, repeat: -1, delay, ease: 'sine.inOut' });
      this.tweens.add({ targets: b, angle: 360, duration: 2600, repeat: -1 });
    }

    // ── بطاقة اللاعب المختار (اضغطها للتغيير) ──
    const ring = this.add.circle(0, 0, 62, 0xffffff, 0.95).setStrokeStyle(6, player.color);
    const avatar = this.add.image(0, 0, `avatar-${player.id}`).setDisplaySize(112, 112);
    const nameTag = this.add
      .text(0, 82, rtl(`${player.name} ${player.emoji}`), {
        fontFamily: FONT,
        fontSize: '23px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const changeHint = this.add
      .text(0, 112, rtl('👆 اضغط لتغيير اللاعب'), {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffe9a8',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const playerCard = this.add.container(GAME_WIDTH / 2, 248, [ring, avatar, nameTag, changeHint]);
    playerCard.setSize(180, 200);
    playerCard.setInteractive({ useHandCursor: true });
    playerCard.on('pointerup', () => {
      audio.play('button');
      this.scene.start('PlayerSelect');
    });
    popIn(playerCard, 0.28);
    this.tweens.add({ targets: avatar, scale: avatar.scale * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    // ── الزر الأساسي الضخم (نيون متدرج وفق الدليل) ──
    const startBtn = makeButton(this, GAME_WIDTH / 2, 428, '🏆 ابدأ البطولة', () => {
      this.scene.start('Game', { stage: 0 });
    }, { width: 392, height: 88, fontSize: 32, variant: 'primary' });
    popIn(startBtn, 0.42);
    pulse(startBtn);

    // خريطة أدوار البطولة
    const stagesHint = this.add
      .text(GAME_WIDTH / 2, 484, rtl(STAGES.map((s) => `${s.icon} ${s.label}`).join(' ← ')), {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    popIn(stagesHint, 0.48);

    // ── صف زجاجي: المباراة والتدريب والخزنة ──
    const glassRow: [string, () => void][] = [
      ['⚔️ المباراة', () => this.scene.start('Game', { mode: 'match' })],
      ['🏋️ التدريب', () => this.scene.start('Game', { training: true })],
      ['🎒 الخزنة', () => this.scene.start('Locker')],
    ];
    glassRow.forEach(([label, go], i) => {
      const btn = makeButton(this, 84 + i * 156, 552, label, go, { width: 148, height: 62, fontSize: 19, variant: 'glass' });
      popIn(btn, 0.52 + i * 0.06);
    });

    // ── شريط الحالة: الرصيد + سطر الأمان (وفق الدليل) ──
    const statusBar = this.add
      .text(GAME_WIDTH / 2, 668, rtl(`رصيدك: ⭐ ${arabicNum(progress.totalStars())}${progress.hasTrophy() ? '  •  🏆 بطل كأس النجوم' : ''}`), {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    popIn(statusBar, 0.7);

    this.add
      .text(GAME_WIDTH / 2, 700, rtl('بلا إعلانات • بلا مشتريات • آمنة للأطفال'), {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#f8fff7',
        stroke: '#07111f',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0.9);

    // رقم الإصدار — للتحقق من تحديث النسخة
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

    // رقاقة الصوت الزجاجية
    makeMuteChip(this, GAME_WIDTH - 46, 46);
  }

  private drawBackground(): void {
    // خلفية الملعب شبه الواقعية + تدرجا وضوح أعلى وأسفل
    const stadiumKey = progress.selectedStadium();
    if (this.textures.exists(stadiumKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, stadiumKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.22);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 4, GAME_WIDTH, GAME_HEIGHT / 2, COLORS.sky);
      this.add.rectangle(GAME_WIDTH / 2, (GAME_HEIGHT * 3) / 4, GAME_WIDTH, GAME_HEIGHT / 2, COLORS.grass);
      for (let i = 0; i < 5; i++) {
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40 + i * 80, GAME_WIDTH, 40, COLORS.grassDark, 0.5);
      }
    }
    // تظليل علوي وسفلي لإبراز الشعار وشريط الحالة
    this.add.rectangle(GAME_WIDTH / 2, 70, GAME_WIDTH, 190, COLORS.navy, 0.38);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 55, GAME_WIDTH, 130, COLORS.navy, 0.38);
  }
}
