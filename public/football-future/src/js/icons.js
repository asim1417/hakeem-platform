/* ═══════════════════════════════════════════════════════════════════
   فوتبول فيوتشر — نظام الأيقونات الموحّد (لوحة الهوية 06)
   أيقونات SVG خطية بسيطة وجريئة — لون موروث (currentColor) لتتلون
   بألوان الهوية من CSS، وتظهر متطابقة على كل الأجهزة (لا إيموجي نظام).
   window.FFIcons.svg(nameOrEmoji) ← يقبل اسم الأيقونة أو الإيموجي القديم.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const P = (paths, extra) =>
    `<svg class="ffic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}${extra || ""}</svg>`;

  const ICONS = {
    home: P('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.8V20h13V9.8"/><path d="M9.8 20v-5.4h4.4V20"/>'),
    gamepad: P('<rect x="2.5" y="8" width="19" height="10" rx="5"/><path d="M8 11.4v3.2M6.4 13h3.2"/><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="18.6" cy="14.2" r="1" fill="currentColor" stroke="none"/>'),
    users: P('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S13.9 16 14.5 19"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M16.2 14.6c2.4.2 4 1.6 4.5 4.4"/>'),
    user: P('<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5c.8-3.6 3.4-5.4 6.5-5.4s5.7 1.8 6.5 5.4"/>'),
    trophy: P('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4.5v1.8A3.2 3.2 0 0 0 7.7 10M17 5.5h2.5v1.8a3.2 3.2 0 0 1-3.2 2.7"/><path d="M12 14v3M8.5 20h7M10 17h4"/>'),
    tasks: P('<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.2V3h6v1.2"/><path d="M8.6 12.6l2.2 2.2 4.6-4.6"/><path d="M8.6 18h6.8"/>'),
    cart: P('<path d="M3.5 4.5h2.4l2.2 11h10.4l2-8H7"/><circle cx="9.6" cy="19.3" r="1.5"/><circle cx="16.9" cy="19.3" r="1.5"/>'),
    star: P('<path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/>'),
    ball: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4z"/><path d="M12 3.5v4.7M18.5 7.5l-3.1 3.2M19.9 14.5l-4.5-.3M14.5 19.9l-2.5-3.7-2.5 3.7M4.1 14.5l4.5-.3M5.5 7.5l3.1 3.2"/>'),
    target: P('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>'),
    bolt: P('<path d="M13 2.5 5.5 13.5h5L9.5 21.5 18 10.5h-5z"/>'),
    check: P('<path d="M4.5 12.5l5 5L19.5 7"/>'),
    lock: P('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle cx="12" cy="15.2" r="1.2" fill="currentColor" stroke="none"/>'),
    bell: P('<path d="M6 17h12l-1.5-2.5v-4a4.5 4.5 0 0 0-9 0v4z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>'),
    gear: P('<circle cx="12" cy="12" r="3.3"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>'),
    shield: P('<path d="M12 3l7.5 2.8v6c0 4.2-3 7.3-7.5 9.4C7.5 19.1 4.5 16 4.5 11.8v-6z"/><path d="M9 12l2.2 2.2L15.4 10"/>'),
    cap: P('<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.7V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.3"/><path d="M21 10v4.5"/>'),
    shirt: P('<path d="M8.6 4.5 12 3l3.4 1.5 4.6 2.8-2 3.2-1.7-1V20H7.7V9.5l-1.7 1-2-3.2z"/><path d="M9.5 4.4a2.6 2.6 0 0 0 5 0"/>'),
    boot: P('<path d="M4.5 16.5l6-2.2 1.6-6.8 3.4 1-1 5.4 5 1.8v3.3h-15z"/><path d="M8 18.8v-2M11 17.8v-2"/>'),
    globe: P('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z"/>'),
    gift: P('<rect x="4" y="9.5" width="16" height="4"/><path d="M6 13.5V20h12v-6.5"/><path d="M12 9.5V20"/><path d="M12 9.5C10 9.5 7.5 8.8 7.5 7s2.5-2.4 4.5 2.5c2-4.9 4.5-4.3 4.5-2.5s-2.5 2.5-4.5 2.5z"/>'),
    medal: P('<circle cx="12" cy="14.5" r="4.8"/><path d="M9.5 10.5 7 3.5h4l1 3 1-3h4l-2.5 7"/><path d="M12 12.8l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z" fill="currentColor" stroke="none"/>'),
    speaker: P('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
    sparkle: P('<path d="M12 3.5 13.8 10 20.5 12 13.8 14 12 20.5 10.2 14 3.5 12 10.2 10z"/>'),
    question: P('<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1 1-1.1 1.8v.5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>'),
    spin: P('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 3.5v3.7h-3.7"/>'),
    play: P('<path d="M8 5.5v13l10-6.5z"/>'),
    chat: P('<path d="M4 5.5h16v10.5H9.5L5.5 20v-4H4z"/><path d="M8.5 9.5h7M8.5 12.3h4.5"/>'),
    coin: P('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 9.2v5.6M10.2 10.5h3.6"/>'),
    gem: P('<path d="M7 4h10l4 5.5L12 20.5 3 9.5z"/><path d="M3 9.5h18M7 4l5 5.5L17 4M12 20.5 7.5 9.5M12 20.5l4.5-11"/>'),
    calendar: P('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5"/>'),
    chev: P('<path d="M10 7l5 5-5 5"/>')
  };

  /* خريطة الإيموجي القديم → أيقونة الهوية */
  const EMOJI = {
    "⌂": "home", "🎮": "gamepad", "👥": "users", "👤": "user", "🏆": "trophy",
    "☑": "tasks", "📋": "tasks", "🛒": "cart", "★": "star", "⭐": "star",
    "⚽": "ball", "🎯": "target", "⚡": "bolt", "🏃": "bolt", "🔥": "bolt",
    "✓": "check", "🔒": "lock", "⚙": "gear", "🛡": "shield", "🎓": "cap",
    "🏟": "cap", "🔟": "shirt", "👟": "boot", "🌐": "globe", "🎁": "gift",
    "🏅": "medal", "🔊": "speaker", "✨": "sparkle", "؟": "question", "❔": "question",
    "🌀": "spin", "🤝": "users", "🧠": "target", "💎": "gem", "🪙": "coin",
    "🎽": "shirt", "▶": "play", "💬": "chat"
  };

  function svg(nameOrEmoji) {
    const key = ICONS[nameOrEmoji] ? nameOrEmoji : EMOJI[nameOrEmoji];
    return ICONS[key] || ICONS.ball;
  }

  window.FFIcons = { svg, names: Object.keys(ICONS) };
})();
