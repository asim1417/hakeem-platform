#!/usr/bin/env node
/**
 * المعالجة الجماعية للوثائق العربية — Google Drive → Gemini OCR → ملفات نصية خام
 *
 * وضعان للتشغيل:
 *   1) Drive:  DRIVE_FOLDER_ID=معرف_المجلد node processDriveDocuments.js
 *      يتطلب credentials.json (حساب خدمة) في هذا المجلد، ومشاركة مجلد Drive
 *      مع بريد حساب الخدمة (…@…gserviceaccount.com) بصلاحية «مشاهد».
 *   2) محلي:   DOCUMENTS_FOLDER=./my-drive-documents node processDriveDocuments.js
 *      يقرأ مجلداً محلياً يحوي الوثائق (صور/PDF) بدل Drive.
 *
 * المتطلبات المشتركة: GEMINI_API_KEY في البيئة، و`npm install` في هذا المجلد.
 *
 * مزايا مدمجة للأعداد الكبيرة (مثل 220 وثيقة):
 *   - استئناف تلقائي: الملف الذي له ناتج .txt سابق يُتخطى — أعد التشغيل بأمان بعد أي انقطاع
 *   - ترقيم صفحات Drive: يجلب كل الملفات مهما بلغ عددها (لا يقف عند 300)
 *   - إعادة محاولة تلقائية عند حدود المعدل (429) بانتظار متزايد
 *   - سجل نهائي: عدد الناجح/المتخطى/الفاشل وقائمة بالإخفاقات
 */

import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // pro للخط اليدوي المعقد
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '';
const DOCUMENTS_FOLDER = process.env.DOCUMENTS_FOLDER || '';
const OUTPUT_FOLDER = process.env.OUTPUT_FOLDER || './extracted-arabic-texts';
const CREDENTIALS_FILE = process.env.GOOGLE_CREDENTIALS_FILE || './credentials.json';
// مهلة لطيفة بين الوثائق لتفادي حدود المعدل (بالمللي ثانية)
const DELAY_MS = Number(process.env.DELAY_MS || 1200);

const SUPPORTED_MIMES = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const EXT_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' };

const OCR_PROMPT =
  'قم بقراءة هذه الوثيقة واستخراج كافة النصوص العربية والإنجليزية منها كنص خام بدقة عالية. ' +
  'حافظ على ترتيب الأسطر وتنسيق الفقرات والجداول إن وجدت، دون أي تفسير أو مقدمات منك.';

// ── فحوصات مسبقة بواجبها رسائل واضحة ──
if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error('❌ GEMINI_API_KEY غير مضبوط. اضبطه ثم أعد التشغيل:');
  console.error('   export GEMINI_API_KEY="مفتاحك-من-Google-AI-Studio"');
  process.exit(1);
}
if (!DRIVE_FOLDER_ID && !DOCUMENTS_FOLDER) {
  console.error('❌ حدد مصدر الوثائق بأحد الوضعين:');
  console.error('   DRIVE_FOLDER_ID=معرف_مجلد_درايف node processDriveDocuments.js');
  console.error('   DOCUMENTS_FOLDER=./مجلد_محلي     node processDriveDocuments.js');
  process.exit(1);
}
if (DRIVE_FOLDER_ID && !fs.existsSync(CREDENTIALS_FILE)) {
  console.error(`❌ ملف ترخيص حساب الخدمة غير موجود: ${CREDENTIALS_FILE}`);
  console.error('   أنشئ Service Account في Google Cloud Console، فعّل Google Drive API،');
  console.error('   نزّل مفتاح JSON باسم credentials.json هنا، وشارك مجلد Drive مع بريد الحساب.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** استدعاء Gemini مع إعادة محاولة تلقائية عند حدود المعدل */
async function geminiExtract(base64Data, mimeType, attempt = 1) {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ inlineData: { data: base64Data, mimeType } }, OCR_PROMPT],
    });
    const text = (response.text ?? '').trim();
    if (!text) throw new Error('أعاد Gemini نصاً فارغاً — تأكد من وضوح الوثيقة');
    return text;
  } catch (err) {
    const msg = String(err?.message ?? err);
    const rateLimited = /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
    if (rateLimited && attempt <= 4) {
      const wait = attempt * 15000;
      console.log(`   ⏳ حد المعدل — انتظار ${wait / 1000} ثانية ثم إعادة المحاولة (${attempt}/4)…`);
      await sleep(wait);
      return geminiExtract(base64Data, mimeType, attempt + 1);
    }
    throw err;
  }
}

