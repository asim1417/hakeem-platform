// ─────────────────────────────────────────────────────────────────────────────
// JS-009 — محرّك المدد الحتميّ (§47 لماذا لا يكفي RAG، §48 القاعدة الإجرائيّة).
// الحساب حتميٌّ ومستقلٌّ عن النموذج، ويشرح خطواته. القاعدة الإجرائيّة نفسها «نموذجيّة غير
// معتمدة» في هذه المرحلة (§75/§76): تُستبدل بقاعدةٍ رسميّة بأساسٍ نظاميّ عند اعتمادها.
// لا نختلق نصًّا نظاميًّا؛ نحسب تاريخًا من حدثٍ موثّق بقاعدةٍ موسومة صراحةً.
// ─────────────────────────────────────────────────────────────────────────────
import type { DeadlineComputation, DeadlineResult, JudicialCase, Jurisdiction } from "../types";

interface DemoRule {
  id: string;
  label: string;
  jurisdictions: Jurisdiction[];
  anchor: "hearing" | "judgment";
  anchorLabel: string;
  direction: "before" | "after";
  offsetDays: number;
  basisNote: string;
}

// قواعد نموذجيّة للعرض — غير معتمدة. الأساس النظاميّ يُربط لاحقًا (ArticleVersionRef).
const DEMO_RULES: DemoRule[] = [
  {
    id: "DR-MEMO-BEFORE-HEARING",
    label: "أجل تقديم المذكّرة قبل الجلسة",
    jurisdictions: ["commercial", "general", "administrative", "labor"],
    anchor: "hearing",
    anchorLabel: "الجلسة القادمة",
    direction: "before",
    offsetDays: 3,
    basisNote: "قاعدة نموذجيّة (٣ أيام قبل الجلسة) — غير معتمدة، تُستبدل بالأساس النظاميّ.",
  },
  {
    id: "DR-APPEAL-AFTER-JUDGMENT",
    label: "مدّة الاعتراض بعد النطق بالحكم",
    jurisdictions: ["commercial", "general", "administrative", "labor", "criminal"],
    anchor: "judgment",
    anchorLabel: "النطق بالحكم",
    direction: "after",
    offsetDays: 30,
    basisNote: "قاعدة نموذجيّة (٣٠ يومًا بعد الحكم) — غير معتمدة، تُستبدل بالأساس النظاميّ للاعتراض.",
  },
];

/** حساب حتميّ: يضيف/يطرح أيّامًا على تاريخ ISO ويعيد ISO (منتصف الليل UTC). */
function shiftDays(iso: string, days: number, direction: "before" | "after"): string {
  const base = new Date(iso);
  const delta = direction === "before" ? -days : days;
  const out = new Date(base.getTime() + delta * 24 * 60 * 60 * 1000);
  return out.toISOString();
}

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-SA", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** يحسب مدد القضية من أحداثها الموثّقة بالقواعد النموذجيّة المنطبقة على نوع قضائها. */
export function computeDeadlines(kase: JudicialCase): DeadlineResult {
  const nextHearing = [...kase.hearings].sort((a, b) => a.date.localeCompare(b.date))[0];
  const computations: DeadlineComputation[] = [];

  for (const rule of DEMO_RULES) {
    if (!rule.jurisdictions.includes(kase.jurisdiction)) continue;

    // لا نجزم عند غياب الحدث المرجعيّ (§50: معلومة ناقصة → لا حساب).
    let anchorDate: string | undefined;
    if (rule.anchor === "hearing") anchorDate = nextHearing?.date;
    // الحكم غير موجودٍ في البيانات الصناعيّة الحاليّة، فتُتخطّى قاعدة الاعتراض ما لم يوجد حدث.
    if (!anchorDate) continue;

    const dueDate = shiftDays(anchorDate, rule.offsetDays, rule.direction);
    const dir = rule.direction === "before" ? "قبل" : "بعد";
    computations.push({
      ruleId: rule.id,
      label: rule.label,
      anchorLabel: rule.anchorLabel,
      anchorDate,
      offsetDays: rule.offsetDays,
      direction: rule.direction,
      dueDate,
      explanation: `${rule.anchorLabel} بتاريخ ${fmt(anchorDate)} ${dir}ها ${rule.offsetDays} يومًا ⟵ ${fmt(dueDate)}.`,
      basisNote: rule.basisNote,
      approved: false,
    });
  }

  return {
    serviceId: "JS-009",
    deterministic: true,
    computations,
    disclaimer:
      "الحساب حتميّ ومستقلّ عن النموذج. القواعد المطبَّقة نموذجيّة غير معتمدة وتُستبدل بقواعد رسميّة بأساسٍ نظاميّ. راجِع تاريخ بداية المدّة قبل الاعتماد.",
  };
}
