// اختبارات وحدة فحص الوثائق — تُشغَّل بـ: npm run test:document-inspection
// حتمية بالكامل: لا شبكة ولا قاعدة بيانات.

import assert from "node:assert/strict";
import {
  analyzeDocuments,
  assessQuality,
  buildBm25Index,
  buildMorphLexicon,
  buildStemFamilies,
  bm25Score,
  classifyType,
  computeFrequencies,
  computeTermStats,
  convertDateApprox,
  detectIssuer,
  detectTopics,
  expandTerm,
  extractEntities,
  extractHijriYear,
  findRanges,
  hasMorphLexicon,
  highlightNeedles,
  isBoilerplateLine,
  lightStem,
  makeCode,
  matchDoc,
  normStr,
  setMorphLexicon,
  normalizeForMatch,
  occurrences,
  parseQuery,
  queryStems,
  sampleCaseDocuments,
  segmentParagraph,
  suspectWords,
  validateReference
} from "../lib/modules/document-inspection";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

// ── اتساق المرجع ──
check("المرجع التشغيلي سليم الاتساق", () => {
  assert.deepEqual(validateReference(), []);
});

// ── التطبيع ──
check("التطبيع: همزات وتاء مربوطة وأرقام هندية", () => {
  assert.equal(normalizeForMatch("المَادَّة"), "الماده");
  assert.equal(normalizeForMatch("إلى أَحكام الإثبات"), "الي احكام الاثبات");
  assert.equal(normalizeForMatch("١٤٤٦/٠٣/١٢"), "1446/03/12");
});

// ── التصنيف ──
check("تصنيف عبر العنوان: صك حكم → HKM", () => {
  const r = classifyType("صك حكم — رفض دعوى بيع الحصص", "");
  assert.equal(r.code, "HKM");
  assert.equal(r.matchedOn, "title");
});

check("تصنيف عبر المتن: «حكمت الدائرة» → HKM", () => {
  const r = classifyType("وثيقة واردة", "وبعد المداولة حكمت الدائرة برفض الدعوى");
  assert.equal(r.code, "HKM");
  assert.equal(r.matchedOn, "body");
});

check("تصنيف عقد: عقد بيع حصص → AQD", () => {
  const r = classifyType("عقد بيع حصص — النسخة الموقّعة", "اتفق الطرفان على البيع");
  assert.equal(r.code, "AQD");
});

check("نص غير معروف → UNK بلا اختلاق", () => {
  const r = classifyType("قائمة تسوق", "خبز وحليب وتمر");
  assert.equal(r.code, "UNK");
  assert.equal(r.name, "غير مصنّف");
});

// ── كشف الجهة ──
check("كشف الجهة: المحكمة التجارية → TIJ", () => {
  const r = detectIssuer(
    "المملكة العربية السعودية وزارة العدل المحكمة التجارية بجدة الدائرة الأولى صك حكم رقم 31420786 وتاريخ 1446/03/12"
  );
  assert.equal(r.code, "TIJ");
});

check("كشف الجهة: كتابة العدل → ADL", () => {
  const r = detectIssuer("المملكة العربية السعودية وزارة العدل كتابة العدل رقم الوثيقة 55231 وتاريخ 1445/11/04");
  assert.equal(r.code, "ADL");
});

check("ترويسة بلا دلالة → UNK", () => {
  assert.equal(detectIssuer("مذكرة داخلية بلا ترويسة").code, "UNK");
});

// ── السنة الهجرية والرمز ──
check("السنة من تاريخ صريح بأرقام هندية", () => {
  assert.equal(extractHijriYear("وتاريخ ١٤٤٦/٠٣/١٢هـ"), "1446");
});

check("السنة المستقلة، وعدم التقاطها من رقم أطول", () => {
  assert.equal(extractHijriYear("في عام 1445 الموافق"), "1445");
  assert.equal(extractHijriYear("رقم الصك 31446078"), "0000");
});

