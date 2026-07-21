// إعادة تشكيل النص العربي المستخرَج من طبقة نصّ PDF المعطوبة.
//
// كثير من ملفات PDF تخزّن الحروف العربية كـ«صور حروف» (Arabic Presentation Forms)
// معزولةً ومفصولةً بمسافات وبترتيب بصري، أحياناً مُضاعَفة، وأحياناً بخطّ مُجزّأ
// (subsetted) بلا خريطة يونيكود صحيحة — فيخرج نصّ مثل: «ﻣ ﺎ أ ﻣ ﺎ» أو «% I J».
//
// هذه الوحدة تعالج ما يمكن علاجه حتمياً:
//  1) تحويل صيغ العرض (FE70–FEFC، FB50–FDFF) إلى الحروف الأساسية عبر NFKC.
//  2) إعادة بناء حدود الكلمات من «صنف الوصل»: الحرف بصيغة أوّل/وسط يصل بما بعده،
//     فالمسافة التي تليه وهميّة تُحذف؛ وبصيغة معزول/آخِر ينهي الكلمة.
//  3) إزالة التكرار المضاعف المتلاصق (كلمات/كتل/أسطر مُعادة حرفياً).
//
// ما لا يُعالَج هنا (خطّ مُجزّأ بلا يونيكود → رموز لاتينية) يُكشَف بـ isGarbledArabicText
// ويُوجَّه إلى OCR على صورة الصفحة — وهو المصدر الصحيح الوحيد لتلك الحالة.

// أكواد «الأول/الوسط» في كتلة صيغ العرض-ب (تصل بالحرف التالي).
// لكل حرف رباعي الصيغ: المعزول=iso، الآخِر=iso+1، الأول=iso+2، الوسط=iso+3.
const FOUR_FORM_ISOLATED = [
  0xfe89, // ئ
  0xfe8f, // ب
  0xfe95, // ت
  0xfe99, // ث
  0xfe9d, // ج
  0xfea1, // ح
  0xfea5, // خ
  0xfeb1, // س
  0xfeb5, // ش
  0xfeb9, // ص
  0xfebd, // ض
  0xfec1, // ط
  0xfec5, // ظ
  0xfec9, // ع
  0xfecd, // غ
  0xfed1, // ف
  0xfed5, // ق
  0xfed9, // ك
  0xfedd, // ل
  0xfee1, // م
  0xfee5, // ن
  0xfee9, // ه
  0xfef1 // ي
];

const JOINS_NEXT = new Set<number>();
for (const iso of FOUR_FORM_ISOLATED) {
  JOINS_NEXT.add(iso + 2); // الأول
  JOINS_NEXT.add(iso + 3); // الوسط
}

function isPresentationForm(code: number): boolean {
  return (code >= 0xfe70 && code <= 0xfefc) || (code >= 0xfb50 && code <= 0xfdff);
}

const PF_RE = /[ﭐ-﷿ﹰ-ﻼ]/;
const ARABIC_RE = /[ء-ي]/;

function reshapeLine(line: string): string {
  const words: string[] = [];
  let word = "";
  let prevJoinsNext = false;
  const flush = () => {
    if (word) {
      words.push(word);
      word = "";
    }
  };
  for (const ch of line) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === " " || ch === "\t") {
      // مسافة حقيقية فقط إن كان الحرف السابق لا يصل بالتالي؛ وإلا فهي وهميّة بين صور الحروف
      if (!prevJoinsNext) flush();
      prevJoinsNext = false;
      continue;
    }
    if (isPresentationForm(code)) {
      word += ch.normalize("NFKC"); // صورة الحرف → الحرف الأساسي (وقد يكون رباطاً كـ«لا/الله»)
      prevJoinsNext = JOINS_NEXT.has(code);
      continue;
    }
    // محرف عادي (حرف أساسي/رقم/علامة): يلتصق بالكلمة الجارية، ولا نفترض له وصلاً
    word += ch;
    prevJoinsNext = false;
  }
  flush();
  return words.join(" ");
}

