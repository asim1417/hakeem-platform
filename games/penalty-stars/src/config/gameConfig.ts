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
  // 🖤 هوية «فوتبول فيوتشر» الداكنة (03_DESIGN_TOKENS.json)
  gold: 0xffd45a, // ذهب الكؤوس والنجوم (مكافآت)
  navy: 0x0b0f14, // deepBlack — خلفية الهوية الأساسية
  graphite: 0x111720,
  deepNavy: 0x1b2430,
  steelBlue: 0x2a3442,
  lime: 0xc6ff00, // electricLime — الزر الأساسي
  limeDark: 0x9eeb00,
  cyan: 0x00e5ff, // electricCyan
  teal: 0x00bfae,
  silver: 0xb2bcc6,
  success: 0x36f58a,
  warning: 0xffd23f,
  dangerRed: 0xff4d4d,
  premium: 0xb967ff,
  pitchGreen: 0x0b7a3b,
  pitchDark: 0x06140e,
  softPanel: 0xeaf3ff,
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
export type DifficultyKey = 'easy' | 'medium' | 'hero' | 'iron';

export interface DifficultySettings {
  key: DifficultyKey;
  label: string;
  keeperName: string; // اسم الحارس المرح
  keeperIdleSpeed: number; // مدة تأرجح الحارس (ثواني)
  diveDuration: number; // مدة الارتماء (أقل = أسرع)
  guessChance: number; // احتمال تخمين الاتجاه الصحيح
  reach: number; // نصف عرض جسم الحارس الفعال
}

export const DIFFICULTIES: Record<DifficultyKey, DifficultySettings> = {
  easy: { key: 'easy', label: 'سهلة', keeperName: 'الحارس فرفور', keeperIdleSpeed: 2.6, diveDuration: 0.62, guessChance: 0.3, reach: 46 },
  medium: { key: 'medium', label: 'متوسطة', keeperName: 'الحارس صقر', keeperIdleSpeed: 2.0, diveDuration: 0.5, guessChance: 0.45, reach: 50 },
  hero: { key: 'hero', label: 'صعبة', keeperName: 'الحارس أبو قفزة', keeperIdleSpeed: 1.6, diveDuration: 0.42, guessChance: 0.55, reach: 54 },
  iron: { key: 'iron', label: 'حديدية', keeperName: 'الحارس الحديدي', keeperIdleSpeed: 1.45, diveDuration: 0.4, guessChance: 0.6, reach: 56 },
};

// بطولة نجوم البلنتيات: ٤ أدوار — لكل دور ملعبه وحارسه، والاجتياز بـ PASS_GOALS أهداف
export interface StageDef {
  difficulty: DifficultyKey;
  label: string;
  icon: string;
  stadium: string; // ملعب الدور في البطولة
}

export const STAGES: StageDef[] = [
  { difficulty: 'easy', label: 'الدور الأول', icon: '🙂', stadium: 'stadium-school' },
  { difficulty: 'medium', label: 'نصف النهائي', icon: '😎', stadium: 'stadium-street' },
  { difficulty: 'hero', label: 'النهائي', icon: '🔥', stadium: 'stadium-stars' },
  { difficulty: 'iron', label: 'كأس النجوم', icon: '🏆', stadium: 'stadium-cup' },
];

export const PASS_GOALS = 3; // أهداف اجتياز المرحلة من أصل ٥

export const SHOTS_PER_ROUND = 5;

// قوة التسديد
export const SHOT = {
  minPower: 420,
  maxPower: 980,
  dragToPower: 3.2, // تحويل طول السحب إلى قوة
  minDrag: 24, // أقل سحب مقبول
};

// عبارات تشجيعية — المصدر في src/data/phrases.ts
import { goalPhrases, missPhrases, savePhrases } from '../data/phrases';

export const PHRASES = {
  goal: goalPhrases,
  save: savePhrases,
  miss: missPhrases,
};

// تغليف النص بعلامة RTL لضبط اتجاه علامات الترقيم في الكانفاس
// يُطبَّق لكل سطر لأن الكانفاس يرسم كل سطر على حدة
export function rtl(s: string): string {
  return s
    .split('\n')
    .map((line) => `‏${line}‏`)
    .join('\n');
}

// تحويل الأرقام إلى أرقام عربية
export function arabicNum(n: number): string {
  const d = '٠١٢٣٤٥٦٧٨٩';
  return String(n).replace(/[0-9]/g, (c) => d[Number(c)]);
}

export const FONT = 'Cairo, Arial, "Segoe UI", Tahoma, sans-serif';
// خط العناوين — Noto Kufi (هوية فوتبول فيوتشر) مع سقوط على Cairo
export const HEADING = '"Noto Kufi Arabic", Cairo, Arial, sans-serif';

// رقم الإصدار — يظهر أسفل القائمة للتحقق من أن الجهاز يعرض آخر نسخة
export const VERSION = 'الإصدار ٢٠';