check("الرمز الهرمي بصيغة {TYPE}.{ISSUER}.{YEAR}.{SEQ}", () => {
  assert.equal(makeCode("HKM", "TIJ", "1446", 1), "HKM.TIJ.1446.001");
  assert.equal(makeCode("AQD", "ADL", "1445", 3), "AQD.ADL.1445.003");
});

// ── الكيانات ──
const JUDGMENT_TEXT = `وبناءً على الدعوى المقامة من شركة الأفق التجارية ضد مؤسسة النخبة القابضة، في شأن المطالبة بمبلغ ٣٣١٬٠٠٠٬٠٠٠ ريال، واستنادًا إلى الصك رقم ٣١٤٢٠٧٨٦ وإلى المادة (٥٣) من نظام المحاكم التجارية وتاريخ ١٤٤٦/٠٣/١٢هـ`;

check("استخراج الكيانات: أطراف ومبلغ وصك ونظام وتاريخ", () => {
  const entities = extractEntities(JUDGMENT_TEXT);
  const byKind = (k: string) => entities.filter((e) => e.kind === k).map((e) => e.value);
  assert.deepEqual(byKind("party"), ["شركة الأفق التجارية", "مؤسسة النخبة القابضة"]);
  assert.deepEqual(byKind("amount"), ["٣٣١٬٠٠٠٬٠٠٠"]);
  assert.deepEqual(byKind("deed"), ["٣١٤٢٠٧٨٦"]);
  assert.equal(byKind("date")[0], "١٤٤٦/٠٣/١٢هـ");
  assert.ok(byKind("law")[0].includes("نظام المحاكم التجارية"));
});

check("تقسيم الفقرة: المقاطع تعيد بناء النص الأصلي حرفياً", () => {
  const segments = segmentParagraph(JUDGMENT_TEXT);
  assert.equal(segments.map((s) => s.text).join(""), JUDGMENT_TEXT);
  assert.ok(segments.some((s) => s.kind === "party"));
  assert.ok(segments.some((s) => s.kind === "amount"));
});

// ── المكنز ──
check("المكنز: غبن وتدليس → عيوب الإرادة", () => {
  const topics = detectTopics("طلب الفسخ لعيبٍ في الرضا من غبنٍ وتدليس");
  assert.ok(topics.includes("عيوب الإرادة"));
});

// ── الجودة ──
check("الجودة: نص قانوني سليم يقيَّم عالياً، ومسح مشوَّه يحتاج مراجعة", () => {
  const clean = assessQuality(JUDGMENT_TEXT + " " + JUDGMENT_TEXT);
  assert.equal(clean.grade, "high");
  const garbled = assessQuality("إشارة إلى م/ن ٤٤ وت�ريخ ١٤�٥ بخصو� متا�عة");
  assert.equal(garbled.grade, "review");
});

// ── العينة عبر الخط الكامل ──
check("العينة: ستّ وثائق كلها مصنّفة وبرموز فريدة", () => {
  const docs = sampleCaseDocuments();
  assert.equal(docs.length, 6);
  assert.equal(new Set(docs.map((d) => d.code)).size, 6);
  const judgment = docs[0];
  assert.equal(judgment.code, "HKM.TIJ.1446.001");
  assert.equal(judgment.issuer.code, "TIJ");
  assert.equal(judgment.quality.grade, "high");
  const contract = docs[1];
  assert.equal(contract.type.code, "AQD");
  assert.equal(contract.issuer.code, "ADL");
  assert.equal(contract.hijriYear, "1445");
  const scanned = docs[4];
  assert.equal(scanned.quality.grade, "review");
});

check("التسلسل داخل (النوع×الجهة×السنة)", () => {
  const twin = analyzeDocuments([
    { title: "صك حكم أول", rawText: "المحكمة التجارية حكمت الدائرة بتاريخ 1446/01/01" },
    { title: "صك حكم ثانٍ", rawText: "المحكمة التجارية حكمت الدائرة بتاريخ 1446/02/02" }
  ]);
  assert.equal(twin[0].code, "HKM.TIJ.1446.001");
  assert.equal(twin[1].code, "HKM.TIJ.1446.002");
});

