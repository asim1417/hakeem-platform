// CameraDirector — زوم الهدف، دفعة الركلة، الإبطاء، وانتقالات fade بين المشاهد

import Phaser from 'phaser';

// انتقال ناعم بين المشاهد (fadeOut ثم start) — يقابله fadeIn في create كل مشهد
export function go(scene: Phaser.Scene, key: string, data?: object): void {
  const cam = scene.cameras.main;
  cam.fadeOut(180, 7, 17, 31);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(220, 7, 17, 31);
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
