// MenuScene — الشاشة الأولية: شعار الدرع، بطاقة اللاعب، شبكة الأوضاع، تحدي اليوم، والإعدادات

import Phaser from 'phaser';
import { arabicNum, COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, rtl, VERSION } from '../config/gameConfig';
import { getPlayer } from '../data/players';
import { audio } from '../utils/audio';
import { popIn, pulse } from '../utils/animations';
import { makeButton, makeChip, makeMuteChip } from '../utils/ui';
import { progress } from '../utils/progress';
import { fadeIn, go } from '../utils/camera';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    // القيم الافتراضية في أول تشغيل
    if (!this.registry.has('playerId')) this.registry.set('playerId', 'hassouni');

    this.drawBackground();
    fadeIn(this);
    const player = getPlayer(this.registry.get('playerId') as string);

    // ── الشعار: درع الهوية فوق الاسم ──
    const shield = this.add.image(GAME_WIDTH / 2, 56, 'logo-shield').setDisplaySize(74, 81);
    popIn(shield, 0.02);
    const titleShadow = this.add
      .text(GAME_WIDTH / 2 + 3, 118 + 4, rtl('نجوم البلنتيات'), {
        fontFamily: FONT,
        fontSize: '50px',
        color: '#0c3a1c',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.55);
    const title = this.add
      .text(GAME_WIDTH / 2, 118, rtl('نجوم البلنتيات'), {
        fontFamily: FONT,
        fontSize: '50px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 12,
      })
      .setOrigin(0.5);
    popIn(titleShadow, 0.05);
    popIn(title, 0.05);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 164, rtl('⚽ سدّد… واصنع المجد! ⚽'), {
        fontFamily: FONT,
        fontSize: '20px',
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
      const b = this.add.image(bx, 170, ballKey).setDisplaySize(44, 44);
      this.tweens.add({ targets: b, y: 146, duration: 650, yoyo: true, repeat: -1, delay, ease: 'sine.inOut' });
      this.tweens.add({ targets: b, angle: 360, duration: 2600, repeat: -1 });
    }

    // ── بطاقة اللاعب المختار (اضغطها للتغيير) ──
    const ring = this.add.circle(0, 0, 56, 0xffffff, 0.95).setStrokeStyle(6, player.color);
    const avatar = this.add.image(0, 0, `avatar-${player.id}`).setDisplaySize(102, 102);
    const nameTag = this.add
      .text(0, 74, rtl(`${player.name} ${player.emoji}`), {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const changeHint = this.add
      .text(0, 102, rtl('👆 اضغط لتغيير اللاعب'), {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffe9a8',
        fontStyle: 'bold',
        stroke: '#1a5c2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const playerCard = this.add.container(GAME_WIDTH / 2, 262, [ring, avatar, nameTag, changeHint]);
    playerCard.setSize(170, 190);
    playerCard.setInteractive({ useHandCursor: true });
    playerCard.on('pointerup', () => {
      audio.play('button');
      go(this, 'PlayerSelect');
    });
    popIn(playerCard, 0.28);
    this.tweens.add({ targets: avatar, scale: avatar.scale * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    // ── الزر الأساسي: شجرة البطولة ──
    const startBtn = makeButton(this, GAME_WIDTH / 2, 418, '🏆 ابدأ البطولة', () => go(this, 'Tournament'), {
      width: 392,
      height: 80,
      fontSize: 31,
      variant: 'primary',
    });
    popIn(startBtn, 0.42);
    pulse(startBtn);

    // ── 🎯 تحدي اليوم (ذهبي — مرة واحدة يوميًا) ──
    const dailyDone = progress.dailyDoneToday();
    const dailyLabel = dailyDone ? '✅ أنجزت تحدي اليوم — عُد غدًا!' : '🎯 تحدي اليوم: سجّل ٤ ضد صقر — +٥⭐';
    const dailyBtn = makeButton(
      this,
      GAME_WIDTH / 2,
      482,
      dailyLabel,
      () => {
        if (!progress.dailyDoneToday()) go(this, 'Game', { mode: 'daily' });
      },
      { width: 392, height: 54, fontSize: 18, variant: 'gold' },
    );
    if (dailyDone) dailyBtn.setAlpha(0.75);
    popIn(dailyBtn, 0.48);

    // ── شبكة الأوضاع ٢×٢ ──
    const grid: [string, () => void][] = [
      ['⚔️ المباراة', () => go(this, 'Game', { mode: 'match' })],
      ['🌀 الفاولات', () => go(this, 'Game', { mode: 'freekick' })],
      ['🏋️ التدريب', () => go(this, 'Game', { training: true })],
      ['🤝 تحدي صديق', () => go(this, 'Game', { mode: 'duel' })],
    ];
    grid.forEach(([label, onTap], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const btn = makeButton(this, 140 + col * 200, 548 + row * 66, label, onTap, {
        width: 188,
        height: 58,
        fontSize: 19,
        variant: 'glass',
      });
      popIn(btn, 0.52 + i * 0.05);
    });

    // ── الخزنة بعرض كامل ──
    const lockerBtn = makeButton(this, GAME_WIDTH / 2, 664, '🎒 الخزنة — كرات وملاعب جديدة', () => go(this, 'Locker'), {
      width: 392,
      height: 52,
      fontSize: 19,
      variant: 'glass',
    });
    popIn(lockerBtn, 0.68);

    // ── شريط الحالة: الرصيد + سطر الأمان ──
    const statusBar = this.add
      .text(GAME_WIDTH / 2, 712, rtl(`رصيدك: ⭐ ${arabicNum(progress.totalStars())}${progress.hasTrophy() ? '  •  🏆 بطل كأس النجوم' : ''}`), {
        fontFamily: FONT,
        fontSize: '19px',
        color: '#ffd45a',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    popIn(statusBar, 0.74);

    this.add
      .text(GAME_WIDTH / 2, 742, rtl('بلا إعلانات • بلا مشتريات • آمنة للأطفال'), {
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

    // رقاقات النظام: صوت + إعدادات
    makeMuteChip(this, GAME_WIDTH - 46, 46);
    makeChip(this, 46, 46, 'ic-gear', () => this.openSettings());
  }

  // ⚙️ الإعدادات: صوت المعلق + حذف التقدم خلف بوابة أهل (سؤال حساب)
  private openSettings(): void {
    const items: Phaser.GameObjects.GameObject[] = [];
    const kill = () => items.forEach((o) => o.destroy());

    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.75)
      .setDepth(80)
      .setInteractive();
    const panel = this.add.image(GAME_WIDTH / 2, 400, 'panel-glass').setDisplaySize(390, 420).setDepth(81);
    const title = this.add
      .text(GAME_WIDTH / 2, 250, rtl('⚙️ الإعدادات'), { fontFamily: FONT, fontSize: '32px', color: '#ffd45a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(82);
    items.push(overlay, panel, title);

    // تبديل صوت المعلق
    const announcerLabel = () => (progress.announcerEnabled() ? '🎙️ صوت المعلق: يعمل' : '🔇 صوت المعلق: متوقف');
    const annBtn = makeButton(
      this,
      GAME_WIDTH / 2,
      330,
      announcerLabel(),
      () => {
        progress.setAnnouncer(!progress.announcerEnabled());
        (annBtn.getAt(2) as Phaser.GameObjects.Text).setText(rtl(announcerLabel()));
      },
      { width: 320, height: 64, fontSize: 22, variant: 'primary' },
    );
    annBtn.setDepth(82);
    items.push(annBtn);

    // حذف التقدم — سؤال حساب بسيط حتى لا يضغطه الصغار بالخطأ
    const resetBtn = makeButton(
      this,
      GAME_WIDTH / 2,
      414,
      '🗑️ حذف كل التقدم',
      () => {
        const q = this.add
          .text(GAME_WIDTH / 2, 470, rtl('للتأكيد (سؤال للكبار): كم ٦ × ٧؟'), {
            fontFamily: FONT,
            fontSize: '19px',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(82);
        items.push(q);
        [35, 42, 48].forEach((n, i) => {
          const a = makeButton(
            this,
            GAME_WIDTH / 2 - 110 + i * 110,
            520,
            arabicNum(n),
            () => {
              if (n === 42) {
                progress.resetAll();
                audio.play('whistle');
                kill();
                this.scene.restart();
              } else {
                audio.play('save');
                q.setText(rtl('إجابة غير صحيحة — التقدم بأمان 😊'));
              }
            },
            { width: 96, height: 52, fontSize: 22, variant: 'glass' },
          );
          a.setDepth(82);
          items.push(a);
        });
      },
      { width: 320, height: 58, fontSize: 20, variant: 'glass' },
    );
    resetBtn.setDepth(82);
    items.push(resetBtn);

    const closeBtn = makeButton(this, GAME_WIDTH / 2, 578, '✖️ إغلاق', () => kill(), {
      width: 200,
      height: 54,
      fontSize: 21,
      variant: 'gold',
    });
    closeBtn.setDepth(82);
    items.push(closeBtn);
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
