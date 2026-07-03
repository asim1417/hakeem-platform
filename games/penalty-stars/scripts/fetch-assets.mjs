// جلب صور واقعية من Pexels وPixabay أثناء التطوير (ليس وقت اللعب)
// الاستخدام: ضع المفاتيح في .env (انظر .env.example) ثم: npm run fetch:assets
// الناتج في public/assets/ للمراجعة اليدوية — بعد الانتقاء انسخ الملفات
// بأسمائها النهائية إلى src/assets/images/ ليضمّها البناء (انظر ASSET_GUIDE.md)
// ⚠️ سجّل كل أصل تعتمده في ATTRIBUTIONS.md قبل الاستخدام

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

const ROOT = process.cwd();

const dirs = {
  stadiums: path.join(ROOT, 'public/assets/images/backgrounds'),
  balls: path.join(ROOT, 'public/assets/images/balls'),
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
}

async function fetchPexelsPhoto(query, outputPath, orientation = 'landscape') {
  if (!PEXELS_API_KEY) {
    console.warn('PEXELS_API_KEY غير موجود، سيتم تخطي Pexels.');
    return false;
  }
  const endpoint = new URL('https://api.pexels.com/v1/search');
  endpoint.searchParams.set('query', query);
  endpoint.searchParams.set('per_page', '1');
  endpoint.searchParams.set('orientation', orientation);

  const res = await fetch(endpoint, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) {
    console.warn(`Pexels error: ${res.status}`);
    return false;
  }
  const data = await res.json();
  const photo = data.photos?.[0];
  if (!photo?.src?.large2x) {
    console.warn('لم يتم العثور على صورة مناسبة من Pexels.');
    return false;
  }
  await downloadFile(photo.src.large2x, outputPath);
  console.log(`Pexels ✓ ${query} — المصوِّر: ${photo.photographer} — ${photo.url}`);
  return true;
}

async function fetchPixabayImage(query, outputPath, orientation = 'horizontal') {
  if (!PIXABAY_API_KEY) {
    console.warn('PIXABAY_API_KEY غير موجود، سيتم تخطي Pixabay.');
    return false;
  }
  const endpoint = new URL('https://pixabay.com/api/');
  endpoint.searchParams.set('key', PIXABAY_API_KEY);
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('image_type', 'photo');
  endpoint.searchParams.set('orientation', orientation);
  endpoint.searchParams.set('safesearch', 'true');
  endpoint.searchParams.set('per_page', '3');

  const res = await fetch(endpoint);
  if (!res.ok) {
    console.warn(`Pixabay error: ${res.status}`);
    return false;
  }
  const data = await res.json();
  const image = data.hits?.[0];
  if (!image?.largeImageURL) {
    console.warn('لم يتم العثور على صورة مناسبة من Pixabay.');
    return false;
  }
  await downloadFile(image.largeImageURL, outputPath);
  console.log(`Pixabay ✓ ${query} — ${image.pageURL}`);
  return true;
}

async function main() {
  const sources = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/asset-sources.json'), 'utf8'));
  await ensureDir(dirs.stadiums);
  await ensureDir(dirs.balls);

  console.log('جلب صور الملاعب...');
  for (const [i, query] of sources.imageQueries.stadiums.entries()) {
    const out = path.join(dirs.stadiums, `stadium-real-${String(i + 1).padStart(2, '0')}.jpg`);
    (await fetchPexelsPhoto(query, out, 'portrait')) || (await fetchPixabayImage(query, out, 'vertical'));
  }

  console.log('جلب صور الكرات...');
  for (const [i, query] of sources.imageQueries.balls.entries()) {
    const out = path.join(dirs.balls, `ball-source-${String(i + 1).padStart(2, '0')}.jpg`);
    (await fetchPexelsPhoto(query, out, 'square')) || (await fetchPixabayImage(query, out, 'horizontal'));
  }

  console.log('مهم: راجع الصور يدويًا وترخيصها، سجّلها في ATTRIBUTIONS.md،');
  console.log('ثم قصّ الكرة إلى PNG شفاف وانسخ الملفات النهائية إلى src/assets/images/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
