/**
 * حالات موثّقة بأمثلة المالك فقط. «معدَّل» وسم فوق «ساري» وليس حالة.
 * الحالة المعروضة تُقرأ من آخر سجل تحقق، لا من حقول الحالة القديمة.
 */

export const VERIFIED_STATUSES = [
  "ساري",
  "صادر لم يسرِ بعد",
  "ملغى",
  "مستبدل",
  "ملغى مع بقاء أحكام محددة مؤقتًا",
  "إلغاء جزئي معلّق على شرط",
  "ملغاة",
  "مضافة",
] as const;

export type VerifiedStatus = (typeof VERIFIED_STATUSES)[number];

export const UNVERIFIED_NOTICE = "الحالة قيد التحقق من المصدر";

export interface VerificationRecord {
  id: string;
  verifiedStatus: string;
  evidenceInstrument: string | null;
  evidenceUrl: string | null;
  evidenceQuote: string | null;
  verifiedAt: string;
}

export interface UnitVersionRecord {
  id: string;
  body: string;
  validFrom: string; // ISO
  evidenceInstrument: string | null;
  evidenceUrl: string | null;
}

export interface DisplayedArticle {
  text: string;
  versionId: string | null;
  validFrom: string | null;
  validTo: string | null;
  faded: boolean;
  badge: string | null;
  badgeDetail: string | null;
  amendmentLine: string | null;
  pendingNotice: string | null;
  unverifiedNotice: string | null;
  citationSuffix: string;
}

const IN_FORCE = new Set<string>(["ساري", "مضافة"]);
const REPEALED = new Set<string>(["ملغاة", "ملغى"]);
const NOT_YET = new Set<string>(["صادر لم يسرِ بعد"]);

export function isAllowedStatus(value: string | null | undefined): value is VerifiedStatus {
  return VERIFIED_STATUSES.includes(String(value ?? "") as VerifiedStatus);
}

/** المعيار الواحد لحالتي الإلغاء والاستبدال (HKM-030): تستعمله صفحتا المادة (/legal و/law) ومصدر النص الساري. */
export const isRepealedStatus = (value: string | null | undefined): boolean => REPEALED.has(String(value ?? ""));
/** «مستبدل» ليس إلغاءً: المادة تُعرض باهتة بنصها (قرار المالك HKM-026/028). */
export const isReplacedStatus = (value: string | null | undefined): boolean => String(value ?? "") === "مستبدل";

/** حالة النظام الملغى الذي بقيت منه أحكام محددة مؤقتًا. */
export const RETAINED_PROVISIONS_STATUS = "ملغى مع بقاء أحكام محددة مؤقتًا";

/**
 * HKM-063: في نظام «ملغى مع بقاء أحكام محددة مؤقتًا»، المادة التي آخر سجل تحقق لها «ساري» من الأحكام الباقية:
 * تُعدّ سارية بسجلها، لا ملغاة بتبعية إلغاء النظام. ما سواها من مواد هذا النظام يبقى ملغى بالتبعية.
 */
export function isRetainedProvision(workStatus: string | null | undefined, unitStatus: string | null | undefined): boolean {
  return workStatus === RETAINED_PROVISIONS_STATUS && unitStatus === "ساري";
}