/** يجلب قائمة الوثائق من مجلد Drive كاملةً (مع ترقيم الصفحات) */
async function listDriveFiles(drive) {
  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 200,
      pageToken,
    });
    files.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function main() {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });

  // ── تجهيز قائمة العمل من Drive أو من مجلد محلي ──
  let tasks; // [{ name, mimeType, read: () => Promise<Buffer> }]
  if (DRIVE_FOLDER_ID) {
    console.log('🔄 الاتصال بـ Google Drive وجلب قائمة الوثائق…');
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_FILE,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const files = await listDriveFiles(drive);
    tasks = files
      .filter((f) => SUPPORTED_MIMES.has(f.mimeType))
      .map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        read: async () => {
          const res = await drive.files.get({ fileId: f.id, alt: 'media' }, { responseType: 'arraybuffer' });
          return Buffer.from(res.data);
        },
      }));
  } else {
    console.log(`🔄 قراءة المجلد المحلي: ${DOCUMENTS_FOLDER}`);
    tasks = fs
      .readdirSync(DOCUMENTS_FOLDER)
      .filter((name) => EXT_MIME[path.extname(name).toLowerCase()])
      .map((name) => ({
        name,
        mimeType: EXT_MIME[path.extname(name).toLowerCase()],
        read: async () => fs.readFileSync(path.join(DOCUMENTS_FOLDER, name)),
      }));
  }

  if (!tasks.length) {
    console.log('❌ لم يُعثر على وثائق مدعومة (PNG/JPG/PDF) في المصدر.');
    return;
  }
  console.log(`🟢 عُثر على ${tasks.length} وثيقة. النموذج: ${GEMINI_MODEL} — المخرجات في: ${OUTPUT_FOLDER}\n`);

  let done = 0, skipped = 0;
  const failures = [];

  for (const [i, task] of tasks.entries()) {
    const outName = path.parse(task.name).name + '.txt';
    const outPath = path.join(OUTPUT_FOLDER, outName);

    // استئناف: الناتج موجود من تشغيل سابق → تخطٍّ
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      skipped++;
      console.log(`⏭️  [${i + 1}/${tasks.length}] موجود مسبقاً — ${outName}`);
      continue;
    }

    console.log(`📄 [${i + 1}/${tasks.length}] معالجة: ${task.name} …`);
    try {
      const buffer = await task.read();
      const text = await geminiExtract(buffer.toString('base64'), task.mimeType);
      fs.writeFileSync(outPath, text, 'utf8');
      done++;
      console.log(`   ✅ حُفظ → ${outName} (${text.length.toLocaleString('ar-EG')} حرف)`);
    } catch (err) {
      failures.push({ name: task.name, error: String(err?.message ?? err).slice(0, 120) });
      console.error(`   ❌ فشل: ${String(err?.message ?? err).slice(0, 160)}`);
    }
    if (i < tasks.length - 1) await sleep(DELAY_MS);
  }

  // ── الملخص النهائي ──
  console.log('\n════════ الملخص ════════');
  console.log(`✅ نجح:   ${done}`);
  console.log(`⏭️  تُخطي: ${skipped} (معالَج سابقاً)`);
  console.log(`❌ فشل:   ${failures.length}`);
  if (failures.length) {
    console.log('\nالإخفاقات (أعد التشغيل نفسه لاستئناف معالجتها فقط):');
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
    process.exitCode = 1;
  } else {
    console.log(`\n🎉 اكتملت العملية بالكامل! تحقق من مجلد: ${OUTPUT_FOLDER}`);
  }
}

main().catch((err) => {
  console.error('💥 حدث خطأ عام في النظام:', err?.message ?? err);
  process.exit(1);
});
