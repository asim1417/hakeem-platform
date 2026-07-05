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
    difficulty: 1,
    custom: { name: "علي", number: 10, accent: "lime" },
    owned: [],
    cup: null,
    matchContext: "quick",
    currentOpp: { ar: "النمور", code: "NMO" },
    audio: { muted: false, voice: true, sfx: true }
  };

  let state = loadState();
  const ACCENTS = { lime: "#C6FF00", cyan: "#00E5FF", teal: "#00BFAE", gold: "#FFD34D" };
  const CUP_ROUNDS = ["ربع النهائي", "نصف النهائي", "النهائي"];
  const CUP_DIFF = [0.85, 1.0, 1.2];

  function newCup() {
    const pool = [...window.FF_DATA.opponents].sort(() => Math.random() - 0.5).slice(0, 3);
    return { round: 0, opps: pool, results: [], done: false, won: false };
  }

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

    root.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("change", (event) => {
        const field = event.currentTarget.getAttribute("data-field");
        if (field === "custName") {
          const v = String(event.currentTarget.value || "").trim().slice(0, 12);
          state.custom.name = v || "علي";
          saveState(); toast("حُفظ اسم اللاعب: " + state.custom.name);
        }
      });
    });

    root.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", (event) => {
        const action = event.currentTarget.getAttribute("data-action");
        if (action === "claimMissions") claimMissions();
        if (action === "buyPack") buyPack(Number(event.currentTarget.getAttribute("data-price")) || 0);
        if (action === "toggleAudio") toggleAudio();
        if (action === "testArabicVoice") { window.FFAudio?.play("reward"); window.FFAudio?.speak("audioTest", { force: true }); toast("تم تشغيل اختبار الصوت العربي."); }
        if (action === "setDifficulty") {
          state.difficulty = Number(event.currentTarget.getAttribute("data-diff")) || 1;
          saveState(); window.FFAudio?.play("click");
          render("preMatch");
        }
        if (action === "togglePause") togglePause();
        if (action === "resumeMatch") resumeMatch();
        if (action === "quickMatch") {
          const pool = window.FF_DATA.opponents;
          state.currentOpp = pool[Math.floor(Math.random() * pool.length)];
          state.matchContext = "quick";
          saveState(); render("preMatch");
        }
        if (action === "playCup") {
          if (!state.cup || state.cup.done) state.cup = newCup();
          state.currentOpp = state.cup.opps[state.cup.round];
          state.difficulty = CUP_DIFF[state.cup.round];
          state.matchContext = "cup";
          saveState(); render("preMatch");
        }
        if (action === "newCup") { state.cup = newCup(); saveState(); render("tournaments"); }
        if (action === "buyItem") buyItem(event.currentTarget.getAttribute("data-item"));
        if (action === "setNum") {
          state.custom.number = Number(event.currentTarget.getAttribute("data-num")) || 10;
          saveState(); window.FFAudio?.play("click"); render("profile");
        }
        if (action === "setAccent") {
          const a = event.currentTarget.getAttribute("data-accent");
          if (a === "gold" && !state.owned.includes("gold")) { toast("الطقم الذهبي يُشترى من المتجر أولاً."); return; }
          state.custom.accent = a;
          saveState(); window.FFAudio?.play("click"); render("profile");
        }
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

  function buyItem(id) {
    const item = (window.FF_DATA.shopItems || []).find((x) => x.id === id);
    if (!item) return;
    if (state.owned.includes(id)) { toast("تملك هذا العنصر بالفعل."); return; }
    if (state.coins < item.price) {
      window.FFAudio?.announce("error", "error");
      toast("عملاتك لا تكفي — اِلعب مباريات واجمع المزيد!");
      return;
    }
    state.coins -= item.price;
    state.owned.push(id);
    if (id === "gold") state.custom.accent = "gold";
    window.FFAudio?.announce("pack", "reward");
    toast("مبروك! حصلت على " + item.ar);
    saveState();
    render("shop");
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
    window.FFAudio?.crowdStop?.();
  }

  function setupMatch() {
    const canvas = document.getElementById("matchCanvas");
    if (!canvas) return;
    const scoreHome = document.getElementById("scoreHome");
    const scoreAway = document.getElementById("scoreAway");
    const matchTime = document.getElementById("matchTime");
    const summaryOverlay = document.getElementById("summaryOverlay");

    currentEngine = new window.FootballFutureEngine(canvas, {
      difficulty: state.difficulty || 1,
      playerName: state.custom?.name,
      playerNumber: state.custom?.number,
      kitAccent: ACCENTS[state.custom?.accent] || ACCENTS.lime,
      captain: state.owned?.includes("captain"),
      ballTrail: state.owned?.includes("goldball") ? "#FFD34D" : null,
      onEvent(event) {
        if (event.type === "goal") {
          window.FFAudio?.crowdSwell?.(0.13, 1.6);
          window.FFCommentary?.goal?.(event.team);
        }
        if (event.type === "shot") window.FFAudio?.crowdSwell?.(0.05);
        if (event.type === "save") window.FFAudio?.crowdSwell?.(0.075);
        if (event.type === "restart" && event.kind === "corner") window.FFAudio?.crowdSwell?.(0.05);
      },
      onEnd(result) {
        const line = document.getElementById("commentaryLine");
        if (line) line.hidden = true;
        state.lastMatch = result;
        state.stats.matches += 1;
        state.stats.goals += result.stats.goals;
        if (result.result === "win") state.stats.wins += 1;
        updateMissionsAfterMatch(result);

        // الاقتصاد: عملات وخبرة حسب النتيجة والأهداف
        const win = result.result === "win", draw = result.result === "draw";
        let coins = (win ? 120 : draw ? 50 : 25) + result.stats.goals * 10;
        let xp = (win ? 70 : draw ? 35 : 20) + result.stats.goals * 5;

        // منطق كأس المستقبل
        let cupHtml = "";
        let nextBtn = "";
        if (state.matchContext === "cup" && state.cup && !state.cup.done) {
          state.cup.results[state.cup.round] = [result.score.home, result.score.away];
          if (win) {
            if (state.cup.round === 2) {
              state.cup.done = true; state.cup.won = true;
              state.stats.cups = (state.stats.cups || 0) + 1;
              coins += 500; xp += 250;
              cupHtml = `<p class="cup-note win">🏆 أنت بطل كأس المستقبل! +500 عملة إضافية</p>`;
            } else {
              state.cup.round += 1;
              coins += 100; xp += 60;
              cupHtml = `<p class="cup-note">تأهلت إلى ${CUP_ROUNDS[state.cup.round]}!</p>`;
              nextBtn = `<button class="btn" data-action="playCup" type="button">الدور التالي ◀</button>`;
            }
          } else if (draw) {
            // التعادل في الإقصائيات: تُعاد المباراة — لا إقصاء بالتعادل
            state.cup.results[state.cup.round] = null;
            cupHtml = `<p class="cup-note">تعادل — أعد المباراة لتحسم التأهل!</p>`;
            nextBtn = `<button class="btn" data-action="playCup" type="button">إعادة المباراة ◀</button>`;
          } else {
            state.cup.done = true; state.cup.won = false;
            cupHtml = `<p class="cup-note">انتهى مشوار الكأس — حاول من جديد، البطولة تنتظرك.</p>`;
          }
        }

        state.coins += coins;
        state.player.xp += xp;
        while (state.player.xp >= state.player.nextXp) {
          state.player.xp -= state.player.nextXp;
          state.player.level += 1;
          state.player.nextXp += 250;
        }
        saveState();
        window.FFCommentary?.fulltime?.(result);
        const title = win ? "فوز رائع!" : draw ? "تعادل مثير" : "مباراة قوية";
        summaryOverlay.innerHTML = `<div class="match-summary"><div class="summary-card"><h2>${title}</h2><div class="stats-row"><div class="stat"><b>${result.score.home}-${result.score.away}</b><span>النتيجة</span></div><div class="stat"><b>${result.stats.shots}</b><span>تسديدات</span></div><div class="stat"><b>${result.stats.passes}</b><span>تمريرات</span></div></div>${cupHtml}<div class="reward-row"><span class="reward-pill">+${coins} عملة</span><span class="reward-pill xp">+${xp} XP</span></div><div class="cta-row">${nextBtn || '<button class="btn" data-action="quickMatch" type="button">مباراة أخرى</button>'}<button class="btn secondary" data-route="missions" type="button">المهام</button><button class="btn ghost" data-route="home" type="button">الرئيسية</button></div></div></div>`;
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
    window.FFAudio?.crowdStart?.();
    currentEngine.start();
  }

  /* ── إيقاف مؤقت حقيقي ── */
  function togglePause() {
    if (!currentEngine || currentEngine.finished) return;
    currentEngine.stop();
    const hud = document.querySelector(".match-hud");
    if (!hud || document.getElementById("pauseOverlay")) return;
    const node = document.createElement("div");
    node.id = "pauseOverlay";
    node.className = "match-summary";
    node.innerHTML = `<div class="summary-card" style="text-align:center">
      <h2>إيقاف مؤقت</h2>
      <p style="color:var(--ff-silver);margin:6px 0 16px">خذ نفسًا يا بطل — المباراة بانتظارك.</p>
      <div class="cta-row" style="justify-content:center">
        <button class="btn" data-action="resumeMatch" type="button">▶ استئناف</button>
        <button class="btn ghost" data-route="home" type="button">إنهاء المباراة</button>
      </div>
    </div>`;
    hud.appendChild(node);
    bindScreen();
  }
  function resumeMatch() {
    document.getElementById("pauseOverlay")?.remove();
    if (currentEngine && !currentEngine.finished) currentEngine.start();
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