// ── طبقة البحث (واجهة v2) ──

check("تحليل الاستعلام: عبارة دقيقة واستبعاد وأو", () => {
  const P = parseQuery('"بيع الحصص" عقد -تقرير أو');
  assert.deepEqual(P.phrases, [normStr("بيع الحصص")]);
  assert.deepEqual(P.terms, [normStr("عقد")]);
  assert.deepEqual(P.nots, [normStr("تقرير")]);
  assert.equal(P.orMode, true);
});

check("التجذيع الخفيف: ال/و بادئة وات/ين لاحقة", () => {
  assert.equal(lightStem(normStr("والدعوى")), normStr("دعو"));
  assert.equal(lightStem(normStr("الشركات")), normStr("شرك"));
  assert.equal(lightStem("عقد"), "عقد");
});

check("مطابقة الوثيقة: استبعاد يُسقط، والاشتقاق يوسّع", () => {
  const docs = analyzeDocuments([
    { title: "مذكرة", rawText: "تقدم المدعي بدعواه إلى المحكمة التجارية بشأن الشركات" }
  ]);
  const hay = normStr(`${docs[0].title} \n ${docs[0].rawText}`);
  const fams = buildStemFamilies(docs);
  assert.equal(matchDoc(parseQuery("الشركة"), hay, fams), true); // «الشركة» تطابق «الشركات» بالجذع
  assert.equal(matchDoc(parseQuery("الشركة"), hay, null), false); // بلا اشتقاق: لا تطابق حرفياً
  assert.equal(matchDoc(parseQuery("المحكمة -الشركات"), hay, null), false); // الاستبعاد يُسقط
});

check("BM25: الوثيقة الأكثر تكراراً للكلمة تتقدم", () => {
  const texts = [normStr("عقد بيع عقد بيع عقد"), normStr("مذكرة اعتراض واحدة عن عقد")];
  const idx = buildBm25Index(texts);
  const stems = queryStems(parseQuery("عقد"));
  assert.ok(bm25Score(idx, 0, stems) > bm25Score(idx, 1, stems));
});

check("مواضع التظليل تُعاد على النص الأصلي (مع التشكيل)", () => {
  const text = "حَكَمَتِ الدائرةُ برفضِ الدعوى";
  const ranges = findRanges(text, [normStr("الدائرة")]);
  assert.equal(ranges.length, 1);
  assert.equal(text.slice(ranges[0][0], ranges[0][1]).includes("الدائرة"), true);
  const occ = occurrences(text, [normStr("الدعوى")]);
  assert.equal(occ.length, 1);
});

check("الكلمات غير الواضحة: تكرار حرف ثلاثاً أو رمز تالف", () => {
  const s = suspectWords("حضر وكيلللتاعن وقدم مذكرته ورمز ت�لف هنا");
  assert.ok(s.has(normStr("وكيلللتاعن")));
  assert.ok(!s.has(normStr("مذكرته")));
});

check("المصطلحات: «غبن» يُحصى ويُنسب لفئته من المكنز", () => {
  const docs = analyzeDocuments([{ title: "مذكرة", rawText: "دفع المدعي بوقوع الغبن والتدليس في العقد مرتين غبن" }]);
  const stats = computeTermStats(docs);
  const ghabn = stats.concepts.find((c) => c.term === "غبن");
  assert.ok(ghabn && ghabn.count >= 2 && ghabn.category === "عيوب الإرادة");
});

check("الأكثر تكراراً: تجميع بالجذع واستبعاد كلمات الوصل", () => {
  const docs = analyzeDocuments([
    { title: "مذكرة", rawText: "الدعوى دعوى الدعاوى في من إلى الدعوى مذكرة" }
  ]);
  const f = computeFrequencies(docs);
  assert.ok(f.length > 0);
  assert.ok(f[0].count >= 3);
  assert.ok(!f.some((g) => normStr(g.word) === normStr("في")));
});

