/* ═══════════════════════════════════════════════════════════════════
   فوتبول فيوتشر — محرك المباراة v5
   جرافيكس بمستوى ألعاب الفيديو، مصمم للجوال أولاً:
   • أرضية ملعب بنسيج منظوري حقيقي (تقنية Mode-7 بمسح سطري):
     مربعات قص متعامدة وخطوط حادة مرسومة في خامة عالمية تُسقط لكل صف شاشة.
   • لاعبون بمواصفات حزمة الهوية (لوحة 04): طقم أسود بقصّة ليمونية وياقة
     سماوية وجوارب ليمونية — أجسام ممتلئة بميلان جري ووضعية تسديد.
   • كاميرا بث تتبع الكرة، مدرج بانورامي، لوحات LED، مرميان بشباك،
     قوس طيران للكرة، واحتفالات سينمائية.
   API المتاح للتطبيق:
     new FootballFutureEngine(canvas, {onEvent, onEnd})
     .start() .stop() .destroy() .setInput() .action() .getTimeText()
     .score .clock .duration .pitch .home .away .ball .controlled
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── عالم اللعب (إحداثيات منطقية علوية — الفيزياء مستقلة عن العرض) ── */
  const W = 1280, H = 800;
  const FX = 132, FY = 132;
  const FW = W - FX * 2, FH = H - FY * 2;
  const GOAL_W = 168;
  const GOAL_TOP = H / 2 - GOAL_W / 2, GOAL_BOT = H / 2 + GOAL_W / 2;
  const PR = 15;
  const BR = 8;

  const LIME = "#C6FF00", CYAN = "#00E5FF", TEAL = "#00BFAE";

  /* نسيج الأرضية: دقة الخامة وامتدادها خارج الملعب */
  const TS = 1.2;              // بكسل خامة / وحدة عالم
  const PAD = 720;             // امتداد العشب خلف المرمى وخارج الرؤية

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

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

  /* أطقم الهوية (لوحة هوية اللاعب 04):
     الفريق: أسود فحمي + قصّة ليمونية + ياقة/أكمام سماوية + جوارب ليمونية */
  const KITS = {
    home:    { shirt0: "#1A222D", shirt1: "#0C1219", slash: LIME,    trim: CYAN,    shorts: "#0B1016", sock: LIME,    num: LIME,    skin: "#E8C39E", hair: "#171C22" },
    // (قصّة الفريق وجواربه تُستبدل بلون التخصيص عند تفعيله — انظر kitFor)
    homeGK:  { shirt0: "#FFDF66", shirt1: "#E4B62B", slash: "#0C1219", trim: "#0C1219", shorts: "#12181F", sock: "#FFDF66", num: "#0C1219", skin: "#E8C39E", hair: "#171C22" },
    away:    { shirt0: "#F4F7FA", shirt1: "#CDD7E0", slash: "#FF4D5E", trim: "#B02A30", shorts: "#B02A30", sock: "#F4F7FA", num: "#B02A30", skin: "#D9A67F", hair: "#26160F" },
    awayGK:  { shirt0: "#8E5CFF", shirt1: "#6234C9", slash: "#F4F7FA", trim: "#F4F7FA", shorts: "#2A1B4E", sock: "#8E5CFF", num: "#FFFFFF", skin: "#D9A67F", hair: "#26160F" }
  };

  class FootballFutureEngine {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.options = options || {};
      this.onEnd = this.options.onEnd || function () {};
      this.onEvent = this.options.onEvent || function () {};
      this.diff = clamp(this.options.difficulty || 1, 0.7, 1.4);   // سهل 0.85 / متوسط 1 / صعب 1.2
      // تخصيص اللاعب (من شاشة الهوية): الاسم، الرقم، لون القصّة، شارة الكابتن، ذيل الكرة
      this.custom = {
        name: (this.options.playerName || "علي").slice(0, 12),
        number: this.options.playerNumber || 10,
        accent: this.options.kitAccent || LIME,
        captain: Boolean(this.options.captain),
        ballTrail: this.options.ballTrail || null
      };
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
      this.restartInfo = null;      // رمية تماس / ركنية / ركلة مرمى
      this.celebFocus = null;       // تركيز الكاميرا على المحتفل
      this.goalBannerT = 0;
      this.goalBannerText = "";
      this.camX = W / 2;
      this.history = [];            // مخزن لقطات آخر ثانيتين (لإعادة الهدف)
      this.replayQ = null;          // إطارات الإعادة الجارية
      this.replayIdx = 0;
      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.buildPitchTexture();
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
        const isMe = side === 1 && f.role === "ST";
        return {
          id: (side === 1 ? "h" : "a") + i,
          name: isMe ? this.custom.name : side === 1 ? HOME_NAMES[i] : AWAY_NAMES[i],
          num: isMe ? this.custom.number : NUMS[i], role: f.role, side,
          home: { x: FX + fx * FW, y: FY + f.fy * FH },
          x: FX + fx * FW, y: FY + f.fy * FH,
          vx: 0, vy: 0, face: side === 1 ? 0 : Math.PI,
          dirX: side, phase: hash(i * 7) * 6, kickT: 0,
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
      for (const p of this.all) { p.x = p.home.x; p.y = p.home.y; p.vx = p.vy = 0; p.kickT = 0; }
      const b = this.ball;
      b.x = W / 2; b.y = H / 2; b.vx = b.vy = 0; b.z = 0; b.vz = 0;
      b.owner = null; b.lastKick = null; b.passTo = null;
      // استئناف حقيقي: الكرة تُسلَّم مباشرة لصاحب ضربة البداية — لا تزاحم على المنتصف
      const me = this.home.find(p => p.role === "ST");
      if (this.controlled) this.controlled.user = false;
      me.user = true; this.controlled = me;
      const starter = concededBy === "away"
        ? this.away.find(p => p.role === "CM")
        : me;
      if (starter) {
        starter.x = W / 2 - starter.side * 22;
        starter.y = H / 2;
        starter.face = starter.side === 1 ? 0 : Math.PI;
        b.owner = starter;
      }
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
      this.py0 = vh * 0.235;
      this.py1 = vh * 0.99;
      this.kNear = Math.max(vh / 600, vw / 1450);
      this.kFar = this.kNear * 0.5;
      const halfNear = vw / 2 / this.kNear;
      this.camMin = Math.min(W / 2, halfNear * 0.9);
      this.camMax = Math.max(W / 2, W - halfNear * 0.9);
      this.buildBackdrop();
    }

    /* إسقاط: عالم → شاشة */
    proj(wx, wy) {
      const t = clamp((wy - FY) / FH, -0.35, 1.3);
      const tc = clamp(t, 0, 1.15);
      const s = this.kFar + (this.kNear - this.kFar) * tc;
      const y = this.py0 + (this.py1 - this.py0) * (t * (0.7 + 0.3 * tc));
      const x = this.view.w / 2 + (wx - this.camX) * s;
      return { x, y, s };
    }
    /* عكس الإسقاط: صف شاشة → عمق عالم (لرسم الأرضية سطرياً) */
    unprojRow(sy) {
      const q = (sy - this.py0) / (this.py1 - this.py0);
      const t = (-0.7 + Math.sqrt(0.49 + 1.2 * Math.max(0, q))) / 0.6;
      return { t, wy: FY + t * FH, k: this.kFar + (this.kNear - this.kFar) * clamp(t, 0, 1.15) };
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

      const focus = this.celebFocus != null ? this.celebFocus : this.ball.x;
      const camTarget = clamp(focus, this.camMin, this.camMax);
      this.camX += (camTarget - this.camX) * Math.min(1, dt * 3.4);
      this.goalBannerT = Math.max(0, this.goalBannerT - dt);

      if (this.freeze > 0) {
        this.freeze -= dt;
        // حركة الاحتفال: المسجّل يقفز وزملاؤه يهرعون إليه
        for (const p of this.all) {
          if (p.celebT > 0) {
            p.celebT -= dt;
            p.phase += dt * 9;
            if (p.celebTarget) {
              const d = dist(p, p.celebTarget) || 1;
              if (d > 40) {
                p.x += (p.celebTarget.x - p.x) / d * 150 * dt;
                p.y += (p.celebTarget.y - p.y) / d * 150 * dt;
                p.dirX = p.celebTarget.x > p.x ? 1 : -1;
              }
            }
          }
        }
        if (this.freeze <= 0) {
          this.celebFocus = null;
          for (const p of this.all) { p.celebT = 0; p.celebTarget = null; }
          this.kickoff(this._concededBy);
        }
        return;
      }

      // استئناف اللعب (تماس/ركنية/ركلة مرمى)
      if (this.restartInfo) {
        this.restartInfo.t -= dt;
        this.updateAI(dt);                 // اللاعبون يتمركزون أثناء التحضير
        if (this.restartInfo.t <= 0) { this.execRestart(); }
        return;
      }

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

      for (const p of this.all) {
        const spd = Math.hypot(p.vx, p.vy);
        p.phase += spd * dt * 0.055;
        p.kickT = Math.max(0, p.kickT - dt);
        p.diveT = Math.max(0, (p.diveT || 0) - dt);
        if (p.slideT > 0) {
          p.slideT = Math.max(0, p.slideT - dt);
          p.x = clamp(p.x + p.dirX * 150 * dt, FX + 6, W - FX - 6);   // اندفاع الانزلاق
          if (this.time % 0.07 < dt) this.spawnDust(p);
        }
        if (Math.abs(p.vx) > 12) p.dirX = p.vx > 0 ? 1 : -1;
      }

      // تسجيل لقطة للإعادة (آخر ~1.8 ثانية)
      this.history.push({
        b: { x: this.ball.x, y: this.ball.y, z: this.ball.z },
        ps: this.all.map(p => ({ x: p.x, y: p.y, dirX: p.dirX, phase: p.phase, kickT: p.kickT, diveT: p.diveT || 0, slideT: p.slideT || 0 }))
      });
      if (this.history.length > 55) this.history.shift();
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
          tx = gx; ty = lerp(p.y, H / 2, 0.25); sp = p.side === -1 ? 156 * this.diff : 172;
          const pressers = this.all.filter(o => o.side !== p.side && dist(o, p) < 70);
          const distGoal = Math.abs(p.x - gx);
          if (distGoal < 300 && Math.random() < (p.side === -1 ? 0.72 * this.diff : 1.15) * dt) { this.aiShoot(p); continue; }
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
            tx = carrier.x; ty = carrier.y; sp = p.side === -1 ? 168 * this.diff : 168;
            if (p.side === -1 && p.cd <= 0 && dist(p, carrier) < PR * 2.2 && Math.random() < 1.35 * this.diff * dt) {
              p.cd = 1.1;
              if (Math.random() < 0.3 * this.diff) { b.owner = p; this.msg("الخصم يستخلص الكرة!"); }
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

      if (b.z > 0 || b.vz !== 0) {
        b.z += b.vz * dt;
        b.vz -= 420 * dt;
        if (b.z <= 0) { b.z = 0; b.vz = Math.abs(b.vz) > 60 ? Math.abs(b.vz) * 0.42 : 0; }
      }

      // خروج من خطي التماس → رمية تماس
      if (b.y < FY - 6 || b.y > H - FY + 6) {
        const toSide = b.lastKick ? -b.lastKick.side : 1;
        return this.beginRestart("throw", toSide, clamp(b.x, FX + 30, W - FX - 30), b.y < H / 2 ? FY : H - FY);
      }
      const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOT;
      // خروج من خطي المرمى خارج الفتحة → ركنية أو ركلة مرمى
      if (b.x < FX - 8 && !inMouth) {
        const defenderTouched = b.lastKick && b.lastKick.side === 1;   // يدافع عن اليسار: فريقك
        if (defenderTouched) return this.beginRestart("corner", -1, FX, b.y < H / 2 ? FY : H - FY);
        return this.beginRestart("goalkick", 1, FX + 40, H / 2);
      }
      if (b.x > W - FX + 8 && !inMouth) {
        const defenderTouched = b.lastKick && b.lastKick.side === -1;  // يدافع عن اليمين: الخصم
        if (defenderTouched) return this.beginRestart("corner", 1, W - FX, b.y < H / 2 ? FY : H - FY);
        return this.beginRestart("goalkick", -1, W - FX - 40, H / 2);
      }
      b.x = clamp(b.x, FX - 34, W - FX + 34);
    }

    detectPossession() {
      const b = this.ball;
      if (b.owner || this.freeze > 0 || this.restartInfo) return;
      if (b.z > 26) return;
      const speed = Math.hypot(b.vx, b.vy);
      for (const p of this.all) {
        if (p === b.lastKick && speed > 90) continue;
        if (dist(p, b) < PR + BR + 4) {
          if (p.role === "GK" && b.lastKick && b.lastKick.side !== p.side && speed > 250) {
            const save = Math.random() < (p.side === -1 ? clamp(0.52 + (this.diff - 1) * 0.5, 0.3, 0.85) : clamp(0.72 - (this.diff - 1) * 0.35, 0.45, 0.85));
            p.diveT = 0.6;
            p.diveDir = b.vy >= 0 ? 1 : -1;
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
      if (this.freeze > 0 || b.owner || this.restartInfo) return;
      const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOT;
      if (!inMouth) return;
      if (b.x > W - FX + 10) return this.goal("home");
      if (b.x < FX - 10) return this.goal("away");
    }

    goal(team) {
      this.score[team] += 1;
      if (team === "home") { this.stats.goals += 1; }
      this.shake = 10;
      this.flash = team === "home" ? 1 : 0.4;
      this.spawnConfetti(this.ball.x, this.ball.y, team === "home");
      this.onEvent({ type: "goal", team });
      this._concededBy = team === "home" ? "away" : "home";
      this.ball.owner = null; this.ball.vx = this.ball.vy = 0; this.ball.vz = 0;
      // مشهد الاحتفال
      const squad = team === "home" ? this.home : this.away;
      const scorer = (this.ball.lastKick && this.ball.lastKick.side === (team === "home" ? 1 : -1))
        ? this.ball.lastKick
        : squad.find(p => p.role === "ST");
      if (scorer) {
        scorer.celebT = 2.4;
        scorer.celebTarget = null;
        this.celebFocus = scorer.x;
        squad.filter(p => p !== scorer && p.role !== "GK")
          .sort((a, c) => dist(a, scorer) - dist(c, scorer))
          .slice(0, 3)
          .forEach(p => { p.celebT = 2.2; p.celebTarget = scorer; });
      }
      // إعادة اللقطة السينمائية لأهدافك — نصف سرعة لآخر ثانيتين
      if (team === "home" && this.history.length > 20) {
        this.replayQ = this.history.slice();
        this.replayIdx = 0;
      }
      const replaySec = this.replayQ ? this.replayQ.length / 30 : 0;
      this.freeze = (team === "home" ? 2.6 : 1.9) + replaySec;
      this.goalBannerT = (team === "home" ? 2.4 : 1.6) + replaySec;
      this.goalBannerText = team === "home" ? "هــدف!" : "هدف للخصم";
      this.goalBannerHome = team === "home";
      this.msg(team === "home" ? "تسديدة عالمية من " + (scorer ? scorer.name : "فريقك") : "ارجع بقوة يا بطل!", 2.4);
    }

    /* ─────────────── الاستئنافات: تماس / ركنية / ركلة مرمى ─────────────── */
    beginRestart(type, side, x, y) {
      const b = this.ball;
      b.owner = null; b.vx = b.vy = 0; b.z = 0; b.vz = 0; b.passTo = null; b.lastKick = null;
      b.x = x; b.y = y;
      this.restartInfo = { type, side, x, y, t: type === "corner" ? 1.1 : 0.8 };
      const label = { throw: "رمية تماس", corner: "ركلة ركنية!", goalkick: "ركلة مرمى" }[type];
      this.msg(side === 1 ? label + " لفريقك" : label + " للخصم", 1.4);
      this.onEvent({ type: "restart", kind: type, team: side === 1 ? "home" : "away" });
      // المنفّذ يتحرك لموقع الاستئناف
      const squad = side === 1 ? this.home : this.away;
      let taker;
      if (type === "goalkick") taker = squad.find(p => p.role === "GK");
      else taker = squad.filter(p => p.role !== "GK").sort((a, c) => dist(a, { x, y }) - dist(c, { x, y }))[0];
      this.restartInfo.taker = taker;
      // في الركنية: مهاجمو المنفذ يتوغلون داخل المنطقة
      if (type === "corner") {
        const boxX = side === 1 ? W - FX - 100 : FX + 100;
        squad.filter(p => ["ST", "CM"].includes(p.role)).forEach((p, i) => {
          p.x = boxX + (side === 1 ? -1 : 1) * i * 46;
          p.y = H / 2 + (i ? -52 : 44);
        });
      }
    }

    execRestart() {
      const info = this.restartInfo;
      this.restartInfo = null;
      const b = this.ball;
      const taker = info.taker;
      if (!taker) return;
      taker.x = clamp(info.x, FX + 8, W - FX - 8);
      taker.y = clamp(info.y, FY + 8, H - FY - 8);
      if (info.type === "corner") {
        // عرضية تلقائية نحو نقطة الجزاء
        const spotX = info.side === 1 ? W - FX - 106 : FX + 106;
        taker.kickT = 0.24;
        b.x = taker.x; b.y = taker.y;
        this.kick(taker, spotX, H / 2 + (Math.random() - 0.5) * 90, 520, 150);
        const target = (info.side === 1 ? this.home : this.away).find(p => p.role === "ST");
        b.passTo = target || null;
        this.msg("عرضية داخل المنطقة!");
      } else if (info.type === "goalkick") {
        // الحارس يطلقها طويلة لمنتصف الملعب
        b.x = taker.x; b.y = taker.y;
        taker.kickT = 0.24;
        this.kick(taker, W / 2 + info.side * 120, H / 2 + (Math.random() - 0.5) * 220, 560, 160);
      } else {
        // رمية تماس: تسليم قصير لأقرب زميل
        b.x = taker.x; b.y = taker.y;
        const mate = (info.side === 1 ? this.home : this.away)
          .filter(p => p !== taker && p.role !== "GK")
          .sort((a, c) => dist(a, taker) - dist(c, taker))[0];
        if (mate) { this.kick(taker, mate.x, mate.y, 330, 70); b.passTo = mate; }
      }
    }

    /* تسلل مبسّط: تمريرة لمستلم خلف آخر مدافع في الثلث الهجومي */
    isOffside(passer, receiver) {
      if (!receiver || receiver.role === "GK") return false;
      if (passer.side === 1) {
        const lastDef = Math.max(...this.away.filter(p => p.role !== "GK").map(p => p.x));
        return receiver.x > W * 0.62 && receiver.x > lastDef + 8 && receiver.x > passer.x;
      }
      const lastDef = Math.min(...this.home.filter(p => p.role !== "GK").map(p => p.x));
      return receiver.x < W * 0.38 && receiver.x < lastDef - 8 && receiver.x < passer.x;
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
      if (this.isOffside(owner, mate)) {
        this.msg("تسلل! الكرة للخصم", 1.6);
        this.onEvent({ type: "offside", team: "home" });
        return this.beginRestart("goalkick", -1, W - FX - 40, H / 2);
      }
      const lead = { x: mate.x + mate.vx * 0.22, y: mate.y + mate.vy * 0.22 };
      owner.kickT = 0.22;
      this.kick(owner, lead.x, lead.y, 470, 60);
      this.ball.passTo = mate;
      this.msg("تمريرة متقنة");
    }

    doShoot() {
      const owner = this.ball.owner;
      if (!owner || owner.side !== 1) return;
      const aimY = clamp(H / 2 + this.input.y * (GOAL_W / 2 - 16) + (Math.random() - 0.5) * 60, GOAL_TOP + 10, GOAL_BOT - 10);
      const power = owner.x > W - FX - 380 ? 820 : 640;
      owner.kickT = 0.26;
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
      p.cd = 0.6;
      p.slideT = 0.5;
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
      if (this.isOffside(owner, mate)) {
        this.msg("تسلل على الخصم!", 1.5);
        this.onEvent({ type: "offside", team: "away" });
        return this.beginRestart("goalkick", 1, FX + 40, H / 2);
      }
      owner.kickT = 0.22;
      this.kick(owner, mate.x, mate.y, 430, 55);
      this.ball.passTo = mate;
    }

    aiShoot(owner) {
      const aimY = GOAL_TOP + 14 + Math.random() * (GOAL_W - 28);
      owner.kickT = 0.26;
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

    /* ═══════════════ العرض ═══════════════ */

    /* خامة الأرضية العالمية — تُبنى مرة واحدة بخطوط حادة
       ثم تُسقط سطرياً بمنظور حقيقي (Mode-7) */
    buildPitchTexture() {
      const texW = Math.ceil((W + PAD * 2) * TS);
      const texH = Math.ceil(H * TS);
      const c = document.createElement("canvas");
      c.width = texW; c.height = texH;
      const x = c.getContext("2d");
      x.scale(TS, TS);
      x.translate(PAD, 0);

      /* عشب أساس + مربعات قص متعامدة (نمط بث حقيقي) */
      x.fillStyle = "#0E5230";
      x.fillRect(-PAD, 0, W + PAD * 2, H);
      const stripes = 16, sw = FW / (stripes - 2);
      // أعمدة قص رأسية
      for (let i = -6; i < stripes + 6; i++) {
        if (i % 2) continue;
        x.fillStyle = "rgba(255,255,255,.05)";
        x.fillRect(FX + (i - 1) * sw, 0, sw, H);
      }
      // صفوف قص أفقية (تُكوّن مربعات مع الأعمدة)
      const rows = 10, rh = FH / (rows - 2);
      for (let i = -3; i < rows + 3; i++) {
        if (i % 2) continue;
        x.fillStyle = "rgba(0,0,0,.05)";
        x.fillRect(-PAD, FY + (i - 1) * rh, W + PAD * 2, rh);
      }
      // تعتيم خارج أرضية اللعب (منطقة الأمان)
      x.fillStyle = "rgba(0,0,0,.28)";
      x.fillRect(-PAD, 0, PAD + FX - 26, H);
      x.fillRect(W - FX + 26, 0, PAD + FX - 26, H);
      // إضاءة مركزية
      const spot = x.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.58);
      spot.addColorStop(0, "rgba(235,255,244,.07)");
      spot.addColorStop(1, "rgba(0,0,0,.18)");
      x.fillStyle = spot;
      x.fillRect(-PAD, 0, W + PAD * 2, H);

      /* شعار FF باهت في دائرة المنتصف (الخطوط تُرسم متجهياً فوق الأرضية) */
      x.globalAlpha = 0.12;
      x.fillStyle = LIME;
      x.font = "900 84px Rajdhani, Arial";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText("FF", W / 2, H / 2 + 4);
      x.globalAlpha = 1;

      this.pitchTex = c;
    }

    /* بانوراما المدرج + لوحات LED */
    buildBackdrop() {
      const padWorld = 700;
      this.panPad = padWorld;
      const panW = Math.max(2, Math.ceil((W + padWorld * 2) * this.kFar));
      const panH = Math.max(2, Math.ceil(this.py0));
      const c = document.createElement("canvas");
      c.width = panW; c.height = panH;
      const x = c.getContext("2d");

      const sky = x.createLinearGradient(0, 0, 0, panH);
      sky.addColorStop(0, "#05070C"); sky.addColorStop(1, "#0A1017");
      x.fillStyle = sky; x.fillRect(0, 0, panW, panH);

      const standTop = panH * 0.10, boardTop = panH * 0.80;
      const tier = x.createLinearGradient(0, standTop, 0, boardTop);
      tier.addColorStop(0, "#0D1420"); tier.addColorStop(0.5, "#131C2A"); tier.addColorStop(1, "#0B111B");
      x.fillStyle = tier;
      x.fillRect(0, standTop, panW, boardTop - standTop);
      const roof = x.createLinearGradient(0, 0, panW, 0);
      roof.addColorStop(0, "rgba(0,229,255,.0)"); roof.addColorStop(0.2, "rgba(0,229,255,.55)");
      roof.addColorStop(0.5, "rgba(198,255,0,.55)"); roof.addColorStop(0.8, "rgba(0,229,255,.55)");
      roof.addColorStop(1, "rgba(0,229,255,.0)");
      x.fillStyle = roof;
      x.fillRect(0, standTop, panW, 2.5);

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

      /* وضع الإعادة: استبدال مواضع الكيانات بلقطة مسجلة (نصف سرعة) */
      let snapBackup = null;
      const replaying = this.replayQ && this.replayIdx < this.replayQ.length;
      if (replaying) {
        const snap = this.replayQ[Math.floor(this.replayIdx)];
        this.replayIdx += 0.5;
        snapBackup = {
          b: { x: this.ball.x, y: this.ball.y, z: this.ball.z },
          ps: this.all.map(p => ({ x: p.x, y: p.y, dirX: p.dirX, phase: p.phase, kickT: p.kickT, diveT: p.diveT, slideT: p.slideT, celebT: p.celebT }))
        };
        this.ball.x = snap.b.x; this.ball.y = snap.b.y; this.ball.z = snap.b.z;
        this.all.forEach((p, i) => {
          const sp = snap.ps[i];
          p.x = sp.x; p.y = sp.y; p.dirX = sp.dirX; p.phase = sp.phase;
          p.kickT = sp.kickT; p.diveT = sp.diveT; p.slideT = sp.slideT; p.celebT = 0;
        });
        if (this.replayIdx >= this.replayQ.length) this._replayDone = true;
      }

      const sh = this.shake;
      const shx = sh ? (Math.random() - .5) * sh : 0;
      const shy = sh ? (Math.random() - .5) * sh : 0;

      ctx.save();
      ctx.translate(shx, shy);

      /* 1) المدرج البانورامي */
      ctx.fillStyle = "#05070C";
      ctx.fillRect(-10, -10, vw + 20, vh + 20);
      if (this.backdrop) {
        const dx = vw / 2 - (this.camX + this.panPad) * this.kFar;
        ctx.drawImage(this.backdrop, dx, 0);
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 22; i++) {
          const h1 = hash(i * 13.7 + Math.floor(this.time * 3));
          const h2 = hash(i * 7.3 + Math.floor(this.time * 3) * 1.7);
          ctx.fillStyle = i % 5 === 0 ? LIME : i % 5 === 1 ? CYAN : "#EAF2F8";
          ctx.fillRect(h1 * vw, this.py0 * (0.14 + h2 * 0.6), 2.2, 2.2);
        }
        ctx.globalAlpha = 1;
      }

      /* 2) الأرضية بالمسح السطري المنظوري (Mode-7) */
      this.drawGroundMode7(ctx, vw, vh);

      /* 3) خطوط الملعب متجهية حادة فوق الأرضية */
      this.drawLines(ctx);

      /* 4) ظل المدرج على أعلى الملعب (عمق) */
      const contact = ctx.createLinearGradient(0, this.py0, 0, this.py0 + vh * 0.09);
      contact.addColorStop(0, "rgba(0,0,0,.45)");
      contact.addColorStop(1, "transparent");
      ctx.fillStyle = contact;
      ctx.fillRect(0, this.py0, vw, vh * 0.09);

      /* 4) المرميان */
      this.drawGoal(FX, CYAN, ctx);
      this.drawGoal(W - FX, LIME, ctx);

      /* 5) أثر الكرة */
      const b = this.ball;
      if (!b.owner && Math.hypot(b.vx, b.vy) > 120) {
        this.trail.push({ x: b.x, y: b.y, z: b.z });
        if (this.trail.length > 9) this.trail.shift();
      } else if (this.trail.length) this.trail.shift();
      const trailRGB = this.custom.ballTrail === "#FFD34D" ? "255,211,77" : "198,255,0";
      for (let i = 0; i < this.trail.length; i++) {
        const k = i / this.trail.length;
        const tp = this.proj(this.trail[i].x, this.trail[i].y);
        ctx.fillStyle = `rgba(${trailRGB},${k * (this.custom.ballTrail ? 0.45 : 0.3)})`;
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

      /* 8) استعادة الحالة الحية بعد رسم لقطة الإعادة */
      if (snapBackup) {
        this.ball.x = snapBackup.b.x; this.ball.y = snapBackup.b.y; this.ball.z = snapBackup.b.z;
        this.all.forEach((p, i) => {
          const sp = snapBackup.ps[i];
          p.x = sp.x; p.y = sp.y; p.dirX = sp.dirX; p.phase = sp.phase;
          p.kickT = sp.kickT; p.diveT = sp.diveT; p.slideT = sp.slideT; p.celebT = sp.celebT;
        });
        if (this._replayDone) { this.replayQ = null; this._replayDone = false; }
      }

      /* 9) أشرطة سينمائية + شارة الإعادة أثناء عرض اللقطة */
      if (replaying) {
        const barH = vh * 0.085;
        ctx.fillStyle = "rgba(4,6,10,.92)";
        ctx.fillRect(0, 0, vw, barH);
        ctx.fillRect(0, vh - barH, vw, barH);
        ctx.save();
        ctx.font = '800 13px Rajdhani, Arial';
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = LIME;
        const blink = Math.floor(this.time * 3) % 2 === 0;
        if (blink) { ctx.beginPath(); ctx.arc(18, barH / 2, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillText("REPLAY", 30, barH / 2 + 1);
        ctx.font = '700 13px "Noto Kufi Arabic", Arial';
        ctx.textAlign = "right";
        ctx.fillStyle = "#EAF2F8";
        ctx.fillText("إعادة اللقطة", vw - 16, barH / 2 + 1);
        ctx.restore();
      }

      /* 10) وميض الهدف واللافتات (اللافتة الكبيرة بعد انتهاء الإعادة) */
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(198,255,0,${this.flash * 0.15})`;
        ctx.fillRect(0, 0, vw, vh);
      }
      if (!replaying) this.drawOverlay(ctx, vw, vh);
    }

    /* المسح السطري: كل شريحة شاشة تُملأ من صف الخامة الموافق لعمقها */
    drawGroundMode7(ctx, vw, vh) {
      const tex = this.pitchTex;
      const band = 2;
      let prev = this.unprojRow(this.py0);
      for (let y = Math.floor(this.py0); y < vh; y += band) {
        const cur = this.unprojRow(y + band);
        const wy0 = clamp(prev.wy, 0, H - 0.5);
        const wy1 = clamp(cur.wy, wy0 + 0.25, H);
        const k = prev.k;
        const visHalf = vw / 2 / k;
        const sx = (this.camX - visHalf + PAD) * TS;
        const sy = wy0 * TS;
        const sw = visHalf * 2 * TS;
        const shh = Math.max(0.5, (wy1 - wy0) * TS);
        ctx.drawImage(tex, sx, sy, sw, shh, 0, y, vw, band);
        prev = cur;
      }
    }

    /* خط عالمي مُسقط */
    line(ctx, x0, y0, x1, y1) {
      const a = this.proj(x0, y0), b = this.proj(x1, y1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    drawLines(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(245,255,250,.88)";
      ctx.lineCap = "round";

      const lw = t => Math.max(1.2, 2.6 * (this.kFar + (this.kNear - this.kFar) * clamp(t, 0, 1)));
      // الحدود
      ctx.lineWidth = lw(0);   this.line(ctx, FX, FY, W - FX, FY);
      ctx.lineWidth = lw(1);   this.line(ctx, FX, H - FY, W - FX, H - FY);
      ctx.lineWidth = lw(0.5); this.line(ctx, FX, FY, FX, H - FY);
                               this.line(ctx, W - FX, FY, W - FX, H - FY);
      this.line(ctx, W / 2, FY, W / 2, H - FY);

      // دائرة المنتصف
      ctx.beginPath();
      for (let i = 0; i <= 44; i++) {
        const a = i / 44 * Math.PI * 2;
        const p = this.proj(W / 2 + Math.cos(a) * 92, H / 2 + Math.sin(a) * 92);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // مناطق الجزاء والمرمى
      const paW = 158, paH = 330, gaW = 62, gaH = 190;
      const box = (bx, bw) => {
        this.line(ctx, bx, H / 2 - paH / 2, bx + bw, H / 2 - paH / 2);
        this.line(ctx, bx, H / 2 + paH / 2, bx + bw, H / 2 + paH / 2);
        this.line(ctx, bx + bw, H / 2 - paH / 2, bx + bw, H / 2 + paH / 2);
      };
      box(FX, paW); box(W - FX, -paW);
      const gbox = (bx, bw) => {
        this.line(ctx, bx, H / 2 - gaH / 2, bx + bw, H / 2 - gaH / 2);
        this.line(ctx, bx, H / 2 + gaH / 2, bx + bw, H / 2 + gaH / 2);
        this.line(ctx, bx + bw, H / 2 - gaH / 2, bx + bw, H / 2 + gaH / 2);
      };
      gbox(FX, gaW); gbox(W - FX, -gaW);

      // قوسا الجزاء
      const arc = (cx, from, to) => {
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const a = from + (to - from) * i / 20;
          const p = this.proj(cx + Math.cos(a) * 62, H / 2 + Math.sin(a) * 62);
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      };
      arc(FX + paW, -Math.PI / 2.6, Math.PI / 2.6);
      arc(W - FX - paW, Math.PI - Math.PI / 2.6, Math.PI + Math.PI / 2.6);

      // النقاط
      ctx.fillStyle = "rgba(245,255,250,.88)";
      for (const px of [FX + 106, W - FX - 106, W / 2]) {
        const p = this.proj(px, H / 2);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.3 * p.s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    /* مرمى ثلاثي الأبعاد بشباك */
    drawGoal(gx, color, ctx) {
      const out = gx < W / 2 ? -1 : 1;
      const pT = this.proj(gx, GOAL_TOP), pB = this.proj(gx, GOAL_BOT);
      const hT = 56 * pT.s, hB = 56 * pB.s;
      const dT = 24 * pT.s * out, dB = 24 * pB.s * out;
      const ftT = { x: pT.x, y: pT.y - hT };
      const ftB = { x: pB.x, y: pB.y - hB };
      const bkT = { x: pT.x + dT, y: pT.y - hT * 0.42 };
      const bkB = { x: pB.x + dB, y: pB.y - hB * 0.42 };
      const gT = { x: pT.x + dT, y: pT.y };
      const gB = { x: pB.x + dB, y: pB.y };
      const sMid = (pT.s + pB.s) / 2;

      ctx.save();
      const cx = (pT.x + pB.x) / 2 + dT, cy = (ftT.y + pB.y) / 2;
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 110 * sMid);
      glow.addColorStop(0, color === LIME ? "rgba(198,255,0,.20)" : "rgba(0,229,255,.20)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 120 * sMid, cy - 120 * sMid, 240 * sMid, 240 * sMid);

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

    /* طقم اللاعب مع تطبيق لون التخصيص على قصّة الفريق وجواربه */
    kitFor(p) {
      const isGK = p.role === "GK";
      const base = p.side === 1 ? (isGK ? KITS.homeGK : KITS.home) : (isGK ? KITS.awayGK : KITS.away);
      if (p.side === 1 && !isGK && this.custom.accent !== LIME) {
        return { ...base, slash: this.custom.accent, sock: this.custom.accent, num: this.custom.accent };
      }
      return base;
    }

    /* ── لاعب بمواصفات حزمة الهوية — جسم ممتلئ وحركة جري ووضعية تسديد ── */
    drawPlayer(ctx, p) {
      const isUser = p === this.controlled;
      const isGK = p.role === "GK";
      const kit = this.kitFor(p);
      const pos = this.proj(p.x, p.y);
      const u = pos.s;
      const hgt = 64 * u;                                // الطول الكلي
      const spd = Math.hypot(p.vx, p.vy);
      const moving = spd > 14;
      const runK = clamp(spd / 290, 0, 1);
      const ph = p.phase;
      const swingRaw = moving ? Math.sin(ph) : 0;
      const swing2Raw = moving ? Math.sin(ph + Math.PI) : 0;
      // وضعية التسديد: الرجل الأمامية ممدودة للأمام
      const kicking = p.kickT > 0;
      const celebrating = p.celebT > 0;
      const diving = (p.diveT || 0) > 0;
      const sliding = (p.slideT || 0) > 0;
      const swing = kicking || sliding ? 1.5 : celebrating || diving ? 0.4 : swingRaw;
      const swing2 = kicking ? -0.7 : sliding ? -1.2 : celebrating || diving ? -0.4 : swing2Raw;
      const bob = celebrating
        ? Math.abs(Math.sin(this.time * 9)) * 5 * u
        : moving && !kicking ? Math.abs(Math.sin(ph)) * 1.8 * u : 0;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      /* الظل وحلقة التحكم */
      ctx.fillStyle = "rgba(0,0,0,.30)";
      ctx.beginPath(); ctx.ellipse(0, 1.2 * u, 16 * u, 5.6 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.30)";
      ctx.beginPath(); ctx.ellipse(0, 1.2 * u, 10 * u, 3.6 * u, 0, 0, Math.PI * 2); ctx.fill();
      if (isUser) {
        ctx.save();
        ctx.strokeStyle = LIME; ctx.lineWidth = 2.4;
        ctx.setLineDash([8 * u, 6 * u]);
        ctx.lineDashOffset = -this.time * 44;
        ctx.shadowColor = LIME; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(0, 1.2 * u, 19 * u, 7 * u, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      ctx.scale(p.dirX < 0 ? -1 : 1, 1);
      // ميلان الجسم: جريٌ أمامي / ارتماء جانبي للحارس / انزلاق منخفض
      if (diving) {
        const k = 1 - (p.diveT || 0) / 0.6;
        ctx.rotate((p.diveDir || 1) * Math.min(1.15, k * 1.5));
      } else if (sliding) {
        ctx.rotate(0.85 * Math.min(1, (0.5 - (p.slideT || 0)) * 6 + 0.4));
      } else {
        ctx.rotate(runK * 0.14);
      }

      const hipY = -hgt * 0.44 - bob;
      const shoY = -hgt * 0.76 - bob;
      const legW = 4.8 * u, armW = 3.9 * u;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      /* ── الرجل الخلفية: فخذ (بشرة) → جورب → حذاء ── */
      const b2x = swing2 * 8 * u, b2lift = Math.max(0, swing2) * 4.5 * u;
      // الفخذ والساق
      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = legW;
      ctx.beginPath();
      ctx.moveTo(-1.6 * u, hipY);
      ctx.quadraticCurveTo(-1.6 * u + b2x * 0.5, hipY + hgt * 0.15, -1.6 * u + b2x * 0.8, hipY + hgt * 0.26);
      ctx.stroke();
      // الجورب (لون الهوية)
      ctx.strokeStyle = kit.sock;
      ctx.lineWidth = legW * 1.02;
      ctx.beginPath();
      ctx.moveTo(-1.6 * u + b2x * 0.8, hipY + hgt * 0.26);
      ctx.lineTo(-1.6 * u + b2x, -2.2 * u - b2lift);
      ctx.stroke();
      // الحذاء
      ctx.strokeStyle = "#0A0D12";
      ctx.lineWidth = legW * 1.15;
      ctx.beginPath();
      ctx.moveTo(-1.6 * u + b2x, -1.8 * u - b2lift);
      ctx.lineTo(1.2 * u + b2x, -1.4 * u - b2lift);
      ctx.stroke();

      /* ── الذراع الخلفية ── */
      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = armW;
      ctx.beginPath();
      if (celebrating || diving) {
        ctx.moveTo(-5.2 * u, shoY + 2 * u);
        ctx.quadraticCurveTo(-8.5 * u, shoY - 4 * u, -7.2 * u, shoY - 10 * u);
      } else {
        ctx.moveTo(-5.2 * u, shoY + 2.4 * u);
        ctx.quadraticCurveTo(-6.5 * u - swing * 3 * u, shoY + hgt * 0.12, -5.2 * u - swing * 6.5 * u, shoY + hgt * 0.2);
      }
      ctx.stroke();

      /* ── الشورت ── */
      ctx.fillStyle = kit.shorts;
      ctx.beginPath();
      ctx.moveTo(-6 * u, hipY - 4 * u);
      ctx.lineTo(6 * u, hipY - 4 * u);
      ctx.lineTo(7 * u, hipY + 4.5 * u);
      ctx.lineTo(1.2 * u, hipY + 5.5 * u);
      ctx.lineTo(0, hipY + 2 * u);
      ctx.lineTo(-1.2 * u, hipY + 5.5 * u);
      ctx.lineTo(-7 * u, hipY + 4.5 * u);
      ctx.closePath(); ctx.fill();
      // شريط جانبي على الشورت
      ctx.fillStyle = kit.slash;
      ctx.fillRect(5.2 * u, hipY - 4 * u, 1.5 * u, 8.5 * u);

      /* ── الرجل الأمامية ── */
      const b1x = swing * 8 * u, b1lift = Math.max(0, swing) * 4.5 * u;
      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = legW * 1.06;
      ctx.beginPath();
      ctx.moveTo(1.8 * u, hipY);
      ctx.quadraticCurveTo(1.8 * u + b1x * 0.5, hipY + hgt * 0.15, 1.8 * u + b1x * 0.8, hipY + hgt * 0.26);
      ctx.stroke();
      ctx.strokeStyle = kit.sock;
      ctx.lineWidth = legW * 1.08;
      ctx.beginPath();
      ctx.moveTo(1.8 * u + b1x * 0.8, hipY + hgt * 0.26);
      ctx.lineTo(1.8 * u + b1x, -2.2 * u - b1lift);
      ctx.stroke();
      ctx.strokeStyle = "#0A0D12";
      ctx.lineWidth = legW * 1.2;
      ctx.beginPath();
      ctx.moveTo(1.8 * u + b1x, -1.8 * u - b1lift);
      ctx.lineTo(4.8 * u + b1x, -1.4 * u - b1lift);
      ctx.stroke();

      /* ── الجذع: قميص الهوية ── */
      const jg = ctx.createLinearGradient(0, shoY, 0, hipY);
      jg.addColorStop(0, kit.shirt0); jg.addColorStop(1, kit.shirt1);
      ctx.fillStyle = jg;
      ctx.beginPath();
      // كتفان أعرض من الخصر
      ctx.moveTo(-7.6 * u, shoY + 1 * u);
      ctx.quadraticCurveTo(-7.8 * u, shoY - 1.5 * u, -5.5 * u, shoY - 2 * u);
      ctx.lineTo(5.5 * u, shoY - 2 * u);
      ctx.quadraticCurveTo(7.8 * u, shoY - 1.5 * u, 7.6 * u, shoY + 1 * u);
      ctx.lineTo(6.2 * u, hipY - 2 * u);
      ctx.lineTo(-6.2 * u, hipY - 2 * u);
      ctx.closePath();
      ctx.fill();
      // القصّة الليمونية المائلة (بصمة الهوية)
      ctx.save();
      ctx.clip();
      ctx.fillStyle = kit.slash;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(-7.6 * u, shoY + 3 * u);
      ctx.lineTo(-3.2 * u, shoY - 2 * u);
      ctx.lineTo(-0.6 * u, shoY - 2 * u);
      ctx.lineTo(-5 * u, hipY - 2 * u);
      ctx.lineTo(-7.6 * u, hipY - 2 * u);
      ctx.closePath(); ctx.fill();
      // لمعة قماش
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(-7.6 * u, shoY - 2 * u, 15.2 * u, 2.6 * u);
      ctx.restore();
      // ياقة سماوية
      ctx.strokeStyle = kit.trim;
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath();
      ctx.moveTo(-2.6 * u, shoY - 2 * u);
      ctx.quadraticCurveTo(0, shoY - 0.4 * u, 2.6 * u, shoY - 2 * u);
      ctx.stroke();
      /* كمّان قصيران */
      for (const sd of [-1, 1]) {
        ctx.fillStyle = kit.shirt1;
        ctx.beginPath();
        ctx.ellipse(sd * 7.4 * u, shoY + 2.6 * u, 2.6 * u, 3.6 * u, sd * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = kit.trim;
        ctx.lineWidth = 1.1 * u;
        ctx.beginPath();
        ctx.ellipse(sd * 7.6 * u, shoY + 4.6 * u, 2.2 * u, 1 * u, sd * 0.35, 0, Math.PI);
        ctx.stroke();
      }
      /* الرقم على الصدر */
      ctx.fillStyle = kit.num;
      ctx.font = `800 ${8.6 * u}px Rajdhani, Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.scale(p.dirX < 0 ? -1 : 1, 1);
      ctx.fillText(String(p.num), 0.4 * u * (p.dirX < 0 ? -1 : 1), (shoY + hipY) / 2 - 1.2 * u);
      ctx.restore();

      /* ── الذراع الأمامية ── */
      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = armW * 1.05;
      ctx.beginPath();
      if (celebrating || diving) {
        ctx.moveTo(5.4 * u, shoY + 2 * u);
        ctx.quadraticCurveTo(8.7 * u, shoY - 4 * u, 7.4 * u, shoY - 10 * u);
      } else {
        ctx.moveTo(5.4 * u, shoY + 2.4 * u);
        ctx.quadraticCurveTo(6.8 * u + swing2 * 3 * u, shoY + hgt * 0.12, 5.4 * u + swing2 * 6.5 * u, shoY + hgt * 0.2);
      }
      ctx.stroke();

      /* شارة الكابتن (عنصر متجر) على العضد */
      if (this.custom.captain && isUser) {
        ctx.strokeStyle = this.custom.accent;
        ctx.lineWidth = 2.2 * u;
        ctx.beginPath();
        ctx.moveTo(4.6 * u, shoY + 3.4 * u);
        ctx.lineTo(6.6 * u, shoY + 4.4 * u);
        ctx.stroke();
      }

      /* ── الرأس والشعر ── */
      const headY = shoY - 6.2 * u;
      ctx.fillStyle = kit.skin;
      ctx.beginPath(); ctx.arc(1.4 * u, headY, 5 * u, 0, Math.PI * 2); ctx.fill();
      // رقبة
      ctx.fillRect(-0.4 * u, headY + 3.4 * u, 3.4 * u, 2.6 * u);
      // شعر رياضي حديث
      ctx.fillStyle = kit.hair;
      ctx.beginPath();
      ctx.arc(0.9 * u, headY - 0.7 * u, 5 * u, Math.PI * 0.86, Math.PI * 2.06);
      ctx.quadraticCurveTo(3 * u, headY - 5.8 * u, -1 * u, headY - 4.6 * u);
      ctx.closePath(); ctx.fill();

      ctx.restore();

      /* اسم اللاعب المتحكَّم به */
      if (isUser) {
        ctx.save();
        ctx.font = `700 ${Math.max(10, 10.5 * u)}px "Noto Kufi Arabic", Arial`;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.shadowColor = "#000"; ctx.shadowBlur = 6;
        ctx.fillText(p.name, pos.x, pos.y - hgt - 9 * u);
        ctx.shadowBlur = 0;
        ctx.fillStyle = LIME;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - hgt - 3.4 * u);
        ctx.lineTo(pos.x - 4.6 * u, pos.y - hgt - 8.6 * u);
        ctx.lineTo(pos.x + 4.6 * u, pos.y - hgt - 8.6 * u);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    drawBall(ctx) {
      const b = this.ball;
      const pos = this.proj(b.x, b.y);
      const u = pos.s;
      const r = 5.6 * u;
      const lift = b.z * u * 0.55;

      ctx.save();
      const shScale = clamp(1 - b.z / 220, 0.45, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.4 * shScale})`;
      ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 1 * u, r * shScale, r * 0.42 * shScale, 0, 0, Math.PI * 2); ctx.fill();

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
      // لافتة الهدف السينمائية
      if (this.goalBannerT > 0) {
        const k = this.goalBannerT;
        const inK = clamp((2.4 - k) / 0.25, 0, 1);          // دخول
        const outK = clamp(k / 0.3, 0, 1);                   // خروج
        const a = Math.min(inK, outK);
        const slide = (1 - inK) * w * 0.25;
        ctx.save();
        ctx.globalAlpha = a;
        // شريط عرضي مائل
        const bandH = Math.min(110, h * 0.2);
        const cy = h * 0.38;
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        if (this.goalBannerHome) {
          grad.addColorStop(0, "rgba(198,255,0,0)");
          grad.addColorStop(0.2, "rgba(198,255,0,.85)");
          grad.addColorStop(0.8, "rgba(0,229,255,.85)");
          grad.addColorStop(1, "rgba(0,229,255,0)");
        } else {
          grad.addColorStop(0, "rgba(20,26,35,0)");
          grad.addColorStop(0.5, "rgba(20,26,35,.9)");
          grad.addColorStop(1, "rgba(20,26,35,0)");
        }
        ctx.fillStyle = grad;
        ctx.save();
        ctx.transform(1, 0, -0.12, 1, slide, 0);
        ctx.fillRect(-w * 0.1, cy - bandH / 2, w * 1.2, bandH);
        ctx.restore();
        ctx.font = `900 ${Math.min(64, h * 0.12)}px "Noto Kufi Arabic", Arial`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = this.goalBannerHome ? "#071013" : "#FFFFFF";
        ctx.fillText(this.goalBannerText, w / 2 - slide * 0.4, cy);
        ctx.restore();
      }
      if (this.messageTime <= 0) return;
      const alpha = clamp(this.messageTime / 0.3, 0, 1);
      // دخول بتكبير خفيف (إحساس لعبة فيديو)
      const pop = 1 + Math.max(0, this.messageTime - 1.05) * 0.14;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2, h * 0.22);
      ctx.scale(pop, pop);
      ctx.font = '800 17px "Noto Kufi Arabic", Arial';
      const tw = ctx.measureText(this.message).width + 56;
      ctx.fillStyle = "rgba(9,12,17,.86)";
      ctx.strokeStyle = "rgba(198,255,0,.6)";
      ctx.lineWidth = 1.4;
      ctx.shadowColor = "rgba(198,255,0,.4)"; ctx.shadowBlur = 20;
      roundRect(ctx, -tw / 2, -22, tw, 44, 10);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = LIME;
      ctx.beginPath();
      ctx.moveTo(-tw / 2 + 14, -13); ctx.lineTo(-tw / 2 + 22, -13);
      ctx.lineTo(-tw / 2 + 16, 13); ctx.lineTo(-tw / 2 + 8, 13);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(this.message, 9, 1);
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