/** يحوّل صيغ العرض إلى حروف أساسية ويعيد بناء حدود الكلمات. آمن على النص السليم (يعيده كما هو). */
export function reshapeArabicPresentationForms(text: string): string {
  if (!PF_RE.test(text)) return text;
  return text
    .split("\n")
    .map(reshapeLine)
    .join("\n")
    .replace(/[ \t]{2,}/g, " ");
}

/**
 * يطوي كل «كتلة مُضاعَفة متلاصقة» محلياً: عند كل موضع، إن تكرّرت الكتلة التالية
 * (بطول 1..8) مباشرةً، تُكتب مرّة واحدة. يعالج المضاعفة المتداخلة الشائعة في طبقات
 * PDF المعطوبة: «و ا لسلا م و ا لسلا م و ا لصلا ة و ا لصلا ة» → «و ا لسلا م و ا لصلا ة».
 */
function collapseLocalDoubling(toks: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < toks.length) {
    let collapsed = false;
    const maxBlock = Math.min(8, Math.floor((toks.length - i) / 2));
    for (let b = maxBlock; b >= 1; b -= 1) {
      let same = true;
      for (let k = 0; k < b; k += 1) {
        if (toks[i + k] !== toks[i + b + k]) {
          same = false;
          break;
        }
      }
      if (same && ARABIC_RE.test(toks.slice(i, i + b).join(""))) {
        for (let k = 0; k < b; k += 1) out.push(toks[i + k]);
        i += 2 * b;
        collapsed = true;
        break;
      }
    }
    if (!collapsed) {
      out.push(toks[i]);
      i += 1;
    }
  }
  return out;
}

/**
 * يزيل التكرار المضاعف الشائع في طبقات PDF المعطوبة:
 *  - سطر يتكرّر حرفياً بعد نفسه.
 *  - كتلة مُضاعَفة متلاصقة داخل السطر (بأيّ طول): «و ا لسلا م و ا لسلا م» → «و ا لسلا م».
 *  - كلمة عربية تتكرّر متلاصقةً: «أما أما» → «أما».
 */
export function dedupeAdjacentDuplicates(text: string): string {
  const lines = text.split("\n");
  const outLines: string[] = [];
  for (const line of lines) {
    if (outLines.length && outLines[outLines.length - 1] === line && line.trim()) continue; // سطر مُعاد
    const rawToks = line.split(" ").filter((t) => t !== "");
    const toks = collapseLocalDoubling(rawToks); // طيّ المضاعفة على مستوى الكتل
    const dedup: string[] = [];
    for (const t of toks) {
      if (dedup.length && dedup[dedup.length - 1] === t && ARABIC_RE.test(t) && t.length >= 2) continue; // كلمة مُعادة
      dedup.push(t);
    }
    outLines.push(dedup.join(" "));
  }
  return outLines.join("\n");
}

export interface GarbleReport {
  garbled: boolean;
  /** نسبة صيغ العرض قبل إعادة التشكيل */
  presentationRatio: number;
  /** نسبة الكلمات المُضاعَفة المتلاصقة */
  duplicationRatio: number;
  /** نسبة الرموز اللاتينية/الغريبة وسط نصّ عربي (بديل خطّ مُجزّأ لا يُعالَج إلا بـ OCR) */
  substitutionRatio: number;
  /** نسبة الكلمات المكوّنة من حرف عربي واحد (تقطيع مفرط) */
  singleLetterRatio: number;
  /** نسبة الرموز غير المُعيَّنة يونيكودياً (منطقة الاستخدام الخاص PUA وبدائل العطب) —
      خطّ مُرمَّز ترميزاً خاصاً تظهر رموزه مربعات ☐؛ لا يُقرأ إلا بـ OCR */
  unmappedRatio: number;
  /** نسبة شظايا «الترتيب البصري»: كلمات تبدأ/تنتهي بتطويل أو شظايا مستحيلة
      (ىل، ني، يه، رش…) — سمة طبقات InDesign المخزّنة بترتيب العرض لا المنطق؛
      النص حروفه عربية سليمة لكن أجزاء الكلمات مبعثرة، والمصدر الصحيح OCR بالصورة */
  fragmentRatio: number;
}

