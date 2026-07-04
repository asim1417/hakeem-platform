/* ═══════════════════════════════════════════════════════════════════
   فوتبول فيوتشر — محرك المباراة v3.1
   مشهد استاد ليلي كامل: مدرجات وجمهور، كشافات، لوحات إعلانية متوهجة،
   لاعبون بتفاصيل وحراس مرمى وذكاء اصطناعي، مؤثرات أهداف واهتزاز كاميرا.
   API المتاح للتطبيق:
     new FootballFutureEngine(canvas, {onEvent, onEnd})
     .start() .stop() .destroy() .setInput() .action() .getTimeText()
     .score .clock .duration .pitch .home .away .ball .controlled
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── أبعاد العالم ── */
  const W = 1280, H = 800;          // مشهد الاستاد كاملاً
  const STAND = 78;                 // عمق المدرجات
  const FX = 132, FY = 132;         // بداية أرضية الملعب
  const FW = W - FX * 2, FH = H - FY * 2; // أرضية اللعب 1016×536
  const GOAL_W = 168;               // عرض فتحة المرمى
  const GOAL_TOP = H / 2 - GOAL_W / 2, GOAL_BOT = H / 2 + GOAL_W / 2;
  const PR = 15;                    // نصف قطر اللاعب
  const BR = 8;                     // نصف قطر الكرة

  const LIME = "#C6FF00", CYAN = "#00E5FF", TEAL = "#00BFAE";

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // عشوائي حتمي للجمهور (ثابت بين الإطارات)
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  /* التشكيلة 1-2-1-2 لكل فريق (حارس + 5) — نسب على أرضية اللعب */
  const FORM = [
    { role: "GK", fx: 0.035, fy: 0.50 },
    { role: "CB", fx: 0.16, fy: 0.50 },
    { role: "LB", fx: 0.30, fy: 0.20 },
    { role: "RB", fx: 0.30, fy: 0.80 },
    { role: "CM", fx: 0.46, fy: 0.50 },
    { role: "ST", fx: 0.68, fy: 0.50 }
  ];
  const HOME_NAMES = ["حارس", "سلمان", "تركي", "عمر", "فهد", "علي"];
  const AWAY_NAMES = ["N1", "N4", "N2", "N3", "N8", "N9"];
  const NUMS = [1, 4, 2, 3, 8, 10];

  class FootballFutureEngine {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.options = options || {};
      this.onEnd = this.options.onEnd || function () {};
      this.onEvent = this.options.onEvent || function () {};
      this.running = false;
      this.finished = false;
      this.last = 0;
      this.score = { home: 0, away: 0 };
      this.clock = 0;
      // شوطان × 90 ثانية — ‏?dur=N لتقصير المباراة لأغراض الفحص فقط
      this.duration = parseInt(new URLSearchParams(location.search).get("dur"), 10) || 180;
      this.half = 1;
      this.input = { x: 0, y: 0, sprint: false };
      this.stats = { shots: 0, passes: 0, tackles: 0, goals: 0, saves: 0 };
      this.pitch = { w: W, h: H, margin: FX };
      this.particles = [];
      this.trail = [];
      this.shake = 0;
      this.flash = 0;
      this.time = 0;
      this.freeze = 0;              // توقف قصير بعد الهدف
      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.resetWorld();
      this.resize = this.resize.bind(this);
      this.loop = this.loop.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      this.keys = {};
      window.addEventListener("resize", this.resize);
      window.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("keyup", this.onKeyUp);
      this.resize();
    }

    /* ─────────────── العالم ─────────────── */
    makeTeam(side) {
      // side=1: الفريق (يهاجم يميناً) / side=-1: الخصم (يهاجم يساراً)
      return FORM.map((f, i) => {
        const fx = side === 1 ? f.fx : 1 - f.fx;
        return {
          id: (side === 1 ? "h" : "a") + i,
          name: side === 1 ? HOME_NAMES[i] : AWAY_NAMES[i],
          num: NUMS[i], role: f.role, side,
          home: { x: FX + fx * FW, y: FY + f.fy * FH },
          x: FX + fx * FW, y: FY + f.fy * FH,
          vx: 0, vy: 0, face: side === 1 ? 0 : Math.PI,
          user: side === 1 && f.role === "ST",
          stamina: 100, cd: 0
        };
      });
    }

    resetWorld() {
      this.home = this.makeTeam(1);
      this.away = this.makeTeam(-1);
      this.all = this.home.concat(this.away);
      this.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, owner: null, lastKick: null, passTo: null, spin: 0 };
      this.controlled = this.home.find(p => p.user);
      this.kickoff("home");
      this.message = "اسحب للتحرك — مرّر وسدّد نحو المرمى الأيمن";
      this.messageTime = 3.2;
    }

    kickoff(concededBy) {
      for (const p of this.all) { p.x = p.home.x; p.y = p.home.y; p.vx = p.vy = 0; }
      const b = this.ball;
      b.x = W / 2; b.y = H / 2; b.vx = b.vy = 0; b.owner = null; b.lastKick = null; b.passTo = null;
      const starter = concededBy === "away"
        ? this.away.find(p => p.role === "CM")
        : this.home.find(p => p.role === "CM");
      if (starter) { starter.x = W / 2 - starter.side * 30; starter.y = H / 2 + 22; }
      const me = this.home.find(p => p.role === "ST");
      if (this.controlled) this.controlled.user = false;
      me.user = true; this.controlled = me;
      this.trail.length = 0;
    }

    /* ─────────────── الإدخال ─────────────── */
    onKeyDown(e) {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === "x" || k === "k") this.action("shoot");
      if (k === "z" || k === "j") this.action("pass");
      if (k === "c") this.action("skill");
      if (k === "v") this.action("tackle");
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      this.syncKeys();
    }
    onKeyUp(e) { this.keys[e.key.toLowerCase()] = false; this.syncKeys(); }
    syncKeys() {
      const K = this.keys;
      const kx = (K["arrowright"] || K["d"] ? 1 : 0) - (K["arrowleft"] || K["a"] ? 1 : 0);
      const ky = (K["arrowdown"] || K["s"] ? 1 : 0) - (K["arrowup"] || K["w"] ? 1 : 0);
      if (kx || ky || this._keysWereDown) { this.input.x = kx; this.input.y = ky; this.input.sprint = !!K["shift"]; }
      this._keysWereDown = !!(kx || ky);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.view = { w: rect.width, h: rect.height };
      // احتواء المشهد كاملاً داخل الشاشة
      this.scale = Math.min(rect.width / W, rect.height / H);
      this.offset = { x: (rect.width - W * this.scale) / 2, y: (rect.height - H * this.scale) / 2 };
      this.buildStadium();
    }

    start() {
      if (this.running || this.finished) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.loop);
    }
    stop() { this.running = false; }
    destroy() {
      this.stop();
      window.removeEventListener("resize", this.resize);
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
    }

    setInput(patch) { Object.assign(this.input, patch); }

    action(type) {
      const own = this.ball.owner === this.controlled;
      if (type === "shoot") own ? this.doShoot() : this.doTackle();
      if (type === "pass") own ? this.doPass() : this.switchPlayer();
      if (type === "skill") this.doSkill();
      if (type === "tackle") this.doTackle();
    }

    /* ─────────────── الحلقة ─────────────── */
    loop(now) {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.update(dt);
      this.draw();
      requestAnimationFrame(this.loop);
    }

    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 26);
      this.flash = Math.max(0, this.flash - dt * 2.2);
      this.updateParticles(dt);
      if (this.messageTime > 0) this.messageTime -= dt;

      if (this.freeze > 0) { this.freeze -= dt; if (this.freeze <= 0) this.kickoff(this._concededBy); return; }

      this.clock += dt;
      if (this.half === 1 && this.clock >= this.duration / 2) {
        this.half = 2;
        this.message = "⏱ نهاية الشوط الأول — واصل يا بطل";
        this.messageTime = 2.6;
        this.kickoff("away");
      }
      if (this.clock >= this.duration) {
        this.running = false;
        this.finished = true;
        const { home, away } = this.score;
        this.onEnd({
          score: this.score,
          stats: this.stats,
          result: home > away ? "win" : home === away ? "draw" : "loss"
        });
        return;
      }

      this.updateControlled(dt);
      this.updateAI(dt);
      this.updateBall(dt);
      this.detectPossession();
      this.detectGoal();
    }

    /* ─────────────── اللاعب المتحكَّم به ─────────────── */
    updateControlled(dt) {
      const p = this.controlled;
      if (!p) return;
      const mag = Math.hypot(this.input.x, this.input.y);
      const sprinting = this.input.sprint && p.stamina > 4;
      const speed = (sprinting ? 292 : 196) * Math.min(1, mag);
      if (mag > 0.08) {
        const nx = this.input.x / (mag || 1), ny = this.input.y / (mag || 1);
        p.vx = nx * speed; p.vy = ny * speed;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.face = Math.atan2(ny, nx);
        if (sprinting && this.time % 0.09 < dt) this.spawnDust(p);
      } else { p.vx = p.vy = 0; }
      p.stamina = clamp(p.stamina + (sprinting && mag > 0.08 ? -20 : 10) * dt, 0, 100);
      this.bound(p);
    }

    switchPlayer() {
      const candidates = this.home.filter(p => p.role !== "GK" && p !== this.controlled);
      let best = null, bd = Infinity;
      for (const p of candidates) { const d = dist(p, this.ball); if (d < bd) { bd = d; best = p; } }
      if (best) {
        if (this.controlled) this.controlled.user = false;
        best.user = true;
        this.controlled = best;
      }
    }

    /* ─────────────── الذكاء ─────────────── */
    updateAI(dt) {
      const b = this.ball;
      const ownerSide = b.owner ? b.owner.side : 0;

      for (const p of this.all) {
        p.cd = Math.max(0, p.cd - dt);
        if (p === this.controlled) continue;

        let tx = p.home.x, ty = p.home.y, sp = 128;

        if (p.role === "GK") {
          // الحارس: يتحرك عمودياً بمحاذاة الكرة على خط مرماه
          const line = p.side === 1 ? FX + 26 : W - FX - 26;
          tx = line;
          ty = clamp(b.y, GOAL_TOP + 16, GOAL_BOT - 16);
          const nearGoal = Math.abs(b.x - (p.side === 1 ? FX : W - FX)) < 200 && b.y > GOAL_TOP - 60 && b.y < GOAL_BOT + 60;
          if (!b.owner && nearGoal) { tx = b.x; ty = b.y; sp = 200; }
        } else if (b.owner === p) {
          // حامل الكرة الآلي: تقدّم نحو مرمى الخصم
          const gx = p.side === 1 ? W - FX : FX;
          tx = gx; ty = lerp(p.y, H / 2, 0.25); sp = p.side === -1 ? 156 : 172;
          const pressers = this.all.filter(o => o.side !== p.side && dist(o, p) < 70);
          const distGoal = Math.abs(p.x - gx);
          if (distGoal < 300 && Math.random() < (p.side === -1 ? 0.72 : 1.15) * dt) { this.aiShoot(p); continue; }
          if (pressers.length && Math.random() < 1.7 * dt) { this.aiPass(p); continue; }
        } else if (ownerSide === p.side) {
          // فريق مستحوذ: انزياح هجومي مع حفظ الشكل
          const shift = p.side * FW * 0.14;
          tx = p.home.x + shift + (b.x - p.home.x) * 0.22;
          ty = p.home.y + (b.y - p.home.y) * 0.25;
          sp = 138;
        } else if (ownerSide !== 0) {
          // فريق مدافع: الأقرب اثنان يضغطان
          const carrier = b.owner;
          const chasers = this.all.filter(o => o.side === p.side && o.role !== "GK")
            .sort((m, n) => dist(m, carrier) - dist(n, carrier));
          if (chasers.indexOf(p) < 2) {
            tx = carrier.x; ty = carrier.y; sp = 168;
            if (p.side === -1 && p.cd <= 0 && dist(p, carrier) < PR * 2.2 && Math.random() < 1.35 * dt) {
              p.cd = 1.1;
              if (Math.random() < 0.3) { b.owner = p; this.msg("الخصم يستخلص الكرة!"); }
            }
          } else {
            tx = p.home.x - p.side * FW * 0.10;
            ty = p.home.y + (b.y - p.home.y) * 0.2;
          }
        } else {
          // كرة حرة: الأقرب من كل فريق يلاحق
          const mates = this.all.filter(o => o.side === p.side && o.role !== "GK")
            .sort((m, n) => dist(m, b) - dist(n, b));
          if (mates.indexOf(p) === 0 || b.passTo === p) { tx = b.x; ty = b.y; sp = 172; }
        }

        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > 3) {
          p.vx = dx / d * sp; p.vy = dy / d * sp;
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.face = Math.atan2(dy, dx);
        } else { p.vx = p.vy = 0; }
        this.bound(p);
      }
    }

    bound(p) {
      p.x = clamp(p.x, FX + 6, W - FX - 6);
      p.y = clamp(p.y, FY + 6, H - FY - 6);
    }

    /* ─────────────── الكرة ─────────────── */
    updateBall(dt) {
      const b = this.ball;
      if (b.owner) {
        const o = b.owner;
        b.x = o.x + Math.cos(o.face) * (PR + 9);
        b.y = o.y + Math.sin(o.face) * (PR + 9);
        b.vx = o.vx; b.vy = o.vy;
        return;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      const fr = Math.pow(0.5, dt);
      b.vx *= fr; b.vy *= fr;
      b.spin += Math.hypot(b.vx, b.vy) * dt * 0.02;

      // حدود الملعب العلوية/السفلية
      if (b.y < FY + BR) { b.y = FY + BR; b.vy = Math.abs(b.vy) * 0.72; }
      if (b.y > H - FY - BR) { b.y = H - FY - BR; b.vy = -Math.abs(b.vy) * 0.72; }
      // خطا المرمى (خارج فتحة المرمى يرتد)
      const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOT;
      if (b.x < FX + BR && !inMouth) { b.x = FX + BR; b.vx = Math.abs(b.vx) * 0.72; }
      if (b.x > W - FX - BR && !inMouth) { b.x = W - FX - BR; b.vx = -Math.abs(b.vx) * 0.72; }
      b.x = clamp(b.x, FX - 34, W - FX + 34);
    }

    detectPossession() {
      const b = this.ball;
      if (b.owner || this.freeze > 0) return;
      const speed = Math.hypot(b.vx, b.vy);
      for (const p of this.all) {
        if (p === b.lastKick && speed > 90) continue;
        if (dist(p, b) < PR + BR + 4) {
          // تصدي الحارس للتسديدات القوية
          if (p.role === "GK" && b.lastKick && b.lastKick.side !== p.side && speed > 250) {
            const save = Math.random() < (p.side === -1 ? 0.52 : 0.72);
            if (save) {
              if (p.side === 1) this.stats.saves += 1;
              b.vx = p.side * (170 + Math.random() * 120);
              b.vy = (Math.random() - 0.5) * 260;
              b.lastKick = p;
              this.msg(p.side === -1 ? "🧤 تصدى الحارس — حاول زاوية أخرى!" : "🧤 تصدٍّ خرافي من حارسك!");
              this.spawnRing(p.x, p.y, CYAN);
              this.onEvent({ type: "save", team: p.side === 1 ? "home" : "away" });
              return;
            }
          }
          b.owner = p;
          // تمريرة ناجحة للفريق
          if (b.passTo && b.lastKick && b.lastKick.side === p.side && b.lastKick !== p && p.side === 1) {
            this.stats.passes += 1;
          }
          b.passTo = null;
          if (p.side === 1 && p.role !== "GK" && p !== this.controlled) {
            if (this.controlled) this.controlled.user = false;
            p.user = true; this.controlled = p;
          }
          return;
        }
      }
      if (speed < 30) b.lastKick = null;
    }

    detectGoal() {
      const b = this.ball;
      if (this.freeze > 0 || b.owner) return;
      const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOT;
      if (!inMouth) return;
      if (b.x > W - FX + 10) return this.goal("home");
      if (b.x < FX - 10) return this.goal("away");
    }

    goal(team) {
      this.score[team] += 1;
      if (team === "home") { this.stats.goals += 1; }
      this.msg(team === "home" ? "⚽ هــــدف! رائع يا بطل" : "هدف للخصم — ارجع بقوة!", 2.6);
      this.shake = 9;
      this.flash = team === "home" ? 1 : 0.4;
      this.spawnConfetti(this.ball.x, this.ball.y, team === "home");
      this.onEvent({ type: "goal", team });
      this.freeze = 1.7;
      this._concededBy = team === "home" ? "away" : "home";
      this.ball.owner = null; this.ball.vx = this.ball.vy = 0;
    }

    /* ─────────────── أفعال اللاعب ─────────────── */
    doPass() {
      const owner = this.ball.owner;
      if (!owner || owner.side !== 1) return;
      let mate = null, best = Infinity;
      for (const p of this.home) {
        if (p === owner || p.role === "GK") continue;
        const backward = Math.max(0, owner.x - p.x) * 0.5;   // عقوبة الرجوع للخلف
        const score = dist(p, owner) + backward;
        if (score < best) { best = score; mate = p; }
      }
      if (!mate) return;
      const lead = { x: mate.x + mate.vx * 0.22, y: mate.y + mate.vy * 0.22 };
      this.kick(owner, lead.x, lead.y, 470);
      this.ball.passTo = mate;
      this.msg("تمريرة ذكية");
    }

    doShoot() {
      const owner = this.ball.owner;
      if (!owner || owner.side !== 1) return;
      const aimY = clamp(H / 2 + this.input.y * (GOAL_W / 2 - 16) + (Math.random() - 0.5) * 60, GOAL_TOP + 10, GOAL_BOT - 10);
      const power = owner.x > W - FX - 380 ? 820 : 640;
      this.kick(owner, W - FX + 40, aimY, power);
      this.stats.shots += 1;
      this.msg("تسديدة!");
      this.spawnRing(owner.x, owner.y, LIME);
      this.onEvent({ type: "shot", team: "home" });
    }

    doSkill() {
      const p = this.controlled;
      if (!p) return;
      const spin = Math.random() > 0.5 ? 1 : -1;
      p.y += 42 * spin; p.x += 26;
      p.stamina = clamp(p.stamina - 7, 0, 100);
      this.bound(p);
      this.spawnRing(p.x, p.y, TEAL);
      this.msg("مراوغة رائعة");
    }

    doTackle() {
      const p = this.controlled;
      if (!p || p.cd > 0) return;
      p.cd = 0.5;
      const target = this.ball.owner && this.ball.owner.side === -1 ? this.ball.owner : null;
      if (target && dist(p, target) < PR * 3.2) {
        if (Math.random() < 0.62) {
          this.ball.owner = p;
          this.stats.tackles += 1;
          this.spawnRing(p.x, p.y, LIME);
          this.msg("افتكاك ناجح!");
        } else this.msg("أفلت منك — طارده!");
      }
    }

    kick(from, tx, ty, power) {
      const b = this.ball;
      const d = Math.hypot(tx - b.x, ty - b.y) || 1;
      b.vx = (tx - b.x) / d * power;
      b.vy = (ty - b.y) / d * power;
      b.owner = null; b.lastKick = from;
    }

    aiPass(owner) {
      const mates = this.away.filter(p => p !== owner && p.role !== "GK");
      const sorted = mates.sort((a, b) => a.x - b.x);
      const mate = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
      if (!mate) return;
      this.kick(owner, mate.x, mate.y, 430);
      this.ball.passTo = mate;
    }

    aiShoot(owner) {
      const aimY = GOAL_TOP + 14 + Math.random() * (GOAL_W - 28);
      this.kick(owner, FX - 40, aimY, 640);
      this.onEvent({ type: "shot", team: "away" });
    }

    msg(text, t) { this.message = text; this.messageTime = t || 1.3; }

    /* ─────────────── المؤثرات ─────────────── */
    spawnConfetti(x, y, big) {
      const n = big ? 90 : 30;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 420;
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 140,
          t: 1 + Math.random() * 0.9, size: 3 + Math.random() * 5,
          c: [LIME, CYAN, "#FFFFFF", TEAL][i % 4], g: 460, rot: Math.random() * Math.PI
        });
      }
    }
    spawnRing(x, y, c) {
      this.particles.push({ ring: true, x, y, r: 10, t: 0.45, c });
    }
    spawnDust(p) {
      this.particles.push({
        x: p.x - Math.cos(p.face) * PR, y: p.y - Math.sin(p.face) * PR + 6,
        vx: (Math.random() - .5) * 30, vy: -12, t: 0.4, size: 3.5, c: "rgba(255,255,255,.5)", g: 0
      });
    }
    updateParticles(dt) {
      this.particles = this.particles.filter(pt => (pt.t -= dt) > 0);
      for (const pt of this.particles) {
        if (pt.ring) { pt.r += 190 * dt; continue; }
        pt.vy += (pt.g || 0) * dt;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        if (pt.rot != null) pt.rot += dt * 7;
      }
    }

    /* ═══════════════ الرسم ═══════════════ */

    /* المشهد الثابت يُرسم مرة واحدة في canvas منفصل (أداء + ثبات) */
    buildStadium() {
      const c = document.createElement("canvas");
      c.width = Math.max(2, Math.floor(W * this.scale * this.dpr));
      c.height = Math.max(2, Math.floor(H * this.scale * this.dpr));
      const x = c.getContext("2d");
      x.scale(this.scale * this.dpr, this.scale * this.dpr);

      /* خلفية الليل */
      const night = x.createLinearGradient(0, 0, 0, H);
      night.addColorStop(0, "#05070B"); night.addColorStop(1, "#0B0F14");
      x.fillStyle = night; x.fillRect(0, 0, W, H);

      /* المدرجات الأربعة */
      const standGrad = (x0, y0, x1, y1) => {
        const g = x.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, "#151C27"); g.addColorStop(1, "#0A0F16");
        return g;
      };
      x.fillStyle = standGrad(0, 0, 0, STAND); x.fillRect(0, 0, W, STAND);
      x.fillStyle = standGrad(0, H, 0, H - STAND); x.fillRect(0, H - STAND, W, STAND);
      x.fillStyle = standGrad(0, 0, STAND, 0); x.fillRect(0, 0, STAND, H);
      x.fillStyle = standGrad(W, 0, W - STAND, 0); x.fillRect(W - STAND, 0, STAND, H);

      /* الجمهور: نقاط حتمية بصفوف — لمسات ليموني/سماوي متفرقة */
      const crowdDot = (px, py, i) => {
        const h1 = hash(i), h2 = hash(i * 1.7);
        const tone = h1 < 0.06 ? LIME : h1 < 0.12 ? CYAN : h1 < 0.2 ? "#8FA3B8" : h1 < 0.6 ? "#3D4C5E" : "#2A3644";
        x.fillStyle = tone;
        x.globalAlpha = 0.55 + h2 * 0.45;
        x.fillRect(px, py, 3, 3);
      };
      let seed = 1;
      for (let row = 8; row < STAND - 8; row += 7) {
        for (let px = 8; px < W - 8; px += 6) { crowdDot(px + hash(seed) * 3, row + hash(seed * 3) * 3, seed); seed++; }
        for (let px = 8; px < W - 8; px += 6) { crowdDot(px + hash(seed) * 3, H - row - 3 + hash(seed * 3) * 3, seed); seed++; }
      }
      for (let col = 8; col < STAND - 8; col += 7) {
        for (let py = STAND; py < H - STAND; py += 6) { crowdDot(col + hash(seed) * 3, py + hash(seed * 3) * 3, seed); seed++; }
        for (let py = STAND; py < H - STAND; py += 6) { crowdDot(W - col - 3 + hash(seed) * 3, py + hash(seed * 3) * 3, seed); seed++; }
      }
      x.globalAlpha = 1;

      /* اللوحات الإعلانية المتوهجة حول الملعب */
      const board = (bx, by, bw, bh, horizontal) => {
        const g = horizontal
          ? x.createLinearGradient(bx, 0, bx + bw, 0)
          : x.createLinearGradient(0, by, 0, by + bh);
        g.addColorStop(0, "#0D141D"); g.addColorStop(0.5, "#111B26"); g.addColorStop(1, "#0D141D");
        x.fillStyle = g; x.fillRect(bx, by, bw, bh);
        const glow = horizontal
          ? x.createLinearGradient(bx, 0, bx + bw, 0)
          : x.createLinearGradient(0, by, 0, by + bh);
        glow.addColorStop(0, LIME); glow.addColorStop(0.5, CYAN); glow.addColorStop(1, TEAL);
        x.fillStyle = glow;
        if (horizontal) x.fillRect(bx, by, bw, 2.5); else x.fillRect(bx, by, 2.5, bh);
        if (horizontal && bw > 300) {
          x.save();
          x.font = "700 13px Rajdhani, Arial";
          x.textAlign = "center"; x.textBaseline = "middle";
          const cx0 = bx + bw / 2;
          x.fillStyle = "rgba(198,255,0,.8)";
          x.fillText("FOOTBALL FUTURE", cx0 - 260, by + bh / 2 + 1);
          x.fillStyle = "rgba(0,229,255,.8)";
          x.fillText("PLAY · GROW · WIN", cx0, by + bh / 2 + 1);
          x.fillStyle = "rgba(198,255,0,.8)";
          x.fillText("FOOTBALL FUTURE", cx0 + 260, by + bh / 2 + 1);
          x.restore();
        }
      };
      board(STAND, STAND, W - STAND * 2, 22, true);
      board(STAND, H - STAND - 22, W - STAND * 2, 22, true);
      board(STAND, STAND + 22, 20, H - STAND * 2 - 44, false);
      board(W - STAND - 20, STAND + 22, 20, H - STAND * 2 - 44, false);

      /* أرضية العشب الليلي + خطوط القص */
      const apx = STAND + 22, apy = STAND + 22;
      const apw = W - apx * 2, aph = H - apy * 2;
      const grass = x.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.62);
      grass.addColorStop(0, "#17603A"); grass.addColorStop(0.55, "#0F4A2C"); grass.addColorStop(1, "#08301D");
      x.fillStyle = grass; x.fillRect(apx, apy, apw, aph);
      const stripes = 14;
      for (let i = 0; i < stripes; i++) {
        if (i % 2) continue;
        x.fillStyle = "rgba(255,255,255,.032)";
        x.fillRect(apx + i * apw / stripes, apy, apw / stripes, aph);
      }
      // بقع إضاءة الكشافات على العشب
      for (const [lx, ly] of [[W * .22, H * .3], [W * .78, H * .3], [W * .22, H * .7], [W * .78, H * .7]]) {
        const spot = x.createRadialGradient(lx, ly, 10, lx, ly, 300);
        spot.addColorStop(0, "rgba(210,255,230,.05)"); spot.addColorStop(1, "transparent");
        x.fillStyle = spot; x.fillRect(apx, apy, apw, aph);
      }

      /* خطوط الملعب مع توهج خفيف */
      x.strokeStyle = "rgba(235,255,245,.85)";
      x.lineWidth = 3;
      x.shadowColor = "rgba(190,255,220,.5)"; x.shadowBlur = 6;
      x.strokeRect(FX, FY, W - FX * 2, H - FY * 2);
      x.beginPath(); x.moveTo(W / 2, FY); x.lineTo(W / 2, H - FY); x.stroke();
      x.beginPath(); x.arc(W / 2, H / 2, 92, 0, Math.PI * 2); x.stroke();
      const paW = 158, paH = 330, gaW = 62, gaH = 190;
      x.strokeRect(FX, H / 2 - paH / 2, paW, paH);
      x.strokeRect(W - FX - paW, H / 2 - paH / 2, paW, paH);
      x.strokeRect(FX, H / 2 - gaH / 2, gaW, gaH);
      x.strokeRect(W - FX - gaW, H / 2 - gaH / 2, gaW, gaH);
      x.beginPath(); x.arc(FX + paW, H / 2, 62, -Math.PI / 2.6, Math.PI / 2.6); x.stroke();
      x.beginPath(); x.arc(W - FX - paW, H / 2, 62, Math.PI - Math.PI / 2.6, Math.PI + Math.PI / 2.6); x.stroke();
      x.shadowBlur = 0;
      x.fillStyle = "rgba(235,255,245,.85)";
      for (const px of [FX + 106, W - FX - 106, W / 2]) { x.beginPath(); x.arc(px, H / 2, 4, 0, Math.PI * 2); x.fill(); }

      /* المرميان: قائمان وشبكة وتوهج بلون الهوية */
      const goalNet = (gx, dir, color) => {
        const depth = 30 * dir;
        x.save();
        const g = x.createRadialGradient(gx, H / 2, 8, gx, H / 2, 150);
        g.addColorStop(0, color === LIME ? "rgba(198,255,0,.20)" : "rgba(0,229,255,.20)");
        g.addColorStop(1, "transparent");
        x.fillStyle = g;
        x.fillRect(gx - 150, H / 2 - 150, 300, 300);
        x.strokeStyle = "rgba(255,255,255,.30)"; x.lineWidth = 1;
        for (let i = 0; i <= 6; i++) {
          const yy = GOAL_TOP + i * GOAL_W / 6;
          x.beginPath(); x.moveTo(gx, yy); x.lineTo(gx + depth, yy + (i - 3) * 2); x.stroke();
        }
        for (let i = 0; i <= 4; i++) {
          const xx = gx + depth * i / 4;
          x.beginPath(); x.moveTo(xx, GOAL_TOP); x.lineTo(xx, GOAL_BOT); x.stroke();
        }
        x.strokeStyle = "#F2F6FA"; x.lineWidth = 5; x.lineCap = "round";
        x.shadowColor = color; x.shadowBlur = 16;
        x.beginPath();
        x.moveTo(gx + depth, GOAL_TOP); x.lineTo(gx, GOAL_TOP);
        x.lineTo(gx, GOAL_BOT); x.lineTo(gx + depth, GOAL_BOT);
        x.stroke();
        x.shadowBlur = 0;
        x.restore();
      };
      goalNet(FX, -1, CYAN);
      goalNet(W - FX, 1, LIME);

      /* أبراج الكشافات في الزوايا */
      for (const [cx0, cy0] of [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]]) {
        const g = x.createRadialGradient(cx0, cy0, 2, cx0, cy0, 120);
        g.addColorStop(0, "rgba(240,255,250,.55)");
        g.addColorStop(0.2, "rgba(240,255,250,.12)");
        g.addColorStop(1, "transparent");
        x.fillStyle = g;
        x.beginPath(); x.arc(cx0, cy0, 120, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#DDE9F2";
        for (let i = -1; i <= 1; i++) { x.beginPath(); x.arc(cx0 + i * 9, cy0 + (cy0 > H / 2 ? 4 : -4), 3, 0, Math.PI * 2); x.fill(); }
      }

      /* تظليل الحواف (vignette) */
      const vig = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
      vig.addColorStop(0, "transparent"); vig.addColorStop(1, "rgba(0,0,0,.5)");
      x.fillStyle = vig; x.fillRect(0, 0, W, H);

      this.stadium = c;
    }

    draw() {
      const ctx = this.ctx;
      const vw = this.view.w, vh = this.view.h;
      ctx.fillStyle = "#05070B";
      ctx.fillRect(0, 0, vw, vh);

      ctx.save();
      // اهتزاز الكاميرا
      const sh = this.shake;
      const shx = sh ? (Math.random() - .5) * sh : 0;
      const shy = sh ? (Math.random() - .5) * sh : 0;
      ctx.translate(this.offset.x + shx, this.offset.y + shy);

      // المشهد الثابت
      if (this.stadium) ctx.drawImage(this.stadium, 0, 0, W * this.scale, H * this.scale);

      ctx.scale(this.scale, this.scale);

      // وميض الجمهور
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 26; i++) {
        const h1 = hash(i * 13.7 + Math.floor(this.time * 3));
        const h2 = hash(i * 7.3 + Math.floor(this.time * 3) * 1.7);
        const side = i % 4;
        let px, py;
        if (side === 0) { px = h1 * W; py = h2 * (STAND - 12) + 6; }
        else if (side === 1) { px = h1 * W; py = H - STAND + h2 * (STAND - 12) + 6; }
        else if (side === 2) { px = h1 * (STAND - 12) + 6; py = STAND + h2 * (H - STAND * 2); }
        else { px = W - STAND + h1 * (STAND - 12) + 6; py = STAND + h2 * (H - STAND * 2); }
        ctx.fillStyle = i % 5 === 0 ? LIME : i % 5 === 1 ? CYAN : "#EAF2F8";
        ctx.fillRect(px, py, 2.6, 2.6);
      }
      ctx.globalAlpha = 1;

      // أثر الكرة
      const b = this.ball;
      if (!b.owner && Math.hypot(b.vx, b.vy) > 120) {
        this.trail.push({ x: b.x, y: b.y });
        if (this.trail.length > 9) this.trail.shift();
      } else if (this.trail.length) this.trail.shift();
      for (let i = 0; i < this.trail.length; i++) {
        const k = i / this.trail.length;
        ctx.fillStyle = `rgba(198,255,0,${k * 0.3})`;
        ctx.beginPath(); ctx.arc(this.trail[i].x, this.trail[i].y, BR * k, 0, Math.PI * 2); ctx.fill();
      }

      // اللاعبون مرتبون حسب العمق
      const sorted = [...this.all].sort((m, n) => m.y - n.y);
      for (const p of sorted) this.drawPlayer(ctx, p);

      this.drawBall(ctx);
      this.drawParticles(ctx);
      ctx.restore();

      // وميض الهدف
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(198,255,0,${this.flash * 0.16})`;
        ctx.fillRect(0, 0, vw, vh);
      }

      this.drawOverlay(ctx, vw, vh);
    }

    drawPlayer(ctx, p) {
      const isUser = p === this.controlled;
      const isGK = p.role === "GK";
      const kit = p.side === 1 ? (isGK ? "#FFD23F" : LIME) : (isGK ? "#FF8DA0" : "#FF5A5F");
      const kitDark = p.side === 1 ? (isGK ? "#B8931B" : "#7FA800") : (isGK ? "#C24A61" : "#B02A30");

      ctx.save();
      ctx.translate(p.x, p.y);

      // الظل
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.beginPath(); ctx.ellipse(2, PR * 0.72, PR * 1.05, PR * 0.42, 0, 0, Math.PI * 2); ctx.fill();

      // حلقة اللاعب المتحكَّم به (متحركة)
      if (isUser) {
        ctx.save();
        ctx.rotate(this.time * 2.2);
        ctx.strokeStyle = LIME; ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        ctx.shadowColor = LIME; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, PR + 8, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // سهم الاتجاه
      if (Math.hypot(p.vx, p.vy) > 20) {
        ctx.save();
        ctx.rotate(p.face);
        ctx.fillStyle = p.side === 1 ? "rgba(198,255,0,.5)" : "rgba(255,90,95,.45)";
        ctx.beginPath();
        ctx.moveTo(PR + 7, 0); ctx.lineTo(PR + 1, -5); ctx.lineTo(PR + 1, 5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // الجسم: قميص بتظليل كروي + حافة
      const g = ctx.createRadialGradient(-PR * 0.4, -PR * 0.4, 2, 0, 0, PR * 1.25);
      g.addColorStop(0, "#FFFFFF");
      g.addColorStop(0.25, kit);
      g.addColorStop(1, kitDark);
      ctx.fillStyle = g;
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, PR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // شريط كتف بلون الفريق الثانوي
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, PR, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = p.side === 1 ? "rgba(0,229,255,.35)" : "rgba(255,255,255,.22)";
      ctx.fillRect(-PR, -PR, PR * 2, 5);
      ctx.restore();

      // الرأس
      ctx.fillStyle = p.side === 1 ? "#E8C9A5" : "#D9B08C";
      ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(Math.cos(p.face) * 4, Math.sin(p.face) * 4 - PR * 0.62, PR * 0.42, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // الرقم
      ctx.fillStyle = p.side === 1 ? "#06210B" : "#FFFFFF";
      ctx.font = `800 ${PR * 0.9}px Rajdhani, Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(p.num), 0, 2.5);

      // اسم اللاعب المتحكَّم به
      if (isUser) {
        ctx.font = '700 11px "Noto Kufi Arabic", Arial';
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.shadowColor = "#000"; ctx.shadowBlur = 5;
        ctx.fillText(p.name, 0, -PR - 15);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    drawBall(ctx) {
      const b = this.ball;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = "rgba(0,0,0,.5)";
      ctx.beginPath(); ctx.ellipse(1.6, BR * 0.85, BR * 0.95, BR * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, BR + 2);
      g.addColorStop(0, "#FFFFFF"); g.addColorStop(0.75, "#E8EFF4"); g.addColorStop(1, "#B9C6D1");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, BR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(10,16,22,.55)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.rotate(b.spin);
      ctx.fillStyle = "#141B23";
      ctx.beginPath(); ctx.arc(0, 0, BR * 0.34, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.arc(Math.cos(a) * BR * 0.78, Math.sin(a) * BR * 0.78, BR * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    drawParticles(ctx) {
      for (const pt of this.particles) {
        if (pt.ring) {
          ctx.globalAlpha = clamp(pt.t / 0.45, 0, 1);
          ctx.strokeStyle = pt.c; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.save();
        ctx.globalAlpha = clamp(pt.t, 0, 1);
        ctx.translate(pt.x, pt.y);
        if (pt.rot != null) ctx.rotate(pt.rot);
        ctx.fillStyle = pt.c;
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.7);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    drawOverlay(ctx, w, h) {
      if (this.messageTime <= 0) return;
      const alpha = clamp(this.messageTime / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 19px "Noto Kufi Arabic", Arial';
      const tw = ctx.measureText(this.message).width + 56;
      const bx = w / 2 - tw / 2, by = h * 0.16;
      ctx.fillStyle = "rgba(11,15,20,.82)";
      ctx.strokeStyle = "rgba(198,255,0,.65)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(198,255,0,.45)"; ctx.shadowBlur = 22;
      roundRect(ctx, bx, by, tw, 48, 24); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = LIME;
      ctx.beginPath();
      ctx.moveTo(bx + 16, by + 10); ctx.lineTo(bx + 24, by + 10);
      ctx.lineTo(bx + 18, by + 38); ctx.lineTo(bx + 10, by + 38);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(this.message, w / 2 + 10, by + 25);
      ctx.restore();
    }

    getTimeText() {
      const total = Math.floor(this.clock);
      const min = Math.floor(total / 60);
      const sec = String(total % 60).padStart(2, "0");
      return min + ":" + sec;
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.FootballFutureEngine = FootballFutureEngine;
})();
