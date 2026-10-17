/**
 * anchors — عبارات المرسى في نصوص الأحكام: عناوين الأجزاء، وصيغ التسبيب والمنطوق
 * والاستئناف والإثبات. تُستعمل في دراسة البنية (المرحلة صفر)، ثم يُبنى عليها التقطيع.
 *
 * المطابقة على النص بعد حذف الكشيدة فقط، مع خريطة تعيد كل إزاحة إلى موضعها في النص الأصلي،
 * فالإزاحات المرجعة (start/end) تخص النص الأصلي كما هو في judicial_cases.
 * أوسع من detectSection القائم (lib/modules/legal-core/judgment-citation-extractor.ts:320)
 * الذي يبحث عن آخر ظهور لكلمة مفردة مثل «دفع» أو «حكمت» في أي موضع.
 */

export type AnchorFamily = "section" | "reasoning" | "disposition" | "appeal" | "evidence";

export interface AnchorPattern {
  label: string;
  re: RegExp;
}

const A = "[اأإآ]"; // ألف بأي همزة
const H = "[ةه]";
const Y = "[يى]";
const LS = "(?:^|\\n)[ \\t]*(?:[-–•*\\d١-٩)(.]+[ \\t]*)?"; // بداية سطر مع ترقيم اختياري
const LE = "[ \\t]*(?:[:：]|(?=\\n)|$)"; // عنوان قائم بنفسه: نقطتان أو نهاية سطر

function rx(src: string): RegExp {
  return new RegExp(src, "gu");
}

export const ANCHOR_FAMILIES: Array<{ family: AnchorFamily; patterns: AnchorPattern[] }> = [
  {
    family: "section",
    patterns: [
      { label: "الوقائع", re: rx(`${LS}(?:ال)?وقائع(?:[ \\t]+الدعو${Y})?${LE}`) },
      { label: "الدعوى", re: rx(`${LS}(?:ملخص[ \\t]+)?(?:ال)?دعو${Y}${LE}`) },
      { label: "الطلبات", re: rx(`${LS}(?:ال)?طلبات${LE}`) },
      { label: "الإجابة", re: rx(`${LS}(?:${A}ل)?(?:${A}جاب${H}|جواب)(?:[ \\t]+المدع${Y}[ \\t]+عل${Y}ه(?:ا)?)?${LE}`) },
      { label: "الدفوع", re: rx(`${LS}(?:ال)?دفوع${LE}`) },
      { label: "البينات", re: rx(`${LS}(?:ال)?(?:بينات|${A}دل${H}|بين${H})${LE}`) },
      { label: "الأسباب", re: rx(`${LS}(?:${A}سباب(?:[ \\t]+(?:ال)?حكم)?|ال${A}سباب|(?:ال)?حيثيات|(?:ال)?تسبيب)${LE}`) },
      { label: "المنطوق", re: rx(`${LS}(?:منطوق(?:[ \\t]+(?:ال)?حكم)?|(?:ال)?منطوق|نص[ \\t]+(?:ال)?حكم)${LE}`) },
      { label: "الاستئناف", re: rx(`${LS}(?:ال)?(?:${A}ستئناف|اعتراض)${LE}`) },
    ],
  },
  {
    family: "reasoning",
    patterns: [
      { label: "وحيث إن", re: rx(`(?:^|[^\\u0621-\\u064A])و?حيث[ \\t]+${A}ن`) },
      { label: "ولما كان", re: rx(`(?:^|[^\\u0621-\\u064A])و?لما[ \\t]+كان`) },
      { label: "وبما أن", re: rx(`(?:^|[^\\u0621-\\u064A])و?بما[ \\t]+${A}ن`) },
      { label: "ولأن", re: rx(`(?:^|[^\\u0621-\\u064A])ول${A}ن[ \\t]`) },
      { label: "وتأسيسًا/وبناءً على ما تقدم", re: rx(`(?:وت${A}سيسا|وبناء|وبناء)[ًٌٍ]?[ \\t]+عل${Y}[ \\t]+ما[ \\t]+تقدم`) },
      { label: "وعليه", re: rx(`(?:^|[^\\u0621-\\u064A])وعليه[ \\t]`) },
    ],
  },
  {
    family: "disposition",
    patterns: [
      { label: "لذلك حكمت الدائرة/المحكمة", re: rx(`(?:فل|ل)ذلك[ \\t]+(?:فقد[ \\t]+)?(?:حكمت|قررت)[ \\t]+(?:ال)?(?:دائر${H}|محكم${H})`) },
      { label: "حكمت الدائرة/المحكمة", re: rx(`(?:^|[^\\u0621-\\u064A])(?:وبه[ \\t]+|فقد[ \\t]+)?حكمت[ \\t]+(?:ال)?(?:دائر${H}|محكم${H})`) },
      { label: "قررت الدائرة", re: rx(`قررت[ \\t]+(?:ال)?(?:دائر${H}|محكم${H})`) },
      { label: "منطوق/نص الحكم", re: rx(`(?:منطوق|نص)[ \\t]+(?:ال)?حكم`) },
      { label: "رفض الدعوى", re: rx(`رفض[ \\t]+(?:ال)?دعو${Y}`) },
      { label: "عدم قبول", re: rx(`عدم[ \\t]+قبول`) },
      { label: "عدم اختصاص", re: rx(`عدم[ \\t]+(?:ال)?اختصاص`) },
      { label: "صرف النظر", re: rx(`صرف[ \\t]+(?:ال)?نظر`) },
      { label: "شطب", re: rx(`(?:^|[^\\u0621-\\u064A])شطب[ \\t]`) },
      { label: "إلزام", re: rx(`(?:^|[^\\u0621-\\u064A])ب?${A}لزام[ \\t]`) },
      { label: "إثبات الصلح", re: rx(`${A}ثبات[ \\t]+(?:ال)?صلح`) },
    ],
  },
  {
    family: "appeal",
    patterns: [
      { label: "تأييد", re: rx(`(?:ت${A}ييد|نؤيد|${A}يدت)[ \\t]+(?:ال)?حكم`) },
      { label: "نقض", re: rx(`نقض[ \\t]+(?:ال)?حكم`) },
      { label: "تعديل", re: rx(`تعديل[ \\t]+(?:ال)?حكم`) },
      { label: "محكمة/دائرة الاستئناف", re: rx(`(?:محكم${H}|(?:ال)?دائر${H})[ \\t]+(?:ال)?${A}ستئناف(?:ي${H})?`) },
      { label: "القناعة/الاعتراض", re: rx(`(?:قنع|(?:ال)?قناع${H}|اعترض|(?:ال)?اعتراض)`) },
    ],
  },
  {
    family: "evidence",
    patterns: [
      { label: "إقرار", re: rx(`(?:${A}قر|(?:ال|ب|وب)?${A}قرار)`) },
      { label: "شهادة/شهود", re: rx(`(?:(?:ال)?شهود|(?:ال|ب)?شهاد${H}|شهد[ \\t])`) },
      { label: "بينة", re: rx(`(?:ال|ب)?بين${H}`) },
      { label: "يمين", re: rx(`(?:ال|ب)?يمين`) },
      { label: "نكول", re: rx(`(?:نكل|(?:ال)?نكول)`) },
      { label: "خبرة", re: rx(`(?:(?:ال)?خبير|(?:ال)?خبر${H}[ \\t]+(?:ال)?فني${H})`) },
      { label: "قرائن", re: rx(`(?:ال)?قرائن|(?:ال)?قرين${H}`) },
      { label: "كتابة/مستند", re: rx(`(?:ال)?(?:مستند|مستندات|سند[ \\t]+لأمر|عقد[ \\t]+مكتوب)`) },
    ],
  },
];