check("تحويل التاريخ التقريبي: هجري→ميلادي والعكس", () => {
  assert.ok(convertDateApprox("١٤٤٦/٠٣/١٢هـ").startsWith("م "));
  assert.ok(convertDateApprox("15-06-2024").startsWith("هـ "));
  assert.equal(convertDateApprox("بلا تاريخ"), "");
});

check("أسطر الترويسة تُكشف", () => {
  assert.equal(isBoilerplateLine("المملكة العربية السعودية — وزارة العدل"), true);
  assert.equal(isBoilerplateLine("وحيث إن المدعي طلب الفسخ"), false);
});

// ── التطبيع: محارف صفرية العرض وعلامات الاتجاه (شبك/تقطيع الكلمات) ──

check("التطبيع يُزيل المحارف الصفرية وعلامات الاتجاه (لا تكسر شبك الكلمات)", () => {
  // «الدائرة» مع ZWJ داخلها وRLM قبلها ومحرف عزل اتجاه — يجب أن تطابق «الدائرة» النظيفة
  assert.equal(normStr("الدائ‍رة"), normStr("الدائرة"));
  assert.equal(normStr("‏الدعوى‬"), normStr("الدعوى"));
  assert.equal(normStr("﻿صك"), normStr("صك"));
  // بحث فعلي: كلمة ملتصقة بمحرف صفري تُوجد كأنها نظيفة
  const ranges = findRanges("حكمت الدائ‍رة برفض", [normStr("الدائرة")]);
  assert.equal(ranges.length, 1);
});

// ── المعجم الصرفي: توسعة البحث بصيغ الجذر ──

check("buildMorphLexicon: يبني خريطة صيغة→صيغ جذرها (مُطبَّعة)", () => {
  const map = buildMorphLexicon({ "رغب": ["رغب", "رغائب", "مرغوب"], "قصر": ["قصر"] });
  const forms = map.get(normStr("مرغوب"));
  assert.ok(forms && forms.includes(normStr("رغائب")) && forms.includes(normStr("رغب")));
  // جذر بصيغة واحدة لا يُضاف (لا توسعة له)
  assert.equal(map.has(normStr("قصر")), false);
});

check("expandTerm: التوسعة الصرفية مرتبطة بمفتاح الجذر (families)", () => {
  setMorphLexicon(buildMorphLexicon({ "رغب": ["رغب", "رغائب", "مرغوب"] }));
  try {
    const fams = buildStemFamilies(analyzeDocuments([{ title: "ت", rawText: "لا شيء" }]));
    // مع المفتاح مُفعّلاً (families != null): تظهر صيغ الجذر
    const on = expandTerm(normStr("مرغوب"), fams);
    assert.ok(on.includes(normStr("رغائب")));
    // بلا المفتاح (families = null): الكلمة نفسها فقط
    const off = expandTerm(normStr("مرغوب"), null);
    assert.deepEqual(off, [normStr("مرغوب")]);
  } finally {
    setMorphLexicon(null);
  }
});

check("المعجم الصرفي: matchDoc/highlightNeedles يجدان صيغة مختلفة للجذر", () => {
  setMorphLexicon(buildMorphLexicon({ "رغب": ["رغب", "رغائب", "مرغوب"] }));
  try {
    assert.equal(hasMorphLexicon(), true);
    const docs = analyzeDocuments([{ title: "مذكرة", rawText: "قدّم الطرف صيغته وهي من الرغائب المطلوبة" }]);
    const hay = normStr(`${docs[0].title} \n ${docs[0].rawText}`);
    const fams = buildStemFamilies(docs);
    // البحث عن «مرغوب» يطابق «الرغائب» عبر المعجم الصرفي
    assert.equal(matchDoc(parseQuery("مرغوب"), hay, fams), true);
    assert.ok(highlightNeedles(parseQuery("مرغوب"), fams).includes(normStr("رغائب")));
    // بلا مفتاح الجذر لا توسعة
    assert.equal(matchDoc(parseQuery("مرغوب"), hay, null), false);
  } finally {
    setMorphLexicon(null);
  }
  assert.equal(hasMorphLexicon(), false);
});

