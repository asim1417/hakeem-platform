// ─────────────────────────────────────────────────────────────────────────────
// تحليل المستندات + مراجعة العقود + التفكير متعدد المستندات.
// يعمل على النص المُستخرَج من الملفات (attachment.content). لا يحلّل قبل أن يحدّد
// المستخدم نوع الملف. استخراج حتمي بالأنماط (أطراف/تواريخ/مبالغ/بنود) دون اختلاق.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ChatAttachmentMeta,
  ContractReview,
  ContractReviewRow,
  DocAnalysis,
  DocAnalysisItem,
} from "./types";
import { normalizeArabic } from "./taxonomy";

const DATE_RE = /(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{2,4})|(\d{1,2}\s+(?:محرم|صفر|ربيع الأول|ربيع الآخر|جمادى الأولى|جمادى الآخرة|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة)\s+\d{2,4}\s*(?:هـ)?)/g;
const AMOUNT_RE = /(\d[\d,\.]{2,})\s*(?:ريال|ر\.?س|ريالا|sar)/gi;
const PARTY_RE = /(?:الطرف الأول|الطرف الثاني|المدعي|المدعى عليه|البائع|المشتري|المؤجر|المستأجر|المقاول|صاحب العمل|الدائن|المدين)\s*[:：]?\s*([^\n،.؛]{2,60})/g;
const ARTICLE_REF_RE = /(?:نظام|لائحة)\s+[؀-ۿ\s]{3,40}/g;

function uniq(arr: string[], max = 12): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))).slice(0, max);
}

function extractAll(text: string, re: RegExp): string[] {
  return uniq(Array.from(text.matchAll(re)).map((m) => m[0].trim()));
}

/** تحليل مستند واحد من نصّه. */
function analyzeOne(att: ChatAttachmentMeta): DocAnalysisItem {
  const text = att.content ?? "";
  const parties = uniq(
    Array.from(text.matchAll(PARTY_RE)).map((m) => `${m[0].split(/[:：]/)[0].trim()}: ${(m[1] ?? "").trim()}`)
  );
  const dates = extractAll(text, DATE_RE);
  const amounts = extractAll(text, AMOUNT_RE);
  const references = extractAll(text, ARTICLE_REF_RE);
  const firstLines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 15).slice(0, 2).join(" — ");

  return {
    name: att.fileName,
    kind: att.declaredKind ?? "غير محدد",
    parties,
    dates,
    amounts,
    references,
    summary: firstLines || (text ? text.slice(0, 160) : "لم يُستخرج نص من هذا الملف (قد يكون بصيغة غير نصية)."),
  };
}

/** تحليل متعدد المستندات + كشف التعارض (Multi-Document Reasoning). */
export function analyzeDocuments(attachments: ChatAttachmentMeta[]): DocAnalysis {
  const withContent = attachments.filter((a) => (a.content ?? "").trim().length > 0);
  const items = attachments.map(analyzeOne);

  const conflicts: string[] = [];
  // تعارض المبالغ: مبالغ مختلفة عبر المستندات.
  const allAmounts = uniq(items.flatMap((i) => i.amounts));
  if (allAmounts.length > 1) {
    conflicts.push(`مبالغ متعددة عبر المستندات (${allAmounts.join("، ")}) — يلزم تحديد المبلغ محل المطالبة.`);
  }
  // مستندات بلا نص.
  const missing: string[] = [];
  const noText = attachments.filter((a) => !(a.content ?? "").trim());
  if (noText.length) missing.push(`${noText.length} ملف لم يُستخرج نصه (صيغة غير نصية) — يُفضّل لصق النص المؤثّر.`);
  const noKind = attachments.filter((a) => !a.declaredKind);
  if (noKind.length) missing.push(`${noKind.length} ملف لم يُحدَّد نوعه بعد.`);

  return { hasContent: withContent.length > 0, items, conflicts, missing };
}

// ── مراجعة العقد ──

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[0].trim() : null;
}

function clauseRow(text: string, normalized: string, args: {
  keys: string[];
  clause: string;
  riskIfPresent: string;
  riskIfAbsent: string;
  impact: string;
  recPresent: string;
  recAbsent: string;
}): ContractReviewRow {
  const present = args.keys.some((k) => normalized.includes(normalizeArabic(k)));
  // مقتطف النص حول أول كلمة مفتاحية.
  let excerpt = "—";
  for (const k of args.keys) {
    const idx = text.indexOf(k);
    if (idx >= 0) {
      excerpt = text.slice(idx, idx + 120).replace(/\n/g, " ").trim();
      break;
    }
  }
  return {
    clause: args.clause,
    text: present ? excerpt : "غير وارد صراحةً",
    risk: present ? args.riskIfPresent : args.riskIfAbsent,
    impact: args.impact,
    recommendation: present ? args.recPresent : args.recAbsent,
  };
}

/**
 * مراجعة عقد: تلخيص + استخراج الأطراف والالتزامات والمدد والمقابل والشرط الجزائي
 * وشرط التحكيم والاختصاص والفسخ + جدول مخاطر وتوصيات. يعمل على نص العقد المُقدَّم.
 */
