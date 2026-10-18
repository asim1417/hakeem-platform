/**
 * HKM-012 — اللفظ الذي يطابق داخل أسماء الأفراد غالبًا يُعدّ غير مطابق أصلًا في أدوات الأحكام في الموصل.
 *
 * search_norm مبني من النص الخام، فالاسم يطابق في القاعدة وإن حُجب في المخرج. فحص كل نتيجة وحده لا يكفي:
 * العدد والتوزيع والمؤشر تُحسب في القاعدة على كل المطابقات. فيُفحص اللفظ نفسه على عيّنة من الأحكام التي
 * تطابقه (بالقاعدة نفسها، بلا مرشحات ولا مؤشر)، ويُعاد حساب المطابقة على نسختها المحجوبة. إن لم يطابق
 * النسخةَ المحجوبة في نصف العيّنة فأكثر، فهو لفظ اسم: يُعامل كأنه لا يطابق شيئًا (كما لو كان الفهرس محجوبًا)،
 * فلا يظهر له حكم ولا عدد ولا توزيع، ولا يختلف المخرج عن لفظ غائب عن القاعدة.
 *
 * الحل الجذري بناء search_norm وأجزاء الأحكام والمتجهات من النص المحجوب (كتابة على الإنتاج باعتماد المالك).
 */
import { prisma } from "@/lib/prisma";
import { maskPersonalData } from "@/lib/rulings/research/mask";
import {
  enumerateTermVisible,
  groupInWords,
  maskedSearchNorm,
  normWords,
  type EnumerateTerm,
  type RulingIndexFields,
} from "@/lib/mcp/ruling-privacy";

/** حجم العيّنة ونسبة المطابقة داخل الأسماء التي تجعل اللفظ لفظ اسم. */
export const TAINT_SAMPLE = 12;
export const TAINT_RATIO = 0.5;

export const INDEX_FIELDS_SQL = `r."id", r."court", r."judgmentTitle", r."judgmentText", r."appealText", r."caseNo", r."decisionNo", r."cityName"`;
export type IndexRow = RulingIndexFields & { id: string };

/** لفظ اسم إن لم يطابق النسخةَ المحجوبة في نصف العيّنة فأكثر. العيّنة الفارغة: اللفظ غائب، فلا يُحكم بشيء. */
export function taintedBySample<T>(rows: T[], visible: (r: T) => boolean): boolean {
  if (!rows.length) return false;
  const hidden = rows.filter((r) => !visible(r)).length;
  return hidden / rows.length >= TAINT_RATIO;
}

/** لفظ البحث (مجموعة صيغه، كما في buildRulingTsQuery): عيّنة من الأحكام التي تطابقه في فهرس search_norm. */
export async function lexicalGroupTainted(group: string[]): Promise<boolean> {
  if (!group.length) return false;
  const rows = await prisma.$queryRawUnsafe<IndexRow[]>(
    `SELECT ${INDEX_FIELDS_SQL} FROM "judicial_cases" r
     WHERE to_tsvector('simple', coalesce(r."search_norm",'')) @@ to_tsquery('simple', $1)
     LIMIT ${TAINT_SAMPLE}`,
    `(${group.join(" | ")})`,
  );
  return taintedBySample(rows, (r) => groupInWords(normWords(maskedSearchNorm(r)), group));
}

/** لفظ الحصر: عيّنة من الأحكام التي يطابقها شرطه وحده (cond بمعاملاته)، بلا مرشحات ولا مؤشر. */
export async function enumerateTermTainted(term: EnumerateTerm, cond: string, params: unknown[]): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<IndexRow[]>(
    `SELECT ${INDEX_FIELDS_SQL} FROM "judicial_cases" r WHERE ${cond} LIMIT ${TAINT_SAMPLE}`,
    ...params,
  );
  return taintedBySample(rows, (r) =>
    enumerateTermVisible(term, {
      maskedNorm: maskedSearchNorm(r),
      maskedTitleText: () => `${maskPersonalData(r.judgmentTitle)}\n${maskPersonalData(r.judgmentText)}`,
      caseNo: r.caseNo,
      decisionNo: r.decisionNo,
    }),
  );
}
