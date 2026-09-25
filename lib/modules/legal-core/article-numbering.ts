/**
 * article-numbering — اشتقاق رقم المادة من عنوانها الرسمي، وتنظيف العناوين
 * الملوّثة، وتخطيط إعادة الترقيم مادةً بمادة (بلا إزاحة رقمية عامة).
 *
 * المبدأ الرقابي (CLAUDE.md §②، وتقرير الانزياح): رقم المادة المخزَّن قد يُشتق
 * من التسلسل فيُزاح عند إسقاط مادة واحدة من المصدر. أمّا العدد الترتيبي المكتوب
 * في العنوان («المادة السابعة والثلاثون بعد المائتين») فهو جزء من النص الرسمي
 * المنشور. لذا التصحيح الوحيد المسموح هو اشتقاق كل رقم من عنوان مادته — تحققًا
 * مادةً بمادة من النص الرسمي — لا بإضافة ثابتة (+1) عمياء على ما بعد نقطة الكسر.
 */
import crypto from "node:crypto";
import { parseArabicOrdinal, normalizeArabic } from "./arabic-ordinal";

/** بصمة محتوى مستقرّة: SHA-256 فوق النصّ المطبَّع عربيًّا. */
export function sha256Normalized(text: string): string {
  return crypto.createHash("sha256").update(normalizeArabic(String(text ?? ""))).digest("hex");
}

export interface TitleSplit {
  /** العنوان النظيف (السطر الأول فقط، مثل «المادة الرابعة والعشرون»). */
  title: string;
  /** نصّ زائد كان ملتصقًا بالعنوان بعد أوّل سطر — مرشَّح ليكون جزءًا من المتن. */
  extractedBody: string;
  /** هل احتاج العنوان تنظيفًا (كان ملوّثًا بمتن أو أسطر إضافية)؟ */
  cleaned: boolean;
}

/**
 * يفصل العنوان عن المتن الملتصق به. بعض سجلات الاستيراد دمجت متن المادة داخل
 * حقل العنوان (مثل «المادة الرابعة والعشرون\nتسري على المال العام...»)، ما يجعل
 * العدد الترتيبي غير قابل للتحليل. نأخذ السطر الأوّل عنوانًا، والباقي متنًا مرشَّحًا.
 *
 * ملاحظة: لا نغيّر النصّ القانوني؛ نعيد فقط تقطيعًا للعرض/التحقق. المتن المستخرج
 * لا يُعتمد إلا إذا لم يكن مكرَّرًا مسبقًا في حقل content (يقرّر ذلك المُستدعي).
 */
export function splitTitleFromBody(rawTitle: string): TitleSplit {
  const raw = String(rawTitle ?? "");
  const normalizedNewlines = raw.replace(/\r\n?/g, "\n");
  const firstBreak = normalizedNewlines.indexOf("\n");
  if (firstBreak === -1) {
    return { title: raw.trim(), extractedBody: "", cleaned: false };
  }
  const title = normalizedNewlines.slice(0, firstBreak).trim();
  const extractedBody = normalizedNewlines.slice(firstBreak + 1).trim();
  return { title, extractedBody, cleaned: extractedBody.length > 0 };
}

export type NumberSource = "title" | "title-cleaned" | null;

export interface DerivedNumber {
  /** الرقم المشتقّ من العنوان الرسمي، أو null إذا تعذّر التحليل حتى بعد التنظيف. */
  number: number | null;
  /** العنوان النظيف الذي اشتُقّ منه الرقم. */
  cleanTitle: string;
  /** متن استُخرج من عنوان ملوّث (إن وُجد). */
  extractedBody: string;
  /** من أين اشتُقّ الرقم: العنوان مباشرة، أو بعد تنظيفه، أو تعذّر. */
  source: NumberSource;
}

