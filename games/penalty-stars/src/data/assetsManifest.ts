// خريطة الأصول الموحّدة — مفتاح الصورة في Phaser ← الملف المضمّن
// الملفات في src/assets/ تُدمج data URI داخل ملف اللعبة الواحد عند البناء.
// لاستبدال أي أصل بصورة حقيقية: ضع الملف بنفس الاسم في src/assets/images/ وأعد البناء.
// (سير جلب الأصول الخارجية موثق في ASSET_GUIDE.md وسكربت scripts/fetch-assets.mjs)

import stadiumReal from '../assets/images/stadium-real.webp';
import stadiumSchool from '../assets/images/stadium-school.webp';
import stadiumStreet from '../assets/images/stadium-street.webp';
import stadiumStars from '../assets/images/stadium-stars.webp';
import stadiumCup from '../assets/images/stadium-cup.webp';
import ballReal from '../assets/images/ball-real.webp';
import ballStars from '../assets/images/ball-stars.webp';
import ballFire from '../assets/images/ball-fire.webp';
import ballBolt from '../assets/images/ball-bolt.webp';
import ballGold from '../assets/images/ball-gold.webp';
import cardBase from '../assets/images/card-base.webp';

export const assetsManifest: Record<string, string> = {
  'stadium-real': stadiumReal,
  'stadium-school': stadiumSchool,
  'stadium-street': stadiumStreet,
  'stadium-stars': stadiumStars,
  'stadium-cup': stadiumCup,
  'ball-real': ballReal,
  'ball-stars': ballStars,
  'ball-fire': ballFire,
  'ball-bolt': ballBolt,
  'ball-gold': ballGold,
  'card-base': cardBase, // رسم اللاعب بالطقم من لوحة الهوية — يُركّب عليه وجه الطفل
};
