// ─────────────────────────────────────────────────────────────────────────────
// تخريج السوابق — يستفيد من أحكام النواة الحقيقيّة (جدول judicial_cases) بدل قوالب مُختلقة.
// استرجاعٌ نصّيّ بكلمات موضوع القضية، مع تخفيض غير المُراجَع ووسمه (لا حجب). دفاعيّ (fail-open).
// كلّ سابقةٍ تحمل معرّفًا حقيقيًّا يُفتح في /dashboard/legal-core/judgments/[id].
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import type { JudicialCase } from "./types";

export interface JudicialPrecedent {
  id: string;
  title: string;
  court?: string;
  decisionNo?: string;
  snippet: string;
  reviewed: boolean;
}

/** كلماتٌ دالّة من موضوع القضية وطلباتها (تتجاوز الحروف القصيرة والشائعة). */
function keywordsOf(kase: JudicialCase): string[] {
  const stop = new Set(["من", "في", "على", "عن", "الى", "إلى", "قيمة", "دعوى", "طلب", "بقيمة", "المطالبة", "و", "أو"]);
  const text = `${kase.subject} ${kase.requests.map((r) => r.text).join(" ")}`;
  const words = text
    .replace(/[،.,:؛()"']/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stop.has(w));
  return [...new Set(words)].slice(0, 6);
}

/** يخرّج سوابق من أحكام النواة المطابقة لموضوع القضية. [] عند غياب البيانات/الجدول. */
export async function findPrecedents(kase: JudicialCase, take = 5): Promise<JudicialPrecedent[]> {
  const keywords = keywordsOf(kase);
  if (keywords.length === 0) return [];
  try {
    const rulings = await prisma.judicialCase.findMany({
      where: {
        OR: keywords.flatMap((k) => [
          { judgmentTitle: { contains: k } },
          { judgmentText: { contains: k } },
        ]),
      },
      select: {
        id: true, judgmentTitle: true, judgmentText: true,
        caseNo: true, decisionNo: true, court: true, reviewStatus: true,
      },
      take: take * 3,
    });

    // ترتيب: عدد الكلمات المطابقة، مع تفضيل المُراجَع.
    const scored = rulings.map((r) => {
      const hay = `${r.judgmentTitle ?? ""}\n${r.judgmentText ?? ""}`;
      const hits = keywords.filter((k) => hay.includes(k)).length;
      const reviewed = r.reviewStatus !== "needs_review";
      return { r, score: hits + (reviewed ? 0.5 : 0), reviewed };
    });
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, take).map(({ r, reviewed }) => ({
      id: r.id,
      title: r.judgmentTitle?.trim() || `حكم ${r.decisionNo ?? r.caseNo ?? r.id}`,
      court: r.court ?? undefined,
      decisionNo: r.decisionNo ?? r.caseNo ?? undefined,
      snippet: (r.judgmentText ?? "").replace(/\s+/g, " ").slice(0, 220),
      reviewed,
    }));
  } catch {
    return [];
  }
}
