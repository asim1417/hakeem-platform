(function () {
  "use strict";

  const STORE_KEY = "football-future-commentary-v3";
  const BANK = {
    kickoff: ["صافرة البداية، فيوتشر يبدأ المباراة.", "انطلقت المباراة، ركز في التمرير واصنع المساحة.", "بداية قوية منتظرة من فريق فيوتشر."],
    pass: ["تمريرة ذكية في المساحة.", "لعبة جماعية جميلة.", "تمرير سريع يحرك الدفاع."],
    shoot: ["تسديدة قوية نحو المرمى!", "محاولة خطيرة من فيوتشر.", "سددها بقوة، والحارس يترقب."],
    skill: ["مراوغة رائعة يا بطل.", "مهارة جميلة وتجاوز ناجح.", "لمسة فنية تغير اتجاه اللعب."],
    tackle: ["افتكاك ممتاز للكرة.", "ضغط قوي واستعادة ناجحة.", "دفاع ذكي في الوقت المناسب."],
    sprint: ["انطلاقة سريعة على الطرف.", "سرعة ممتازة نحو المساحة.", "ارفع الإيقاع واستغل المساحة."],
    goalHome: ["هدف! هدف رائع لفيوتشر، تسديدة لا تصد ولا ترد.", "يا سلام! فيوتشر يتقدم بهدف جميل.", "هدف مستحق بعد هجمة منظمة."],
    goalAway: ["هدف للخصم، لا تستسلم فالوقت ما زال متاحًا.", "النمور يسجلون، وفيوتشر يحتاج إلى رد سريع.", "هدف مباغت للخصم، التركيز الآن أهم."],
    fulltime: ["نهاية المباراة، أداء جميل وتطور واضح.", "انتهت المباراة، راجع الإحصائيات وطوّر فريقك.", "صافرة النهاية، استلم مكافآتك واستعد للتحدي القادم."],
    home: ["من الشاشة الرئيسية يمكنك اللعب أو تطوير فريقك."],
    team: ["رتب تشكيلتك واختر اللاعبين الأفضل للمباراة."],
    missions: ["أكمل المهام لتحصل على نقاط خبرة ومكافآت."],
    shop: ["المتجر التجريبي يعرض الباقات والعناصر بأمان."],
    training: ["التدريب يرفع مهارات التسديد والتمرير والمراوغة."],
    academy: ["الأكاديمية تقود اللاعب من مبتدئ إلى نجم المستقبل."],
    social: ["المجتمع الآمن يستخدم رسائل وردود مناسبة للأطفال."],
    leaderboard: ["تابع ترتيبك وتقدمك بين اللاعبين."],
    rewards: ["استلم المكافآت وواصل تطوير لاعبك."],
    notifications: ["هنا تظهر التنبيهات والرسائل المهمة."],
    settings: ["من الإعدادات يمكنك تشغيل التعليق العربي والمؤثرات."],
    timePressure: ["الدقائق الأخيرة، استغل كل فرصة."],
    stamina: ["راقب اللياقة، الركض المستمر يستهلك طاقة اللاعب."],
    possession: ["استحواذ جيد، ابحث عن تمريرة آمنة."],
    comeback: ["العودة ممكنة، هدف واحد يغير المباراة."],
    lead: ["فيوتشر متقدم، حافظ على التركيز حتى النهاية."]
  };

  let settings = loadSettings();
  let lastAt = 0;
  let lastTickAt = 0;
  let lastScore = "0-0";

  function loadSettings() {
    try { return { enabled: true, cooldownMs: 2800, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; }
    catch { return { enabled: true, cooldownMs: 2800 }; }
  }
  function saveSettings() { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); }
  function pick(key) { const arr = BANK[key] || [key]; return arr[Math.floor(Math.random() * arr.length)]; }
  function output(text) {
    const line = document.getElementById("commentaryLine");
    if (line) line.textContent = text;
  }
  function say(key, opts) {
    if (!settings.enabled) return false;
    const now = Date.now();
    if (!opts?.force && now - lastAt < settings.cooldownMs) return false;
    lastAt = now;
    const phrase = opts?.text || pick(key);
    output(phrase);
    window.FFAudio?.speak?.(phrase, { force: Boolean(opts?.force), rate: opts?.rate || 1.06, pitch: opts?.pitch || 1.05 });
    return true;
  }
  function sfx(kind) { window.FFAudio?.play?.(kind); }
  function action(kind) {
    const map = { pass: "pass", shoot: "shoot", skill: "skill", tackle: "tackle", sprint: "sprint" };
    if (map[kind]) { sfx(kind === "sprint" ? "nav" : kind); say(map[kind]); }
  }
  function goal(team) { const key = team === "home" ? "goalHome" : "goalAway"; sfx("goal"); say(key, { force: true, rate: 1.08 }); }
  function kickoff() { sfx("whistle"); say("kickoff", { force: true }); }
  function fulltime(result) { sfx("end"); say("fulltime", { force: true }); }
  function screen(id) { if (BANK[id]) say(id, { force: false }); }
  function tick(engine) {
    if (!engine || !settings.enabled) return;
    const now = Date.now();
    if (now - lastTickAt < 16000) return;
    lastTickAt = now;
    const score = `${engine.score.home}-${engine.score.away}`;
    if (score !== lastScore) { lastScore = score; return; }
    const remaining = Math.max(0, engine.duration - engine.clock);
    if (remaining < 28) return say("timePressure");
    if (engine.controlled && engine.controlled.stamina < 35) return say("stamina");
    if (engine.ball && engine.ball.owner && String(engine.ball.owner.id).startsWith("h")) return say("possession");
    if (engine.score.home < engine.score.away) return say("comeback");
    if (engine.score.home > engine.score.away) return say("lead");
  }
  function toggle() { settings.enabled = !settings.enabled; saveSettings(); if (settings.enabled) say("settings", { force: true }); return settings.enabled; }

  window.FFCommentary = { say, action, goal, kickoff, fulltime, screen, tick, toggle, bank: BANK, settings: () => ({ ...settings }) };
})();
