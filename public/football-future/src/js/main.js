(function () {
  "use strict";

  const STORAGE_KEY = "football-future-state-v1";
  const root = document.getElementById("app");
  let currentEngine = null;
  let deferredInstallPrompt = null;

  const defaultState = {
    screen: "home",
    coins: 12450,
    gems: 1250,
    player: { name: "علي", level: 12, rating: 89, xp: 850, nextXp: 1500 },
    stats: { wins: 24, matches: 39, goals: 76 },
    missions: JSON.parse(JSON.stringify(window.FF_DATA.missions)),
    lastMatch: { score: { home: 0, away: 0 }, stats: { shots: 0, passes: 0, tackles: 0, goals: 0 }, result: "win" },
    audio: { muted: false, voice: true, sfx: true }
  };

  let state = loadState();

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return structuredClone(defaultState);
      return { ...structuredClone(defaultState), ...JSON.parse(stored) };
    } catch (error) {
      console.warn("State reset because stored data is invalid", error);
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render(screen) {
    cleanupEngine();
    state.screen = screen || state.screen || "home";
    saveState();
    const renderer = window.FFUI[state.screen] || window.FFUI.notFound;
    root.innerHTML = renderer(state);
    bindScreen();
    if (state.screen === "liveMatch") setupMatch();
    else { window.FFAudio?.screen(state.screen); window.FFCommentary?.screen?.(state.screen); }
    document.title = `${window.FF_DATA.app.nameAr} · ${state.screen}`;
  }

  function bindScreen() {
    root.querySelectorAll("[data-route]").forEach((el) => {
      el.addEventListener("click", (event) => {
        const route = event.currentTarget.getAttribute("data-route");
        if (route) { window.FFAudio?.play("nav"); render(route); }
      });
    });

    root.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", (event) => {
        const action = event.currentTarget.getAttribute("data-action");
        if (action === "claimMissions") claimMissions();
        if (action === "buyPack") buyPack(Number(event.currentTarget.getAttribute("data-price")) || 0);
        if (action === "toggleAudio") toggleAudio();
        if (action === "testArabicVoice") { window.FFAudio?.play("reward"); window.FFAudio?.speak("audioTest", { force: true }); toast("تم تشغيل اختبار الصوت العربي."); }
      });
    });
  }

  function claimMissions() {
    let earned = 0;
    state.missions = state.missions.map((mission) => {
      if (mission.progress >= mission.target && !mission.claimed) {
        earned += mission.reward;
        return { ...mission, claimed: true };
      }
      return mission;
    });
    if (earned > 0) {
      state.player.xp += earned;
      while (state.player.xp >= state.player.nextXp) {
        state.player.xp -= state.player.nextXp;
        state.player.level += 1;
        state.player.nextXp += 250;
      }
      window.FFAudio?.announce("reward", "reward");
      toast(`تم استلام ${earned} XP`);
    } else {
      window.FFAudio?.announce("error", "error");
      toast("لا توجد مكافآت مكتملة غير مستلمة الآن.");
    }
    saveState();
    render("missions");
  }

  function buyPack(price) {
    if (state.gems < price) {
      window.FFAudio?.announce("error", "error");
      toast("الجواهر غير كافية في النموذج التجريبي.");
      return;
    }
    state.gems -= price;
    state.coins += 250;
    window.FFAudio?.announce("pack", "reward");
    toast("تم فتح الباقة التجريبية وإضافة 250 عملة.");
    saveState();
    render("shop");
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 2600);
  }

  function toggleAudio() {
    const muted = window.FFAudio?.toggleMute?.();
    state.audio.muted = Boolean(muted);
    saveState();
    toast(muted ? "تم كتم الصوت." : "تم تفعيل الصوت العربي والمؤثرات.");
  }

  function cleanupEngine() {
    if (currentEngine) {
      currentEngine.destroy();
      currentEngine = null;
    }
  }

  function setupMatch() {
    const canvas = document.getElementById("matchCanvas");
    if (!canvas) return;
    const scoreHome = document.getElementById("scoreHome");
    const scoreAway = document.getElementById("scoreAway");
    const matchTime = document.getElementById("matchTime");
    const summaryOverlay = document.getElementById("summaryOverlay");

    currentEngine = new window.FootballFutureEngine(canvas, {
      onEvent(event) {
        if (event.type === "goal") {
          window.FFCommentary?.goal?.(event.team);
        }
      },
      onEnd(result) {
        const line = document.getElementById("commentaryLine");
        if (line) line.hidden = true;
        state.lastMatch = result;
        state.stats.matches += 1;
        state.stats.goals += result.stats.goals;
        if (result.result === "win") state.stats.wins += 1;
        updateMissionsAfterMatch(result);
        saveState();
        window.FFCommentary?.fulltime?.(result);
        summaryOverlay.innerHTML = `<div class="match-summary"><div class="summary-card"><h2>نهاية المباراة</h2><div class="stats-row"><div class="stat"><b>${result.score.home}-${result.score.away}</b><span>النتيجة</span></div><div class="stat"><b>${result.stats.shots}</b><span>تسديدات</span></div><div class="stat"><b>${result.stats.passes}</b><span>تمريرات</span></div></div><div class="cta-row"><button class="btn" data-route="preMatch" type="button">إعادة المباراة</button><button class="btn secondary" data-route="missions" type="button">المكافآت</button><button class="btn ghost" data-route="home" type="button">الرئيسية</button></div></div></div>`;
        bindScreen();
      }
    });

    const interval = window.setInterval(() => {
      if (!currentEngine) { window.clearInterval(interval); return; }
      window.FFCommentary?.tick?.(currentEngine);
      scoreHome.textContent = String(currentEngine.score.home);
      scoreAway.textContent = String(currentEngine.score.away);
      matchTime.textContent = currentEngine.getTimeText();
      const stam = document.getElementById("staminaBar");
      if (stam && currentEngine.controlled) stam.style.width = currentEngine.controlled.stamina + "%";
      drawMiniMap(currentEngine);
    }, 200);

    setupJoystick(currentEngine);
    setupActionButtons(currentEngine);
    window.FFCommentary?.kickoff?.();
    currentEngine.start();
  }

  function updateMissionsAfterMatch(result) {
    state.missions = state.missions.map((mission) => {
      if (mission.id === "m1") return { ...mission, progress: Math.min(mission.target, mission.progress + result.stats.goals) };
      if (mission.id === "m2" && result.result === "win") return { ...mission, progress: Math.min(mission.target, mission.progress + 1) };
      if (mission.id === "m3") return { ...mission, progress: Math.min(mission.target, mission.progress + result.stats.passes) };
      return mission;
    });
  }

  function setupJoystick(engine) {
    const joystick = document.getElementById("joystick");
    const knob = document.getElementById("joystickKnob");
    if (!joystick || !knob) return;
    const radius = 48;

    function reset() {
      knob.style.transform = "translate(0px, 0px)";
      engine.setInput({ x: 0, y: 0 });
    }

    joystick.addEventListener("pointerdown", (event) => {
      joystick.setPointerCapture(event.pointerId);
      move(event);
    });
    joystick.addEventListener("pointermove", move);
    joystick.addEventListener("pointerup", reset);
    joystick.addEventListener("pointercancel", reset);

    function move(event) {
      if (event.buttons === 0 && event.type !== "pointerdown") return;
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      if (d > radius) { dx = dx / d * radius; dy = dy / d * radius; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      engine.setInput({ x: dx / radius, y: dy / radius });
    }
  }

  function setupActionButtons(engine) {
    root.querySelectorAll("[data-game-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const gameAction = button.getAttribute("data-game-action");
        engine.action(gameAction);
        window.FFCommentary?.action?.(gameAction);
      });
    });
    const sprint = document.getElementById("sprintButton");
    if (sprint) {
      const start = () => { engine.setInput({ sprint: true }); window.FFCommentary?.action?.("sprint"); };
      const end = () => engine.setInput({ sprint: false });
      sprint.addEventListener("pointerdown", start);
      sprint.addEventListener("pointerup", end);
      sprint.addEventListener("pointerleave", end);
      sprint.addEventListener("pointercancel", end);
    }
  }

  function drawMiniMap(engine) {
    const mini = document.getElementById("minimap");
    if (!mini || !engine) return;
    const ctx = mini.getContext("2d");
    ctx.clearRect(0, 0, mini.width, mini.height);
    ctx.fillStyle = "rgba(11,15,20,.8)"; ctx.fillRect(0, 0, mini.width, mini.height);
    ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.strokeRect(6, 6, mini.width - 12, mini.height - 12);
    ctx.beginPath(); ctx.moveTo(mini.width / 2, 6); ctx.lineTo(mini.width / 2, mini.height - 6); ctx.stroke();
    const sx = (mini.width - 12) / engine.pitch.w;
    const sy = (mini.height - 12) / engine.pitch.h;
    function dot(p, color, r) { ctx.beginPath(); ctx.arc(6 + p.x * sx, 6 + p.y * sy, r || 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    engine.home.forEach(p => dot(p, p.user ? "#C6FF00" : p.role === "GK" ? "#FFD23F" : "#00E5FF", p.user ? 4.5 : 3));
    engine.away.forEach(p => dot(p, p.role === "GK" ? "#FF8DA0" : "#FF5A5F", 3));
    dot(engine.ball, "#FFFFFF", 3.5);
  }

  function installPromptSetup() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      const banner = document.getElementById("installBanner");
      if (banner) banner.classList.add("show");
    });
    document.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.id === "installNow" && deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        document.getElementById("installBanner")?.classList.remove("show");
      }
      if (target.id === "dismissInstall") {
        document.getElementById("installBanner")?.classList.remove("show");
      }
    });
  }

  function serviceWorkerSetup() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("/football-future/service-worker.js", { scope: "/football-future/" }).catch((error) => console.warn("Service worker registration failed", error));
    }
  }

  window.addEventListener("hashchange", () => {
    const target = location.hash.replace("#", "");
    if (target) render(target);
  });

  installPromptSetup();
  serviceWorkerSetup();
  render(location.hash.replace("#", "") || state.screen || "home");

  // إخفاء شاشة الإقلاع بعد اكتمال أول رسم وتحميل الخطوط
  const splash = document.getElementById("ffSplash");
  if (splash) {
    const hide = () => { splash.classList.add("hide"); window.setTimeout(() => splash.remove(), 600); };
    const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([ready, new Promise(r => window.setTimeout(r, 1800))])
      .then(() => window.setTimeout(hide, 1100));
  }
})();