export interface AnchorHit {
  family: AnchorFamily;
  label: string;
  start: number; // في النص الأصلي
  end: number;
}

/** يحذف الكشيدة مع خريطة من موضع النص المنقّى إلى موضعه في الأصل. */
export function stripTatweel(text: string): { text: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "ـ") continue;
    out.push(text[i]);
    map.push(i);
  }
  map.push(text.length);
  return { text: out.join(""), map };
}

/** كل مواضع المرسى مرتبة بموضعها في النص الأصلي. */
export function findAnchors(original: string): AnchorHit[] {
  const { text, map } = stripTatweel(original ?? "");
  const hits: AnchorHit[] = [];
  for (const { family, patterns } of ANCHOR_FAMILIES) {
    for (const { label, re } of patterns) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        // نتجاوز الفاصل البادئ (سطر جديد أو حرف غير عربي) حتى تبدأ الإزاحة عند العبارة نفسها.
        const lead = m[0].length - m[0].replace(/^(?:\n|[^ء-ي])+/u, "").length;
        const s = (m.index ?? 0) + lead;
        const e = (m.index ?? 0) + m[0].length;
        if (e <= s) continue;
        hits.push({ family, label, start: map[s], end: map[e - 1] + 1 });
      }
    }
  }
  return hits.sort((a, b) => a.start - b.start || b.end - a.end);
}

/** أسطر قصيرة قائمة بنفسها (≤ ٥ كلمات و≤ ٤٠ حرفًا) مرشحة لأن تكون عناوين أجزاء. */
export function headerCandidates(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.replace(/ـ/g, "").replace(/[\s:：\-–•*.()]+/g, " ").replace(/[0-9٠-٩]+/g, "#").trim();
    if (!line || line.length > 40) continue;
    const words = line.split(" ");
    if (words.length > 5 || !/[ء-ي]{2,}/.test(line)) continue;
    seen.add(line);
  }
  return [...seen];
}
