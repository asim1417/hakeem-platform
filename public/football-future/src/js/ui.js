(function () {
  "use strict";

  const DATA = window.FF_DATA;
  const ic = (n) => window.FFIcons ? window.FFIcons.svg(n) : "";

  function esc(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function pct(current, target) {
    return Math.max(0, Math.min(100, Math.round((current / Math.max(1, target)) * 100)));
  }

  function topbar(state) {
    return `
      <header class="topbar">
        <div class="brand">
          <img class="brand-logo" src="/football-future/src/assets/logo.svg" alt="Football Future" />
          <div class="brand-title"><strong>${DATA.app.nameAr}</strong><span>${DATA.app.nameEn.toUpperCase()}</span></div>
        </div>
        <div class="top-actions">
          <div class="currency coins" title="Coins">${ic("coin")} <b>${state.coins.toLocaleString("en-US")}</b></div>
          <div class="currency gems" title="Gems">${ic("gem")} <b>${state.gems.toLocaleString("en-US")}</b></div>
          <button class="btn ghost small audio-control" data-action="toggleAudio" type="button" title="تشغيل/كتم الصوت">${ic("speaker")} الصوت</button>
          <button class="profile-pill" data-route="profile" type="button"><span class="avatar-dot">ع</span><span>${esc(state.player.name)} · LV ${state.player.level}</span></button>
        </div>
      </header>`;
  }

  function bottomNav(active) {
    return `<nav class="bottom-nav" aria-label="التنقل الرئيسي">
      ${DATA.nav.map(item => `
        <button class="nav-item ${active === item.id ? "active" : ""}" data-route="${item.id}" type="button" aria-label="${esc(item.ar)}">
          <span class="ico">${ic(item.icon)}</span><small>${esc(item.ar)}</small>
        </button>`).join("")}
    </nav>`;
  }

  function shell(state, active, content) {
    return `<div class="app-shell">${topbar(state)}<main class="screen" data-screen="${active}">${content}</main></div>${bottomNav(active)}`;
  }

  function home(state) {
    const cards = [
      { title: "مباراة سريعة", en: "QUICK MATCH", icon: "⚽", action: "quickMatch", desc: "ادخل مباراة فورية ضد خصم عشوائي." },
      { title: "المهام اليومية", en: "DAILY MISSIONS", icon: "☑", route: "missions", desc: "اجمع XP وطور مستواك." },
      { title: "كأس فيوتشر", en: "FUTURE CUP", icon: "🏆", route: "tournaments", desc: "بطولات أسبوعية وجوائز." },
      { title: "التدريب", en: "TRAINING", icon: "🎯", route: "training", desc: "تمارين تسديد ومراوغة وتمرير." },
      { title: "الأكاديمية", en: "ACADEMY", icon: "🏟", route: "academy", desc: "رحلة تطور مناسبة للأطفال." },
      { title: "المجتمع الآمن", en: "SAFE SOCIAL", icon: "👥", route: "social", desc: "ردود جاهزة ومناسبة للعمر." }
    ];
    return shell(state, "home", `
      <section class="hero-grid">
        <div class="panel hero-card"><div class="panel-inner hero-player">
          <div class="hero-copy">
            <div class="kicker">لعبة كرة قدم احترافية للأطفال 7–14</div>
            <h1><span class="gradient-text">${DATA.app.nameAr}</span></h1>
            <p>${DATA.app.taglineAr} تجربة لعب سريعة، آمنة، ممتعة، وتفاعلية تجمع بين المهارة، بناء الفريق، والتطور المرح.</p>
            <div class="cta-row">
              <button class="btn" data-action="quickMatch" type="button">العب الآن ▶</button>
              <button class="btn secondary" data-route="team" type="button">تخصيص الفريق</button>
              <button class="btn ghost" data-route="modes" type="button">اختيار نمط اللعب</button>
            </div>
          </div>
          <div class="player-figure" aria-hidden="true"></div>
        </div></div>
        <div class="panel"><div class="panel-inner">
          <div class="section-title"><h2>تقدم اللاعب</h2><span>PLAYER PROGRESSION</span></div>
          <div class="stats-row">
            <div class="stat"><b>${state.player.rating}</b><span>التقييم</span></div>
            <div class="stat"><b>${state.player.level}</b><span>المستوى</span></div>
            <div class="stat"><b>${state.stats.wins}</b><span>انتصارات</span></div>
          </div>
          <div style="height:16px"></div>
          <div class="progress" title="XP"><i style="--p:${pct(state.player.xp, state.player.nextXp)}%"></i></div>
          <p style="color:var(--ff-silver); margin:10px 0 18px;">${state.player.xp}/${state.player.nextXp} XP للانتقال للمستوى التالي.</p>
          <div class="badge-row">
            <span class="badge lime">آمن للأطفال</span><span class="badge">تدريب</span><span class="badge">بطولات</span><span class="badge">مهارات</span>
          </div>
        </div></div>
      </section>
      <section style="height:14px"></section>
      <section class="card-grid three">
        ${cards.map(card => `
          <button class="ff-card" ${card.action ? `data-action="${card.action}"` : `data-route="${card.route}"`} type="button" style="text-align:right;color:inherit">
            <div class="icon-badge">${ic(card.icon)}</div><h3>${esc(card.title)}</h3><p>${esc(card.en)} · ${esc(card.desc)}</p>
          </button>`).join("")}
      </section>`);
  }

  function modes(state) {
    return shell(state, "modes", `
      <div class="section-title"><h1>اختيار نمط اللعب</h1><span>GAME MODE SELECTION</span></div>
      <section class="card-grid four">
        ${DATA.modes.map((mode, i) => `
          <button class="ff-card ${i === 0 ? "active" : ""}" data-route="${mode.id === "quick" ? "preMatch" : mode.id === "academy" ? "academy" : mode.id === "training" ? "training" : mode.id === "online" ? "social" : "modes"}" type="button" style="text-align:right;color:inherit">
            <div class="icon-badge">${ic(mode.icon)}</div>
            <h3>${esc(mode.ar)}</h3>
            <p>${esc(mode.en)} · ${esc(mode.desc)}</p>
          </button>`).join("")}
      </section>
      <section style="height:14px"></section>
      <section class="panel"><div class="panel-inner">
        <div class="section-title"><h2>تدفق تجربة اللعب</h2><span>GAMEPLAY FLOW</span></div>
        <div class="card-grid four">
          ${["التشكيلة", "البداية", "اللعب المباشر", "الملخص"].map((x, i) => `<div class="ff-card"><div class="icon-badge">${ic(["📋","⚽","🎮","🏅"][i])}</div><h3>${x}</h3><p>${["LINEUP","KICKOFF","LIVE MATCH","SUMMARY"][i]}</p></div>`).join("")}
        </div>
      </div></section>`);
  }

  function team(state) {
    const tokens = DATA.players.map(p => `<div class="player-token" style="left:${p.x}%;top:${p.y}%"><b>${p.rating}</b><small>${p.pos}</small></div>`).join("");
    return shell(state, "team", `
      <div class="section-title"><h1>إدارة الفريق</h1><span>TEAM MANAGEMENT</span></div>
      <section class="hero-grid">
        <div class="panel"><div class="panel-inner">
          <div class="section-title"><h2>التشكيلة 4-3-3</h2><span>SQUAD FORMATION</span></div>
          <div class="pitch-card">${tokens}</div>
        </div></div>
        <div class="panel"><div class="panel-inner">
          <div class="section-title"><h2>انسجام الفريق</h2><span>TEAM CHEMISTRY</span></div>
          <div class="stats-row"><div class="stat"><b>87</b><span>قوة الفريق</span></div><div class="stat"><b>92</b><span>انسجام</span></div><div class="stat"><b>4-3-3</b><span>الخطة</span></div></div>
          <div style="height:14px"></div>
          <div class="list">
            <button class="list-item" type="button"><span class="status">${ic("gear")}</span><div><h3>الخطط والتكتيك</h3><p>Tactics & roles</p></div><span>›</span></button>
            <button class="list-item" type="button"><span class="status">${ic("boot")}</span><div><h3>المعدات والزي</h3><p>Outfit & boots</p></div><span>›</span></button>
            <button class="list-item" type="button"><span class="status">${ic("bolt")}</span><div><h3>تطوير المهارات</h3><p>Skill upgrades</p></div><span>›</span></button>
          </div>
        </div></div>
      </section>`);
  }

  function missions(state) {
    return shell(state, "missions", `
      <div class="section-title"><h1>المهام والتحديات</h1><span>MISSIONS & CHALLENGES</span></div>
      <div class="tabs"><button class="tab active">اليومية</button><button class="tab">الأسبوعية</button><button class="tab">الموسمية</button></div>
      <section class="mission-list">
        ${state.missions.map(m => {
          const done = m.progress >= m.target;
          return `
          <div class="mission-item ${done ? "done" : ""} ${m.claimed ? "claimed" : ""}">
            <span class="m-ic">${ic(done ? "check" : "target")}</span>
            <div class="m-body">
              <div class="m-top">
                <h3>${esc(m.ar)}</h3>
                <span class="m-reward">${ic("bolt")} ${m.reward} XP</span>
              </div>
              <div class="m-meta">
                <div class="progress"><i style="--p:${pct(m.progress, m.target)}%"></i></div>
                <span class="m-count">${m.progress}/${m.target}</span>
              </div>
            </div>
          </div>`;
        }).join("")}
      </section>
      <button class="btn secondary" data-action="claimMissions" type="button" style="margin-top:14px">${ic("gift")} استلام المكتمل</button>`);
  }

  function tournaments(state) {
    const ROUNDS = ["ربع النهائي", "نصف النهائي", "النهائي"];
    const cup = state.cup;
    const bracket = cup ? cup.opps.map((o, i) => {
      const res = cup.results[i];
      const cls = res ? "played" : (i === cup.round && !cup.done ? "current" : "pending");
      return `
      <div class="tie ${cls}">
        <span class="tie-round">${ROUNDS[i]}</span>
        <span class="tie-team">${ic("shield")} فيوتشر FC</span>
        ${res ? `<b class="tie-score">${res[0]} - ${res[1]}</b>` : `<span class="tie-vs">VS</span>`}
        <span class="tie-team">${ic(o.logo || "shield")} ${esc(o.ar)}</span>
      </div>`;
    }).join("") : "";
    return shell(state, "tournaments", `
      <div class="section-title"><h1>كأس المستقبل</h1><span>FUTURE CUP</span></div>
      <section class="panel"><div class="panel-inner">
        ${cup ? `
          <div class="bracket">${bracket}</div>
          ${cup.done
            ? (cup.won
              ? `<div class="cup-champ"><div class="big-trophy">${ic("trophy")}</div><h3>أنت بطل كأس المستقبل!</h3><button class="btn" data-action="newCup" type="button">بطولة جديدة</button></div>`
              : `<div class="cup-champ"><p>انتهى المشوار — الأبطال لا يستسلمون.</p><button class="btn" data-action="newCup" type="button">حاول من جديد</button></div>`)
            : `<div class="cta-row"><button class="btn" data-action="playCup" type="button">${ic("play")} اِلعب ${ROUNDS[cup.round]}</button></div>`}
        ` : `
          <div class="cup-champ">
            <div class="big-trophy">${ic("trophy")}</div>
            <h3>ثلاثة أدوار تفصلك عن الكأس</h3>
            <p style="color:var(--ff-silver)">إقصائية بصعوبة متصاعدة — اخسر مرة وتودّع البطولة. جائزة البطل 500 عملة.</p>
            <button class="btn" data-action="playCup" type="button">${ic("play")} ابدأ البطولة</button>
          </div>`}
      </div></section>
      <section style="height:14px"></section>
      <section class="panel"><div class="panel-inner"><div class="section-title"><h2>أحداث قادمة</h2><span>UPCOMING</span></div>
        <div class="list">${DATA.events.map(e => `<div class="list-item"><span class="status">${ic(e.icon)}</span><div><h3>${esc(e.ar)}</h3><p>${esc(e.en)}</p></div><span class="price">${e.time}</span></div>`).join("")}</div>
      </div></section>`);
  }

  function shop(state) {
    const items = (DATA.shopItems || []).map(item => {
      const owned = (state.owned || []).includes(item.id);
      return `
      <div class="ff-card shop-item ${owned ? "owned" : ""}">
        <div class="icon-badge">${ic(item.icon)}</div>
        <h3>${esc(item.ar)}</h3>
        <p>${esc(item.desc)}</p>
        ${owned
          ? `<span class="owned-tag">${ic("check")} مقتنى</span>`
          : `<button class="btn small" data-action="buyItem" data-item="${item.id}" type="button">${ic("coin")} ${item.price.toLocaleString("en-US")}</button>`}
      </div>`;
    }).join("");
    return shell(state, "shop", `
      <div class="section-title"><h1>المتجر</h1><span>STORE</span></div>
      <p class="shop-hint">كل العناصر تُشترى بعملات اللعبة التي تكسبها من المباريات والكأس — لا مشتريات حقيقية.</p>
      <section class="card-grid three">${items}</section>
      <section style="height:14px"></section>
      <section class="panel"><div class="panel-inner"><div class="section-title"><h2>سياسة المتجر للأطفال</h2><span>KID-SAFE STORE</span></div><p style="color:var(--ff-silver);line-height:1.8">لا إعلانات ولا مدفوعات حقيقية — العملات تُكسب باللعب فقط، وما تشتريه ينعكس فوراً داخل المباراة.</p></div></section>`);
  }

  function profile(state) {
    const main = DATA.players[0];
    const statKeys = Object.keys(main.stats);
    return shell(state, "profile", `
      <div class="section-title"><h1>هوية اللاعب</h1><span>PLAYER IDENTITY</span></div>
      <section class="panel"><div class="panel-inner">
        <div class="section-title"><h2>تخصيص لاعبك</h2><span>CUSTOMIZE — ينعكس داخل المباراة</span></div>
        <div class="cust-grid">
          <label class="cust-field">
            <span>اسم اللاعب</span>
            <input class="cust-input" data-field="custName" maxlength="12" value="${esc(state.custom?.name || "علي")}" />
          </label>
          <div class="cust-field">
            <span>رقم القميص</span>
            <div class="chip-row">
              ${[7, 9, 10, 11, 19].map(n => `<button class="chip ${Number(state.custom?.number) === n ? "sel" : ""}" data-action="setNum" data-num="${n}" type="button">${n}</button>`).join("")}
            </div>
          </div>
          <div class="cust-field">
            <span>لون القصّة والجوارب</span>
            <div class="chip-row">
              ${[["lime", "#C6FF00"], ["cyan", "#00E5FF"], ["teal", "#00BFAE"], ["gold", "#FFD34D"]].map(([k, c]) => {
                const locked = k === "gold" && !(state.owned || []).includes("gold");
                return `<button class="swatch ${state.custom?.accent === k ? "sel" : ""} ${locked ? "locked" : ""}" data-action="setAccent" data-accent="${k}" style="--sw:${c}" type="button" aria-label="${k}">${locked ? ic("lock") : ""}</button>`;
              }).join("")}
            </div>
          </div>
        </div>
      </div></section>
      <section style="height:14px"></section>
      <section class="hero-grid">
        <div class="panel"><div class="panel-inner hero-player" style="min-height:360px;align-items:center">
          <div class="hero-copy">
            <div class="kicker">ST · RATING ${main.rating}</div>
            <h1><span class="gradient-text">${state.player.name}</span></h1>
            <p>مهاجم متحرك، سريع، ومرن. طور مهاراتك واحصل على شارات ومكافآت مع كل مباراة.</p>
            <div class="stats-row">${statKeys.slice(0,3).map(k => `<div class="stat"><b>${main.stats[k]}</b><span>${k}</span></div>`).join("")}</div>
            <div style="height:10px"></div>
            <div class="stats-row">${statKeys.slice(3,6).map(k => `<div class="stat"><b>${main.stats[k]}</b><span>${k}</span></div>`).join("")}</div>
          </div><div class="player-figure"></div>
        </div></div>
        <div class="panel"><div class="panel-inner"><div class="section-title"><h2>الإنجازات</h2><span>ACHIEVEMENTS</span></div>
          <div class="list">
            <div class="list-item"><span class="status">${ic("ball")}</span><div><h3>أول هدف</h3><p>First Goal · مكتمل</p></div><span class="ok-ic">${ic("check")}</span></div>
            <div class="list-item"><span class="status">${ic("bolt")}</span><div><h3>فوز متتالي</h3><p>Win Streak · 3/5</p></div><span>3/5</span></div>
            <div class="list-item"><span class="status">${ic("gift")}</span><div><h3>مكافأة الموسم</h3><p>Season Reward</p></div><span>›</span></div>
          </div>
        </div></div>
      </section>`);
  }

  function settings(state) {
    return shell(state, "settings", `
      <div class="section-title"><h1>الإعدادات</h1><span>SETTINGS</span></div>
      <section class="panel"><div class="panel-inner settings-list"><div class="list">
        ${DATA.settings.map(s => `<button class="list-item" type="button"><span class="status">${ic(s.icon)}</span><div><h3>${esc(s.ar)}</h3><p>${esc(s.en)}</p></div>${s.type === "toggle" ? `<span class="switch ${s.on ? "on" : ""}"></span>` : `<span>›</span>`}</button>`).join("")}
        <button class="list-item" data-action="testArabicVoice" type="button"><span class="status">${ic("speaker")}</span><div><h3>اختبار الصوت العربي</h3><p>Arabic voice test + procedural SFX</p></div><span>تشغيل</span></button>
      </div></div></section>`);
  }

  function preMatch(state) {
    const tokens = DATA.players.slice(0, 11).map(p => `<div class="player-token" style="left:${p.x}%;top:${p.y}%"><b>${p.rating}</b><small>${p.pos}</small></div>`).join("");
    return shell(state, "preMatch", `
      <div class="section-title"><h1>${state.matchContext === "cup" ? "كأس المستقبل" : "قبل المباراة"}</h1><span>PRE-MATCH LINEUP</span></div>
      <section class="hero-grid">
        <div class="panel"><div class="panel-inner"><div class="section-title"><h2>فيوتشر FC ضد ${esc(state.currentOpp?.ar || "النمور")}</h2><span>FUTURE FC VS ${esc(state.currentOpp?.code || "NMO")}</span></div><div class="pitch-card">${tokens}</div></div></div>
        <div class="panel"><div class="panel-inner">
          <div class="stats-row"><div class="stat"><b>87</b><span>Future FC</span></div><div class="stat"><b>VS</b><span>المباراة</span></div><div class="stat"><b>84</b><span>${esc(state.currentOpp?.ar || "النمور")}</span></div></div>
          <div style="height:16px"></div>
          <div class="list">
            <div class="list-item"><span class="status">${ic("shield")}</span><div><h3>دفاع متوازن</h3><p>Balanced defense</p></div><span>نشط</span></div>
            <div class="list-item"><span class="status">${ic("bolt")}</span><div><h3>هجوم سريع</h3><p>Quick attack</p></div><span>جاهز</span></div>
            <div class="list-item"><span class="status">${ic("target")}</span><div><h3>تعليمات مبسطة</h3><p>Young-player tutorial hints</p></div><span>مفعل</span></div>
          </div>
          <div class="diff-seg" role="group" aria-label="مستوى الصعوبة">
            ${[["0.85","😊 سهل"],["1","💪 متوسط"],["1.2","🔥 صعب"]].map(([v, label]) => `
              <button class="diff-btn ${Number(state.difficulty || 1) === Number(v) ? "sel" : ""}" data-action="setDifficulty" data-diff="${v}" type="button">${label}</button>`).join("")}
          </div>
          <div class="cta-row"><button class="btn" data-route="liveMatch" type="button">ابدأ المباراة ▶</button><button class="btn ghost" data-route="team" type="button">تعديل التشكيلة</button></div>
        </div></div>
      </section>`);
  }

  function liveMatch(state) {
    return `<div class="match-layout">
      <canvas id="matchCanvas" aria-label="ملعب كرة قدم تفاعلي"></canvas>
      <div class="match-hud">
        <div class="scoreboard" aria-label="النتيجة">
          <span class="ff-tag">FF</span>
          <b>FUT</b><span class="sc" id="scoreHome">0</span>
          <span class="dash">-</span>
          <span class="sc" id="scoreAway">0</span><b>${esc(state.currentOpp?.code || "NMO")}</b>
          <span class="tm" id="matchTime">0:00</span>
        </div>
        <button class="pause-btn" data-action="togglePause" type="button" aria-label="إيقاف مؤقت">II</button>
        <div class="commentary-line" id="commentaryLine" aria-live="polite"></div>
        <div class="joystick" id="joystick" aria-label="عصا التحكم">
          <div class="knob" id="joystickKnob"></div>
          <div class="stamina"><i id="staminaBar"></i></div>
        </div>
        <div class="action-cluster" aria-label="أزرار اللعب">
          <button class="act shoot" data-game-action="shoot" type="button">تسديد<small>SHOOT</small></button>
          <button class="act pass" data-game-action="pass" type="button">تمرير<small>PASS</small></button>
          <button class="act skill" data-game-action="skill" type="button">مهارة<small>SKILL</small></button>
          <button class="act tackle" data-game-action="tackle" type="button">ضغط<small>TACKLE</small></button>
          <button class="act sprint" id="sprintButton" type="button">ركض<small>SPRINT</small></button>
        </div>
        <canvas class="minimap" id="minimap" width="180" height="96"></canvas>
        <div id="summaryOverlay"></div>
      </div>
      <div class="rotate-overlay" aria-hidden="true">
        <div class="ph">📱</div>
        <b>أدر جهازك للوضع العرضي</b>
        <span>تجربة المباراة مصممة للشاشة العريضة</span>
      </div>
    </div>`;
  }

  function matchSummary(state) {
    return shell(state, "home", `
      <section class="panel"><div class="panel-inner">
        <div class="section-title"><h1>ملخص المباراة</h1><span>MATCH SUMMARY</span></div>
        <div class="stats-row"><div class="stat"><b>${state.lastMatch.score.home}-${state.lastMatch.score.away}</b><span>النتيجة</span></div><div class="stat"><b>${state.lastMatch.stats.shots}</b><span>تسديدات</span></div><div class="stat"><b>${state.lastMatch.stats.passes}</b><span>تمريرات</span></div></div>
        <p style="color:var(--ff-silver);line-height:1.8">تم تحديث المهام والتقدم بناءً على نتيجة المباراة التجريبية.</p>
        <div class="cta-row"><button class="btn" data-route="preMatch" type="button">العب مرة أخرى</button><button class="btn secondary" data-route="missions" type="button">عرض المكافآت</button></div>
      </div></section>`);
  }



  function training(state) {
    const drills = [
      ["🎯", "تسديد على الهدف", "SHOOTING DRILL", "+8 SHO"],
      ["⚡", "سرعة وانطلاق", "SPEED DRILL", "+6 PAC"],
      ["🌀", "مراوغة الأقماع", "DRIBBLING DRILL", "+7 DRI"],
      ["🤝", "تمرير ذكي", "PASSING DRILL", "+5 PAS"]
    ];
    return shell(state, "training", `
      <div class="section-title"><h1>التدريب والتمارين</h1><span>TRAINING & DRILLS</span></div>
      <section class="hero-grid">
        <div class="panel"><div class="panel-inner hero-card"><div class="hero-copy"><div class="kicker">STRIKER TRAINING · LEVEL 3</div><h1><span class="gradient-text">طور مهاراتك</span></h1><p>نظام تدريب مبسط للأطفال: تعليمات قصيرة، مكافآت واضحة، وتقدم آمن خطوة بخطوة.</p><div class="cta-row"><button class="btn" data-route="preMatch" type="button">ابدأ تدريب المباراة</button><button class="btn secondary" data-route="skills" type="button">شجرة المهارات</button></div></div></div></div>
        <div class="panel"><div class="panel-inner"><div class="section-title"><h2>تقدم التدريب</h2><span>TRAINING PROGRESS</span></div><div class="stats-row"><div class="stat"><b>12</b><span>نقاط مهارة</span></div><div class="stat"><b>76%</b><span>جاهزية</span></div><div class="stat"><b>3</b><span>مستوى</span></div></div><div style="height:14px"></div><div class="progress"><i style="--p:76%"></i></div></div></div>
      </section><section style="height:14px"></section><section class="card-grid four">${drills.map(d => `<button class="ff-card" type="button" style="text-align:right;color:inherit"><div class="icon-badge">${ic(d[0])}</div><h3>${d[1]}</h3><p>${d[2]} · ${d[3]}</p></button>`).join("")}</section>`);
  }

  function avatar(state) {
    const faces = ["قصير", "مموج", "رياضي", "كلاسيكي", "ناعم", "حارس"];
    return shell(state, "profile", `
      <div class="section-title"><h1>تخصيص هوية اللاعب</h1><span>CUSTOM AVATAR</span></div>
      <section class="hero-grid"><div class="panel"><div class="panel-inner hero-player"><div class="hero-copy"><div class="kicker">DESIGN YOUR IDENTITY</div><h1><span class="gradient-text">${esc(state.player.name)}</span></h1><p>تعديل آمن لشكل اللاعب: الشعر، البشرة، الزي، الحذاء، والاحتفالات بدون صور حقيقية أو بيانات حساسة.</p><div class="cta-row"><button class="btn" data-route="profile" type="button">حفظ الهوية</button><button class="btn secondary" data-route="team" type="button">العودة للفريق</button></div></div><div class="player-figure"></div></div></div><div class="panel"><div class="panel-inner"><div class="section-title"><h2>خيارات المظهر</h2><span>LOOK OPTIONS</span></div><div class="badge-row">${faces.map(f => `<span class="badge">${f}</span>`).join("")}</div><div style="height:14px"></div><div class="list"><div class="list-item"><span class="status">${ic("shirt")}</span><div><h3>زي فيوتشر الأساسي</h3><p>Black / Lime / Cyan</p></div><span>✓</span></div><div class="list-item"><span class="status">${ic("boot")}</span><div><h3>حذاء السرعة</h3><p>Aero Strike</p></div><span>✓</span></div></div></div></div></section>`);
  }

  function skills(state) {
    const skills = [["⚽","تسديدة قوية","POWER SHOT","3/5"],["🧠","صانع لعب","PLAYMAKER","2/5"],["🛡","ضغط دفاعي","PRESSURE","1/5"],["⚡","انطلاقة","SPRINT BURST","4/5"],["🎯","دقة التمرير","PASS ACCURACY","3/5"],["🌀","مراوغة سريعة","QUICK DRIBBLE","2/5"]];
    return shell(state, "team", `<div class="section-title"><h1>شجرة المهارات</h1><span>SKILL TREE</span></div><section class="card-grid three">${skills.map((s,i)=>`<div class="ff-card ${i===0?'active':''}"><div class="icon-badge">${ic(s[0])}</div><h3>${s[1]}</h3><p>${s[2]} · ${s[3]}</p><div class="progress" style="margin-top:12px"><i style="--p:${Number(s[3].split('/')[0])*20}%"></i></div></div>`).join("")}</section><section style="height:14px"></section><section class="panel"><div class="panel-inner"><button class="btn" data-route="training" type="button">اكسب نقاط مهارة من التدريب</button></div></section>`);
  }

  function academy(state) {
    const stages = [["المبتدئ","ROOKIE","1-10","✓"],["النشء","DEVELOPING","11-20","نشط"],["المتميز","ADVANCED","21-30","🔒"],["النخبة","ELITE","31-40","🔒"],["الأسطورة","LEGEND","41+","🔒"]];
    return shell(state, "modes", `<div class="section-title"><h1>أكاديمية فيوتشر</h1><span>ACADEMY DEVELOPMENT JOURNEY</span></div><section class="card-grid five">${stages.map((s,i)=>`<div class="ff-card ${i===1?'active':''}"><div class="icon-badge">${ic(i<2?"star":"lock")}</div><h3>${s[0]}</h3><p>${s[1]} · ${s[2]}</p><strong class="price">${s[3]}</strong></div>`).join("")}</section><section style="height:14px"></section><section class="hero-grid"><div class="panel"><div class="panel-inner"><div class="section-title"><h2>مزايا الأكاديمية</h2><span>BENEFITS</span></div><div class="list"><div class="list-item"><span class="status">🎓</span><div><h3>تعليمات قصيرة</h3><p>Simple direct language for ages 7-14</p></div><span>✓</span></div><div class="list-item"><span class="status">🏆</span><div><h3>بطولات أكاديمية</h3><p>Academy tournaments</p></div><span>✓</span></div><div class="list-item"><span class="status">🛡</span><div><h3>بيئة آمنة</h3><p>Kid-safe progression</p></div><span>✓</span></div></div></div></div><div class="panel"><div class="panel-inner hero-card"><div class="hero-copy"><h1><span class="gradient-text">كل خطوة تقربك من حلمك</span></h1><p>رحلة تقدم واضحة من لاعب ناشئ إلى نجم المستقبل.</p><button class="btn" data-route="training" type="button">ابدأ الرحلة</button></div></div></div></section>`);
  }

  function events(state) {
    return shell(state, "tournaments", `<div class="section-title"><h1>مركز الأحداث الموسمية</h1><span>SEASONAL EVENT HUB</span></div><section class="hero-grid"><div class="panel"><div class="panel-inner"><div class="section-title"><h2>نهائيات الأبطال</h2><span>CHAMPIONS FINALS</span></div><div class="ff-card active"><div class="pack-rating">90+</div><h3>ينتهي خلال 4 أيام</h3><p>أكمل تحديات المهارات واحصل على باقة بطل المستقبل.</p><div class="cta-row"><button class="btn" data-route="preMatch" type="button">ادخل الحدث</button><button class="btn secondary" data-route="rewards" type="button">المكافآت</button></div></div></div></div><div class="panel"><div class="panel-inner"><div class="section-title"><h2>أحداث جارية</h2><span>LIVE EVENTS</span></div><div class="list">${DATA.events.map(e=>`<button class="list-item" data-route="preMatch" type="button"><span class="status">${ic(e.icon)}</span><div><h3>${esc(e.ar)}</h3><p>${esc(e.en)}</p></div><span>${e.time}</span></button>`).join("")}</div></div></div></section>`);
  }

  function social(state) {
    const friends = [["ALI_FF","ONLINE","89"],["NOVA_KING","IN MATCH","87"],["MOHAMED_10","ONLINE","84"],["ZIDANE_FF","OFFLINE","82"]];
    return shell(state, "profile", `<div class="section-title"><h1>النادي والأصدقاء</h1><span>CLUB / FRIENDS / SAFE SOCIAL</span></div><section class="hero-grid"><div class="panel"><div class="panel-inner"><div class="section-title"><h2>نادي المستقبل</h2><span>FUTURE CLUB</span></div><div class="stats-row"><div class="stat"><b>32/50</b><span>أعضاء</span></div><div class="stat"><b>124</b><span>انتصار</span></div><div class="stat"><b>210</b><span>مباراة</span></div></div><div class="cta-row"><button class="btn" data-route="leaderboard" type="button">لوحة المتصدرين</button><button class="btn secondary" data-route="notifications" type="button">التنبيهات</button></div></div></div><div class="panel"><div class="panel-inner"><div class="section-title"><h2>تواصل آمن</h2><span>SAFE REACTIONS</span></div><div class="badge-row"><span class="badge lime">لعب جميل!</span><span class="badge">بالتوفيق</span><span class="badge">تمريرة رائعة</span><span class="badge">أحسنت</span><span class="badge">شكراً</span></div><div style="height:12px"></div><div class="list">${friends.map(f=>`<div class="list-item"><span class="status">${ic("user")}</span><div><h3>${f[0]}</h3><p>${f[1]}</p></div><strong class="price">${f[2]}</strong></div>`).join("")}</div></div></div></section>`);
  }

  function leaderboard(state) {
    const rows = [["FUT_legend","2,450,000"],["KING_FF","2,210,500"],["ALI_FF (أنت)","1,980,300"],["NOOR_FF","1,750,410"],["GOAT_7","1,620,900"]];
    return shell(state, "profile", `<div class="section-title"><h1>لوحة المتصدرين</h1><span>LEADERBOARD</span></div><section class="panel"><div class="panel-inner"><div class="tabs"><button class="tab active">عالمي</button><button class="tab">الأصدقاء</button><button class="tab">النادي</button></div><div class="list">${rows.map((r,i)=>`<div class="list-item ${i===2?'active':''}"><span class="status">${i+1}</span><div><h3>${r[0]}</h3><p>GLOBAL RANKING</p></div><strong class="price">${r[1]}</strong></div>`).join("")}</div></div></section>`);
  }

  function notifications(state) {
    const items = [["🎁","مكافأة مهمة يومية","Daily mission reward claimed","منذ 5 دقائق"],["👥","دعوة للانضمام إلى النادي","Club invitation","منذ 15 دقيقة"],["⚡","حدث جديد متاح الآن","New event is live","منذ ساعة"],["🛒","تم فتح عرض متجر جديد","New store offer","منذ ساعتين"]];
    return shell(state, "profile", `<div class="section-title"><h1>الإشعارات والبريد</h1><span>NOTIFICATIONS & INBOX</span></div><section class="panel"><div class="panel-inner"><div class="list">${items.map(i=>`<div class="list-item"><span class="status">${ic(i[0])}</span><div><h3>${i[1]}</h3><p>${i[2]}</p></div><span>${i[3]}</span></div>`).join("")}</div><div class="cta-row"><button class="btn secondary" data-route="rewards" type="button">استلام المكافآت</button></div></div></section>`);
  }

  function rewards(state) {
    return shell(state, "missions", `<div class="section-title"><h1>المكافآت والتقدم</h1><span>REWARDS & PROGRESSION</span></div><section class="hero-grid"><div class="panel"><div class="panel-inner"><div class="section-title"><h2>مستوى اللاعب</h2><span>LEVELING</span></div><div class="stats-row"><div class="stat"><b>${state.player.level}</b><span>الحالي</span></div><div class="stat"><b>${state.player.level+1}</b><span>التالي</span></div><div class="stat"><b>${state.player.xp}</b><span>XP</span></div></div><div style="height:14px"></div><div class="progress"><i style="--p:${pct(state.player.xp,state.player.nextXp)}%"></i></div><button class="btn" data-action="claimMissions" type="button" style="margin-top:16px">استلام المكتمل</button></div></div><div class="panel"><div class="panel-inner"><div class="section-title"><h2>جوائز قادمة</h2><span>NEXT REWARDS</span></div><div class="card-grid two"><div class="ff-card"><div class="icon-badge">${ic("coin")}</div><h3>2,000 عملة</h3><p>COINS</p></div><div class="ff-card"><div class="icon-badge">${ic("shirt")}</div><h3>زي حصري</h3><p>EXCLUSIVE KIT</p></div></div></div></div></section>`);
  }

  function notFound(state) {
    return shell(state, "home", `<section class="panel"><div class="panel-inner empty"><span class="big">🚧</span><h1>الشاشة تحت التطوير</h1><p>تم تجهيز البنية وقابلية الربط، ويمكن إضافة الشاشة التالية كمكوّن مستقل.</p></div></section>`);
  }

  window.FFUI = { home, modes, team, tournaments, missions, shop, profile, settings, preMatch, liveMatch, matchSummary, training, avatar, skills, academy, events, social, leaderboard, notifications, rewards, notFound, esc, pct };
})();
