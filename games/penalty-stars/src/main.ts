// نقطة الدخول — إعداد Phaser وتشغيل المشاهد

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { TournamentScene } from './scenes/TournamentScene';
import { PlayerSelectScene } from './scenes/PlayerSelectScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { LockerScene } from './scenes/LockerScene';
import './styles.css';
// خط Cairo العربي — يُضمّن في البناء ويُحمّل قبل إنشاء النصوص
import cairoBold from '@fontsource/cairo/files/cairo-arabic-700-normal.woff2?url';
import cairoBlack from '@fontsource/cairo/files/cairo-arabic-900-normal.woff2?url';

async function loadFonts(): Promise<void> {
  try {
    const bold = new FontFace('Cairo', `url(${cairoBold})`, { weight: '700' });
    const black = new FontFace('Cairo', `url(${cairoBlack})`, { weight: '900' });
    document.fonts.add(await bold.load());
    document.fonts.add(await black.load());
  } catch {
    /* يسقط على خط النظام */
  }
}

loadFonts().then(() => new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#2e9e4f',
  scale: {
    // يتكيف مع شاشة الجوال والمتصفح مع الحفاظ على الأبعاد
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  input: { activePointers: 2 }, // دعم اللمس المتعدد للجوال
  scene: [BootScene, MenuScene, TournamentScene, PlayerSelectScene, GameScene, ResultScene, LockerScene],
}));
