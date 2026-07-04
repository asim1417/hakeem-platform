window.FF_DATA = {
  app: {
    nameAr: "فوتبول فيوتشر",
    nameEn: "Football Future",
    taglineAr: "العب. تطور. انتصر.",
    taglineEn: "PLAY. GROW. WIN.",
    build: "0.1.0-static-prototype"
  },
  colors: {
    deepBlack: "#0B0F14",
    graphite: "#111720",
    deepNavy: "#1B2430",
    steelBlue: "#2A3442",
    electricLime: "#C6FF00",
    cyan: "#00E5FF",
    teal: "#00BFAE",
    white: "#FFFFFF",
    silver: "#B2BCC6"
  },
  nav: [
    { id: "home", ar: "الرئيسية", en: "HOME", icon: "⌂" },
    { id: "modes", ar: "الأوضاع", en: "MODES", icon: "🎮" },
    { id: "team", ar: "فريقي", en: "TEAM", icon: "👥" },
    { id: "tournaments", ar: "البطولات", en: "CUPS", icon: "🏆" },
    { id: "missions", ar: "المهام", en: "MISSIONS", icon: "☑" },
    { id: "shop", ar: "المتجر", en: "SHOP", icon: "🛒" },
    { id: "profile", ar: "الملف", en: "PROFILE", icon: "★" }
  ],
  modes: [
    { id: "quick", ar: "مباراة سريعة", en: "Quick Match", icon: "⚽", desc: "ادخل مباراة مباشرة ضد الذكاء الاصطناعي." },
    { id: "career", ar: "مهنة اللاعب", en: "Player Career", icon: "🔟", desc: "طوّر لاعبك من مبتدئ إلى نجم المستقبل." },
    { id: "academy", ar: "الأكاديمية", en: "Academy", icon: "🎯", desc: "تدريب وتمارين مبسطة مناسبة للأعمار 7–14." },
    { id: "online", ar: "اللعب الجماعي", en: "Online", icon: "🌐", desc: "جاهز لاحقًا لخدمة التوفيق الآمن والنوادي." },
    { id: "training", ar: "تدريب", en: "Training", icon: "🏃", desc: "تدرب على التسديد والتمرير والمراوغة." },
    { id: "friendly", ar: "ودية", en: "Friendly", icon: "🤝", desc: "مباراة ممتعة بدون تأثير على الترتيب." }
  ],
  players: [
    { name: "علي", en: "ALI", pos: "ST", rating: 89, x: 88, y: 50, stats: { PAC: 92, SHO: 88, PAS: 85, DRI: 90, DEF: 45, PHY: 82 } },
    { name: "ريان", en: "RAYAN", pos: "LW", rating: 86, x: 75, y: 25, stats: { PAC: 88, SHO: 78, PAS: 82, DRI: 87, DEF: 44, PHY: 74 } },
    { name: "سامي", en: "SAMI", pos: "RW", rating: 85, x: 75, y: 75, stats: { PAC: 87, SHO: 80, PAS: 79, DRI: 83, DEF: 42, PHY: 76 } },
    { name: "فهد", en: "FAHAD", pos: "CM", rating: 87, x: 55, y: 50, stats: { PAC: 78, SHO: 76, PAS: 90, DRI: 84, DEF: 72, PHY: 80 } },
    { name: "نواف", en: "NAWAF", pos: "CM", rating: 84, x: 48, y: 28, stats: { PAC: 76, SHO: 74, PAS: 86, DRI: 80, DEF: 73, PHY: 78 } },
    { name: "مازن", en: "MAZEN", pos: "CM", rating: 84, x: 48, y: 72, stats: { PAC: 77, SHO: 73, PAS: 85, DRI: 82, DEF: 72, PHY: 79 } },
    { name: "تركي", en: "TURKI", pos: "LB", rating: 82, x: 30, y: 16, stats: { PAC: 80, SHO: 52, PAS: 70, DRI: 72, DEF: 83, PHY: 78 } },
    { name: "سلمان", en: "SALMAN", pos: "CB", rating: 84, x: 25, y: 38, stats: { PAC: 66, SHO: 45, PAS: 68, DRI: 63, DEF: 88, PHY: 86 } },
    { name: "بدر", en: "BADR", pos: "CB", rating: 83, x: 25, y: 62, stats: { PAC: 68, SHO: 42, PAS: 66, DRI: 61, DEF: 86, PHY: 84 } },
    { name: "عمر", en: "OMAR", pos: "RB", rating: 82, x: 30, y: 84, stats: { PAC: 81, SHO: 50, PAS: 70, DRI: 72, DEF: 83, PHY: 77 } },
    { name: "حارس", en: "GK", pos: "GK", rating: 86, x: 8, y: 50, stats: { DIV: 87, HAN: 84, KIC: 79, REF: 88, SPD: 60, POS: 85 } }
  ],
  missions: [
    { id: "m1", ar: "سجل 3 أهداف", en: "Score 3 goals", progress: 2, target: 3, reward: 150, type: "XP" },
    { id: "m2", ar: "اربح مباراة واحدة", en: "Win 1 match", progress: 0, target: 1, reward: 200, type: "XP" },
    { id: "m3", ar: "أكمل 10 تمريرات", en: "Complete 10 passes", progress: 7, target: 10, reward: 100, type: "XP" },
    { id: "m4", ar: "تدرب مرة واحدة", en: "Train once", progress: 1, target: 1, reward: 100, type: "XP" }
  ],
  events: [
    { ar: "كأس فيوتشر", en: "Future Cup", time: "02:15:30", icon: "🏆" },
    { ar: "دوري الشباب", en: "Youth League", time: "1:15:30", icon: "⚡" },
    { ar: "نهائيات الأبطال", en: "Champions Finals", time: "5:45:30", icon: "🛡" }
  ],
  shop: [
    { ar: "باقة اللاعبين", en: "Players Pack", rating: "85+", price: "750" },
    { ar: "باقة النخبة", en: "Elite Pack", rating: "90+", price: "1,250" },
    { ar: "باقة الأبطال", en: "Heroes Pack", rating: "92+", price: "2,500" },
    { ar: "بطاقة الموسم", en: "Season Pass", rating: "VIP", price: "3,000" }
  ],
  settings: [
    { ar: "الحساب", en: "Account", icon: "👤", type: "link" },
    { ar: "التحكم", en: "Controls", icon: "🎮", type: "link" },
    { ar: "الصوت", en: "Audio", icon: "🔊", type: "toggle", on: true },
    { ar: "الرسومات", en: "Graphics", icon: "✨", type: "link" },
    { ar: "اللغة", en: "Arabic / English", icon: "🌐", type: "link" },
    { ar: "الخصوصية والأمان", en: "Privacy & Safety", icon: "🛡", type: "link" },
    { ar: "مساعدة ودعم", en: "Help & Support", icon: "؟", type: "link" }
  ],
  copy: {
    safeChat: ["لعب جميل!", "حظًا موفقًا", "تمريرة رائعة", "أحسنت", "مباراة ممتعة"],
    tutorial: [
      "اسحب الدائرة اليسرى للتحرك.",
      "اضغط تمرير لإرسال الكرة لأقرب لاعب.",
      "اضغط تسديد قرب المرمى للتسجيل.",
      "استخدم الركض وقت الهجمة، ولا تستهلك لياقتك بالكامل."
    ]
  }
};
