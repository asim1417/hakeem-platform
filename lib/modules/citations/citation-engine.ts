import { prisma } from "@/lib/prisma";
import type { LegalContext } from "@/lib/modules/legal-rag/context-builder";

// محرّك الاستشهاد: يربط كل معلومة قانونية بمصدرها الحقيقي بمرجع رسمي،
// ويتحقق من وجود المصدر فعلاً في قاعدة بيانات حكيم.

export interface Citation {
  sourceType: "article" | "ruling" | "principle";
  sourceId: string;
  title: string;
  reference: string; // المرجع الرسمي: اسم النظام + رقم المادة / رقم الحكم / اسم المبدأ
  confidence: number;
}

/** يبني استشهادات من السياق (مراجع رسمية لا غموض فيها). */
export function buildCitations(context: LegalContext): Citation[] {
  const citations: Citation[] = [];

  for (const a of context.articles) {
    citations.push({
      sourceType: "article",
      sourceId: a.id,
      title: a.title,
      reference: `${a.lawName} — المادة (${a.articleNumber})`,
      confidence: a.weight,
    });
  }
  for (const r of context.rulings) {
    const no = r.decisionNo ?? r.caseNo ?? r.id;
    citations.push({
      sourceType: "ruling",
      sourceId: r.id,
      title: r.title,
      reference: `حكم رقم ${no}${r.court ? ` — ${r.court}` : ""}`,
      confidence: r.weight,
    });
  }
  for (const p of context.principles) {
    citations.push({
      sourceType: "principle",
      sourceId: p.id,
      title: p.title,
      reference: `مبدأ قضائي: ${p.title}`,
      confidence: p.weight,
    });
  }
  return citations;
}

/** يُبقي فقط الاستشهادات التي مصدرها موجود فعلاً في القاعدة (تتبّع وإسناد). */
export async function verifyCitations(citations: Citation[]): Promise<Citation[]> {
  const ids = (t: Citation["sourceType"]) => citations.filter((c) => c.sourceType === t).map((c) => c.sourceId);
  try {
    const [articles, rulings, principles] = await Promise.all([
      prisma.legalArticle.findMany({ where: { id: { in: ids("article") } }, select: { id: true } }),
      prisma.judicialCase.findMany({ where: { id: { in: ids("ruling") } }, select: { id: true } }),
      prisma.judicialPrinciple.findMany({ where: { id: { in: ids("principle") } }, select: { id: true } }),
    ]);
    const exists = new Set([...articles, ...rulings, ...principles].map((x) => x.id));
    return citations.filter((c) => exists.has(c.sourceId));
  } catch {
    // عند تعذّر القاعدة لا نختلق إسناداً — نُرجع لا شيء بدل مصادر غير متحقّقة.
    return [];
  }
}
