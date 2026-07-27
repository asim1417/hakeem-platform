// تفعيل الوكيل المتخصّص لخدمة القاضي — بناءً على نوع الدعوى يُحدَّد التخصّص ونطاقه النظاميّ،
// فيُقيَّد تأريض القاضي في أنظمة ذلك التخصّص (لا منطق موازٍ: يقرأ النطاق من مانيفستات الوكلاء).
// يُدمج مع مرحلة الترافع (المهارة) ليكون القاضي «متخصّصًا بنوع الدعوى ومرحلته» معًا.
import { listManifests } from "@/lib/agent-runtime/live/manifests";
import { proceduralScopeFor } from "./judicial-brain";

export type ActivatedAgent = {
  agentId: string;
  /** وصفٌ مختصرٌ للتخصّص المفعّل (يُعرَض في شفافيّة القاضي). */
  label: string;
  /** أنظمة النطاق (بأسماء lawName لتقييد الاسترجاع). */
  scopeSystems: string[];
};

const DOMAIN_LABEL: Record<string, string> = {
  "محامي_تقاضي_تجاري": "التخصّص التجاريّ",
  "ممارس_إفلاس": "تخصّص الإفلاس",
  "معاون_قاضٍ": "التخصّص العامّ (معاون القاضي)"
};

/** «نظام-المحاكم-التجارية» → «نظام المحاكم التجارية» لمطابقة lawName في النواة. */
function slugToLawName(slug: string): string {
  return slug.replace(/-/g, " ").trim();
}

function pickRole(role: string) {
  return listManifests().find((m) => m.practiceProfile.role === role) ?? null;
}

/**
 * يحدّد الوكيل المتخصّص المناسب لنوع الدعوى، ويعيد نطاقه النظاميّ لتقييد تأريض القاضي.
 * افتراضيًّا: معاون القاضي (نطاقٌ إجرائيٌّ عامّ) حين لا يُعرف التخصّص.
 */
export function resolveSpecializedAgent(caseType?: string): ActivatedAgent {
  const t = (caseType ?? "").trim();
  let m = null;
  if (/إفلاس|افلاس|إعسار|اعسار|تصفية/.test(t)) m = pickRole("ممارس_إفلاس");
  else if (/تجار/.test(t)) m = pickRole("محامي_تقاضي_تجاري");
  else m = pickRole("معاون_قاضٍ");
  m = m ?? pickRole("معاون_قاضٍ") ?? listManifests()[0] ?? null;

  // نطاق التأريض = أنظمة التخصّص الموضوعيّ (من المانيفست) ∪ الأنظمة الإجرائيّة الحاكمة للدعوى.
  // فيبقى القاضي مؤرَّضًا في المواد الموضوعيّة ومحكومًا بالأنظمة الإجرائيّة الأربعة معًا.
  const substantive = (m?.scope.defaultSystems ?? []).map(slugToLawName);
  const scopeSystems = Array.from(new Set([...substantive, ...proceduralScopeFor(caseType)]));

  return {
    agentId: m?.agentId ?? "aman-judge-aide",
    label: DOMAIN_LABEL[m?.practiceProfile.role ?? ""] ?? "التخصّص العامّ",
    scopeSystems
  };
}