/**
 * يكشف نصّ طبقة PDF المعطوب. يُحسب على النصّ الخام (قبل إعادة التشكيل) لصيغ العرض
 * والتقطيع، وبعدها لبقايا الرموز البديلة. garbled=true يعني أنّ إعادة التشكيل وحدها
 * لا تكفي والمصدر الصحيح هو OCR على صورة الصفحة.
 */
export function isGarbledArabicText(rawText: string): GarbleReport {
  const text = rawText.replace(/\[صفحة \d+\]/g, " ");
  let pf = 0;
  let arabic = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (isPresentationForm(c)) pf += 1;
    else if (c >= 0x0620 && c <= 0x064a) arabic += 1;
  }
  const presentationRatio = pf / (pf + arabic + 1);

  const words = text.split(/\s+/).filter(Boolean);
  const arabicWords = words.filter((w) => /[ء-يﭐ-﷿ﹰ-ﻼ]/.test(w));
  let dup = 0;
  for (let i = 1; i < arabicWords.length; i += 1) if (arabicWords[i] === arabicWords[i - 1]) dup += 1;
  const duplicationRatio = dup / (arabicWords.length + 1);

  let single = 0;
  for (const w of arabicWords) {
    const letters = [...w].filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return (c >= 0x0620 && c <= 0x064a) || isPresentationForm(c);
    });
    if (letters.length === 1) single += 1;
  }
  const singleLetterRatio = single / (arabicWords.length + 1);

  // الرموز البديلة: بعد إعادة التشكيل، حروف لاتينية/رموز وسط سياق عربي كثيف
  const reshaped = reshapeArabicPresentationForms(text);
  const latin = (reshaped.match(/[A-Za-z%@#&]/g) ?? []).length;
  const arabicAfter = (reshaped.match(/[ء-ي]/g) ?? []).length;
  const substitutionRatio = arabicAfter > 40 ? latin / (latin + arabicAfter) : 0;

  // الرموز غير المُعيَّنة (تظهر مربعات ☐): منطقة الاستخدام الخاص PUA بمستوييها،
  // ومحرف الإحلال FFFD، ومحارف التحكم C1 — سمة الخطوط المُرمَّزة ترميزاً خاصاً
  let unmapped = 0;
  let visible = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0x20) continue;
    visible += 1;
    if ((c >= 0xe000 && c <= 0xf8ff) || c >= 0xf0000 || c === 0xfffd || (c >= 0x80 && c <= 0x9f)) unmapped += 1;
  }
  const unmappedRatio = visible > 40 ? unmapped / visible : 0;

  // شظايا الترتيب البصري: تطويل على حافة الكلمة (تبــ / ـاهمني) أو شظايا مستحيلة كوحدات
  const IMPOSSIBLE = new Set(["ىل", "ني", "يه", "رش", "زت", "هت", "اهت"]);
  let fragments = 0;
  for (const w of arabicWords) {
    const core = w.replace(/[،؛:.()\[\]«»"']/g, "");
    if (core.startsWith("ـ") || core.endsWith("ـ") || IMPOSSIBLE.has(core)) fragments += 1;
  }
  const fragmentRatio = arabicWords.length > 30 ? fragments / arabicWords.length : 0;

  const garbled =
    presentationRatio > 0.3 ||
    singleLetterRatio > 0.4 ||
    duplicationRatio > 0.25 ||
    substitutionRatio > 0.12 ||
    unmappedRatio > 0.2 ||
    fragmentRatio > 0.08;

  return { garbled, presentationRatio, duplicationRatio, substitutionRatio, singleLetterRatio, unmappedRatio, fragmentRatio };
}

/**
 * كاشفٌ أقوى لاستخراجٍ معطوب — يشمل ما يفوت isGarbledArabicText: خطوطٌ تُرمَّز إلى
 * حروفٍ لاتينيّة موسّعة/IPA/يونانيّة/سيريليّة/رسم صناديق (لا عربيّة أصلًا ولا PUA فقط).
 * يعتمد على كثافة المحارف «الغريبة» عن نصٍّ عربيّ/إنجليزيّ سليم. لا يُفعَّل على النصوص القصيرة.
 */
export function isBrokenExtraction(rawText: string): boolean {
  const t = (rawText || "").trim();
  if (t.length < 40) return false;
  if (isGarbledArabicText(t).garbled) return true;
  let weird = 0;
  let total = 0;
  for (const ch of t) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0x20) continue;
    total += 1;
    if (
      (c >= 0x0100 && c <= 0x02ff) || // لاتينيّ موسّع + IPA
      (c >= 0x0370 && c <= 0x03ff) || // يونانيّ
      (c >= 0x0400 && c <= 0x04ff) || // سيريليّ
      (c >= 0x2500 && c <= 0x25ff) || // رسم صناديق + أشكال هندسيّة
      (c >= 0xe000 && c <= 0xf8ff) || // منطقة الاستخدام الخاص
      c === 0xfffd || (c >= 0x80 && c <= 0x9f) // محرف الإحلال + تحكّم C1
    ) weird += 1;
  }
  return total >= 40 && weird / total > 0.12;
}

