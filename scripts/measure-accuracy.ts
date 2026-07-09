// قياس دقّة المعالجة على مجموعة ذهبية — يُشغَّل بـ: npm run accuracy
//
// الغاية (وفق التقرير §3): تحويل «الأولى في الدقّة» من ادّعاء إلى رقمٍ مُقاس ومُتتبَّع.
// كل حالة: نصّ خام كما يخرج من الاستخراج + «الحقيقة» المُدقَّقة يدوياً + سقف CER مقبول.
// نمرّر الخام عبر الدماغ الموحّد (processExtractedText) ونقيس مخرَجه مقابل الحقيقة.
//
// هذه بذرة تُثبت المقياس والمعالجة الحتمية. وسّعها بوثائق سعودية حقيقية (صكوك، أحكام،
// نماذج وزارية) مع نصّها الصحيح — فتصير حارساً يمنع أي انحدارٍ في الدقّة عند كل تغيير.
//
// لقياس دقّة OCR فعلية لاحقاً: أضِف حالات مصدرُها "ocr" مع نصّ محرّكٍ حقيقي (Tesseract/
// Gemini/QARI) في hypothesis والحقيقة في truth — فيقارن المقياس المحرّكات كمّياً.

import {
  measureAccuracy,
  formatAccuracy,
  processExtractedText,
  type TextSource
} from "../lib/modules/document-inspection";

interface GoldCase {
  name: string;
  source: TextSource;
  /** النصّ الخام كما يخرج من طبقة الاستخراج (قبل الدماغ). */
  raw: string;
  /** الحقيقة المُدقَّقة يدوياً — ما ينبغي أن يكون عليه المتن بعد المعالجة. */
  truth: string;
  /** سقف CER المقبول (مطبَّعاً) — أصغر = أدقّ. */
  maxCer: number;
  totalPages?: number;
}

// ── المجموعة الذهبية (بذرة حتمية — وسّعها بوثائق حقيقية) ──
const GOLDSET: GoldCase[] = [
  {
    name: "طبقة نصّ رقمية سليمة — لا تتغيّر",
    source: "digital-layer",
    raw: "المادة الأولى: يُعمل بأحكام هذا النظام من تاريخ نشره في الجريدة الرسمية.",
    truth: "المادة الأولى: يُعمل بأحكام هذا النظام من تاريخ نشره في الجريدة الرسمية.",
    maxCer: 0.02
  },
  {
    name: "ترويسة متكررة تُفصل عن المتن (3 صفحات)",
    source: "cloud",
    totalPages: 3,
    raw:
      "[صفحة 1]\nوزارة العدل\nحكمت المحكمة برفض الدعوى\n\n" +
      "[صفحة 2]\nوزارة العدل\nوألزمت المدّعي بالمصاريف\n\n" +
      "[صفحة 3]\nوزارة العدل\nوصدر الحكم حضورياً",
    // الحقيقة: المتن بلا الترويسة المتكررة، مع علامات الصفحات
    truth:
      "[صفحة 1]\nحكمت المحكمة برفض الدعوى\n\n" +
      "[صفحة 2]\nوألزمت المدّعي بالمصاريف\n\n" +
      "[صفحة 3]\nوصدر الحكم حضورياً",
    maxCer: 0.05
  },
  {
    name: "سطر OCR معكوس الاتجاه يُصحَّح",
    source: "ocr",
    raw: "يضاقلا نم ةمكحملا يف",
    truth: "في المحكمة من القاضي",
    maxCer: 0.05
  }
];

let failures = 0;
const rows: string[] = [];

for (const c of GOLDSET) {
  const processed = processExtractedText(c.raw, { source: c.source, totalPages: c.totalPages });
  const acc = measureAccuracy(c.truth, processed.body, { normalize: true });
  const ok = acc.cer <= c.maxCer;
  if (!ok) failures += 1;
  rows.push(
    `${ok ? "✓" : "✗"} ${c.name}\n` +
      `    CER=${acc.cer.toFixed(3)} (سقف ${c.maxCer}) · WER=${acc.wer.toFixed(3)} · دقّة=${formatAccuracy(acc)}`
  );
}

console.log("قياس الدقّة على المجموعة الذهبية:\n");
console.log(rows.join("\n"));

const avgCer =
  GOLDSET.reduce((s, c) => {
    const p = processExtractedText(c.raw, { source: c.source, totalPages: c.totalPages });
    return s + measureAccuracy(c.truth, p.body, { normalize: true }).cer;
  }, 0) / GOLDSET.length;

console.log(`\nمتوسّط CER: ${avgCer.toFixed(3)} · حالات: ${GOLDSET.length} · إخفاقات: ${failures}`);

if (failures > 0) {
  console.error(`\n✗ ${failures} حالة تجاوزت سقف الخطأ — انحدارٌ في الدقّة.`);
  process.exit(1);
}
console.log("\n✓ كل الحالات ضمن سقف الدقّة.");
