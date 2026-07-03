// نقطة الدخول — إعداد Phaser وتشغيل المشاهد

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayerSelectScene } from './scenes/PlayerSelectScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { LockerScene } from './scenes/LockerScene';
import { unlockSpeech } from './utils/announcer';
import './styles.css';

// فتح محرك النطق بأول لمسة — متطلب iOS/Safari لصوت المعلق
window.addEventListener('pointerdown', unlockSpeech, { once: true });

new Phaser.Game({
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
  scene: [BootScene, MenuScene, PlayerSelectScene, GameScene, ResultScene, LockerScene],
});