// ── استخراج الملفات (DOCX) ──

import { deflateRawSync } from "node:zlib";
import {
  docxXmlToText,
  extractZipEntry,
  mergeScannedPages,
  SCANNED_PAGE_MARK
} from "../lib/modules/document-inspection/file-extract";

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** يبني أرشيف ZIP مصغّراً بملف واحد (deflate) — لاختبار قارئ DOCX */
function buildZip(name: string, content: Uint8Array): ArrayBuffer {
  const nameBytes = new TextEncoder().encode(name);
  const compressed = new Uint8Array(deflateRawSync(Buffer.from(content)));
  const crc = crc32(content);
  const local = new Uint8Array(30 + nameBytes.length + compressed.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, 8, true); // deflate
  lv.setUint32(14, crc, true);
  lv.setUint32(18, compressed.length, true);
  lv.setUint32(22, content.length, true);
  lv.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  local.set(compressed, 30 + nameBytes.length);

  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, 8, true);
  cv.setUint32(16, crc, true);
  cv.setUint32(20, compressed.length, true);
  cv.setUint32(24, content.length, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint32(42, 0, true); // local offset
  central.set(nameBytes, 46);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);

  const out = new Uint8Array(local.length + central.length + eocd.length);
  out.set(local, 0);
  out.set(central, local.length);
  out.set(eocd, local.length + central.length);
  return out.buffer;
}

check("مسح جزئي: دمج الصفحات المقروءة ضوئياً محلَّ العلامة، وإبقاء صفحات النصّ", () => {
  // مستند: صفحة 1 نصّ سليم، صفحتان 2 و3 صور ممسوحة (علامة)، ثم قراءة ضوئية لهما.
  const base = `[صفحة 1]\nنصّ الصفحة الأولى السليم\n\n[صفحة 2]\n${SCANNED_PAGE_MARK}\n\n[صفحة 3]\n${SCANNED_PAGE_MARK}`;
  const ocr = "[صفحة 2]\nنصّ الصفحة الثانية المقروء ضوئياً\n\n[صفحة 3]\nنصّ الصفحة الثالثة المقروء ضوئياً";
  const merged = mergeScannedPages(base, ocr);
  // الصفحة السليمة لا تُمسّ
  assert.ok(merged.includes("نصّ الصفحة الأولى السليم"));
  // العلامة استُبدلت بنصّ القراءة الضوئية، ولم تبقَ أيّ علامة صامتة
  assert.ok(merged.includes("نصّ الصفحة الثانية المقروء ضوئياً"));
  assert.ok(merged.includes("نصّ الصفحة الثالثة المقروء ضوئياً"));
  assert.ok(!merged.includes(SCANNED_PAGE_MARK));
});

check("مسح جزئي: صفحة بلا قراءة ضوئية تبقى علامتها ظاهرة (لا فراغ صامت)", () => {
  const base = `[صفحة 1]\nنصّ سليم\n\n[صفحة 2]\n${SCANNED_PAGE_MARK}`;
  // لا نتيجة ضوئية للصفحة 2 → تبقى العلامة كما هي بدل اختفائها فراغاً
  const merged = mergeScannedPages(base, "");
  assert.ok(merged.includes(SCANNED_PAGE_MARK));
  assert.ok(merged.includes("نصّ سليم"));
});

