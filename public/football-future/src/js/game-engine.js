/* ═══════════════════════════════════════════════════════════════════
   فوتبول فيوتشر — محرك المباراة v4
   عرض بمنظور كاميرا البث التلفزيوني (بأسلوب ألعاب كرة القدم الحديثة):
   ملعب بمنظور، كاميرا تتبع الكرة، لاعبون مجسّمون بحركة جري،
   مدرج بانورامي بجمهور، لوحات LED، مرميان ثلاثيا الأبعاد بشباك،
   قوس طيران للكرة، واحتفالات أهداف سينمائية.
   API المتاح للتطبيق:
     new FootballFutureEngine(canvas, {onEvent, onEnd})
     .start() .stop() .destroy() .setInput() .action() .getTimeText()
     .score .clock .duration .pitch .home .away .ball .controlled
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* roundRect polyfill للمتصفحات الأقدم */
  if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  /* ── عالم اللعب (إحداثيات منطقية علوية — الفيزياء مستقلة عن العرض) ── */
  const W = 1280, H = 800;
  const FX = 132, FY = 132;               // حدود أرضية اللعب
  const FW = W - FX * 2, FH = H - FY * 2;
  const GOAL_W = 168;
  const GOAL_TOP = H / 2 - GOAL_W / 2, GOAL_BOT = H / 2 + GOAL_W / 2;
  const PR = 15;                          // نصف قطر التصادم
  const BR = 8;

  const LIME = "#C6FF00", CYAN = "#00E5FF", TEAL = "#00BFAE";

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  /* التشكيلة 1-2-1-2 لكل فريق (حارس + 5) */
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
      this.freeze = 0;
      this.camX = W / 2;
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
      return FORM.map((f, i) => {
        const fx = side === 1 ? f.fx : 1 - f.fx;
        return {
          id: (side === 1 ? "h" : "a") + i,
          name: side === 1 ? HOME_NAMES[i] : AWAY_NAMES[i],
          num: NUMS[i], role: f.role, side,
          home: { x: FX + fx * FW, y: FY + f.fy * FH },
          x: FX + fx * FW, y: FY + f.fy * FH,
          vx: 0, vy: 0, face: side === 1 ? 0 : Math.PI,
          dirX: side,                      // اتجاه النظر الأفقي للرسم
          phase: hash(i * 7) * 6,          // طور حركة الجري
          user: side === 1 && f.role === "ST",
          stamina: 100, cd: 0
        };
      });
    }

    resetWorld() {
      this.home = this.makeTeam(1);
      this.away = this.makeTeam(-1);
      this.all = this.home.concat(this.away);
      this.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, z: 0, vz: 0, owner: null, lastKick: null, passTo: null, spin: 0 };
      this.controlled = this.home.find(p => p.user);
      this.kickoff("home");
      this.message = "تقدّم نحو المرمى الأيمن وسدّد";
      this.messageTime = 3;
    }

    kickoff(concededBy) {
      for (const p of this.all) { p.x = p.home.x; p.y = p.home.y; p.vx = p.vy = 0; }
      const b = this.ball;
      b.x = W / 2; b.y = H / 2; b.vx = b.vy = 0; b.z = 0; b.vz = 0;
      b.owner = null; b.lastKick = null; b.passTo = null;
      const starter = concededBy === "away"
        ? this.away.find(p => p.role === "CM")
        : this.home.find(p => p.role === "CM");
      if (starter) { starter.x = W / 2 - starter.side * 30; starter.y = H / 2 + 22; }
      const me = this.home.find(p => p.role === "ST");
      if (this.controlled) this.controlled.user = false;
      me.user = true; this.controlled = me;
      this.trail.length = 0;
      this.camX = W / 2;
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

      /* معايرة منظور كاميرا البث */
      const vw = rect.width, vh = rect.height;
      this.py0 = vh * 0.245;               // خط التماس البعيد على الشاشة
      this.py1 = vh * 0.985;               // خط التماس القريب
      this.kNear = Math.max(vh / 620, vw / 1500); // بكسل/وحدة عند الخط القريب
      this.kFar = this.kNear * 0.52;       // وعند البعيد (التقلص المنظوري)
      const halfNear = vw / 2 / this.kNear;
      this.camMin = Math.min(W / 2, halfNear * 0.92);
      this.camMax = Math.max(W / 2, W - halfNear * 0.92);
      this.buildBackdrop();
    }

    /* إسقاط نقطة من عالم اللعب إلى الشاشة */
    proj(wx, wy) {
      const t = clamp((wy - FY) / FH, -0.35, 1.3);
      const s = this.kFar + (this.kNear - this.kFar) * clamp(t, 0, 1);
      const y = this.py0 + (this.py1 - this.py0) * (t * (0.7 + 0.3 * clamp(t, 0, 1)));
      const x = this.view.w / 2 + (wx - this.camX) * s;
      return { x, y, s };
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

      // الكاميرا تتبع الكرة بنعومة
      const camTarget = clamp(this.ball.x, this.camMin, this.camMax);
      this.camX += (camTarget - this.camX) * Math.min(1, dt * 3.4);

      if (this.freeze > 0) { this.freeze -= dt; if (this.freeze <= 0) this.kickoff(this._concededBy); return; }

      this.clock += dt;
      if (this.half === 1 && this.clock >= this.duration / 2) {
        this.half = 2;
        this.message = "نهاية الشوط الأول — واصل يا بطل";
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

      // طور الجري واتجاه النظر لكل اللاعبين
      for (const p of this.all) {
        const spd = Math.hypot(p.vx, p.vy);
        p.phase += spd * dt * 0.055;
        if (Math.abs(p.vx) > 12) p.dirX = p.vx > 0 ? 1 : -1;
      }
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
          const line = p.side === 1 ? FX + 26 : W - FX - 26;
          tx = line;
          ty = clamp(b.y, GOAL_TOP + 16, GOAL_BOT - 16);
          const nearGoal = Math.abs(b.x - (p.side === 1 ? FX : W - FX)) < 200 && b.y > GOAL_TOP - 60 && b.y < GOAL_BOT + 60;
          if (!b.owner && nearGoal) { tx = b.x; ty = b.y; sp = 200; }
        } else if (b.owner === p) {
          const gx = p.side === 1 ? W - FX : FX;
          tx = gx; ty = lerp(p.y, H / 2, 0.25); sp = p.side === -1 ? 156 : 172;
          const pressers = this.all.filter(o => o.side !== p.side && dist(o, p) < 70);
          const distGoal = Math.abs(p.x - gx);
          if (distGoal < 300 && Math.random() < (p.side === -1 ? 0.72 : 1.15) * dt) { this.aiShoot(p); continue; }
          if (pressers.length && Math.random() < 1.7 * dt) { this.aiPass(p); continue; }
        } else if (ownerSide === p.side) {
          const shift = p.side * FW * 0.14;
          tx = p.home.x + shift + (b.x - p.home.x) * 0.22;
          ty = p.home.y + (b.y - p.home.y) * 0.25;
          sp = 138;
        } else if (ownerSide !== 0) {
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
        b.z = 0; b.vz = 0;
        return;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      const fr = Math.pow(0.5, dt);
      b.vx *= fr; b.vy *= fr;
      b.spin += Math.hypot(b.vx, b.vy) * dt * 0.02;

      // قوس الطيران (بصري)
      if (b.z > 0 || b.vz !== 0) {
        b.z += b.vz * dt;
        b.vz -= 420 * dt;
        if (b.z <= 0) { b.z = 0; b.vz = Math.abs(b.vz) > 60 ? Math.abs(b.vz) * 0.42 : 0; }
      }

      if (b.y < FY + BR) { b.y = FY + BR; b.vy = Math.abs(b.vy) * 0.72; }
      if (b.y > H - FY - BR) { b.y = H - FY - BR; b.vy = -Math.abs(b.vy) * 0.72; }
      const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOT;
      if (b.x < FX + BR && !inMouth) { b.x = FX + BR; b.vx = Math.abs(b.vx) * 0.72; }
      if (b.x > W - FX - BR && !inMouth) { b.x = W - FX - BR; b.vx = -Math.abs(b.vx) * 0.72; }
      b.x = clamp(b.x, FX - 34, W - FX + 34);
    }

    detectPossession() {
      const b = this.ball;
      if (b.owner || this.freeze > 0) return;
      if (b.z > 26) return;                       // الكرة في الهواء
      const speed = Math.hypot(b.vx, b.vy);
      for (const p of this.all) {
        if (p === b.lastKick && speed > 90) continue;
        if (dist(p, b) < PR + BR + 4) {
          if (p.role === "GK" && b.lastKick && b.lastKick.side !== p.side && speed > 250) {
            const save = Math.random() < (p.side === -1 ? 0.52 : 0.72);
            if (save) {
              if (p.side === 1) this.stats.saves += 1;
              b.vx = p.side * (170 + Math.random() * 120);
              b.vy = (Math.random() - 0.5) * 260;
              b.vz = 90; b.z = 1;
              b.lastKick = p;
              this.msg(p.side === -1 ? "تصدى الحارس — حاول زاوية أخرى!" : "تصدٍّ خرافي من حارسك!");
              this.spawnRing(p.x, p.y, CYAN);
              this.onEvent({ type: "save", team: p.side === 1 ? "home" : "away" });
              return;
            }
          }
          b.owner = p;
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
      this.msg(team === "home" ? "هــــدف! تسديدة عالمية" : "هدف للخصم — ارجع بقوة!", 2.6);
      this.shake = 10;
      this.flash = team === "home" ? 1 : 0.4;
      this.spawnConfetti(this.ball.x, this.ball.y, team === "home");
      this.onEvent({ type: "goal", team });
      this.freeze = 1.8;
      this._concededBy = team === "home" ? "away" : "home";
      this.ball.owner = null; this.ball.vx = this.ball.vy = 0; this.ball.vz = 0;
    }

    /* ─────────────── أفعال اللاعب ─────────────── */
    doPass() {
      const owner = this.ball.owner;
      if (!owner || owner.side !== 1) return;
      let mate = null, best = Infinity;
      for (const p of this.home) {
        if (p === owner || p.role === "GK") continue;
        const backward = Math.max(0, owner.x - p.x) * 0.5;
        const score = dist(p, owner) + backward;
        if (score < best) { best = score; mate = p; }
      }
      if (!mate) return;
      const lead = { x: mate.x + mate.vx * 0.22, y: mate.y + mate.vy * 0.22 };
      this.kick(owner, lead.x, lead.y, 470, 60);
      this.ball.passTo = mate;
      this.msg("تمريرة متقنة");
    }

    doShoot() {
      const owner = this.ball.owner;
      if (!owner || owner.side !== 1) return;
      const aimY = clamp(H / 2 + this.input.y * (GOAL_W / 2 - 16) + (Math.random() - 0.5) * 60, GOAL_TOP + 10, GOAL_BOT - 10);
      const power = owner.x > W - FX - 380 ? 820 : 640;
      this.kick(owner, W - FX + 40, aimY, power, 120);
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
      this.msg("مراوغة مذهلة");
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
          this.msg("استخلاص نظيف!");
        } else this.msg("أفلت منك — طارده!");
      }
    }

    kick(from, tx, ty, power, loft) {
      const b = this.ball;
      const d = Math.hypot(tx - b.x, ty - b.y) || 1;
      b.vx = (tx - b.x) / d * power;
      b.vy = (ty - b.y) / d * power;
      b.vz = clamp((loft || 60) * (0.6 + Math.random() * 0.7), 30, 170);
      b.z = 1;
      b.owner = null; b.lastKick = from;
    }

    aiPass(owner) {
      const mates = this.away.filter(p => p !== owner && p.role !== "GK");
      const sorted = mates.sort((a, b) => a.x - b.x);
      const mate = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
      if (!mate) return;
      this.kick(owner, mate.x, mate.y, 430, 55);
      this.ball.passTo = mate;
    }

    aiShoot(owner) {
      const aimY = GOAL_TOP + 14 + Math.random() * (GOAL_W - 28);
      this.kick(owner, FX - 40, aimY, 640, 110);
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
    spawnRing(x, y, c) { this.particles.push({ ring: true, x, y, r: 10, t: 0.45, c }); }
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

    /* ═══════════════ العرض بمنظور البث ═══════════════ */

    /* بانوراما المدرج البعيد + لوحات LED — تُبنى مرة عند تغيير المقاس */
    buildBackdrop() {
      const vw = this.view.w;
      const padWorld = 700;
      this.panPad = padWorld;
      const panW = Math.ceil((W + padWorld * 2) * this.kFar);
      const panH = Math.ceil(this.py0);
      const c = document.createElement("canvas");
      c.width = Math.max(2, panW); c.height = Math.max(2, panH);
      const x = c.getContext("2d");

      /* سماء ليلية */
      const sky = x.createLinearGradient(0, 0, 0, panH);
      sky.addColorStop(0, "#05070C"); sky.addColorStop(1, "#0A1017");
      x.fillStyle = sky; x.fillRect(0, 0, panW, panH);

      /* هيكل المدرج: طبقتان بميل */
      const standTop = panH * 0.10, boardTop = panH * 0.80;
      const tier = x.createLinearGradient(0, standTop, 0, boardTop);
      tier.addColorStop(0, "#0D1420"); tier.addColorStop(0.5, "#131C2A"); tier.addColorStop(1, "#0B111B");
      x.fillStyle = tier;
      x.fillRect(0, standTop, panW, boardTop - standTop);
      // خط سقف متوهج
      const roof = x.createLinearGradient(0, 0, panW, 0);
      roof.addColorStop(0, "rgba(0,229,255,.0)"); roof.addColorStop(0.2, "rgba(0,229,255,.55)");
      roof.addColorStop(0.5, "rgba(198,255,0,.55)"); roof.addColorStop(0.8, "rgba(0,229,255,.55)");
      roof.addColorStop(1, "rgba(0,229,255,.0)");
      x.fillStyle = roof;
      x.fillRect(0, standTop, panW, 2.5);

      /* الجمهور: صفوف نقاط بكثافة عالية */
      let seed = 7;
      const rows = Math.max(6, Math.floor((boardTop - standTop - 8) / 5));
      for (let r = 0; r < rows; r++) {
        const ry = standTop + 6 + r * 5;
        for (let px = 2; px < panW - 2; px += 4) {
          const h1 = hash(seed), h2 = hash(seed * 1.7); seed++;
          const tone = h1 < 0.045 ? LIME : h1 < 0.09 ? CYAN : h1 < 0.18 ? "#7E93A8" : h1 < 0.55 ? "#39485A" : "#242F3D";
          x.fillStyle = tone;
          x.globalAlpha = 0.4 + h2 * 0.55;
          x.fillRect(px + h1 * 3, ry + h2 * 3, 2.4, 2.4);
        }
      }
      x.globalAlpha = 1;

      /* أعمدة إنارة على المدرج */
      const step = Math.max(300, panW / 7);
      for (let lx = step / 2; lx < panW; lx += step) {
        const g = x.createRadialGradient(lx, standTop + 8, 2, lx, standTop + 8, 90);
        g.addColorStop(0, "rgba(235,250,255,.7)");
        g.addColorStop(0.25, "rgba(235,250,255,.14)");
        g.addColorStop(1, "transparent");
        x.fillStyle = g;
        x.beginPath(); x.arc(lx, standTop + 8, 90, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#E6F1F8";
        x.fillRect(lx - 8, standTop + 4, 16, 5);
      }

      /* شريط لوحات LED */
      const bh = panH - boardTop;
      const led = x.createLinearGradient(0, boardTop, 0, panH);
      led.addColorStop(0, "#0A121C"); led.addColorStop(1, "#0D1520");
      x.fillStyle = led; x.fillRect(0, boardTop, panW, bh);
      x.fillStyle = "rgba(198,255,0,.9)";
      x.fillRect(0, boardTop, panW, 1.6);
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = `700 ${Math.max(9, bh * 0.52)}px Rajdhani, Arial`;
      const msgs = ["FOOTBALL FUTURE", "PLAY · GROW · WIN", "FUTURE CUP"];
      const colors = [LIME, CYAN, "#EAF2F8"];
      const segW = 240;
      for (let sx = segW / 2, i = 0; sx < panW; sx += segW, i++) {
        x.fillStyle = colors[i % 3];
        x.globalAlpha = 0.85;
        x.fillText(msgs[i % 3], sx, boardTop + bh / 2 + 1);
        x.globalAlpha = 0.25;
        x.fillRect(sx + segW / 2 - 1, boardTop + 4, 1, bh - 8);
        x.globalAlpha = 1;
      }
      this.backdrop = c;
    }

    draw() {
      const ctx = this.ctx;
      const vw = this.view.w, vh = this.view.h;
      const sh = this.shake;
      const shx = sh ? (Math.random() - .5) * sh : 0;
      const shy = sh ? (Math.random() - .5) * sh : 0;

      ctx.save();
      ctx.translate(shx, shy);

      /* 1) المدرج البانورامي (بارالاكس مع الكاميرا) */
      ctx.fillStyle = "#05070C";
      ctx.fillRect(-8, -8, vw + 16, vh + 16);
      if (this.backdrop) {
        const dx = vw / 2 - (this.camX + this.panPad) * this.kFar;
        ctx.drawImage(this.backdrop, dx, 0);
        // وميض جمهور حي
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 22; i++) {
          const h1 = hash(i * 13.7 + Math.floor(this.time * 3));
          const h2 = hash(i * 7.3 + Math.floor(this.time * 3) * 1.7);
          ctx.fillStyle = i % 5 === 0 ? LIME : i % 5 === 1 ? CYAN : "#EAF2F8";
          ctx.fillRect(h1 * vw, this.py0 * (0.14 + h2 * 0.6), 2.2, 2.2);
        }
        ctx.globalAlpha = 1;
      }

      /* 2) أرضية العشب بمنظور */
      this.drawGrass(ctx, vw, vh);

      /* 3) خطوط الملعب بمنظور */
      this.drawLines(ctx);

      /* 4) المرميان */
      this.drawGoal(FX, CYAN, ctx);
      this.drawGoal(W - FX, LIME, ctx);

      /* 5) أثر الكرة */
      const b = this.ball;
      if (!b.owner && Math.hypot(b.vx, b.vy) > 120) {
        this.trail.push({ x: b.x, y: b.y, z: b.z });
        if (this.trail.length > 9) this.trail.shift();
      } else if (this.trail.length) this.trail.shift();
      for (let i = 0; i < this.trail.length; i++) {
        const k = i / this.trail.length;
        const tp = this.proj(this.trail[i].x, this.trail[i].y);
        ctx.fillStyle = `rgba(198,255,0,${k * 0.3})`;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y - this.trail[i].z * tp.s * 0.55, BR * 0.55 * tp.s * k, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 6) الكيانات بترتيب العمق */
      const drawables = this.all.map(p => ({ y: p.y, fn: () => this.drawPlayer(ctx, p) }));
      drawables.push({ y: b.y, fn: () => this.drawBall(ctx) });
      drawables.sort((m, n) => m.y - n.y);
      for (const d of drawables) d.fn();

      /* 7) الجسيمات */
      this.drawParticles(ctx);

      ctx.restore();

      /* 8) وميض الهدف واللافتات */
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(198,255,0,${this.flash * 0.15})`;
        ctx.fillRect(0, 0, vw, vh);
      }
      this.drawOverlay(ctx, vw, vh);
    }

    drawGrass(ctx, vw, vh) {
      // مساحة العشب: من خط التماس البعيد حتى أسفل الشاشة
      const g = ctx.createLinearGradient(0, this.py0, 0, vh);
      g.addColorStop(0, "#0E4A2B");
      g.addColorStop(0.45, "#12613A");
      g.addColorStop(1, "#0A3B22");
      ctx.fillStyle = g;
      ctx.fillRect(-8, this.py0, vw + 16, vh - this.py0 + 8);

      // خطوط القص العمودية (شبه منحرفة بالمنظور)
      const stripes = 16, sw = (W + 1400) / stripes;
      for (let i = 0; i < stripes; i++) {
        if (i % 2) continue;
        const x0 = -700 + i * sw, x1 = x0 + sw;
        const fT = this.proj(x0, FY), fB = this.proj(x0, H - FY + 260);
        const gT = this.proj(x1, FY), gB = this.proj(x1, H - FY + 260);
        ctx.fillStyle = "rgba(255,255,255,.035)";
        ctx.beginPath();
        ctx.moveTo(fT.x, this.py0); ctx.lineTo(gT.x, this.py0);
        ctx.lineTo(gB.x, vh + 8); ctx.lineTo(fB.x, vh + 8);
        ctx.closePath(); ctx.fill();
      }

      // إضاءة كشافات مركزية على العشب
      const spot = ctx.createRadialGradient(vw / 2, (this.py0 + vh) / 2, 30, vw / 2, (this.py0 + vh) / 2, vw * 0.62);
      spot.addColorStop(0, "rgba(220,255,235,.055)");
      spot.addColorStop(1, "rgba(0,0,0,.22)");
      ctx.fillStyle = spot;
      ctx.fillRect(-8, this.py0, vw + 16, vh - this.py0 + 8);
    }

    /* رسم خط عالمي مُسقط */
    line(ctx, x0, y0, x1, y1) {
      const a = this.proj(x0, y0), b = this.proj(x1, y1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    drawLines(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(240,255,248,.82)";
      ctx.shadowColor = "rgba(190,255,220,.35)";
      ctx.shadowBlur = 5;

      const lwFar = 1.4, lwNear = 2.6;
      // الحدود
      ctx.lineWidth = lwFar;   this.line(ctx, FX, FY, W - FX, FY);
      ctx.lineWidth = lwNear;  this.line(ctx, FX, H - FY, W - FX, H - FY);
      ctx.lineWidth = 2;       this.line(ctx, FX, FY, FX, H - FY);
                               this.line(ctx, W - FX, FY, W - FX, H - FY);
      // خط المنتصف
      this.line(ctx, W / 2, FY, W / 2, H - FY);

      // دائرة المنتصف (مضلع مُسقط)
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * Math.PI * 2;
        const p = this.proj(W / 2 + Math.cos(a) * 92, H / 2 + Math.sin(a) * 92);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // شعار الهوية باهت في دائرة المنتصف
      const cc = this.proj(W / 2, H / 2);
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = LIME;
      ctx.font = `900 ${Math.round(46 * cc.s)}px Rajdhani, Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("FF", cc.x, cc.y);
      ctx.restore();

      // منطقتا الجزاء والمرمى
      const paW = 158, paH = 330, gaW = 62, gaH = 190;
      const box = (bx, bw) => {
        this.line(ctx, bx, H / 2 - paH / 2, bx + bw, H / 2 - paH / 2);
        this.line(ctx, bx, H / 2 + paH / 2, bx + bw, H / 2 + paH / 2);
        this.line(ctx, bx + (bw > 0 ? bw : bw), H / 2 - paH / 2, bx + bw, H / 2 + paH / 2);
      };
      // يسار
      this.line(ctx, FX, H / 2 - paH / 2, FX + paW, H / 2 - paH / 2);
      this.line(ctx, FX, H / 2 + paH / 2, FX + paW, H / 2 + paH / 2);
      this.line(ctx, FX + paW, H / 2 - paH / 2, FX + paW, H / 2 + paH / 2);
      this.line(ctx, FX, H / 2 - gaH / 2, FX + gaW, H / 2 - gaH / 2);
      this.line(ctx, FX, H / 2 + gaH / 2, FX + gaW, H / 2 + gaH / 2);
      this.line(ctx, FX + gaW, H / 2 - gaH / 2, FX + gaW, H / 2 + gaH / 2);
      // يمين
      this.line(ctx, W - FX, H / 2 - paH / 2, W - FX - paW, H / 2 - paH / 2);
      this.line(ctx, W - FX, H / 2 + paH / 2, W - FX - paW, H / 2 + paH / 2);
      this.line(ctx, W - FX - paW, H / 2 - paH / 2, W - FX - paW, H / 2 + paH / 2);
      this.line(ctx, W - FX, H / 2 - gaH / 2, W - FX - gaW, H / 2 - gaH / 2);
      this.line(ctx, W - FX, H / 2 + gaH / 2, W - FX - gaW, H / 2 + gaH / 2);
      this.line(ctx, W - FX - gaW, H / 2 - gaH / 2, W - FX - gaW, H / 2 + gaH / 2);

      // قوسا الجزاء
      const arc = (cx, from, to) => {
        ctx.beginPath();
        for (let i = 0; i <= 18; i++) {
          const a = from + (to - from) * i / 18;
          const p = this.proj(cx + Math.cos(a) * 62, H / 2 + Math.sin(a) * 62);
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      };
      arc(FX + paW, -Math.PI / 2.6, Math.PI / 2.6);
      arc(W - FX - paW, Math.PI - Math.PI / 2.6, Math.PI + Math.PI / 2.6);

      // نقاط الجزاء والمنتصف
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(240,255,248,.82)";
      for (const px of [FX + 106, W - FX - 106, W / 2]) {
        const p = this.proj(px, H / 2);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.4 * p.s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    /* مرمى ثلاثي الأبعاد بشباك */
    drawGoal(gx, color, ctx) {
      const out = gx < W / 2 ? -1 : 1;
      const pT = this.proj(gx, GOAL_TOP), pB = this.proj(gx, GOAL_BOT);
      const hT = 56 * pT.s, hB = 56 * pB.s;          // ارتفاع كل قائم حسب عمقه
      const dT = 24 * pT.s * out, dB = 24 * pB.s * out;
      const ftT = { x: pT.x, y: pT.y - hT };          // أعلى القائم البعيد
      const ftB = { x: pB.x, y: pB.y - hB };          // أعلى القائم القريب
      const bkT = { x: pT.x + dT, y: pT.y - hT * 0.42 };
      const bkB = { x: pB.x + dB, y: pB.y - hB * 0.42 };
      const gT  = { x: pT.x + dT, y: pT.y };
      const gB  = { x: pB.x + dB, y: pB.y };
      const sMid = (pT.s + pB.s) / 2;

      ctx.save();
      // توهج خلف المرمى
      const cx = (pT.x + pB.x) / 2 + dT, cy = (ftT.y + pB.y) / 2;
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 110 * sMid);
      glow.addColorStop(0, color === LIME ? "rgba(198,255,0,.20)" : "rgba(0,229,255,.20)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 120 * sMid, cy - 120 * sMid, 240 * sMid, 240 * sMid);

      // نسيج الشباك: تعبئة خفيفة ثم شبكة
      ctx.fillStyle = "rgba(255,255,255,.05)";
      ctx.beginPath();
      ctx.moveTo(ftT.x, ftT.y); ctx.lineTo(bkT.x, bkT.y); ctx.lineTo(gT.x, gT.y); ctx.lineTo(pT.x, pT.y);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ftB.x, ftB.y); ctx.lineTo(bkB.x, bkB.y); ctx.lineTo(gB.x, gB.y); ctx.lineTo(pB.x, pB.y);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bkT.x, bkT.y); ctx.lineTo(bkB.x, bkB.y); ctx.lineTo(gB.x, gB.y); ctx.lineTo(gT.x, gT.y);
      ctx.closePath(); ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = 0.8;
      // خطوط الشبكة الخلفية (عمودية وأفقية)
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        ctx.beginPath();
        ctx.moveTo(lerp(bkT.x, bkB.x, k), lerp(bkT.y, bkB.y, k));
        ctx.lineTo(lerp(gT.x, gB.x, k), lerp(gT.y, gB.y, k));
        ctx.stroke();
      }
      for (let i = 0; i <= 3; i++) {
        const k = i / 3;
        ctx.beginPath();
        ctx.moveTo(lerp(bkT.x, gT.x, k), lerp(bkT.y, gT.y, k));
        ctx.lineTo(lerp(bkB.x, gB.x, k), lerp(bkB.y, gB.y, k));
        ctx.stroke();
      }
      // شبكة جانبية علوية
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        ctx.beginPath();
        ctx.moveTo(lerp(ftT.x, pT.x, k), lerp(ftT.y, pT.y, k));
        ctx.lineTo(lerp(bkT.x, gT.x, k), lerp(bkT.y, gT.y, k));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lerp(ftB.x, pB.x, k), lerp(ftB.y, pB.y, k));
        ctx.lineTo(lerp(bkB.x, gB.x, k), lerp(bkB.y, gB.y, k));
        ctx.stroke();
      }

      // القائمان والعارضة
      ctx.strokeStyle = "#F4F8FB";
      ctx.lineCap = "round";
      ctx.shadowColor = color; ctx.shadowBlur = 13;
      ctx.lineWidth = Math.max(2.2, 3.6 * pT.s);
      ctx.beginPath(); ctx.moveTo(pT.x, pT.y); ctx.lineTo(ftT.x, ftT.y); ctx.stroke();
      ctx.lineWidth = Math.max(2.4, 3.6 * pB.s);
      ctx.beginPath(); ctx.moveTo(pB.x, pB.y); ctx.lineTo(ftB.x, ftB.y); ctx.stroke();
      ctx.lineWidth = Math.max(2.2, 3.6 * sMid);
      ctx.beginPath(); ctx.moveTo(ftT.x, ftT.y); ctx.lineTo(ftB.x, ftB.y); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* لاعب مجسّم بحركة جري */
    drawPlayer(ctx, p) {
      const isUser = p === this.controlled;
      const isGK = p.role === "GK";
      const pos = this.proj(p.x, p.y);
      const u = pos.s;                       // وحدة القياس المنظورية
      const hgt = 57 * u;                    // طول اللاعب بالبكسل

      const kit     = p.side === 1 ? (isGK ? "#FFD23F" : "#1A2430") : (isGK ? "#3E2A56" : "#E8ECF2");
      const kitLite = p.side === 1 ? (isGK ? "#FFE58A" : "#273548") : (isGK ? "#5A3E7E" : "#FFFFFF");
      const accent  = p.side === 1 ? LIME : "#FF4D5E";
      const shorts  = p.side === 1 ? "#0C1218" : "#C3341F";
      const skin    = p.side === 1 ? "#E8C39E" : "#D9A67F";
      const moving = Math.hypot(p.vx, p.vy) > 14;
      const ph = p.phase;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      /* ظل وحلقة التحكم على العشب */
      ctx.fillStyle = "rgba(0,0,0,.42)";
      ctx.beginPath(); ctx.ellipse(0, 1.5 * u, 13 * u, 4.6 * u, 0, 0, Math.PI * 2); ctx.fill();
      if (isUser) {
        ctx.save();
        ctx.strokeStyle = LIME; ctx.lineWidth = 2.2;
        ctx.setLineDash([7 * u, 5 * u]);
        ctx.lineDashOffset = -this.time * 40;
        ctx.shadowColor = LIME; ctx.shadowBlur = 9;
        ctx.beginPath(); ctx.ellipse(0, 1.5 * u, 17 * u, 6.4 * u, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      /* اتجاه النظر */
      ctx.scale(p.dirX < 0 ? -1 : 1, 1);

      const swing = moving ? Math.sin(ph) : 0;
      const swing2 = moving ? Math.sin(ph + Math.PI) : 0;
      const bob = moving ? Math.abs(Math.sin(ph)) * 1.6 * u : 0;

      const hipY = -hgt * 0.42 - bob;
      const shoY = -hgt * 0.74 - bob;

      ctx.lineCap = "round";

      /* الرجل الخلفية */
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3.4 * u;
      ctx.beginPath();
      ctx.moveTo(-1.2 * u, hipY);
      ctx.lineTo(-1.2 * u + swing2 * 6.5 * u, hipY + hgt * 0.24);
      ctx.lineTo(-1.2 * u + swing2 * 9.5 * u, -2 * u - Math.max(0, swing2) * 3.4 * u);
      ctx.stroke();
      // حذاء
      ctx.strokeStyle = "#0B0F14";
      ctx.lineWidth = 3.8 * u;
      ctx.beginPath();
      ctx.moveTo(-1.2 * u + swing2 * 9.5 * u, -1.6 * u - Math.max(0, swing2) * 3.4 * u);
      ctx.lineTo(1.2 * u + swing2 * 9.5 * u, -1.2 * u - Math.max(0, swing2) * 3.4 * u);
      ctx.stroke();

      /* الشورت */
      ctx.fillStyle = shorts;
      ctx.beginPath();
      ctx.roundRect(-5.4 * u, hipY - 3.5 * u, 10.8 * u, 8 * u, 2.6 * u);
      ctx.fill();

      /* الرجل الأمامية */
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3.6 * u;
      ctx.beginPath();
      ctx.moveTo(1.4 * u, hipY);
      ctx.lineTo(1.4 * u + swing * 6.5 * u, hipY + hgt * 0.24);
      ctx.lineTo(1.4 * u + swing * 9.5 * u, -2 * u - Math.max(0, swing) * 3.4 * u);
      ctx.stroke();
      ctx.strokeStyle = "#10161D";
      ctx.lineWidth = 4 * u;
      ctx.beginPath();
      ctx.moveTo(1.4 * u + swing * 9.5 * u, -1.6 * u - Math.max(0, swing) * 3.4 * u);
      ctx.lineTo(4 * u + swing * 9.5 * u, -1.2 * u - Math.max(0, swing) * 3.4 * u);
      ctx.stroke();

      /* الذراع الخلفية */
      ctx.strokeStyle = skin;
      ctx.lineWidth = 2.8 * u;
      ctx.beginPath();
      ctx.moveTo(-4.6 * u, shoY + 2 * u);
      ctx.lineTo(-4.6 * u - swing * 5.5 * u, shoY + hgt * 0.17);
      ctx.stroke();

      /* الجذع (القميص) */
      const jg = ctx.createLinearGradient(0, shoY, 0, hipY);
      jg.addColorStop(0, kitLite); jg.addColorStop(1, kit);
      ctx.fillStyle = jg;
      ctx.beginPath();
      ctx.roundRect(-6.4 * u, shoY, 12.8 * u, (hipY - shoY) + 4 * u, 3.4 * u);
      ctx.fill();
      // شريط الهوية المائل على القميص
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-6.4 * u, shoY, 12.8 * u, (hipY - shoY) + 4 * u, 3.4 * u);
      ctx.clip();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(-6.4 * u, shoY + 2 * u); ctx.lineTo(-2.4 * u, shoY);
      ctx.lineTo(1.6 * u, hipY + 4 * u); ctx.lineTo(-2.4 * u, hipY + 4 * u);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      // الرقم على القميص
      ctx.fillStyle = p.side === 1 ? "#EAF6FF" : "#10161D";
      ctx.font = `800 ${6.4 * u}px Rajdhani, Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.scale(p.dirX < 0 ? -1 : 1, 1);
      ctx.fillText(String(p.num), 0, (shoY + hipY) / 2 + 1.4 * u);
      ctx.restore();

      /* الذراع الأمامية */
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.moveTo(4.8 * u, shoY + 2 * u);
      ctx.lineTo(4.8 * u + swing2 * 5.5 * u, shoY + hgt * 0.17);
      ctx.stroke();

      /* الرأس والشعر */
      const headY = shoY - 4.6 * u;
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(1.2 * u, headY, 4.4 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#151A20";
      ctx.beginPath(); ctx.arc(0.6 * u, headY - 1.2 * u, 4.3 * u, Math.PI * 0.95, Math.PI * 2.02); ctx.fill();

      ctx.restore();

      /* اسم اللاعب المتحكَّم به فوق رأسه */
      if (isUser) {
        ctx.save();
        ctx.font = `700 ${Math.max(10, 10.5 * u)}px "Noto Kufi Arabic", Arial`;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.shadowColor = "#000"; ctx.shadowBlur = 6;
        ctx.fillText(p.name, pos.x, pos.y - hgt - 8 * u);
        // مؤشر مثلث
        ctx.shadowBlur = 0;
        ctx.fillStyle = LIME;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - hgt - 3 * u);
        ctx.lineTo(pos.x - 4.5 * u, pos.y - hgt - 8 * u);
        ctx.lineTo(pos.x + 4.5 * u, pos.y - hgt - 8 * u);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    drawBall(ctx) {
      const b = this.ball;
      const pos = this.proj(b.x, b.y);
      const u = pos.s;
      const r = 5.4 * u;
      const lift = b.z * u * 0.55;

      ctx.save();
      // الظل على العشب
      const shScale = clamp(1 - b.z / 220, 0.45, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.42 * shScale})`;
      ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 1 * u, r * shScale, r * 0.42 * shScale, 0, 0, Math.PI * 2); ctx.fill();

      // الكرة
      ctx.translate(pos.x, pos.y - r - lift);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 0.5, 0, 0, r + 1.5);
      g.addColorStop(0, "#FFFFFF"); g.addColorStop(0.72, "#E9F0F5"); g.addColorStop(1, "#B7C4CF");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(10,16,22,.5)"; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.rotate(b.spin);
      ctx.fillStyle = "#161D26";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76, r * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    drawParticles(ctx) {
      for (const pt of this.particles) {
        const pos = this.proj(pt.x, pt.y);
        if (pt.ring) {
          ctx.globalAlpha = clamp(pt.t / 0.45, 0, 1);
          ctx.strokeStyle = pt.c; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.ellipse(pos.x, pos.y, pt.r * pos.s, pt.r * pos.s * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.save();
        ctx.globalAlpha = clamp(pt.t, 0, 1);
        ctx.translate(pos.x, pos.y - 20 * pos.s);
        if (pt.rot != null) ctx.rotate(pt.rot);
        ctx.fillStyle = pt.c;
        const sz = pt.size * pos.s;
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz * 0.7);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    drawOverlay(ctx, w, h) {
      if (this.messageTime <= 0) return;
      const alpha = clamp(this.messageTime / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 18px "Noto Kufi Arabic", Arial';
      const tw = ctx.measureText(this.message).width + 58;
      const bx = w / 2 - tw / 2, by = h * 0.135;
      ctx.fillStyle = "rgba(11,15,20,.84)";
      ctx.strokeStyle = "rgba(198,255,0,.6)";
      ctx.lineWidth = 1.4;
      ctx.shadowColor = "rgba(198,255,0,.4)"; ctx.shadowBlur = 20;
      roundRect(ctx, bx, by, tw, 46, 12);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = LIME;
      ctx.beginPath();
      ctx.moveTo(bx + 15, by + 9); ctx.lineTo(bx + 23, by + 9);
      ctx.lineTo(bx + 17, by + 37); ctx.lineTo(bx + 9, by + 37);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(this.message, w / 2 + 10, by + 24);
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
