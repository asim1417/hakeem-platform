// MenuScene — الشاشة الأولية: هوية قوية، صورة اللاعب المختار، وبطاقتا وضعين

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

    // ── بطاقتا الوضعين: البطولة والمباراة ──
    const tournamentCard = this.modeCard(
      GAME_WIDTH / 2 - 113, 478, COLORS.blue, '🏆', 'البطولة',
      `${arabicNum(STAGES.length)} أدوار حتى الكأس`,
      () => this.scene.start('Game', { stage: 0 }),
    );
    popIn(tournamentCard, 0.42);
    pulse(tournamentCard);

    const matchCard = this.modeCard(
      GAME_WIDTH / 2 + 113, 478, 0x2fae62, '⚔️', 'المباراة',
      'أنت ضد فريق الحارس',
      () => this.scene.start('Game', { mode: 'match' }),
    );
    popIn(matchCard, 0.5);

    // ── صف الأزرار الثانوية ──
    const trainBtn = makeButton(this, GAME_WIDTH / 2 - 113, 620, '🏋️ التدريب', () => {
      this.scene.start('Game', { training: true });
    }, { width: 210, height: 64, fontSize: 24, color: COLORS.pink });
    popIn(trainBtn, 0.58);

    const lockerBtn = makeButton(this, GAME_WIDTH / 2 + 113, 620, '🎒 الخزنة', () => {
      this.scene.start('Locker');
    }, { width: 210, height: 64, fontSize: 24, color: 0x9b6bff });
    popIn(lockerBtn, 0.64);

    // ── شريط الحالة السفلي: النجوم والكأس والإصدار ──
    const statusBar = this.add
      .text(GAME_WIDTH / 2, 700, rtl(`رصيدك: ⭐ ${arabicNum(progress.totalStars())}${progress.hasTrophy() ? '  •  🏆 بطل كأس النجوم' : ''}`), {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffd93d',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    popIn(statusBar, 0.7);

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

    // زر كتم الصوت
    const muteBtn = makeButton(this, GAME_WIDTH - 52, 48, audio.isMuted() ? '🔇' : '🔊', () => {
      const muted = audio.toggleMute();
      const label = muteBtn.getAt(2) as Phaser.GameObjects.Text;
      label.setText(muted ? '🔇' : '🔊');
    }, { width: 66, height: 66, fontSize: 30, color: 0x27893f });
  }

  // بطاقة وضع لعب كبيرة: أيقونة + اسم + وصف قصير
  private modeCard(
    x: number,
    y: number,
    color: number,
    icon: string,
    label: string,
    sub: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const w = 212;
    const h = 128;
    const shadow = this.add.rectangle(4, 7, w, h, 0x000000, 0.3);
    const bg = this.add.rectangle(0, 0, w, h, color, 0.97).setStrokeStyle(5, 0xffffff);
    const iconText = this.add.text(0, -34, icon, { fontSize: '42px' }).setOrigin(0.5);
    const labelText = this.add
      .text(0, 14, rtl(label), {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#00000044',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const subText = this.add
      .text(0, 44, rtl(sub), {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffffffdd',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const card = this.add.container(x, y, [shadow, bg, iconText, labelText, subText]);
    card.setSize(w, h);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => card.setScale(0.94));
    card.on('pointerout', () => card.setScale(1));
    card.on('pointerup', () => {
      card.setScale(1);
      audio.play('button');
      onClick();
    });
    return card;
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