/** «… — من 2024-06-13» في نص الأداة (سجلات fix-2026-09-25): يوم نفاذ الإلغاء أو الاستبدال. */
export function effectiveDateFromEvidence(instrument: string | null | undefined): string | null {
  const m = String(instrument ?? "").match(/من\s+(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * هل الإلغاء/الاستبدال نافذ في التاريخ المطلوب؟ سجل بلا يوم نفاذ في نص أدواته = نافذ على أي asOf (كما كان).
 * وإن حمل يومًا وكان asOf قبله، فالمادة تُعرض بنصها (كصفحة النظام /law: «أُلغيت لاحقًا في …»).
 */
export function statusEffectiveAsOf(verification: VerificationRecord | null, asOf: Date): boolean {
  const evDate = effectiveDateFromEvidence(verification?.evidenceInstrument);
  if (!evDate || Number.isNaN(asOf.getTime())) return true;
  return asOf.toISOString().slice(0, 10) >= evDate;
}

/** علم الحارس من سجل التحقق فقط. بلا سجل: ليس نافذًا وليس ملغى. */
export function citationFlagsFromVerification(record: VerificationRecord | null): {
  inForce: boolean;
  repealed: boolean;
  statusLabel: string;
} {
  if (!record || !isAllowedStatus(record.verifiedStatus)) {
    return { inForce: false, repealed: false, statusLabel: UNVERIFIED_NOTICE };
  }
  return {
    inForce: IN_FORCE.has(record.verifiedStatus),
    repealed: REPEALED.has(record.verifiedStatus),
    statusLabel: record.verifiedStatus,
  };
}

function amendmentLine(record: VerificationRecord): string | null {
  const instrument = record.evidenceInstrument?.trim();
  if (!instrument) return null;
  if (!/تعديل|معدّل|معدَّل/.test(instrument) && record.verifiedStatus !== "مضافة") return null;
  return `معدّلة بموجب ${instrument}`;
}

/** سطر التعديل من النسخة نفسها: الأداة فقط (قرار المالك 18/10/2026، كما تعرض هيئة الخبراء). */
export function versionLine(version: UnitVersionRecord): string {
  const instrument = version.evidenceInstrument?.trim() || "أداة تعديل";
  return `معدّلة بموجب ${instrument}`;
}

/**
 * يختار نصًا واحدًا لتاريخ. النسخ فترات نصف مفتوحة [from, nextFrom).
 * النص الأصلي هو الأصل عند غياب نسخة يبدأ سريانها في التاريخ أو قبله.
 */
export function textAsOf(
  baseText: string,
  versions: UnitVersionRecord[],
  asOf: Date,
): { text: string; version: UnitVersionRecord | null; validTo: string | null } {
  // نسختان بتاريخ نفاذ واحد (بيانات معيبة): الأعلى معرّفًا هي السارية، حتمًا لا بترتيب القاعدة، وكذلك يختار الحصر في SQL
  // (lib/mcp/tools/enumerate.ts، CURRENT_VERSIONS_FROM) — HKM-044، مراجعة الجودة على d11bc97.
  const sorted = [...versions].sort((a, b) => a.validFrom.localeCompare(b.validFrom) || a.id.localeCompare(b.id));
  let chosen: UnitVersionRecord | null = null;
  let validTo: string | null = null;
  for (let i = 0; i < sorted.length; i += 1) {
    const from = new Date(sorted[i].validFrom);
    if (Number.isNaN(from.getTime()) || from.getTime() > asOf.getTime()) {
      if (chosen) validTo = sorted[i].validFrom;
      break;
    }
    chosen = sorted[i];
    validTo = sorted[i + 1]?.validFrom ?? null;
  }
  return { text: chosen ? chosen.body : baseText, version: chosen, validTo };
}

export function assertNoVersionOverlap(versions: UnitVersionRecord[]): boolean {
  const sorted = [...versions].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].validFrom <= sorted[i - 1].validFrom) return false;
  }
  return true;
}

export function presentArticle(input: {
  baseText: string;
  versions: UnitVersionRecord[];
  verification: VerificationRecord | null;
  asOf?: Date;
}): DisplayedArticle {
  const asOf = input.asOf ?? new Date();
  const picked = textAsOf(input.baseText, input.versions, asOf);
  const flags = citationFlagsFromVerification(input.verification);
  const future = [...input.versions]
    .filter((v) => new Date(v.validFrom).getTime() > asOf.getTime())
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];

  // نسخة موثّقة في unit_version سند كافٍ: لا تُعرض «قيد التحقق» على مادة معدّلة بأداة معروفة.
  const unverified = input.versions.length === 0 && (!input.verification || !isAllowedStatus(input.verification.verifiedStatus));
  // الإلغاء أو الاستبدال المؤرخ بعد asOf لا يُطبَّق بعد (كصفحة النظام /law).
  const effectiveNow = statusEffectiveAsOf(input.verification, asOf);
  const repealed = flags.repealed && effectiveNow;
  const replaced = isReplacedStatus(flags.statusLabel) && effectiveNow;
  const conditional = flags.statusLabel.startsWith("ملغى مع") || flags.statusLabel.startsWith("إلغاء جزئي");
  const faded = repealed || replaced;
  const badge = unverified ? null : faded || conditional || NOT_YET.has(flags.statusLabel) ? flags.statusLabel : null;
  const instrument = input.verification?.evidenceInstrument?.trim() || null;

  let citationSuffix = "النص الأصلي المحفوظ (بلا نسخة مؤرخة بعد)";
  if (picked.version) {
    citationSuffix = versionLine(picked.version);
  }

  // قرار المالك (16/10/2026): الملغاة نصها الرئيسي سطر الإلغاء وسنده، كبقية المسارات.
  // النص المحفوظ يبقى مطويًا في «النسخ السابقة» للقراءة التاريخية.
  const repealText = repealed ? `أُلغيت هذه المادة${instrument ? ` بموجب ${instrument}` : ""}` : null;

  return {
    text: repealText ?? picked.text,
    versionId: picked.version?.id ?? null,
    validFrom: picked.version?.validFrom ?? null,
    validTo: picked.validTo,
    faded,
    badge,
    badgeDetail: instrument,
    amendmentLine: picked.version
      ? versionLine(picked.version)
      : input.verification && flags.inForce
        ? amendmentLine(input.verification)
        : null,
    pendingNotice: future
      ? `تعديل صدر ولم يسرِ بعد. يسري في ${future.validFrom.slice(0, 10)}${future.evidenceUrl ? ` — ${future.evidenceUrl}` : ""}`
      : null,
    unverifiedNotice: unverified ? UNVERIFIED_NOTICE : null,
    citationSuffix,
  };
}
