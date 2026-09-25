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
  const when = record.verifiedAt ? record.verifiedAt.slice(0, 10) : "";
  return `معدّلة بالمرسوم ${instrument}${when ? `، سارية من ${when}` : ""}`;
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
  const sorted = [...versions].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
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

  const unverified = !input.verification || !isAllowedStatus(input.verification.verifiedStatus);
  const faded = flags.repealed;
  const badge = unverified ? null : flags.repealed ? flags.statusLabel : NOT_YET.has(flags.statusLabel) ? flags.statusLabel : null;
  const instrument = input.verification?.evidenceInstrument?.trim() || null;

  let citationSuffix = "النص الأصلي المحفوظ (بلا نسخة مؤرخة بعد)";
  if (picked.version) {
    citationSuffix = `النسخة السارية من ${picked.version.validFrom.slice(0, 10)}`;
    if (picked.validTo) citationSuffix += ` حتى ${picked.validTo.slice(0, 10)}`;
  }

  return {
    text: picked.text,
    versionId: picked.version?.id ?? null,
    validFrom: picked.version?.validFrom ?? null,
    validTo: picked.validTo,
    faded,
    badge,
    badgeDetail: instrument,
    amendmentLine: input.verification && flags.inForce ? amendmentLine(input.verification) : null,
    pendingNotice: future
      ? `تعديل صدر ولم يسرِ بعد. يسري في ${future.validFrom.slice(0, 10)}${future.evidenceUrl ? ` — ${future.evidenceUrl}` : ""}`
      : null,
    unverifiedNotice: unverified ? UNVERIFIED_NOTICE : null,
    citationSuffix,
  };
}
