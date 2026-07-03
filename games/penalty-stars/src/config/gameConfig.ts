// إعدادات اللعبة العامة — نجوم البلنتيات

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

// ألوان المنصة المبهجة
export const COLORS = {
  grass: 0x2e9e4f,
  grassDark: 0x27893f,
  sky: 0x7ed6f2,
  yellow: 0xffd93d,
  white: 0xffffff,
  blue: 0x2f9bff,
  orange: 0xff8c42,
  pink: 0xff6b9d,
  net: 0xe8f6ff,
};

// أبعاد المرمى والملعب
export const GOAL = {
  centerX: GAME_WIDTH / 2,
  lineY: 230, // خط المرمى — تجاوزه = هدف
  width: 340,
  height: 130,
  postWidth: 10,
};

export const BALL_START = { x: GAME_WIDTH / 2, y: 640 };

// مستويات الصعوبة — سرعة الحارس واحتمال تخمينه الصحيح
export type DifficultyKey = 'easy' | 'medium' | 'hero';

export interface DifficultySettings {
  key: DifficultyKey;
  label: string;
  keeperIdleSpeed: number; // مدة تأرجح الحارس (ثواني)
  diveDuration: number; // مدة الارتماء (أقل = أسرع)
  guessChance: number; // احتمال تخمين الاتجاه الصحيح
  reach: number; // نصف عرض جسم الحارس الفعال
}

export const DIFFICULTIES: Record<DifficultyKey, DifficultySettings> = {
  easy: { key: 'easy', label: 'سهل', keeperIdleSpeed: 2.6, diveDuration: 0.62, guessChance: 0.3, reach: 46 },
  medium: { key: 'medium', label: 'متوسط', keeperIdleSpeed: 2.0, diveDuration: 0.5, guessChance: 0.45, reach: 50 },
  hero: { key: 'hero', label: 'بطل', keeperIdleSpeed: 1.6, diveDuration: 0.42, guessChance: 0.55, reach: 54 },
};

export const SHOTS_PER_ROUND = 5;

// قوة التسديد
export const SHOT = {
  minPower: 420,
  maxPower: 980,
  dragToPower: 3.2, // تحويل طول السحب إلى قوة
  minDrag: 24, // أقل سحب مقبول
};

// عبارات تشجيعية — لا عبارات سلبية أبدًا
export const PHRASES = {
  goal: ['قووول يا بطل! ⚽', 'تسديدة بطولية! 🌟', 'يا سلام يا نجم! ✨', 'رااائع! هدف عالمي! 🎉'],
  save: ['محاولة رائعة يا بطل! جرّب مرة ثانية 💪', 'محاولة ممتازة! 👏', 'كابتن المستقبل! حاول ثانية 🧤'],
  miss: ['اقتربت كثيرًا! 🎯', 'قريبة جدًا! جرّب ثانية 🌈', 'محاولة ممتازة! صوّب نحو المرمى ⭐'],
};

// تغليف النص بعلامة RTL لضبط اتجاه علامات الترقيم في الكانفاس
export function rtl(s: string): string {
  return `‏${s}‏`;
}

// تحويل الأرقام إلى أرقام عربية
export function arabicNum(n: number): string {
  const d = '٠١٢٣٤٥٦٧٨٩';
  return String(n).replace(/[0-9]/g, (c) => d[Number(c)]);
}

export const FONT = 'Arial, "Segoe UI", Tahoma, sans-serif';
