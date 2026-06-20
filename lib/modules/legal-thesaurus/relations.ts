/**
 * relations.ts — اشتقاق علاقات المكنز بطريقة حتمية مُسنَدة (لا توليد، لا هلوسة).
 *
 * ① التضمين (broader/narrower): العبارات القانونية العربية رأسية البداية
 *    («عقد العمل»، «هيئة التحكيم»)؛ فإن كانت كلمات المفهوم A بادئةً لكلمات المفهوم B
 *    (رأس مشترك، وعدد كلمات B أكبر) فإن A أعمّ من B (broader)، وB أخصّ (narrower).
 *    الدليل: التسميتان نفسهما — قابل للمراجعة. («بطلان العقد» رأسه «بطلان» لا «عقد»
 *    فلا يُربط بـ«العقد» — تمييز صحيح بين النوع والحالة).
 *
 * ② الترابط (related): يُشتقّ في السكربت من تواضع المفاهيم في المواد نفسها (دليل = المادة).
 */
import { searchableText } from "./normalize";

const LEADING_AL = /^ال/;

/** كلمات المطابقة بعد إزالة «ال» التعريف من كل كلمة (لتوحيد «العقد» و«عقد»). */
export function relationTokens(label: string): string[] {
  return searchableText(label || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(LEADING_AL, ""))
    .filter(Boolean);
}

export interface ConceptLite {
  id: string;
  /** التسمية أو الصيغة المعيارية — تُطبَّع داخلياً. */
  label: string;
}

export interface DerivedRelation {
  sourceId: string;
  targetId: string;
  type: "broader" | "narrower";
  confidence: number;
}

function isPrefix(a: string[], b: string[]): boolean {
  if (a.length >= b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * يشتقّ علاقات التضمين بين المفاهيم: لكل زوج يشترك في الرأس وتكون كلمات أحدهما بادئةً
 * للآخر يُولَّد اتجاهان (broader/narrower). فهرسة بالرأس لكفاءة المقارنة. نقيّة وقابلة للاختبار.
 */
export function deriveSubsumptionRelations(concepts: ConceptLite[]): DerivedRelation[] {
  const items = concepts
    .map((c) => ({ id: c.id, toks: relationTokens(c.label) }))
    .filter((x) => x.toks.length > 0);

  const byHead = new Map<string, Array<{ id: string; toks: string[] }>>();
  for (const it of items) {
    const arr = byHead.get(it.toks[0]);
    if (arr) arr.push(it);
    else byHead.set(it.toks[0], [it]);
  }

  const out: DerivedRelation[] = [];
  const seen = new Set<string>();
  for (const a of items) {
    const group = byHead.get(a.toks[0]);
    if (!group) continue;
    for (const b of group) {
      if (a.id === b.id) continue;
      if (!isPrefix(a.toks, b.toks)) continue; // a أعمّ، b أخصّ
      const key = `${a.id}>${b.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ sourceId: b.id, targetId: a.id, type: "broader", confidence: 90 });
      out.push({ sourceId: a.id, targetId: b.id, type: "narrower", confidence: 90 });
    }
  }
  return out;
}
