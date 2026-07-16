// ─────────────────────────────────────────────────────────────────────────────
// المرحلة ١.ج — سجلّ الأنظمة (Systems registry). يعيد استخدام جدول `LegalSystem` القائم
// (اسم @unique + معرّف ثابت) — لا جدول جديد. يوفّر: تطبيع اسم النظام، ومطابقة الأنظمة
// المذكورة في نصّ السؤال (أساس **قيد النطاق** في المرحلة ٣ كي لا تتسرّب مادةٌ بين الأنظمة).
// الدوالّ المطابِقة نقيّة وقابلة للاختبار؛ الاستيراد من القاعدة كسولٌ (لا يُثقل الاختبار النقيّ).
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";

export interface SystemRef {
  id: string;
  name: string;
}

// بادئات نوع الأداة التشريعية — تُزال عند التطبيع كي يطابق «نظام العمل» ⇄ «العمل».
const INSTRUMENT_PREFIXES = ["نظام", "لائحة", "اللائحة التنفيذية", "اللائحة", "تنظيم", "قواعد", "ضوابط", "دليل", "الدليل", "آلية", "قرار"];

/**
 * يطبّع اسم النظام: تطبيع عربيّ + إزالة بادئة نوع الأداة + ضغط المسافات.
 * فيتوحّد «نظام العمل»/«العمل»/«اللائحة التنفيذية لنظام العمل» على جوهر «العمل».
 * نقيّ وحتميّ.
 */
export function normalizeSystemName(name: string): string {
  let n = normalizeArabicText(name || "").replace(/\s+/g, " ").trim();
  for (const p of INSTRUMENT_PREFIXES.map((x) => normalizeArabicText(x))) {
    if (n.startsWith(p + " ")) {
      n = n.slice(p.length).trim();
      break;
    }
  }
  // «التنفيذية لـ…» ⇒ جوهر النظام المُشار إليه.
  n = n.replace(/^التنفيذيه?\s+ل/, "").trim();
  return n;
}

/**
 * يطابق الأنظمة المذكورة في نصٍّ (سؤال المستخدم) ضمن سجلّ معطى.
 * يعيد الأنظمة التي يظهر جوهر اسمها المُطبَّع (≥ 3 أحرف) داخل نصّ السؤال المُطبَّع.
 * نقيّ — يُغذّى بالسجلّ من القاعدة أو من ثابت الاختبار.
 */
export function matchSystemsInText(text: string, registry: SystemRef[]): SystemRef[] {
  const h = normalizeArabicText(text || "");
  if (!h) return [];
  const hits: Array<{ ref: SystemRef; len: number }> = [];
  for (const ref of registry) {
    const core = normalizeSystemName(ref.name);
    if (core.length >= 3 && h.includes(core)) hits.push({ ref, len: core.length });
  }
  // الأطول أولًا (الأخصّ): «المعاملات المدنية» قبل «المدنية» عند التداخل.
  return hits.sort((a, b) => b.len - a.len).map((x) => x.ref);
}

/** هل ذُكر أيّ نظام صراحةً في السؤال؟ (بوّابة تفعيل قيد النطاق). */
export function mentionsSystem(text: string, registry: SystemRef[]): boolean {
  return matchSystemsInText(text, registry).length > 0;
}

let _cache: { at: number; systems: SystemRef[] } | null = null;
const REGISTRY_TTL_MS = 5 * 60 * 1000;

/**
 * يحمّل سجلّ الأنظمة من `LegalSystem` (مُذكّر ٥ دقائق). استيراد prisma كسولٌ كي تبقى
 * الدوالّ النقيّة أعلاه قابلةً للاختبار بلا قاعدة. سقوط آمن إلى [] عند أي تعذّر.
 */
export async function loadSystemsRegistry(): Promise<SystemRef[]> {
  const now = Date.now();
  if (_cache && now - _cache.at < REGISTRY_TTL_MS) return _cache.systems;
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.legalSystem.findMany({ select: { id: true, name: true } });
    const systems = rows.map((r) => ({ id: r.id, name: r.name }));
    _cache = { at: now, systems };
    return systems;
  } catch {
    return _cache?.systems ?? [];
  }
}

/** يحلّل الأنظمة المستهدفة من سؤال المستخدم (لقيد النطاق في الاسترجاع). */
export async function resolveTargetSystems(query: string): Promise<SystemRef[]> {
  const registry = await loadSystemsRegistry();
  return matchSystemsInText(query, registry);
}
