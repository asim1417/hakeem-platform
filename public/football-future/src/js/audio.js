(function () {
  "use strict";

  const STORE_KEY = "football-future-audio-v2";
  const DEFAULTS = { muted: false, voice: true, sfx: true, volume: 0.78, voiceRate: 1.04, voicePitch: 1.05 };

  const SFX_FILES = {
    click: "/football-future/src/assets/audio/sfx/click.wav", nav: "/football-future/src/assets/audio/sfx/nav.wav", pass: "/football-future/src/assets/audio/sfx/pass.wav",
    shoot: "/football-future/src/assets/audio/sfx/shoot.wav", skill: "/football-future/src/assets/audio/sfx/skill.wav", tackle: "/football-future/src/assets/audio/sfx/tackle.wav",
    goal: "/football-future/src/assets/audio/sfx/goal.wav", reward: "/football-future/src/assets/audio/sfx/reward.wav", error: "/football-future/src/assets/audio/sfx/error.wav",
    whistle: "/football-future/src/assets/audio/sfx/whistle.wav", crowd: "/football-future/src/assets/audio/sfx/crowd.wav", end: "/football-future/src/assets/audio/sfx/end.wav"
  };
  const filePool = {};

  function playFile(kind) {
    if (settings.muted || !settings.sfx || !SFX_FILES[kind]) return false;
    try {
      const src = SFX_FILES[kind];
      if (!filePool[kind]) {
        filePool[kind] = Array.from({ length: 3 }, () => { const a = new Audio(src); a.preload = "auto"; return a; });
      }
      const audio = filePool[kind].find(a => a.paused || a.ended) || filePool[kind][0];
      audio.currentTime = 0;
      audio.volume = Math.min(1, Math.max(0, settings.volume));
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      return true;
    } catch { return false; }
  }
  const PHRASES = {
    welcome: "مرحبًا بك في فوتبول فيوتشر. استعد للعب والتطور والانتصار.",
    home: "هذه الشاشة الرئيسية. اختر المباراة أو طور فريقك.",
    startMatch: "صافرة البداية. العب بذكاء يا بطل.",
    goalHome: "هدف رائع لفريق فيوتشر! ممتاز يا بطل.",
    goalAway: "هدف للخصم. لا تستسلم وارجع للمباراة.",
    pass: "تمريرة ذكية.",
    shoot: "تسديدة قوية.",
    skill: "مراوغة رائعة.",
    tackle: "افتكاك ناجح.",
    reward: "تم استلام المكافأة.",
    pack: "تم فتح الباقة وإضافة العملات.",
    error: "تنبيه. لا يمكن تنفيذ هذا الآن.",
    win: "نهاية المباراة. أداء ممتاز وتقدم جديد.",
    settings: "من هنا يمكنك ضبط الصوت والتحكم والخصوصية.",
    audioTest: "اختبار الصوت العربي يعمل بنجاح.",
    training: "ابدأ التدريب لتطوير المهارات.",
    academy: "رحلة الأكاديمية تنقلك من لاعب ناشئ إلى نجم المستقبل.",
    social: "تواصل آمن وردود جاهزة مناسبة للأطفال.",
    leaderboard: "تابع ترتيبك وتقدمك بين اللاعبين.",
    events: "الأحداث الموسمية تمنحك تحديات ومكافآت جديدة.",
    notifications: "هذه الرسائل والتنبيهات المهمة.",
    rewards: "كل إنجاز يقربك من مكافأة جديدة.",
    kickoff: "صافرة البداية، فيوتشر يبدأ المباراة.",
    fulltime: "نهاية المباراة، أداء جميل وتطور واضح.",
    sprint: "انطلاقة سريعة نحو المساحة.",
    commentatorReady: "المعلق العربي جاهز، استمتع بالمباراة."
  };

  let ctx = null;
  let master = null;
  let lastSpeechAt = 0;
  let settings = loadSettings();

  function loadSettings() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; }
    catch { return { ...DEFAULTS }; }
  }

  function saveSettings() { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); }

  function ensureContext() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = settings.volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, duration, type, gain, when, destination) {
    const ac = ensureContext();
    if (!ac || settings.muted || !settings.sfx) return;
    const start = when == null ? ac.currentTime : when;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.08), start + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(destination || master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function noise(duration, gain, when) {
    const ac = ensureContext();
    if (!ac || settings.muted || !settings.sfx) return;
    const start = when == null ? ac.currentTime : when;
    const buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * duration)), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    const source = ac.createBufferSource();
    const amp = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 950;
    filter.Q.value = 0.8;
    amp.gain.setValueAtTime(gain || 0.08, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(start);
  }

  function play(kind) {
    playFile(kind);
    const ac = ensureContext();
    if (!ac || settings.muted || !settings.sfx) return;
    const t = ac.currentTime;
    const map = {
      click: () => { tone(660, .07, "triangle", .05, t); tone(990, .06, "sine", .025, t + .04); },
      nav: () => { tone(420, .06, "sine", .045, t); tone(720, .09, "triangle", .05, t + .05); },
      pass: () => { tone(520, .08, "square", .045, t); tone(780, .12, "triangle", .035, t + .06); },
      shoot: () => { noise(.16, .11, t); tone(140, .20, "sawtooth", .07, t); tone(520, .14, "triangle", .05, t + .08); },
      skill: () => { tone(760, .05, "sine", .055, t); tone(1040, .06, "sine", .05, t + .06); tone(1280, .08, "triangle", .045, t + .12); },
      tackle: () => { noise(.09, .08, t); tone(190, .08, "square", .06, t); },
      goal: () => { tone(523, .16, "triangle", .08, t); tone(659, .16, "triangle", .08, t + .16); tone(784, .24, "triangle", .09, t + .32); crowd(.9); },
      reward: () => { [0, .09, .18, .31].forEach((d, i) => tone([660, 880, 1046, 1320][i], .12, "sine", .055, t + d)); },
      error: () => { tone(240, .12, "sawtooth", .055, t); tone(180, .18, "sawtooth", .05, t + .1); },
      whistle: () => { tone(1750, .34, "sine", .06, t); tone(2100, .22, "sine", .04, t + .05); },
      end: () => { tone(392, .14, "triangle", .06, t); tone(523, .18, "triangle", .06, t + .14); tone(659, .22, "triangle", .06, t + .3); }
    };
    (map[kind] || map.click)();
  }

  function crowd(duration) {
    const ac = ensureContext();
    if (!ac || settings.muted || !settings.sfx) return;
    const start = ac.currentTime;
    for (let i = 0; i < 7; i += 1) {
      const d = duration * (0.35 + Math.random() * 0.65);
      noise(d, 0.025 + Math.random() * 0.025, start + Math.random() * 0.25);
      tone(240 + Math.random() * 280, d, "triangle", 0.012, start + Math.random() * 0.18);
    }
  }

  function getArabicVoice() {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    const voices = synth.getVoices ? synth.getVoices() : [];
    return voices.find(v => /^ar([-_]|$)/i.test(v.lang)) || voices.find(v => /arabic|عربي|ar-/i.test(`${v.name} ${v.lang}`)) || null;
  }

  function speak(keyOrText, options) {
    if (settings.muted || !settings.voice || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
    const now = Date.now();
    if (!options?.force && now - lastSpeechAt < 900) return false;
    lastSpeechAt = now;
    const text = PHRASES[keyOrText] || keyOrText;
    if (!text) return false;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ar-SA";
    utter.rate = options?.rate || settings.voiceRate;
    utter.pitch = options?.pitch || settings.voicePitch;
    utter.volume = Math.min(1, Math.max(0, settings.volume));
    const voice = getArabicVoice();
    if (voice) utter.voice = voice;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      return true;
    } catch { return false; }
  }

  function announce(key, sfx) { play(sfx || key); speak(key); }

  function screen(screenId) {
    const map = { home: "home", settings: "settings", training: "training", academy: "academy", social: "social", leaderboard: "leaderboard", events: "events", notifications: "notifications", rewards: "rewards" };
    if (map[screenId]) speak(map[screenId]);
  }

  function toggleMute() {
    settings.muted = !settings.muted;
    saveSettings();
    if (!settings.muted) { play("reward"); speak("audioTest", { force: true }); }
    return settings.muted;
  }

  function setVolume(value) {
    settings.volume = Math.min(1, Math.max(0, Number(value) || DEFAULTS.volume));
    if (master) master.gain.value = settings.volume;
    saveSettings();
  }

  ["pointerdown", "touchstart", "keydown"].forEach((evt) => {
    window.addEventListener(evt, ensureContext, { once: true, passive: true });
  });
  if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = () => getArabicVoice();

  /* ── هدير الجمهور المحيطي التفاعلي ──
     يفضّل عيّنة استاد حقيقية محلقة (ambience.wav) فور فك ترميزها،
     مع بدء فوري بمولّد الضجيج الوردي ريثما تُحمَّل — وسقوط كامل عليه إن تعذّرت. */
  let crowdRig = null;
  const CROWD_BASE = 0.016;
  const AMB_URL = "/football-future/src/assets/audio/sfx/ambience.wav";
  let ambBuffer = null, ambLoading = null;
  function loadAmbience(ac) {
    if (ambBuffer || ambLoading) return ambLoading;
    ambLoading = fetch(AMB_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("http"))))
      .then((buf) => ac.decodeAudioData(buf))
      .then((decoded) => { ambBuffer = decoded; return decoded; })
      .catch(() => { ambLoading = null; return null; });
    return ambLoading;
  }
  function makeSynthSource(ac) {
    const dur = 2.5;
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      // ضجيج وردي مبسّط (أدفأ من الأبيض) لهدير جماهيري
      const white = Math.random() * 2 - 1;
      last = last * 0.94 + white * 0.06;
      data[i] = last * 3.2;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass"; filter.frequency.value = 420; filter.Q.value = 0.5;
    src.connect(filter);
    return { src, out: filter };
  }
  function makeAmbSource(ac) {
    const src = ac.createBufferSource();
    src.buffer = ambBuffer; src.loop = true;
    const comp = ac.createGain();
    comp.gain.value = 1.5; // العيّنة أدفأ طيفياً من المولّد — معادلة مستوى
    src.connect(comp);
    return { src, out: comp };
  }
  function crowdStart() {
    if (crowdRig || settings.muted || !settings.sfx) return;
    const ac = ensureContext();
    if (!ac) return;
    const gain = ac.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master);
    const piece = ambBuffer ? makeAmbSource(ac) : makeSynthSource(ac);
    piece.out.connect(gain);
    piece.src.start();
    gain.gain.setTargetAtTime(CROWD_BASE, ac.currentTime, 0.8);
    // تموّج طبيعي بطيء
    const timer = window.setInterval(() => {
      if (!crowdRig) return;
      const target = CROWD_BASE * (0.75 + Math.random() * 0.6);
      crowdRig.gain.gain.setTargetAtTime(target, ac.currentTime, 1.4);
    }, 2600);
    crowdRig = { src: piece.src, gain, timer, isFile: !!ambBuffer };
    if (!ambBuffer) {
      // بدّل للهدير الحقيقي فور جاهزيته — بتلاشٍ متقاطع قصير
      loadAmbience(ac).then((decoded) => {
        if (!decoded || !crowdRig || crowdRig.isFile) return;
        const old = crowdRig.src;
        const real = makeAmbSource(ac);
        real.out.connect(crowdRig.gain);
        real.src.start();
        crowdRig.src = real.src; crowdRig.isFile = true;
        window.setTimeout(() => { try { old.stop(); } catch {} }, 700);
      });
    }
  }
  function crowdSwell(level, hold) {
    if (!crowdRig || settings.muted || !settings.sfx) return;
    const ac = ensureContext();
    const g = crowdRig.gain.gain;
    g.cancelScheduledValues(ac.currentTime);
    g.setTargetAtTime(level, ac.currentTime, 0.06);
    g.setTargetAtTime(CROWD_BASE, ac.currentTime + (hold || 0.7), 0.9);
  }
  function crowdStop() {
    if (!crowdRig) return;
    try {
      window.clearInterval(crowdRig.timer);
      crowdRig.gain.gain.setTargetAtTime(0.0001, (ctx || {}).currentTime || 0, 0.3);
      const src = crowdRig.src;
      window.setTimeout(() => { try { src.stop(); } catch {} }, 900);
    } catch {}
    crowdRig = null;
  }

  window.FFAudio = { play, speak, announce, screen, toggleMute, setVolume, crowdStart, crowdSwell, crowdStop, settings: () => ({ ...settings }), phrases: { ...PHRASES } };
})();
