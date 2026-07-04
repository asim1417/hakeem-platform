// CameraDirector — زوم الهدف، دفعة الركلة، الإبطاء، وانتقالات fade بين المشاهد

import Phaser from 'phaser';

// انتقال بين المشاهد وفق الدليل: شعاع ضوء ملعب يمسح الشاشة من اليمين لليسار
// خلال ~380ms بينما ستارة كحلية تشتد خلفه — يقابله fadeIn في create كل مشهد
export function go(scene: Phaser.Scene, key: string, data?: object): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const cover = scene.add.rectangle(w / 2, h / 2, w, h, 0x0b0f14, 0).setDepth(9998).setScrollFactor(0);
  const band = scene.add.graphics().setDepth(9999).setScrollFactor(0);
  // شعاع أبيض متدرج: يتوهج في وسطه ويخفت على حافتيه
  band.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0, 0.55, 0, 0.55);
  band.fillRect(0, 0, 85, h);
  band.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.55, 0, 0.55, 0);
  band.fillRect(85, 0, 85, h);
  band.x = w + 20;
  scene.tweens.add({ targets: band, x: -200, duration: 380, ease: 'Sine.easeIn' });
  scene.tweens.add({
    targets: cover,
    fillAlpha: 1,
    duration: 340,
    delay: 40,
    onComplete: () => scene.scene.start(key, data),
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(220, 11, 15, 20);
}

// دفعة زوم خفيفة لحظة الركلة
export function kickPunch(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.zoomTo(1.05, 140, 'Power2', true);
  scene.time.delayedCall(180, () => cam.zoomTo(1, 260, 'Sine.easeOut', true));
}

// زوم واقتراب نحو المرمى عند الهدف ثم عودة سلسة
export function goalZoom(scene: Phaser.Scene, x: number, y: number): void {
  const cam = scene.cameras.main;
  cam.pan(x, y + 60, 280, 'Sine.easeOut', true);
  cam.zoomTo(1.3, 280, 'Sine.easeOut', true);
  scene.time.delayedCall(950, () => {
    cam.pan(scene.scale.width / 2, scene.scale.height / 2, 420, 'Sine.easeInOut', true);
    cam.zoomTo(1, 420, 'Sine.easeInOut', true);
  });
}

// إبطاء زمني وجيز (لحظة التصدي)
export function slowMo(scene: Phaser.Scene, scale = 0.45, ms = 220): void {
  scene.time.timeScale = scale;
  scene.tweens.timeScale = scale;
  scene.physics.world.timeScale = 1 / scale;
  scene.time.delayedCall(ms * scale, () => {
    scene.time.timeScale = 1;
    scene.tweens.timeScale = 1;
    scene.physics.world.timeScale = 1;
  });
}
