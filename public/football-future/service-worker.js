const CACHE_NAME = "football-future-static-v3";
const ASSETS = [
  "/football-future/",
  "/football-future/index.html",
  "/football-future/manifest.webmanifest",
  "/football-future/src/css/tokens.css",
  "/football-future/src/css/styles.css",
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
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
