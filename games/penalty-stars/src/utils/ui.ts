// نظام واجهة الهوية البصرية — أزرار نيون متدرجة وزجاج كحلي وأيقونات موحدة
// المرجع: visual_identity_guide.html + design_tokens.json

import Phaser from 'phaser';
import { FONT, HEADING, rtl } from '../config/gameConfig';
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
  primary: '#0b0f14',
  glass: '#f8fff7',
  gold: '#0b0f14',
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
      fontFamily: HEADING, // خط العناوين الكوفي في كل الأزرار (الهوية)
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

// ⚡ خطوط الطاقة المائلة (الهوية §9): ثلاث ضربات ضوئية خلف العناوين
export function energyStreaks(scene: Phaser.Scene, y: number, depth = 0): void {
  const w = scene.scale.width;
  const g = scene.add.graphics().setDepth(depth);
  const streak = (x0: number, sw: number, color: number, alpha: number) => {
    g.fillStyle(color, alpha);
    g.fillPoints([
      new Phaser.Math.Vector2(x0, y + 34),
      new Phaser.Math.Vector2(x0 + 26, y - 34),
      new Phaser.Math.Vector2(x0 + 26 + sw, y - 34),
      new Phaser.Math.Vector2(x0 + sw, y + 34),
    ], true);
  };
  streak(-20, 14, 0xc6ff00, 0.16);
  streak(26, 8, 0x00e5ff, 0.14);
  streak(w - 60, 14, 0x00e5ff, 0.16);
  streak(w - 22, 8, 0xc6ff00, 0.14);
}

// 🧭 شريط التنقل السفلي (هوية فوتبول فيوتشر): ٤ تبويبات — الرئيسية/الأوضاع/المهام/الملف
export type NavTab = 'home' | 'modes' | 'missions' | 'profile';

const NAV_ITEMS: { tab: NavTab; icon: string; label: string; scene: string }[] = [
  { tab: 'home', icon: 'ic-home', label: 'الرئيسية', scene: 'Menu' },
  { tab: 'modes', icon: 'ball', label: 'الأوضاع', scene: 'Modes' },
  { tab: 'missions', icon: 'ic-target', label: 'المهام', scene: 'Missions' },
  { tab: 'profile', icon: 'ic-user', label: 'الملف', scene: 'Profile' },
];

export function makeBottomNav(scene: Phaser.Scene, active: NavTab, goFn: (scene: Phaser.Scene, key: string) => void): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const barY = h - 40;
  scene.add.image(w / 2, barY, 'panel-glass').setDisplaySize(w + 8, 84).setDepth(90);
  // RTL: أول تبويب يبدأ من اليمين
  NAV_ITEMS.forEach((item, i) => {
    const x = w - w / 8 - (w / 4) * i;
    const isActive = item.tab === active;
    const icon = scene.add.image(x, barY - 12, item.icon).setDisplaySize(26, 26).setDepth(91);
    scene.add
      .text(x, barY + 14, rtl(item.label), {
        fontFamily: FONT,
        fontSize: '12px',
        color: isActive ? '#c6ff00' : '#b2bcc6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(91);
    if (isActive) {
      icon.setTint(0xc6ff00);
      scene.add.circle(x, barY - 32, 2.5, 0xc6ff00).setDepth(91); // نقطة توهج للتبويب النشط
    } else {
      icon.setTint(0xb2bcc6);
      const hit = scene.add.rectangle(x, barY, w / 4 - 8, 78, 0xffffff, 0.001).setDepth(92).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        audio.play('button');
        goFn(scene, item.scene);
      });
    }
  });
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
