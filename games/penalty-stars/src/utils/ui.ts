// أزرار كبيرة وواضحة مناسبة للأطفال — تعمل باللمس والماوس

import Phaser from 'phaser';
import { COLORS, FONT, rtl } from '../config/gameConfig';
import { audio } from './audio';

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  fontSize?: number;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 280;
  const h = opts.height ?? 72;
  const color = opts.color ?? COLORS.blue;

  const shadow = scene.add.rectangle(3, 6, w, h, 0x000000, 0.25);
  shadow.setOrigin(0.5);
  const bg = scene.add.rectangle(0, 0, w, h, color).setOrigin(0.5);
  bg.setStrokeStyle(5, COLORS.white);
  const text = scene.add
    .text(0, 0, rtl(label), {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 30}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#00000033',
      strokeThickness: 2,
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [shadow, bg, text]);
  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true });

  container.on('pointerdown', () => {
    container.setScale(0.93);
  });
  container.on('pointerup', () => {
    container.setScale(1);
    audio.play('button');
    onClick();
  });
  container.on('pointerout', () => container.setScale(1));

  return container;
}