check("DOCX: تحويل XML إلى نص بفواصل فقرات", () => {
  const xml =
    '<w:document><w:body><w:p><w:r><w:t>صك حكم</w:t></w:r><w:r><w:t xml:space="preserve"> رقم ١٢٣</w:t></w:r></w:p><w:p><w:r><w:t>حكمت الدائرة &amp; أفهمت</w:t></w:r></w:p></w:body></w:document>';
  const text = docxXmlToText(xml);
  assert.ok(text.includes("صك حكم رقم ١٢٣"));
  assert.ok(text.includes("حكمت الدائرة & أفهمت"));
  assert.ok(text.split("\n").length >= 2);
});

// ── جودة النص وتصحيح الأسطر المعكوسة (فلسفة النتائج العالية) ──
import {
  analyzeTextIssues,
  arabicRatio,
  fixReversedArabicLines,
  fragmentationRatio,
  reversedLineCount
} from "../lib/modules/document-inspection/text-quality";

check("جودة: نسبة العربية والتجزئة", () => {
  assert.ok(arabicRatio("حكمت الدائرة برفض الدعوى") > 0.9);
  assert.ok(arabicRatio("hello world 123") < 0.1);
  assert.ok(fragmentationRatio("ا ل م ح ك م ة") > 0.9); // أحرف مبعثرة
  assert.ok(fragmentationRatio("حكمت الدائرة برفض الدعوى") < 0.2);
});

check("تصحيح الأسطر المعكوسة: يكشف ويعكس بدليل قاطع", () => {
  // سطر معكوس: «يف» بدل «في»، «نم» بدل «من»، «ىلع» بدل «على»
  const reversed = "ةرئادلا تمكح يف ىوعدلا نم ىعدملا ىلع";
  assert.ok(reversedLineCount(reversed) >= 1);
  const fixed = fixReversedArabicLines(reversed);
  assert.equal(fixed.corrected.length, 1);
  // بعد التصحيح تظهر الكلمات الصحيحة
  assert.ok(fixed.text.includes("في") || fixed.text.includes("من"));
});

check("تصحيح: لا يمسّ النص السليم", () => {
  const clean = "حكمت الدائرة في الدعوى المقامة من المدعي على المدعى عليه";
  const fixed = fixReversedArabicLines(clean);
  assert.equal(fixed.corrected.length, 0);
  assert.equal(fixed.text, clean);
});

check("تحليل شامل issues: rev/frag/badsym/ar", () => {
  const issues = analyzeTextIssues("حكمت الدائرة برفض الدعوى بمبلغ ٥٠٬٠٠٠ ريال");
  assert.ok(issues.ar > 0.7);
  assert.equal(issues.badsym, 0);
  assert.ok(issues.q >= 70);
  const bad = analyzeTextIssues("ت�ريخ م/ن ٤٤ بخصو� ا ل م ح");
  assert.ok(bad.badsym >= 1 || bad.q < 70);
});

// ── بنية الوثيقة: الترويسة/المتن/التذييل + الحقول حسب النوع ──
import {
  extractKeyFields,
  removePageFurniture,
  segmentDocument
} from "../lib/modules/document-inspection/structure";

check("الترويسة تُفصل عن المتن (منطقة الهامش العلوي)", () => {
  const text = "المملكة العربية السعودية\nوزارة العدل المحكمة التجارية\nالدائرة الأولى\nحكمت الدائرة برفض الدعوى المقامة من شركة الأفق";
  const seg = segmentDocument(text, "TIJ");
  assert.ok(seg.headerLines.length >= 2);
  assert.ok(seg.headerLines.join(" ").includes("وزارة العدل"));
  assert.ok(seg.bodyText.includes("حكمت الدائرة"));
  assert.ok(!seg.bodyText.includes("وزارة العدل")); // الترويسة خارج المتن
});

check("التذييل يُفصل (رمز التحقّق/التوقيع في الهامش السفلي)", () => {
  const text = "حكمت الدائرة برفض الدعوى\nوالله الموفق\nالتوقيع: القاضي فلان\nرمز التحقق: AB12CD";
  const seg = segmentDocument(text, "TIJ");
  assert.ok(seg.footerLines.some((l) => l.includes("رمز التحقق") || l.includes("التوقيع")));
  assert.ok(!seg.bodyText.includes("رمز التحقق"));
});

