/**
 * resolve-law — حلّ اسم النظام القانونيّ إلى سجلّ LegalSystem بثبات (البند 1.1 من خطة الإصلاح).
 *
 * الاستراتيجية:
 *   1) تطبيع الاسم (إسقاط التشكيل والتطويل، توحيد الهمزات والتاء المربوطة والألف المقصورة،
 *      إزالة سنة ملتصقة مثل «1443هـ»، وعلامات الترقيم، وتوحيد المسافات).
 *   2) مطابقة تامّة على الاسم المطبَّع.
 *   3) وإلّا أطول بادئة (اسم النظام يبدأ بالمُدخَل أو العكس) — يُفضَّل الأطول ثمّ الأكبر مادةً.
 *   4) وإلّا احتواء.
 *   • تُستبعد اللوائح التنفيذية ما لم يطلبها المُدخَل صراحةً أو تُمرَّر includeBylaws.
 *   • «تفضيل النافذ»: عند التعادل يُقدَّم النظام الأصل (أكبر عدد مواد) لا اللائحة.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { normalizeArabic } from "./bm25-tokenizer";

// قائمة الأنظمة المتأثّرة بإزاحة الترقيم (البند 1.4) — تُقرأ مرّة وتُخزَّن.
let _shiftedSet: Set<string> | null = null;
function shiftedSystems(): Set<string> {
  if (_shiftedSet) return _shiftedSet;
  _shiftedSet = new Set<string>();
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/shifted-systems.json"), "utf8"));
    for (const n of raw.pendingOfficialCorrection ?? []) _shiftedSet.add(normalizeSystemName(n));
  } catch { /* غياب الملف = لا قائمة */ }
  return _shiftedSet;
}

/** هل ترقيم هذا النظام مزاح ولم يُصحَّح رسميًّا بعد؟ (استشهاد مواده غير متحقَّق). */
export function isNumberingShifted(systemName: string | null | undefined): boolean {
  return shiftedSystems().has(normalizeSystemName(systemName));
}

export function normalizeSystemName(input: string | null | undefined): string {
  // normalizeArabic يُسقط التشكيل/التطويل ويوحّد الهمزات/التاء/الألف المقصورة ويحوّل الأرقام
  // الهندية إلى لاتينية ويزيل الترقيم. نزيل بعدها السنة الملتصقة (مثل 1443/1443هـ).
  return normalizeArabic(String(input ?? ""))
    .replace(/لسنه/g, " ")
    .replace(/\d{3,4}\s*[هم]?/g, " ") // سنة ملتصقة مع علامة هجريّة/ميلاديّة (هـ→ه بعد التطبيع)
    .replace(/\s+/g, " ")
    .trim();
}

// ملاحظة: \b لا يعمل مع الحروف العربية في JS، فنستخدم (?:\s|$) للحدّ بعد كلمة اللائحة.
const BYLAW_RE = /^(?:اللائحه|لائحه|القواعد|الضوابط|الدليل|اللايحه)(?:\s|$)/;
export function isBylawName(normalized: string): boolean {
  return BYLAW_RE.test(normalized);
}

export interface ResolvedLaw {
  system: { id: string; name: string; articleCount: number } | null;
  matchType: "exact" | "prefix" | "contains" | "none";
  /** حاسم = مطابقة تامّة وحيدة أو أطول بادئة وحيدة. الاحتواء والتعدّد ليسا حاسمين. */
  decisive: boolean;
  /** مرشّحون عند الغموض (للاقتراح لا للاختيار الحاسم). */
  candidates: string[];
}

/**
 * يحلّ اسم النظام. **الاحتواء لم يعد اختيارًا حاسمًا**: عند التعدّد أو الاحتواء يعيد
 * decisive=false مع candidates ليتعامل معه المُستدعي كـ CITATION_NOT_VERIFIED.
 */
export async function resolveLaw(
  input: string,
  opts: { includeBylaws?: boolean } = {},
): Promise<ResolvedLaw> {
  const q = normalizeSystemName(input);
  if (!q) return { system: null, matchType: "none", decisive: false, candidates: [] };
  const wantsBylaw = opts.includeBylaws === true || isBylawName(q);

  const systems = await prisma.legalSystem
    .findMany({ select: { id: true, name: true, articleCount: true } })
    .catch(() => [] as Array<{ id: string; name: string; articleCount: number }>);

  const cand = systems
    .map((s) => ({ s, n: normalizeSystemName(s.name) }))
    .filter((x) => x.n.length > 0 && (wantsBylaw || !isBylawName(x.n)));

  // ① مطابقة تامّة — حاسمة فقط إن كانت وحيدة.
  const exact = cand.filter((x) => x.n === q);
  if (exact.length === 1) return { system: exact[0].s, matchType: "exact", decisive: true, candidates: [exact[0].s.name] };
  if (exact.length > 1) return { system: null, matchType: "exact", decisive: false, candidates: exact.map((x) => x.s.name) };

  // ② أطول بادئة — حاسمة فقط إن انفرد صاحب أطول تطابق.
  const prefix = cand.filter((x) => x.n.startsWith(q) || q.startsWith(x.n));
  if (prefix.length) {
    prefix.sort((a, b) => b.n.length - a.n.length || b.s.articleCount - a.s.articleCount);
    const topLen = prefix[0].n.length;
    const topTies = prefix.filter((x) => x.n.length === topLen);
    if (topTies.length === 1) return { system: prefix[0].s, matchType: "prefix", decisive: true, candidates: [prefix[0].s.name] };
    return { system: null, matchType: "prefix", decisive: false, candidates: topTies.map((x) => x.s.name) };
  }

  // ③ احتواء — **ليس حاسمًا** إطلاقًا؛ اقتراح مرشّحين فقط.
  const contains = cand.filter((x) => x.n.includes(q) || q.includes(x.n));
  if (contains.length) {
    contains.sort((a, b) => b.s.articleCount - a.s.articleCount);
    return { system: null, matchType: "contains", decisive: false, candidates: contains.slice(0, 8).map((x) => x.s.name) };
  }

  return { system: null, matchType: "none", decisive: false, candidates: [] };
}
