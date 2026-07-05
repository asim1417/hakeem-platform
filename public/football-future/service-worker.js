const CACHE_NAME = "football-future-static-v10";
const ASSETS = [
  "/football-future/",
  "/football-future/index.html",
  "/football-future/manifest.webmanifest",
  "/football-future/src/css/tokens.css",
  "/football-future/src/css/fonts.css",
  "/football-future/src/assets/fonts/noto-kufi-arabic-var-arabic.woff2",
  "/football-future/src/assets/fonts/noto-kufi-arabic-var-latin.woff2",
  "/football-future/src/assets/fonts/rajdhani-700-latin.woff2",
  "/football-future/src/css/styles.css",
  "/football-future/src/js/icons.js",
  "/football-future/src/js/audio.js",
  "/football-future/src/assets/audio/voice_ar_manifest.json",
  "/football-future/src/assets/audio/README_AUDIO_AR.md",
  "/football-future/src/js/data.js",
  "/football-future/src/js/ui.js",
  "/football-future/src/js/game-engine.js",
  "/football-future/src/js/main.js",
  "/football-future/src/assets/logo.svg",
  "/football-future/src/assets/icon.svg",
  "/football-future/src/assets/field.svg",
  "/football-future/src/js/commentary.js",
  "/football-future/src/assets/audio/commentary_bank_ar.json",
  "/football-future/src/assets/audio/sfx/click.wav",
  "/football-future/src/assets/audio/sfx/crowd.wav",
  "/football-future/src/assets/audio/sfx/end.wav",
  "/football-future/src/assets/audio/sfx/error.wav",
  "/football-future/src/assets/audio/sfx/goal.wav",
  "/football-future/src/assets/audio/sfx/nav.wav",
  "/football-future/src/assets/audio/sfx/pass.wav",
  "/football-future/src/assets/audio/sfx/reward.wav",
  "/football-future/src/assets/audio/sfx/shoot.wav",
  "/football-future/src/assets/audio/sfx/skill.wav",
  "/football-future/src/assets/audio/sfx/tackle.wav",
  "/football-future/src/assets/audio/sfx/whistle.wav",
];

self.addEventListener("install", event => {
  // الاستيلاء الفوري: لا نسخة «منتظرة» قد تخلط إصداراً قديماً بجديد
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
    ])
  );
});

/* استراتيجية منع تداخل الإصدارات:
   - HTML/JS/CSS: الشبكة أولاً (نسخة واحدة متسقة دائماً عند الاتصال)
     مع سقوط للكاش دون اتصال.
   - الخطوط/الأصوات/الصور: الكاش أولاً (ثقيلة ونادرة التغيير). */
const NETWORK_FIRST = /\.(?:html|js|css|webmanifest)$/;

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNav = request.mode === "navigate";
  const isCore = isNav || NETWORK_FIRST.test(url.pathname) || url.pathname === "/football-future/";

  if (isCore) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match("/football-future/index.html"))
        )
    );
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
