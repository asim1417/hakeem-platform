// ─────────────────────────────────────────────────────────────────────────────
// JS-004 — الخطّ الزمنيّ الإجرائيّ (حتميّ، §16 JS-004، §50 عرض التعارض).
// يدمج أحداث القضية (جلسات + مدد) ويرتّبها زمنيًّا، ويكشف تعارضات الترتيب الظاهرة.
// حتميٌّ بالكامل من بيانات القضية — لا نموذج ولا اختلاق.
// ─────────────────────────────────────────────────────────────────────────────
import type { JudicialCase, TimelineEvent, TimelineResult } from "../types";
import { formatDate } from "../labels";

export function buildTimeline(kase: JudicialCase): TimelineResult {
  const events: TimelineEvent[] = [
    ...kase.hearings.map((h) => ({
      date: h.date,
      kind: "hearing" as const,
      label: "جلسة",
      detail: h.purpose + (h.hasMinutes ? " (يوجد محضر)" : ""),
    })),
    ...kase.deadlines.map((d) => ({
      date: d.dueDate,
      kind: "deadline" as const,
      label: d.label,
      detail: d.basis,
      flag: d.status === "overdue" ? "متأخّرة" : undefined,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // كشف تعارضٍ ظاهر: مدّة «تقديم/إيداع» يقع موعدها بعد أوّل جلسة (يحتاج مراجعة).
  const firstHearing = kase.hearings.map((h) => h.date).sort()[0];
  const conflicts: string[] = [];
  if (firstHearing) {
    for (const ev of events) {
      if (ev.kind === "deadline" && /تقديم|إيداع|مذكّر/.test(ev.label) && ev.date > firstHearing) {
        ev.flag = ev.flag ?? "بعد الجلسة";
        conflicts.push(`«${ev.label}» موعدها ${formatDate(ev.date)} — بعد أوّل جلسةٍ في ${formatDate(firstHearing)}؛ يحتاج مراجعة الترتيب.`);
      }
    }
  }

  return {
    serviceId: "JS-004",
    deterministic: true,
    events,
    conflicts,
    disclaimer: "خطٌّ زمنيّ حتميّ من أحداث القضية. التعارضات مؤشّراتٌ للمراجعة لا أحكامٌ نهائيّة.",
  };
}
