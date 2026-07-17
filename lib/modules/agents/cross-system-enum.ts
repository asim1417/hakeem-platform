// ─────────────────────────────────────────────────────────────────────────────
// الاستقصاء الشامل عبر الأنظمة (المرحلة ٣) — لخيار «استقصاء شامل». يمسح المدد في مجموعة
// أنظمة ذات صلة، ويجمّعها **مجموعاتٍ لكل نظام** كي تُعرَض بالتدرّج (دفعات + «عرض المزيد»).
// حتميّ (مسح فهرس كل نظام + استخراج المدد) — لا نموذج. لا يلمس نواة الترتيب.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { scan_system_articles } from "./tools";
import { extractDurations, formatDurationTable, type DurationRow } from "./enumeration";
import type { AgentStep } from "./types";

const ENUM = ["كل", "جميع", "كافة", "ما هي", "ماهي", "عدّد", "عدد", "قائمة", "حصر", "استقصاء"];
const DUR = ["مدة", "مدد", "المدة", "المدد", "مهلة", "مهل", "أجل", "آجال", "ميعاد", "مواعيد"];

// أنظمة كثيفة المدد (بأسمائها الفعلية في النواة) — تُمسَح في الاستقصاء الشامل للمدد.
const DURATION_SYSTEMS = [
  "نظام المرافعات الشرعية",
  "نظام الإجراءات الجزائية",
  "نظام العمل",
  "نظام المعاملات المدنية",
  "نظام التنفيذ",
  "نظام الإفلاس",
  "نظام المحاكم التجارية",
  "نظام الأحوال الشخصية",
];

export interface DurationGroup {
  systemName: string;
  count: number; // عدد المواد ذات المدد
  table: string; // جدول Markdown لهذا النظام
}

/** هل السؤال «حصر مدد عبر الأنظمة» (حصر + بُعد المدد)؟ */
export function isCrossSystemDurationQuery(query: string): boolean {
  const q = normalizeArabicText(query || "");
  if (!q) return false;
  const hasEnum = ENUM.some((w) => q.includes(normalizeArabicText(w)));
  const hasDur = DUR.some((w) => q.includes(normalizeArabicText(w)));
  return hasEnum && hasDur;
}

/**
 * يمسح المدد عبر مجموعة أنظمة ويجمّعها لكل نظام. يُبقي الأنظمة التي وُجدت فيها مدد فقط،
 * مرتّبةً تنازليًّا بعدد المواد. onStep يبثّ تقدّم كل نظام. سقوط آمن لكل نظام على حدة.
 */
export async function scanDurationsAcrossSystems(onStep?: (s: AgentStep) => void): Promise<{ groups: DurationGroup[]; scannedSystems: string[] }> {
  const groups: DurationGroup[] = [];
  const scannedSystems: string[] = [];
  for (const sys of DURATION_SYSTEMS) {
    onStep?.({ id: `xscan-${sys}`, status: "running", label: `أمسح «${sys}» لحصر المدد` });
    scannedSystems.push(sys);
    const scan = await scan_system_articles(sys).catch(() => null);
    const rows: DurationRow[] = [];
    if (scan?.ok) {
      for (const a of scan.data) {
        const durations = extractDurations(a.content);
        if (durations.length) rows.push({ articleNumber: a.articleNumber, title: a.title, durations });
      }
    }
    onStep?.({ id: `xscan-${sys}`, status: "done", label: `«${sys}»: ${rows.length.toLocaleString("ar-SA")} مادة بمدد` });
    if (rows.length) groups.push({ systemName: sys, count: rows.length, table: formatDurationTable(sys, rows) });
  }
  groups.sort((a, b) => b.count - a.count);
  return { groups, scannedSystems };
}
