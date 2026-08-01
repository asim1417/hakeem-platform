// اصطلاح المنشأ (Provenance) الموحّد — المخطط السيادي §7.
// نواة نقيّة: بنية موحّدة للمصدر والإصدار والبصمة وحالة التحقّق، تُستعمل للكيانات
// الجديدة وتُخزَّن في حقول JSON قائمة (metadata) — بلا هجرة، تقارب تدريجيّ.

export type VerificationState = "unverified" | "needs_review" | "verified";

export interface Provenance {
  source: string; // الجهة/النظام المصدر (moj | hoqoqi | turath | manual-upload | derived)
  externalId?: string; // المعرّف لدى المصدر
  importedAt?: string; // ISO — وقت الاستيراد
  version?: string; // إصدار المصدر/الاستخراج
  contentHash?: string; // بصمة النصّ (sha256) لكشف التقادم
  verification: VerificationState;
  transformations?: string[]; // سلسلة التحويلات المطبَّقة
}

/** يبني سجلّ منشأ مكتملًا بقيم افتراضية آمنة. now/importedAt يُمرَّران من المستدعي. */
export function buildProvenance(input: {
  source: string;
  externalId?: string;
  importedAt?: string;
  version?: string;
  contentHash?: string;
  verification?: VerificationState;
  transformations?: string[];
}): Provenance {
  return {
    source: input.source,
    externalId: input.externalId,
    importedAt: input.importedAt,
    version: input.version,
    contentHash: input.contentHash,
    verification: input.verification ?? "unverified",
    transformations: input.transformations ?? [],
  };
}

/** تحقّق بنيويّ خفيف من سجلّ منشأ مقروء من JSON. */
export function isProvenance(value: unknown): value is Provenance {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.source === "string" && typeof v.verification === "string";
}
