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
import { ModesScene } from './scenes/ModesScene';
import { MissionsScene } from './scenes/MissionsScene';
import { ProfileScene } from './scenes/ProfileScene';
import './styles.css';
// الخطوط العربية — تُضمّن في البناء وتُحمّل قبل إنشاء النصوص
// Cairo للنصوص + Noto Kufi للعناوين (هوية فوتبول فيوتشر)
import cairoBold from '@fontsource/cairo/files/cairo-arabic-700-normal.woff2?url';
import cairoBlack from '@fontsource/cairo/files/cairo-arabic-900-normal.woff2?url';
import kufiBold from '@fontsource/noto-kufi-arabic/files/noto-kufi-arabic-arabic-700-normal.woff2?url';
import kufiHeavy from '@fontsource/noto-kufi-arabic/files/noto-kufi-arabic-arabic-800-normal.woff2?url';

async function loadFonts(): Promise<void> {
  try {
    const faces = [
      new FontFace('Cairo', `url(${cairoBold})`, { weight: '700' }),
      new FontFace('Cairo', `url(${cairoBlack})`, { weight: '900' }),
      new FontFace('Noto Kufi Arabic', `url(${kufiBold})`, { weight: '700' }),
      new FontFace('Noto Kufi Arabic', `url(${kufiHeavy})`, { weight: '800' }),
    ];
    for (const f of faces) document.fonts.add(await f.load());
  } catch {
    /* يسقط على خط النظام */
  }
}

loadFonts().then(() => new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0f14',
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
  scene: [BootScene, MenuScene, ModesScene, MissionsScene, ProfileScene, TournamentScene, PlayerSelectScene, GameScene, ResultScene, LockerScene],
}));
