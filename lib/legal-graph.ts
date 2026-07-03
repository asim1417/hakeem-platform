/**
 * legal-graph.ts — طبقة استعلام الرسم القانوني رباعي الطبقات (حزمة hakeem-bylaw-linking).
 * كل دالة ترجّع الجيران عبر علاقات مُوسومة، مرتّبين بالثقة تنازليًا، مع النصّ من المادة المرتبطة.
 */
import { prisma } from "@/lib/prisma";

export type GraphNeighbor = {
  node: { id: string; type: string; law: string; number: number | null; content: string | null; sourceUrl: string | null };
  relationType: string;
  evidence: string | null;
  confidence: number;
  source: string; // STRUCTURAL | EXPLICIT | MANUAL
};

const nodeContent = (n: { body: string | null; article: { content: string } | null }) => n.article?.content ?? n.body ?? null;

/** لوائح/أدوات تُنفّذ مادة نظام: العلاقات الواردة IMPLEMENTS إلى عقدة النظام. */
export async function getBylaws(systemNodeId: string): Promise<GraphNeighbor[]> {
  const edges = await prisma.legalGraphEdge.findMany({
    where: { targetId: systemNodeId, type: "IMPLEMENTS" },
    include: { sourceNode: { include: { article: { select: { content: true } } } } },
    orderBy: { confidence: "desc" },
  });
  return edges.map((e) => ({
    node: { id: e.sourceNode.id, type: e.sourceNode.type, law: e.sourceNode.law, number: e.sourceNode.number, content: nodeContent(e.sourceNode), sourceUrl: e.sourceNode.sourceUrl },
    relationType: e.type, evidence: e.evidence, confidence: e.confidence, source: e.source,
  }));
}

/** مادة النظام التي تُنفّذها مادة لائحة: العلاقات الصادرة IMPLEMENTS من عقدة اللائحة. */
export async function getSystemArticle(bylawNodeId: string): Promise<GraphNeighbor[]> {
  const edges = await prisma.legalGraphEdge.findMany({
    where: { sourceId: bylawNodeId, type: "IMPLEMENTS" },
    include: { targetNode: { include: { article: { select: { content: true } } } } },
    orderBy: { confidence: "desc" },
  });
  return edges.map((e) => ({
    node: { id: e.targetNode.id, type: e.targetNode.type, law: e.targetNode.law, number: e.targetNode.number, content: nodeContent(e.targetNode), sourceUrl: e.targetNode.sourceUrl },
    relationType: e.type, evidence: e.evidence, confidence: e.confidence, source: e.source,
  }));
}

/** الضوابط التي يخضع لها بند: العلاقات الواردة GOVERNED_BY إلى العقدة. */
export async function getControls(nodeId: string): Promise<GraphNeighbor[]> {
  return neighborsByType(nodeId, "GOVERNED_BY");
}

/** الإجراءات/الأدلة لتنفيذ بند: العلاقات الواردة PROCEDURE_FOR إلى العقدة. */
export async function getProcedures(nodeId: string): Promise<GraphNeighbor[]> {
  return neighborsByType(nodeId, "PROCEDURE_FOR");
}

async function neighborsByType(nodeId: string, type: "GOVERNED_BY" | "PROCEDURE_FOR"): Promise<GraphNeighbor[]> {
  const edges = await prisma.legalGraphEdge.findMany({
    where: { targetId: nodeId, type },
    include: { sourceNode: { include: { article: { select: { content: true } } } } },
    orderBy: { confidence: "desc" },
  });
  return edges.map((e) => ({
    node: { id: e.sourceNode.id, type: e.sourceNode.type, law: e.sourceNode.law, number: e.sourceNode.number, content: nodeContent(e.sourceNode), sourceUrl: e.sourceNode.sourceUrl },
    relationType: e.type, evidence: e.evidence, confidence: e.confidence, source: e.source,
  }));
}
