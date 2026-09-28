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
  // «… الصادر بالمرسوم الملكي رقم (م/53) وتاريخ …» وصف إصدار لا جزء من الاسم: الإصدارات المؤرّخة
  // لعمل واحد تتوحّد على جوهره، ثم يختار وجه البحث النسخة السارية منها.
  n = n.replace(/\s+الصادر[ةه]?\s+(?:بال|ب)(?:مرسوم|امر|قرار).*$/, "").trim();
  return n;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;
// حروف تلتصق بأول الكلمة دون أن تغيّر الاسم: «وبنظام»، «بالعمل»، «لنظام».
const CLITICS = new Set(["و", "ب", "ل", "ف", "ك"]);

/** مواضع ظهور الجوهر كلماتٍ كاملة (لا جزءًا من كلمة أطول). نقيّ. */
export function wholeWordSpans(haystack: string, needle: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!needle) return out;
  let from = 0;
  for (;;) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) break;
    const end = i + needle.length;
    const prev = i > 0 ? haystack[i - 1] : "";
    const prev2 = i > 1 ? haystack[i - 2] : "";
    const startOk = !prev || !WORD_CHAR.test(prev) || (CLITICS.has(prev) && (!prev2 || !WORD_CHAR.test(prev2)));
    const next = end < haystack.length ? haystack[end] : "";
    const endOk = !next || !WORD_CHAR.test(next);
    if (startOk && endOk) out.push([i, end]);
    from = i + 1;
  }
  return out;
}

/**
 * يطابق الأنظمة المذكورة في نصٍّ (سؤال المستخدم) ضمن سجلّ معطى.
 * القاعدة (الموجة ١): الجوهر يُطابَق كلماتٍ كاملة، والجوهر الأقصر الواقع داخل موضع جوهرٍ أطول
 * مطابَق يسقط — فـ«الزراعة العضوية» لا تُقصر على «الزراعة»، و«التنفيذ أمام ديوان المظالم» لا
 * تُقصر على «التنفيذ»، و«اللائحة التنفيذية لنظام العمل» لا يبتلعها «العمل».
 * عند تساوي الموضع يُقدَّم ما ذُكر اسمه الكامل ببادئته («نظام X» على «لائحة X»).
 * نقيّ — يُغذّى بالسجلّ من القاعدة أو من ثابت الاختبار.
 */
export function matchSystemsInText(text: string, registry: SystemRef[]): SystemRef[] {
  const h = normalizeArabicText(text || "");
  if (!h) return [];
  type Hit = { ref: SystemRef; len: number; start: number; end: number; full: boolean };
  const hits: Hit[] = [];
  for (const ref of registry) {
    const core = normalizeSystemName(ref.name);
    if (core.length < 3) continue;
    const spans = wholeWordSpans(h, core);
    if (!spans.length) continue;
    const fullName = normalizeArabicText(ref.name).replace(/\s+الصادر[ةه]?\s+(?:بال|ب)(?:مرسوم|امر|قرار).*$/, "").trim();
    const fullSpans = fullName !== core ? wholeWordSpans(h, fullName) : [];
    // أوسع موضع لهذا النظام: الاسم الكامل إن ذُكر، وإلا الجوهر.
    const [s, e] = fullSpans[0] ?? spans[0];
    hits.push({ ref, len: core.length, start: s, end: e, full: fullSpans.length > 0 });
  }
  // إسقاط المحتوى: موضع أقصر داخل موضع أطول لنظام آخر.
  const kept = hits.filter(
    (a) => !hits.some((b) => b !== a && b.start <= a.start && b.end >= a.end && b.end - b.start > a.end - a.start)
  );
  // تساوي الموضع: من ذُكر اسمه الكامل يتقدّم ويُسقط من طابق جوهره فقط.
  const final = kept.filter(
    (a) => a.full || !kept.some((b) => b !== a && b.full && b.start <= a.start && b.end >= a.end)
  );
  return final.sort((a, b) => b.len - a.len).map((x) => x.ref);
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
