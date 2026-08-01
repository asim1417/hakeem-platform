import "server-only";

// مركز المراجعة — المخطط السيادي §12. خدمة فوق الجداول الجديدة.
// «لا تعديل صامت»: كل اقتراح يمرّ بدورة suggested→accepted/rejected/deferred بقرار بشريّ،
// ويُسجَّل القرار (من/متى/لماذا). كل عملية مُدقَّقة عبر auditEvent.

import type {
  FindingSeverity,
  SuggestionStatus,
  ReviewSessionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";

export type { FindingSeverity, SuggestionStatus, ReviewSessionStatus };

export interface CreateSessionInput {
  ownerId: string;
  title: string;
  entityType: string;
  entityId?: string;
}

export async function createSession(input: CreateSessionInput) {
  const session = await prisma.reviewSession.create({
    data: {
      ownerId: input.ownerId,
      title: input.title,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
    },
  });
  await auditEvent({
    actorId: input.ownerId,
    subject: "ADMIN",
    action: "REVIEW_SESSION_CREATED",
    entityId: session.id,
    metadata: { entityType: input.entityType },
  });
  return session;
}

export async function listSessions(ownerId: string) {
  return prisma.reviewSession.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { findings: true, suggestions: true } },
    },
  });
}

export async function getSession(id: string, ownerId: string) {
  return prisma.reviewSession.findFirst({
    where: { id, ownerId },
    include: {
      findings: { orderBy: { createdAt: "asc" } },
      suggestions: { orderBy: { createdAt: "asc" } },
      report: true,
    },
  });
}

export interface AddFindingInput {
  sessionId: string;
  ownerId: string;
  category: string;
  severity?: FindingSeverity;
  description: string;
  evidence?: unknown[];
  confidence?: number;
  affectedLocation?: unknown;
  ruleId?: string;
}

/** §13 Evidence-First: لا تُقبل ملاحظة بلا دليل (evidence غير فارغ). */
export async function addFinding(input: AddFindingInput) {
  const owns = await prisma.reviewSession.findFirst({
    where: { id: input.sessionId, ownerId: input.ownerId },
    select: { id: true },
  });
  if (!owns) throw new Error("جلسة المراجعة غير موجودة أو ليست لك.");
  const evidence = input.evidence ?? [];
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error("Evidence-First (§13): لا تُضاف ملاحظة بلا دليل.");
  }
  const finding = await prisma.finding.create({
    data: {
      sessionId: input.sessionId,
      category: input.category,
      severity: input.severity ?? "MEDIUM",
      description: input.description,
      evidence: evidence as never,
      confidence: input.confidence ?? null,
      affectedLocation: (input.affectedLocation ?? undefined) as never,
      ruleId: input.ruleId ?? null,
    },
  });
  await auditEvent({
    actorId: input.ownerId,
    subject: "ADMIN",
    action: "REVIEW_FINDING_ADDED",
    entityId: finding.id,
    metadata: { sessionId: input.sessionId, severity: finding.severity },
  });
  return finding;
}

export interface ProposeSuggestionInput {
  sessionId: string;
  ownerId: string;
  findingId?: string;
  title: string;
  body: string;
}

export async function proposeSuggestion(input: ProposeSuggestionInput) {
  const owns = await prisma.reviewSession.findFirst({
    where: { id: input.sessionId, ownerId: input.ownerId },
    select: { id: true },
  });
  if (!owns) throw new Error("جلسة المراجعة غير موجودة أو ليست لك.");
  const suggestion = await prisma.suggestion.create({
    data: {
      sessionId: input.sessionId,
      findingId: input.findingId ?? null,
      title: input.title,
      body: input.body,
      status: "SUGGESTED",
    },
  });
  await auditEvent({
    actorId: input.ownerId,
    subject: "ADMIN",
    action: "REVIEW_SUGGESTION_PROPOSED",
    entityId: suggestion.id,
    metadata: { sessionId: input.sessionId },
  });
  return suggestion;
}

const DECIDABLE: SuggestionStatus[] = ["ACCEPTED", "REJECTED", "DEFERRED"];

/** القرار البشريّ الصريح على اقتراح — يُسجَّل من/متى/لماذا (§12/§13). */
export async function decideSuggestion(input: {
  suggestionId: string;
  ownerId: string;
  decision: SuggestionStatus;
  note?: string;
  decidedAt: string; // ISO — يُمرَّر من المسار
}) {
  if (!DECIDABLE.includes(input.decision)) {
    throw new Error("قرار غير صالح.");
  }
  const suggestion = await prisma.suggestion.findFirst({
    where: { id: input.suggestionId, session: { ownerId: input.ownerId } },
    select: { id: true, sessionId: true },
  });
  if (!suggestion) throw new Error("الاقتراح غير موجود أو ليس لك.");
  const updated = await prisma.suggestion.update({
    where: { id: input.suggestionId },
    data: {
      status: input.decision,
      decidedById: input.ownerId,
      decidedAt: new Date(input.decidedAt),
      decisionNote: input.note ?? null,
    },
  });
  await auditEvent({
    actorId: input.ownerId,
    subject: "ADMIN",
    action: `REVIEW_SUGGESTION_${input.decision}`,
    entityId: updated.id,
    metadata: { sessionId: suggestion.sessionId, note: input.note ?? null },
  });
  return updated;
}

/** تقرير المراجعة: تجميع المؤشّرات من الملاحظات والاقتراحات (§12). */
export async function buildReport(sessionId: string, ownerId: string) {
  const session = await getSession(sessionId, ownerId);
  if (!session) throw new Error("جلسة المراجعة غير موجودة أو ليست لك.");
  const bySeverity: Record<string, number> = {};
  for (const f of session.findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  const byStatus: Record<string, number> = {};
  for (const s of session.suggestions) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
  const metrics = {
    findings: session.findings.length,
    suggestions: session.suggestions.length,
    bySeverity,
    byStatus,
    open: byStatus["SUGGESTED"] ?? 0,
  };
  const summary = `ملاحظات: ${metrics.findings} · اقتراحات: ${metrics.suggestions} · معلّقة: ${metrics.open}`;
  const report = await prisma.reviewReport.upsert({
    where: { sessionId },
    update: { summary, metrics: metrics as never },
    create: { sessionId, summary, metrics: metrics as never },
  });
  return report;
}
