// التقدم والمكافآت — يُحفظ محليًا على الجهاز فقط (localStorage)
// بلا حسابات، بلا خوادم، بلا جمع بيانات

export interface BallSkin {
  key: string; // مفتاح الصورة ball-*
  name: string;
  cost: number; // نجوم مطلوبة للفتح (0 = مفتوحة)
}

export interface StadiumSkin {
  key: string; // مفتاح الصورة stadium-*
  name: string;
  cost: number;
}

export const BALLS: BallSkin[] = [
  { key: 'ball-real', name: 'الكرة الرسمية', cost: 0 },
  { key: 'ball-stars', name: 'كرة النجوم', cost: 5 },
  { key: 'ball-fire', name: 'كرة النار', cost: 15 },
  { key: 'ball-bolt', name: 'كرة البرق', cost: 30 },
  { key: 'ball-gold', name: 'كرة الذهب', cost: 50 },
];

export const STADIUMS: StadiumSkin[] = [
  { key: 'stadium-real', name: 'الملعب الكبير', cost: 0 },
  { key: 'stadium-school', name: 'ملعب المدرسة', cost: 10 },
  { key: 'stadium-street', name: 'ملعب الحارة', cost: 20 },
  { key: 'stadium-stars', name: 'ملعب النجوم', cost: 40 },
  { key: 'stadium-cup', name: 'ملعب الكأس الكبير', cost: 60 },
];

const KEY = 'penalty-stars-progress';

// لاعب يضيفه الأهل: اسم وصورة فقط — تُحفظ على الجهاز ولا تغادر أبدًا
export interface CustomPlayerSaved {
  id: string; // custom-1 | custom-2
  name: string;
  photo: string; // data URI مصغّرة ٢٠٠×٢٠٠
}

export const MAX_CUSTOM_PLAYERS = 2;

// سجل اللعب — أرقام محلية للملف الشخصي والإنجازات
export interface PlayStats {
  shots: number; // تسديدات اللاعب
  goals: number; // أهدافه
  saves: number; // تصديات دور الحراسة بالإصبع
  rounds: number; // جولات مكتملة (٥ تسديدات)
  goldenWins: number; // انتصارات الضربة الذهبية
}

const EMPTY_STATS: PlayStats = { shots: 0, goals: 0, saves: 0, rounds: 0, goldenWins: 0 };

interface SavedProgress {
  totalStars: number;
  ball: string;
  stadium: string;
  trophy?: boolean; // الفوز بكأس النجوم
  lastDailyDate?: string; // آخر يوم أُنجز فيه تحدي اليوم
  announcerOn?: boolean; // تفضيل صوت المعلق
  customPlayers?: CustomPlayerSaved[]; // لاعبو العائلة المضافون
  stats?: PlayStats; // سجل اللعب
}

function load(): SavedProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { totalStars: 0, ball: 'ball-real', stadium: 'stadium-real', ...JSON.parse(raw) };
  } catch {
    /* التخزين غير متاح — نلعب بلا حفظ */
  }
  return { totalStars: 0, ball: 'ball-real', stadium: 'stadium-real' };
}

function save(p: SavedProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* لا شيء */
  }
}

let state = load();

export const progress = {
  totalStars: () => state.totalStars,
  addStars(n: number): void {
    state.totalStars += n;
    save(state);
  },
  selectedBall: () => state.ball,
  selectedStadium: () => state.stadium,
  selectBall(key: string): void {
    state.ball = key;
    save(state);
  },
  selectStadium(key: string): void {
    state.stadium = key;
    save(state);
  },
  isUnlocked: (cost: number) => state.totalStars >= cost,
  hasTrophy: () => Boolean(state.trophy),
  winTrophy(): void {
    state.trophy = true;
    save(state);
  },
  // تحدي اليوم — يُنجز مرة واحدة يوميًا (تاريخ محلي، بلا خوادم)
  dailyDoneToday(): boolean {
    return state.lastDailyDate === new Date().toDateString();
  },
  markDailyDone(): void {
    state.lastDailyDate = new Date().toDateString();
    save(state);
  },
  announcerEnabled(): boolean {
    return state.announcerOn !== false; // مفعّل افتراضيًا
  },
  setAnnouncer(on: boolean): void {
    state.announcerOn = on;
    save(state);
  },
  resetAll(): void {
    state = { totalStars: 0, ball: 'ball-real', stadium: 'stadium-real' };
    save(state);
  },
  // ── لاعبو العائلة ──
  customPlayers(): CustomPlayerSaved[] {
    return state.customPlayers ?? [];
  },
  addCustomPlayer(name: string, photo: string): CustomPlayerSaved | null {
    const list = state.customPlayers ?? [];
    if (list.length >= MAX_CUSTOM_PLAYERS) return null;
    // أول معرف شاغر حتى لا يتصادم مع لاعب محذوف سابقًا
    let n = 1;
    while (list.some((c) => c.id === `custom-${n}`)) n++;
    const player: CustomPlayerSaved = { id: `custom-${n}`, name, photo };
    state.customPlayers = [...list, player];
    save(state);
    return player;
  },
  removeCustomPlayer(id: string): void {
    state.customPlayers = (state.customPlayers ?? []).filter((c) => c.id !== id);
    save(state);
  },
  // ── سجل اللعب ──
  stats(): PlayStats {
    return { ...EMPTY_STATS, ...(state.stats ?? {}) };
  },
  recordShot(goal: boolean): void {
    const s = this.stats();
    s.shots++;
    if (goal) s.goals++;
    state.stats = s;
    save(state);
  },
  recordSave(): void {
    const s = this.stats();
    s.saves++;
    state.stats = s;
    save(state);
  },
  recordRound(): void {
    const s = this.stats();
    s.rounds++;
    state.stats = s;
    save(state);
  },
  recordGolden(): void {
    const s = this.stats();
    s.goldenWins++;
    state.stats = s;
    save(state);
  },
  // المكافآت التي فُتحت بين رصيدين — لإظهار بشارة الفتح
  newUnlocks(before: number, after: number): string[] {
    return [...BALLS, ...STADIUMS]
      .filter((item) => item.cost > 0 && item.cost > before && item.cost <= after)
      .map((item) => item.name);
  },
};