check("إزالة أثاث الصفحة المتكرّر عبر صفحات PDF", () => {
  const page = (n: number) => `[صفحة ${n}]\nوزارة العدل\nمتن الصفحة رقم ${n} المختلف\nصفحة ${n} من 3`;
  const text = [page(1), page(2), page(3)].join("\n\n");
  const cleaned = removePageFurniture(text);
  assert.ok(cleaned.includes("متن الصفحة رقم 1"));
  assert.ok(!cleaned.includes("وزارة العدل")); // الترويسة المتكرّرة أُزيلت
});

check("استخراج الحقول حسب النوع: حكم مقابل عقد (تفريق حقيقي)", () => {
  const ruling = analyzeDocuments([
    {
      title: "صك حكم",
      rawText:
        "المملكة العربية السعودية المحكمة التجارية الدائرة الأولى صك رقم 3142078 وتاريخ ١٤٤٦/٠٣/١٢هـ\nحكمت الدائرة برفض الدعوى المقامة من شركة الأفق التجارية ضد مؤسسة النخبة."
    }
  ])[0];
  const rf = extractKeyFields(ruling);
  const labels = rf.map((f) => f.label);
  assert.ok(labels.includes("رقم الصك")); // حقل خاص بالحكم
  assert.ok(labels.includes("المنطوق"));

  const contract = analyzeDocuments([
    { title: "عقد بيع", rawText: "عقد بيع حصص\nاتفق الطرفان شركة الأفق ومؤسسة النخبة على البيع بمبلغ ٣٠٠٬٠٠٠ ريال." }
  ])[0];
  const cf = extractKeyFields(contract);
  const clabels = cf.map((f) => f.label);
  assert.ok(clabels.includes("الثمن")); // حقل خاص بالعقد لا الحكم
  assert.ok(!clabels.includes("رقم الصك"));
});

// ── إعادة تشكيل نصّ PDF المعطوب (صيغ العرض/التكرار/توجيه OCR) ──
import {
  cleanPdfTextLayer,
  dedupeAdjacentDuplicates,
  isGarbledArabicText,
  reshapeArabicPresentationForms
} from "../lib/modules/document-inspection/reshape";

check("إعادة التشكيل: صيغ عرض بحدود سليمة → حروف أساسية مقروءة", () => {
  // صيغ عرض متّصلة (بلا مسافة داخل الكلمة) — التشكيل يستردّها كاملةً
  const pf = "ﺣﻜﻤﺖ ﺍﻟﺪﺍﺋﺮﺓ ﺑﺮﻓﺾ ﺍﻟﺪﻋﻮﻯ";
  assert.equal(reshapeArabicPresentationForms(pf), "حكمت الدائرة برفض الدعوى");
});

check("إعادة التشكيل: النص السليم لا يتغيّر", () => {
  const good = "حكمت الدائرة برفض الدعوى المقامة من شركة الأفق";
  assert.equal(reshapeArabicPresentationForms(good), good);
});

check("إزالة التكرار المضاعف المتلاصق (كلمات وأسطر)", () => {
  assert.equal(dedupeAdjacentDuplicates("السلام السلام عليكم"), "السلام عليكم");
  assert.equal(dedupeAdjacentDuplicates("سطر مكرر\nسطر مكرر\nمختلف"), "سطر مكرر\nمختلف");
});

check("طيّ الكتل المُضاعَفة المتداخلة (مضاعفة على مستوى العبارة)", () => {
  // كلّ عبارة من أربع كلمات مُضاعَفة متتاليةً
  assert.equal(
    dedupeAdjacentDuplicates("و ا لسلا م و ا لسلا م و ا لصلا ة و ا لصلا ة"),
    "و ا لسلا م و ا لصلا ة"
  );
});

