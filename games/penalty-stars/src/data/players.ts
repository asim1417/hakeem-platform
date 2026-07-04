// بيانات اللاعبين — شخصيات مرحة للأطفال (مقياس ١–١٠)
// لإضافة صورة حقيقية للاعب: ضع الصورة في src/assets/players/
// واستوردها هنا ثم أسندها لحقل photo — تُستخدم تلقائيًا بدل الشكل المرسوم

import { CustomPlayerSaved, progress } from '../utils/progress';
import saloumiPhoto from '../assets/players/saloumi.webp';
import hassouniPhoto from '../assets/players/hassouni.webp';
import hammadPhoto from '../assets/players/hammad.webp';
import hishamPhoto from '../assets/players/hisham.webp';
import omarPhoto from '../assets/players/omar.webp';
import sheikhPhoto from '../assets/players/sheikh.webp';
import mohammedPhoto from '../assets/players/mohammed.webp';
import azzamPhoto from '../assets/players/azzam.webp';

// نوع الاحتفال عند تسجيل الهدف
export type CelebrationType = 'run' | 'cup' | 'fire' | 'flag' | 'crowd' | 'stars' | 'dance' | 'smart' | 'roar' | 'crown';

export interface PlayerDef {
  id: string;
  name: string;
  emoji: string;
  color: number; // لون القميص
  speed: number; // 1-10
  power: number; // 1-10 يؤثر على أقصى قوة تسديد
  accuracy: number; // 1-10 يقلل انحراف التسديدة
  celebration: string; // عبارة احتفال خاصة
  celebrationType: CelebrationType; // الاحتفال المرئي
  cheer: string; // عبارة المذيع الصغير عند التسديد 🎤
  photo?: string; // صورة حقيقية اختيارية (data URI عند البناء)
}

export const PLAYERS: PlayerDef[] = [
  {
    id: 'saloumi',
    name: 'سلومي السريع',
    emoji: '⚡',
    color: 0xff5d5d,
    speed: 9,
    power: 6,
    accuracy: 7,
    celebration: 'أسرع من البرق! ⚡',
    celebrationType: 'run',
    cheer: 'يا سلام يا سلومي!',
    photo: saloumiPhoto,
  },
  {
    id: 'hassouni',
    name: 'كابتن حسوني',
    emoji: '🧢',
    color: 0x2f9bff,
    speed: 7,
    power: 7,
    accuracy: 7,
    celebration: 'قيادة رائعة يا كابتن! 🧢',
    celebrationType: 'cup',
    cheer: 'كابتن حسوني يسدد!',
    photo: hassouniPhoto,
  },
  {
    id: 'hammad',
    name: 'العبقري حماد',
    emoji: '🤓',
    color: 0xff6b9d,
    speed: 7,
    power: 6,
    accuracy: 9,
    celebration: 'تسديدة محسوبة بذكاء! 🤓',
    celebrationType: 'smart',
    cheer: 'العبقري حماد يحسبها صح!',
    photo: hammadPhoto,
  },
  {
    id: 'hisham',
    name: 'الشبل هشام',
    emoji: '🦁',
    color: 0xc78f3c,
    speed: 8,
    power: 7,
    accuracy: 6,
    celebration: 'زئير الشبل! 🦁',
    celebrationType: 'roar',
    cheer: 'الشبل هشام ينقض على الكرة!',
    photo: hishamPhoto,
  },
  {
    id: 'omar',
    name: 'الأمير عمر',
    emoji: '🤴',
    color: 0x4169e1,
    speed: 7,
    power: 7,
    accuracy: 8,
    celebration: 'تحية الأمير! 🤴',
    celebrationType: 'crown',
    cheer: 'الأمير عمر يتقدم بثقة!',
    photo: omarPhoto,
  },
  {
    id: 'mohammed',
    name: 'الأسطورة محمد',
    emoji: '🔥',
    color: 0xff8c42,
    speed: 6,
    power: 9,
    accuracy: 7,
    celebration: 'تسديدة أسطورية! 🔥',
    celebrationType: 'fire',
    cheer: 'الأسطورة محمد لا يرحم!',
    photo: mohammedPhoto,
  },
  {
    id: 'aws',
    name: 'العَلَم أوس',
    emoji: '🎯',
    color: 0x35c96b,
    speed: 7,
    power: 6,
    accuracy: 9,
    celebration: 'دقة مذهلة يا أوس! 🎯',
    celebrationType: 'flag',
    cheer: 'المعلم أوس يعرف الزاوية!',
  },
  {
    id: 'azzam',
    name: 'العمدة عزام',
    emoji: '👑',
    color: 0x9b6bff,
    speed: 7,
    power: 8,
    accuracy: 7,
    celebration: 'احتفال العمدة! 👑🎉',
    celebrationType: 'crowd',
    cheer: 'العمدة عزام قائد الملعب!',
    photo: azzamPhoto,
  },
  {
    id: 'sheikh',
    name: 'الشيخ أحمد',
    emoji: '🌙',
    color: 0x20b2aa,
    speed: 6,
    power: 7,
    accuracy: 9,
    celebration: 'هدوء وإتقان! 🌙',
    celebrationType: 'stars',
    cheer: 'الشيخ أحمد يسجل بكل هدوء!',
    photo: sheikhPhoto,
  },
  {
    id: 'assoumi',
    name: 'الزعيم عصومي',
    emoji: '💪',
    color: 0xffd93d,
    speed: 8,
    power: 8,
    accuracy: 7,
    celebration: 'قوة الزعيم! 💪',
    celebrationType: 'dance',
    cheer: 'الزعيم عصومي نجم المباراة!',
  },
];

// لاعب العائلة المضاف من الجهاز — إحصائيات متوازنة ولون ذهبي مميز
export function customToDef(c: CustomPlayerSaved): PlayerDef {
  return {
    id: c.id,
    name: c.name,
    emoji: '⭐',
    color: 0xffd45a,
    speed: 7,
    power: 7,
    accuracy: 7,
    celebration: `نجم العائلة ${c.name}! ⭐`,
    celebrationType: 'stars',
    cheer: `${c.name} يسدد بثقة!`,
    photo: c.photo,
  };
}

// كل اللاعبين: الأساسيون + من أضافتهم العائلة
export function allPlayers(): PlayerDef[] {
  return [...PLAYERS, ...progress.customPlayers().map(customToDef)];
}

export function getPlayer(id: string): PlayerDef {
  return allPlayers().find((p) => p.id === id) ?? PLAYERS[1];
}