/**
 * ينظّف نصّ طبقة PDF: إعادة تشكيل + إزالة التكرار. يعيد النصّ المُنظَّف ومؤشّراً
 * إلى بقاء عطب يستوجب OCR (رموز بديلة من خطّ مُجزّأ لا تُعالَج نصّياً).
 */
export function cleanPdfTextLayer(rawText: string): { text: string; needsOcr: boolean; report: GarbleReport } {
  const report = isGarbledArabicText(rawText);
  let text = reshapeArabicPresentationForms(rawText);
  if (report.duplicationRatio > 0.05 || report.garbled) text = dedupeAdjacentDuplicates(text);
  // إعادة التشكيل تُصلح الحالة الشائعة (صيغ عرض بحدود كلمات سليمة). لكنها لا تستطيع
  // استرجاع حدود الكلمات حين تُفصل كلّ صورة حرف بمسافة (singleLetterRatio عالٍ)،
  // ولا إصلاح الخطّ المُجزّأ (رموز بديلة). في هاتين الحالتين المصدر الصحيح هو OCR.
  const needsOcr =
    report.substitutionRatio > 0.12 ||
    report.singleLetterRatio > 0.45 ||
    report.unmappedRatio > 0.2 ||
    report.fragmentRatio > 0.08;
  return { text, needsOcr, report };
}

/**
 * عزل خربشة الشعار/الختم في الصفحة الأولى/الأخيرة من مستند OCR.
 * الشعارات والأختام صور رسومية يُخرج Tesseract منها خربشة (لاتيني/رموز مبعثرة).
 * نفحص أسطر الصفحة الأولى والأخيرة فقط: السطر الذي غالبه ضجيج غير عربي (رموز/لاتيني
 * قصير) يُستبدل بعلامة «[شعار/ختم]» بدل تركه خربشة تلوّث المتن — مع الإبقاء على أي
 * سطر عربي حقيقي (اسم الجهة في الترويسة يبقى للتصنيف والترميز).
 */