check("كشف العطب: مسافة بين كل صورة حرف → garbled + توجيه OCR", () => {
  const g = "و ا ﻟ ﺴ ﻼ م و ا ﻟ ﺴ ﻼ م ا ﻟ ﺜ ﺎ ﻧ ﻴ ﺔ ا ﻟ ﺜ ﺎ ﻧ ﻴ ﺔ";
  const r = isGarbledArabicText(g);
  assert.equal(r.garbled, true);
  assert.ok(r.singleLetterRatio > 0.45);
  assert.equal(cleanPdfTextLayer(g).needsOcr, true); // التشكيل وحده لا يكفي — OCR هو المصدر الصحيح
});

check("كشف العطب: خطّ مُجزّأ (رموز بديلة) → توجيه OCR", () => {
  const g = "حكمت ال% ائرة ب%فض ال%عوى المقامة من ش%كة الأفق وال% I J عباس أحمد زيني";
  assert.equal(cleanPdfTextLayer(g).needsOcr, true);
});

check("كشف العطب: نص سليم ليس معطوباً ولا يحتاج OCR", () => {
  const good = "حكمت الدائرة برفض الدعوى المقامة من شركة الأفق التجارية بمبلغ مليون ريال";
  const c = cleanPdfTextLayer(good);
  assert.equal(c.report.garbled, false);
  assert.equal(c.needsOcr, false);
  assert.equal(c.text, good);
});

// ── توجيه OCR ──
import { isImageExtension, translateOcrStatus } from "../lib/modules/document-inspection/ocr";

check("توجيه OCR: امتدادات الصور تُكشف", () => {
  assert.equal(isImageExtension("png"), true);
  assert.equal(isImageExtension("JPG"), true);
  assert.equal(isImageExtension("webp"), true);
  assert.equal(isImageExtension("pdf"), false);
  assert.equal(isImageExtension("docx"), false);
});

check("OCR: ترجمة حالات التقدّم للعربية", () => {
  assert.equal(translateOcrStatus("recognizing text"), "قراءة النص");
  assert.equal(translateOcrStatus("loading language traineddata"), "تحميل النموذج العربي");
  assert.equal(translateOcrStatus("unknown-status"), "unknown-status");
});

// ── تكامل Google Drive (دوال نقية) ──
import { buildAuthUrl, driveRedirectUri, isDriveConfigured } from "../lib/modules/doc-platform/google-drive";

check("Drive: غير مُهيّأ بلا مفاتيح بيئة", () => {
  // في بيئة الاختبار لا مفاتيح — يجب أن يكون معطّلاً
  assert.equal(isDriveConfigured(), false);
});

check("Drive: redirect URI صحيح", () => {
  assert.equal(driveRedirectUri("https://x.com"), "https://x.com/api/doc-platform/drive/callback");
});

check("Drive: رابط الموافقة يحوي النطاق والمَعلمات", () => {
  const url = buildAuthUrl("https://x.com", "st4te");
  assert.ok(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"));
  assert.ok(url.includes("drive.readonly"));
  assert.ok(url.includes("state=st4te"));
  assert.ok(url.includes(encodeURIComponent("https://x.com/api/doc-platform/drive/callback")));
});

async function asyncChecks() {
  const xml = "<w:p><w:t>وثيقة مضغوطة للاختبار داخل أرشيف</w:t></w:p>";
  const zip = buildZip("word/document.xml", new TextEncoder().encode(xml));
  const entry = await extractZipEntry(zip, "word/document.xml");
  check("DOCX: فك ZIP (deflate) واستخراج document.xml", () => {
    assert.ok(entry);
    assert.equal(docxXmlToText(new TextDecoder().decode(entry as Uint8Array)), "وثيقة مضغوطة للاختبار داخل أرشيف");
  });
  const missing = await extractZipEntry(zip, "word/missing.xml");
  check("DOCX: ملف غير موجود في الأرشيف → null", () => {
    assert.equal(missing, null);
  });
}

asyncChecks()
  .then(() => console.log(`\nكل الاختبارات ناجحة (${passed})`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
