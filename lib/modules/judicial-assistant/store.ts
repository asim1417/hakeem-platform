// ─────────────────────────────────────────────────────────────────────────────
// طبقة الوصول (Store) — القضية مشروع/مجلّد يملكه القاضي، مخزَّنٌ في القاعدة. لا موصل «تقاضي».
// المدخل الأساسيّ: مرفقات المستخدم (§74: الاستيراد اليدويّ المنضبط هو خطّة الأساس لا الاحتياط).
// الوصول دفاعيّ (fail-open) وموقوفٌ على المالك (ABAC). المرفقات والخريطة في JSON.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import { STAGE_META } from "./catalog";
import type {
  CaseAttachment, CaseFact, CaseGap, CaseIssue, CaseRequest, CaseStage,
  CaseSummaryRow, Confidentiality, Deadline, Hearing, JudicialCase, Jurisdiction, Party,
} from "./types";

const JURISDICTIONS: Jurisdiction[] = ["general", "commercial", "criminal", "administrative", "labor"];
const CONFIDENTIALITIES: Confidentiality[] = ["normal", "restricted", "secret"];

function asJurisdiction(v: unknown): Jurisdiction {
  return JURISDICTIONS.includes(v as Jurisdiction) ? (v as Jurisdiction) : "general";
}
function asConfidentiality(v: unknown): Confidentiality {
  return CONFIDENTIALITIES.includes(v as Confidentiality) ? (v as Confidentiality) : "normal";
}
function asStage(v: unknown): CaseStage {
  return v && Object.prototype.hasOwnProperty.call(STAGE_META, v as string) ? (v as CaseStage) : "active";
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

type Row = {
  id: string; ownerId: string; caseNumber: string | null; court: string | null; circuit: string | null;
  jurisdiction: string; subject: string; stage: string; confidentiality: string;
  attachments: unknown; structured: unknown; createdAt: Date;
};

function mapRow(r: Row): JudicialCase {
  const s = (r.structured ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    ownerId: r.ownerId,
    caseNumber: r.caseNumber ?? undefined,
    court: r.court ?? undefined,
    circuit: r.circuit ?? undefined,
    jurisdiction: asJurisdiction(r.jurisdiction),
    subject: r.subject,
    stage: asStage(r.stage),
    confidentiality: asConfidentiality(r.confidentiality),
    createdAt: r.createdAt.toISOString(),
    attachments: arr<CaseAttachment>(r.attachments),
    parties: arr<Party>(s.parties),
    requests: arr<CaseRequest>(s.requests),
    facts: arr<CaseFact>(s.facts),
    hearings: arr<Hearing>(s.hearings),
    deadlines: arr<Deadline>(s.deadlines),
    issues: arr<CaseIssue>(s.issues),
    gaps: arr<CaseGap>(s.gaps),
  };
}

const SELECT = {
  id: true, ownerId: true, caseNumber: true, court: true, circuit: true,
  jurisdiction: true, subject: true, stage: true, confidentiality: true,
  attachments: true, structured: true, createdAt: true,
} as const;

export async function createCase(
  ownerId: string,
  input: { subject: string; caseNumber?: string; court?: string; circuit?: string; jurisdiction?: string; confidentiality?: string }
): Promise<string | null> {
  try {
    const row = await prisma.judicialWorkCase.create({
      data: {
        ownerId,
        subject: input.subject.trim(),
        caseNumber: input.caseNumber?.trim() || null,
        court: input.court?.trim() || null,
        circuit: input.circuit?.trim() || null,
        jurisdiction: asJurisdiction(input.jurisdiction),
        confidentiality: asConfidentiality(input.confidentiality),
        stage: "active",
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

export async function getCase(caseId: string): Promise<JudicialCase | null> {
  try {
    const row = await prisma.judicialWorkCase.findUnique({ where: { id: caseId }, select: SELECT });
    return row ? mapRow(row as Row) : null;
  } catch {
    return null;
  }
}

export async function listCaseRows(ownerId: string): Promise<CaseSummaryRow[]> {
  try {
    const rows = await prisma.judicialWorkCase.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      select: SELECT,
    });
    return rows.map((r) => {
      const c = mapRow(r as Row);
      const next = [...c.hearings].sort((a, b) => a.date.localeCompare(b.date))[0];
      return {
        id: c.id, caseNumber: c.caseNumber, court: c.court, jurisdiction: c.jurisdiction,
        subject: c.subject, stage: c.stage, confidentiality: c.confidentiality,
        nextHearing: next?.date, openIssues: c.issues.filter((i) => !i.resolved).length,
        attachmentCount: c.attachments.length,
      };
    });
  } catch {
    return [];
  }
}

/** يضيف مرفقًا (نصٌّ مُستخرَج في المتصفّح). موقوفٌ على المالك. */
export async function addAttachment(
  caseId: string, ownerId: string, file: { name: string; text: string }
): Promise<boolean> {
  try {
    const row = await prisma.judicialWorkCase.findUnique({ where: { id: caseId }, select: { ownerId: true, attachments: true } });
    if (!row || row.ownerId !== ownerId) return false;
    const current = arr<CaseAttachment>(row.attachments);
    const text = file.text.slice(0, 200_000); // سقفٌ أمنيّ
    const next: CaseAttachment[] = [
      ...current,
      { id: `att-${current.length + 1}-${text.length}`, name: file.name.slice(0, 200), text, chars: text.length, addedAt: new Date().toISOString() },
    ];
    await prisma.judicialWorkCase.update({ where: { id: caseId }, data: { attachments: next as unknown as object } });
    return true;
  } catch {
    return false;
  }
}

export interface JudgeDashboard {
  totalCases: number;
  totalAttachments: number;
  upcomingHearings: Array<{ caseId: string; caseNumber?: string; court?: string; hearing: Hearing }>;
  deadlines: Array<{ caseId: string; caseNumber?: string; deadline: Deadline }>;
  cases: CaseSummaryRow[];
}

export async function getJudgeDashboard(ownerId: string): Promise<JudgeDashboard> {
  try {
    const rows = await prisma.judicialWorkCase.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" }, select: SELECT });
    const cases = rows.map((r) => mapRow(r as Row));
    const upcomingHearings = cases
      .flatMap((c) => c.hearings.map((h) => ({ caseId: c.id, caseNumber: c.caseNumber, court: c.court, hearing: h })))
      .sort((a, b) => a.hearing.date.localeCompare(b.hearing.date));
    const deadlines = cases
      .flatMap((c) => c.deadlines.map((d) => ({ caseId: c.id, caseNumber: c.caseNumber, deadline: d })))
      .sort((a, b) => a.deadline.dueDate.localeCompare(b.deadline.dueDate));
    return {
      totalCases: cases.length,
      totalAttachments: cases.reduce((n, c) => n + c.attachments.length, 0),
      upcomingHearings,
      deadlines,
      cases: cases.map((c) => ({
        id: c.id, caseNumber: c.caseNumber, court: c.court, jurisdiction: c.jurisdiction,
        subject: c.subject, stage: c.stage, confidentiality: c.confidentiality,
        openIssues: c.issues.filter((i) => !i.resolved).length, attachmentCount: c.attachments.length,
      })),
    };
  } catch {
    return { totalCases: 0, totalAttachments: 0, upcomingHearings: [], deadlines: [], cases: [] };
  }
}