export function reviewContract(contractText: string): ContractReview {
  const text = (contractText || "").trim();
  if (!text) {
    return {
      hasContent: false,
      summary: "لم يتوفّر نص العقد للتحليل. ارفع ملفاً نصياً للعقد أو الصق نصّه لأستخرج البنود والمخاطر.",
      parties: [],
      obligations: [],
      term: null,
      consideration: null,
      penaltyClause: null,
      arbitrationClause: null,
      jurisdiction: null,
      termination: null,
      rows: [],
      risks: ["لا يمكن تحليل عقد دون نصّه — لا تُختلق بنود."],
    };
  }
  const normalized = normalizeArabic(text);

  const parties = uniq(
    Array.from(text.matchAll(PARTY_RE)).map((m) => `${m[0].split(/[:：]/)[0].trim()}: ${(m[1] ?? "").trim()}`)
  );
  const obligations = uniq(
    text
      .split(/\n+/)
      .filter((l) => /يلتزم|يتعهد|يجب على|على الطرف|يقوم ب/.test(l))
      .map((l) => l.trim()),
    8
  );
  const term = firstMatch(text, /(?:مدة (?:العقد|الاتفاقية)|تبدأ من|تنتهي في)[^\n.؛]{0,80}/);
  const consideration = firstMatch(text, AMOUNT_RE);
  const penaltyClause = firstMatch(text, /(?:شرط جزائي|غرامة|الغرامة)[^\n.؛]{0,80}/);
  const arbitrationClause = firstMatch(text, /(?:شرط التحكيم|التحكيم|هيئة التحكيم)[^\n.؛]{0,80}/);
  const jurisdiction = firstMatch(text, /(?:الاختصاص|المحكمة المختصة|يخضع لأنظمة)[^\n.؛]{0,80}/);
  const termination = firstMatch(text, /(?:فسخ|إنهاء العقد|الإنهاء)[^\n.؛]{0,80}/);

  const rows: ContractReviewRow[] = [
    clauseRow(text, normalized, {
      keys: ["شرط جزائي", "غرامة"],
      clause: "الشرط الجزائي",
      riskIfPresent: "قد يكون مبالغاً فيه أو قابلاً للتعديل قضاءً",
      riskIfAbsent: "غياب ردع تعاقدي عند الإخلال",
      impact: "يؤثّر في تقدير التعويض عند النزاع",
      recPresent: "مراجعة تناسب الغرامة مع الضرر الفعلي",
      recAbsent: "إضافة شرط جزائي متوازن",
    }),
    clauseRow(text, normalized, {
      keys: ["شرط التحكيم", "التحكيم"],
      clause: "شرط التحكيم",
      riskIfPresent: "يحجب اختصاص القضاء العام",
      riskIfAbsent: "النزاع يخضع للقضاء بحسب الاختصاص",
      impact: "يحدّد جهة الفصل في النزاع",
      recPresent: "التأكد من نطاق الشرط وصحته وتشكيل الهيئة",
      recAbsent: "تحديد جهة فضّ النزاع صراحةً",
    }),
    clauseRow(text, normalized, {
      keys: ["فسخ", "إنهاء العقد"],
      clause: "الفسخ والإنهاء",
      riskIfPresent: "شروط الإنهاء قد تكون غير متوازنة",
      riskIfAbsent: "غموض في آلية إنهاء العقد",
      impact: "يؤثّر في مشروعية إنهاء العلاقة",
      recPresent: "تحديد حالات الفسخ ومهلة الإنذار",
      recAbsent: "إضافة بند فسخ واضح مع الإنذار",
    }),
    clauseRow(text, normalized, {
      keys: ["مدة العقد", "تبدأ من", "تنتهي"],
      clause: "المدة",
      riskIfPresent: "تجدد تلقائي محتمل دون إشعار",
      riskIfAbsent: "عدم تحديد المدة يثير الغموض",
      impact: "يؤثّر في التزامات الطرفين الزمنية",
      recPresent: "ضبط آلية التجديد والإشعار",
      recAbsent: "تحديد مدة العقد بوضوح",
    }),
  ];

  const risks: string[] = [];
  if (!arbitrationClause) risks.push("لم يتبيّن شرط تحكيم — النزاع للقضاء بحسب الاختصاص.");
  if (!penaltyClause) risks.push("لا شرط جزائي ظاهر — ضعف الردع عند الإخلال.");
  if (!termination) risks.push("آلية الفسخ/الإنهاء غير واضحة.");
  if (obligations.length === 0) risks.push("الالتزامات غير محرّرة بوضوح في النص.");

  return {
    hasContent: true,
    summary: `عقد بين ${parties.length || "غير محددي"} الأطراف${consideration ? ` بمقابل ${consideration}` : ""}. ${
      arbitrationClause ? "يتضمّن شرط تحكيم." : "لا يتضمّن شرط تحكيم ظاهراً."
    }`,
    parties,
    obligations,
    term,
    consideration,
    penaltyClause,
    arbitrationClause,
    jurisdiction,
    termination,
    rows,
    risks: risks.length ? risks : ["لا مخاطر بنيوية ظاهرة — تُراجع التفاصيل التشغيلية."],
  };
}
