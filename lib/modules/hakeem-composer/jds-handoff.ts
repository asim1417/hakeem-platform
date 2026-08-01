/**
 * تسليم تدريجي من Composer → المعاون القضائي (JDS).
 * لا يدمج المنتجات — يبني اقتراح تسليم + رابط فقط.
 */
import { SERVICES, STAGE_META } from "@/lib/modules/judicial-assistant/catalog";
import type { CaseStage } from "@/lib/modules/judicial-assistant/types";
import type { HakeemIntentCategory } from "./intent-router";

function envOn(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** تفعيل اقتراح التسليم من الصندوق — OFF افتراضيًا (تدريجي). */
export function isComposerJdsHandoffEnabled(): boolean {
  return envOn("HAKEEM_COMPOSER_JDS_HANDOFF_V1");
}

/** اقتراحات خدمات حسب مقصد Composer — لا تنفيذ تلقائي */
const INTENT_SERVICE_HINTS: Partial<Record<HakeemIntentCategory, string[]>> = {
  "case-analysis": ["JS-001", "JS-005", "JS-013"],
  "judicial-simulation": ["JS-013", "JS-017", "JS-018"],
  "document-review": ["JS-003", "JS-005"],
  "legal-drafting": ["JS-016", "JS-017"],
};

export type JdsHandoffSuggestion = {
  enabled: boolean;
  href: string;
  titleAr: string;
  reason: string;
  suggestedServiceIds: string[];
  /** لا يُنفَّذ تلقائيًا */
  autoExecute: false;
};

/**
 * يقترح فتح المعاون عند مقاصد تحليل/محاكاة — دون تشغيل JS-* تلقائيًا.
 */
export function suggestJdsHandoff(input: {
  intentCategory?: HakeemIntentCategory;
  judicialCaseId?: string | null;
  stage?: CaseStage;
}): JdsHandoffSuggestion | null {
  if (!isComposerJdsHandoffEnabled()) return null;

  const relevant =
    input.intentCategory === "case-analysis" ||
    input.intentCategory === "judicial-simulation" ||
    Boolean(input.judicialCaseId);
  if (!relevant) return null;

  const href = input.judicialCaseId
    ? `/dashboard/judicial-assistant/cases/${input.judicialCaseId}`
    : "/dashboard/judicial-assistant";

  const stage = input.stage ?? "active";
  const ids = validateJdsServiceIds(
    INTENT_SERVICE_HINTS[input.intentCategory ?? "case-analysis"] ?? ["JS-001", "JS-013"]
  );

  return {
    enabled: true,
    href,
    titleAr: "فتح المعاون القضائي",
    reason: input.judicialCaseId
      ? `متابعة القضية في مساحة القاضي (${STAGE_META[stage]?.label ?? stage})`
      : "للتحليل القضائي المتخصّص — خدمة مستقلة عن اسأل حكيم",
    suggestedServiceIds: ids,
    autoExecute: false,
  };
}

/** تحقق أن معرفات الخدمات المقترحة موجودة في الكتالوج المستقل */
export function validateJdsServiceIds(ids: string[]): string[] {
  const set = new Set(SERVICES.map((s) => s.id));
  return ids.filter((id) => set.has(id));
}
