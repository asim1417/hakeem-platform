// ─────────────────────────────────────────────────────────────────────────────
// المخطِّط (المرحلة ٢) — الفهم والتفكيك وبوّابة التغطية. قبل الاسترجاع:
//   • يصنّف السؤال: بحث_مركّز | حصر_مفهوميّ | مقارنة | متعدّد_الأنظمة.
//   • يستخرج الأنظمة المستهدفة (من سجلّ الأنظمة) ويفكّك إلى issues[] (بيان تغطية).
//   • يبني coverageManifest يُفحَص في المرحلة ٤ (لا تسليم قبل تغطية كل مسألة).
// حتميّ ونقيّ (يتلقّى السجلّ ومسائل التكييف حقنًا) — قابل للاختبار بلا قاعدة/نموذج.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { matchSystemsInText, type SystemRef } from "../substrate/systems-registry";
import type { LegalIssue } from "./takyeef";

export type QueryClass = "بحث_مركّز" | "حصر_مفهوميّ" | "مقارنة" | "متعدّد_الأنظمة";

export interface CoverageIssue {
  id: string;
  label: string;
  systemId?: string;
  systemName?: string;
  /** حالة التغطية — تُحدَّث في المرحلة ٤ (بوّابة التغطية). */
  status: "pending" | "answered" | "no_text";
}

export interface QueryPlan {
  queryClass: QueryClass;
  targetSystems: SystemRef[];
  issues: CoverageIssue[];
}

// علامات الحصر المفهوميّ (استقصاء كل العناصر) — مُطبَّعة عند المطابقة.
const ENUM_MARKERS = ["كل ", "جميع", "كافة", "احصر", "عدد ", "عدّد", "اذكر كل", "ما هي كل", "ماهي كل", "كامل"];
// علامات المقارنة.
const COMPARE_MARKERS = ["الفرق بين", "الفروق بين", "مقارنة", "قارن", "مقابل", "بينما", "اوجه الاختلاف", "أوجه الاختلاف", "ايهما", "أيهما"];

function hasMarker(normText: string, markers: string[]): boolean {
  return markers.some((m) => normText.includes(normalizeArabicText(m)));
}

/** يصنّف السؤال ويستخرج الأنظمة المستهدفة (حتميّ). */
export function classifyQuery(query: string, systems: SystemRef[]): { queryClass: QueryClass; targetSystems: SystemRef[] } {
  const n = normalizeArabicText(query || "");
  const targetSystems = matchSystemsInText(query, systems);
  let queryClass: QueryClass;
  if (hasMarker(n, COMPARE_MARKERS)) queryClass = "مقارنة";
  else if (hasMarker(n, ENUM_MARKERS)) queryClass = "حصر_مفهوميّ";
  else if (targetSystems.length >= 2) queryClass = "متعدّد_الأنظمة";
  else queryClass = "بحث_مركّز";
  return { queryClass, targetSystems };
}

/**
 * يبني خطة التغطية. القاعدة: الحصر/المقارنة/تعدّد الأنظمة تُفكَّك **مسألةً لكل نظام مستهدف**
 * (تتبُّع مستقلّ — أساس القبول HLS‑3.5/5.2)، والبحث المركّز يعتمد مسائل التكييف الأصوليّ إن
 * توفّرت (وإلا مسألة واحدة من السؤال). حتميّ ونقيّ.
 */
export function buildPlan(query: string, systems: SystemRef[], takyeefIssues?: LegalIssue[]): QueryPlan {
  const { queryClass, targetSystems } = classifyQuery(query, systems);
  const issues: CoverageIssue[] = [];

  const perSystemClasses: QueryClass[] = ["حصر_مفهوميّ", "مقارنة", "متعدّد_الأنظمة"];
  if (perSystemClasses.includes(queryClass) && targetSystems.length >= 1) {
    // مسألة مستقلّة لكل نظام مستهدف (تُتتبَّع تغطيتها وحدها).
    targetSystems.forEach((s, i) => {
      issues.push({
        id: `iss-${i + 1}`,
        label: `${query.trim().slice(0, 80)} — ${s.name}`,
        systemId: s.id,
        systemName: s.name,
        status: "pending",
      });
    });
  } else if (takyeefIssues && takyeefIssues.length) {
    // بحث مركّز: مسائل التكييف الأصوليّ.
    takyeefIssues.slice(0, 7).forEach((iss, i) => {
      issues.push({ id: `iss-${i + 1}`, label: iss.issue.slice(0, 100), status: "pending" });
    });
  } else {
    issues.push({ id: "iss-1", label: (query.trim().slice(0, 100) || "المسألة محلّ النزاع"), status: "pending" });
  }

  return { queryClass, targetSystems, issues };
}

/** ملخّص نصّي موجز للخطوة المبثوثة `plan`. */
export function describePlan(plan: QueryPlan): string {
  const sys = plan.targetSystems.length ? ` · أنظمة: ${plan.targetSystems.map((s) => s.name).join("، ")}` : "";
  return `التصنيف: ${plan.queryClass} · مسائل: ${plan.issues.length.toLocaleString("ar-SA")}${sys}`;
}
