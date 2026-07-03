// بيانات اللاعبين — شخصيات مرحة للأطفال

export interface PlayerDef {
  id: string;
  name: string;
  emoji: string;
  color: number; // لون القميص
  speed: number; // 1-5
  power: number; // 1-5 يؤثر على أقصى قوة تسديد
  accuracy: number; // 1-5 يقلل انحراف التسديدة
  celebration: string; // عبارة احتفال خاصة
}

export const PLAYERS: PlayerDef[] = [
  {
    id: 'saloumi',
    name: 'سلومي السريع',
    emoji: '⚡',
    color: 0xff5d5d,
    speed: 5,
    power: 3,
    accuracy: 3,
    celebration: 'أسرع من البرق! ⚡',
  },
  {
    id: 'hassouni',
    name: 'كابتن حسوني',
    emoji: '🧢',
    color: 0x2f9bff,
    speed: 4,
    power: 4,
    accuracy: 4,
    celebration: 'قيادة رائعة يا كابتن! 🧢',
  },
  {
    id: 'mohammed',
    name: 'الأسطورة محمد',
    emoji: '🔥',
    color: 0xff8c42,
    speed: 3,
    power: 5,
    accuracy: 3,
    celebration: 'تسديدة أسطورية! 🔥',
  },
  {
    id: 'aws',
    name: 'العَلَم أوس',
    emoji: '🎯',
    color: 0x35c96b,
    speed: 3,
    power: 3,
    accuracy: 5,
    celebration: 'دقة مذهلة يا أوس! 🎯',
  },
  {
    id: 'azzam',
    name: 'العمدة عزام',
    emoji: '👑',
    color: 0x9b6bff,
    speed: 3,
    power: 4,
    accuracy: 4,
    celebration: 'احتفال العمدة! 👑🎉',
  },
  {
    id: 'sheikh',
    name: 'الشيخ الهداف',
    emoji: '🌙',
    color: 0x20b2aa,
    speed: 2,
    power: 4,
    accuracy: 5,
    celebration: 'هدوء وإتقان! 🌙',
  },
  {
    id: 'assoumi',
    name: 'الزعيم عصومي',
    emoji: '💪',
    color: 0xffd93d,
    speed: 4,
    power: 5,
    accuracy: 2,
    celebration: 'قوة الزعيم! 💪',
  },
];

export function getPlayer(id: string): PlayerDef {
  return PLAYERS.find((p) => p.id === id) ?? PLAYERS[1];
}