export function scrubLogoNoise(text: string, totalPages?: number): string {
  const blocks = text.split(/(\[صفحة \d+\]\n?)/);
  // إن لم يكن مقسّماً بصفحات، عامله كصفحة واحدة (الأولى=الأخيرة)
  const pageIndices: number[] = [];
  for (let i = 0; i < blocks.length; i += 1) if (/^\[صفحة \d+\]/.test(blocks[i])) pageIndices.push(i);

  const isNoiseLine = (line: string): boolean => {
    const t = line.trim();
    if (t.length < 2) return false;
    const chars = Array.from(t);
    const arabic = chars.filter((c) => /[؀-ۿ]/u.test(c)).length;
    const latinSym = chars.filter((c) => /[A-Za-z@#&%©®™°£€$§±×÷|\\/{}<>~^`_=]/.test(c)).length;
    const spaces = chars.filter((c) => c === " ").length;
    const meaningful = chars.length - spaces;
    if (meaningful < 2) return false;
    // خربشة شعار: غالبه لاتيني/رموز، والعربي ضئيل، وطوله قصير (سطر شعار لا فقرة)
    return arabic <= 2 && latinSym / meaningful > 0.5 && t.length < 60;
  };

  const scrubBlock = (content: string): string => {
    const lines = content.split("\n");
    // ننظّف أول 4 وآخر 4 أسطر فقط (منطقة الشعار/الختم)، لا وسط الصفحة
    const zone = 4;
    let removed = 0;
    const out = lines.map((l, idx) => {
      const nearEdge = idx < zone || idx >= lines.length - zone;
      if (nearEdge && isNoiseLine(l)) {
        removed += 1;
        return null;
      }
      return l;
    });
    let body = out.filter((l): l is string => l !== null).join("\n");
    if (removed > 0) body = "[شعار/ختم — صورة غير نصية]\n" + body;
    return body;
  };

  if (!pageIndices.length) {
    // مستند بلا وسم صفحات: عامل كامله كصفحة أولى/أخيرة
    return scrubBlock(text);
  }

  const firstPage = pageIndices[0];
  const lastPage = pageIndices[pageIndices.length - 1];
  for (const pi of [firstPage, lastPage]) {
    const contentIdx = pi + 1;
    if (contentIdx < blocks.length) blocks[contentIdx] = scrubBlock(blocks[contentIdx]);
  }
  return blocks.join("");
}

/**
 * كشف الترويسة/التذييل بالتكرار عبر الصفحات (وفق دليل المعالجة):
 * السطر الذي يتكرر في ≥60% من الصفحات قرب أولها أو آخرها ترويسة أو تذييل —
 * يُنقل لبيانات وصفية ويُنزع من المتن حفاظاً على نقاء البحث والفهرسة.
 * يعمل على نصوص PDF المقسّمة بعلامات [صفحة N]. دالة نقيّة (تعمل في المتصفح والخادم).
 */
export function separateRunningLines(text: string): { body: string; running?: string } {
  const pages = text.split(/\[صفحة \d+\]\n?/).filter((p) => p.trim().length > 0);
  if (pages.length < 3) return { body: text };

  const ZONE = 3; // أسطر منطقة الترويسة/التذييل من كل طرف
  const tops = new Map<string, number>();
  const bots = new Map<string, number>();
  const pageLines = pages.map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean));
  for (const lines of pageLines) {
    for (const l of lines.slice(0, ZONE)) tops.set(l, (tops.get(l) ?? 0) + 1);
    for (const l of lines.slice(-ZONE)) bots.set(l, (bots.get(l) ?? 0) + 1);
  }
  const threshold = Math.ceil(0.6 * pages.length);
  const isRunning = (l: string) =>
    l.length >= 3 && ((tops.get(l) ?? 0) >= threshold || (bots.get(l) ?? 0) >= threshold);

  const found = new Set<string>();
  const cleanedPages = pageLines.map((lines) =>
    lines
      .filter((l, idx) => {
        const nearEdge = idx < ZONE || idx >= lines.length - ZONE;
        if (nearEdge && isRunning(l)) {
          found.add(l);
          return false;
        }
        return true;
      })
      .join("\n")
  );
  if (!found.size) return { body: text };
  return {
    body: cleanedPages.map((p, i) => `[صفحة ${i + 1}]\n${p}`).join("\n\n").trim(),
    running: Array.from(found).join("\n")
  };
}
