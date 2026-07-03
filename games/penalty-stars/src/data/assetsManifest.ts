// خريطة الأصول الموحّدة — مفتاح الصورة في Phaser ← الملف المضمّن
// الملفات في src/assets/ تُدمج data URI داخل ملف اللعبة الواحد عند البناء.
// لاستبدال أي أصل بصورة حقيقية: ضع الملف بنفس الاسم في src/assets/images/ وأعد البناء.
// (سير جلب الأصول الخارجية موثق في ASSET_GUIDE.md وسكربت scripts/fetch-assets.mjs)

import stadiumReal from '../assets/images/stadium-real.jpg';
import stadiumSchool from '../assets/images/stadium-school.jpg';
import stadiumStreet from '../assets/images/stadium-street.jpg';
import stadiumStars from '../assets/images/stadium-stars.jpg';
import stadiumCup from '../assets/images/stadium-cup.jpg';
import ballReal from '../assets/images/ball-real.png';
import ballStars from '../assets/images/ball-stars.png';
import ballFire from '../assets/images/ball-fire.png';
import ballBolt from '../assets/images/ball-bolt.png';
import ballGold from '../assets/images/ball-gold.png';

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
};
