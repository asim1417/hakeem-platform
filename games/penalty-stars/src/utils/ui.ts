// نظام واجهة الهوية البصرية — أزرار نيون متدرجة وزجاج كحلي وأيقونات موحدة
// المرجع: visual_identity_guide.html + design_tokens.json

import Phaser from 'phaser';
import { FONT, rtl } from '../config/gameConfig';
import { audio } from './audio';

export type ButtonVariant = 'primary' | 'glass' | 'gold';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  variant?: ButtonVariant;
  color?: number; // متجاهَل — أبقي التوافق مع الاستدعاءات القديمة
}

const TEXTURE: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  glass: 'btn-glass',
  gold: 'btn-gold',
};

// نص كحلي داكن فوق النيون والذهبي، أبيض فوق الزجاج
const TEXT_COLOR: Record<ButtonVariant, string> = {
  primary: '#07111f',
  glass: '#f8fff7',
  gold: '#07111f',
};

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 300;
  const h = opts.height ?? 72;
  const variant = opts.variant ?? 'glass';

  const shadow = scene.add.image(3, 6, TEXTURE[variant]).setDisplaySize(w, h).setTint(0x000000).setAlpha(0.35);
  const bg = scene.add.image(0, 0, TEXTURE[variant]).setDisplaySize(w, h);
  const text = scene.add
    .text(0, 0, rtl(label), {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 28}px`,
      color: TEXT_COLOR[variant],
      fontStyle: 'bold',
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [shadow, bg, text]);
  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true });
  container.on('pointerdown', () => container.setScale(0.95));
  container.on('pointerout', () => container.setScale(1));
  container.on('pointerup', () => {
    container.setScale(1);
    audio.play('button');
    onClick();
  });
  return container;
}

// رقاقة دائرية زجاجية بأيقونة مرسومة (بيت/صوت...) — لأزرار النظام الصغيرة
export function makeChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  iconKey: string,
  onClick: () => void,
  size = 62,
): Phaser.GameObjects.Container {
  const bg = scene.add.image(0, 0, 'chip-glass').setDisplaySize(size, size);
  const icon = scene.add.image(0, 0, iconKey).setDisplaySize(size * 0.52, size * 0.52);
  const chip = scene.add.container(x, y, [bg, icon]);
  chip.setSize(size, size);
  chip.setInteractive({ useHandCursor: true });
  chip.on('pointerdown', () => chip.setScale(0.92));
  chip.on('pointerout', () => chip.setScale(1));
  chip.on('pointerup', () => {
    chip.setScale(1);
    audio.play('button');
    onClick();
  });
  return chip;
}

// رقاقة كتم الصوت الجاهزة — تبدّل الأيقونة تلقائيًا
export function makeMuteChip(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const chip = makeChip(scene, x, y, audio.isMuted() ? 'ic-mute' : 'ic-sound', () => {
    const muted = audio.toggleMute();
    (chip.getAt(1) as Phaser.GameObjects.Image).setTexture(muted ? 'ic-mute' : 'ic-sound');
  });
  return chip;
}

// لوحة زجاجية خلف نص (HUD وغيرها)
export function glassBehind(scene: Phaser.Scene, text: Phaser.GameObjects.Text, pad = 12): Phaser.GameObjects.Image {
  const panel = scene.add
    .image(text.x - pad, text.y - pad / 2, 'panel-glass')
    .setOrigin(0, 0)
    .setDepth(text.depth - 1);
  const sync = () => panel.setDisplaySize(text.width + pad * 2, text.height + pad);
  sync();
  (panel as Phaser.GameObjects.Image & { sync: () => void }).sync = sync;
  return panel;
}