/**
 * يشتقّ رقم المادة الرسمي من عنوانها. يحاول العنوان كما هو أولًا، ثمّ ينظّفه
 * (السطر الأول) ويعيد المحاولة. لا يشتقّ الرقم من التسلسل ولا من حقل الرقم المخزَّن.
 */
export function deriveOfficialNumber(rawTitle: string): DerivedNumber {
  const direct = parseArabicOrdinal(String(rawTitle ?? ""));
  if (direct !== null) {
    return { number: direct, cleanTitle: String(rawTitle ?? "").trim(), extractedBody: "", source: "title" };
  }
  const split = splitTitleFromBody(rawTitle);
  if (split.cleaned || split.title !== String(rawTitle ?? "").trim()) {
    const cleaned = parseArabicOrdinal(split.title);
    if (cleaned !== null) {
      return { number: cleaned, cleanTitle: split.title, extractedBody: split.extractedBody, source: "title-cleaned" };
    }
  }
  return { number: null, cleanTitle: split.title, extractedBody: split.extractedBody, source: null };
}

export interface ArticleInput {
  id?: string;
  articleNumber: number;
  title: string;
  content: string;
}

export type ChangeStatus = "noop" | "renumber" | "title-clean" | "unparsed";

export interface RenumberChange {
  id?: string;
  oldNumber: number;
  newNumber: number | null;
  oldTitle: string;
  newTitle: string;
  numberSource: NumberSource;
  status: ChangeStatus;
}

export interface RenumberPlan {
  changes: RenumberChange[];
  /** أرقام رسمية مفقودة داخل المدى 1..max (مثل المادة 237 المُسقَطة). */
  gaps: number[];
  /** أرقام رسمية تكرّرت بعد الاشتقاق — تعارض يلزم مراجعته. */
  duplicateNewNumbers: number[];
  /** مواد تعذّر تحليل عنوانها — تبقى للمراجعة، ولا يُغيَّر رقمها. */
  unparsed: RenumberChange[];
  /** أعلى رقم رسمي مشتقّ. */
  maxNumber: number;
  /** عدد المواد التي تغيّر رقمها فعليًّا. */
  renumbered: number;
}

/**
 * يبني خطة إعادة ترقيم مشتقّة من العناوين الرسمية — دون تطبيق. كل تغيير مبرَّر
 * بعنوان مادته وحدها. لا يفترض إزاحة منتظمة ولا يطبّق إضافة ثابتة.
 */
export function planRenumber(articles: ArticleInput[]): RenumberPlan {
  const changes: RenumberChange[] = [];
  const newNumbers = new Map<number, number>();
  let maxNumber = 0;

  for (const a of articles) {
    const derived = deriveOfficialNumber(a.title);
    const titleChanged = derived.cleanTitle !== String(a.title ?? "").trim();
    let status: ChangeStatus;
    if (derived.number === null) {
      status = "unparsed";
    } else if (derived.number !== a.articleNumber) {
      status = "renumber";
    } else if (titleChanged) {
      status = "title-clean";
    } else {
      status = "noop";
    }
    if (derived.number !== null) {
      newNumbers.set(derived.number, (newNumbers.get(derived.number) ?? 0) + 1);
      if (derived.number > maxNumber) maxNumber = derived.number;
    }
    changes.push({
      id: a.id,
      oldNumber: a.articleNumber,
      newNumber: derived.number,
      oldTitle: String(a.title ?? ""),
      newTitle: derived.cleanTitle,
      numberSource: derived.source,
      status,
    });
  }

  const present = new Set([...newNumbers.keys()]);
  const gaps: number[] = [];
  for (let i = 1; i <= maxNumber; i++) if (!present.has(i)) gaps.push(i);
  const duplicateNewNumbers = [...newNumbers.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  const unparsed = changes.filter((c) => c.status === "unparsed");
  const renumbered = changes.filter((c) => c.status === "renumber").length;

  return { changes, gaps, duplicateNewNumbers, unparsed, maxNumber, renumbered };
}
