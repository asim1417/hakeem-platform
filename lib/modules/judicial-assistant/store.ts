// ─────────────────────────────────────────────────────────────────────────────
// طبقة الوصول (Store) — تبني قوائم القضايا ولوحة القاضي فوق الموصل الفعّال.
// لا SQL هنا؛ المصدر هو الموصل (Mock حاليًّا). المرجع: §20 (لوحة القاضي، قائمة القضايا).
// ─────────────────────────────────────────────────────────────────────────────
import { activeConnector } from "./connector";
import { STAGE_META } from "./catalog";
import type { CaseSummaryRow, Deadline, Hearing, JudicialCase } from "./types";

function toRow(c: JudicialCase): CaseSummaryRow {
  const next = [...c.hearings].sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    court: c.court,
    jurisdiction: c.jurisdiction,
    subject: c.subject,
    stage: c.stage,
    confidentiality: c.confidentiality,
    nextHearing: next?.date,
    openIssues: c.issues.filter((i) => !i.resolved).length,
  };
}

export async function listCaseRows(): Promise<CaseSummaryRow[]> {
  const cases = await activeConnector.listCases();
  return cases.map(toRow);
}

export async function getCase(caseId: string): Promise<JudicialCase | null> {
  return activeConnector.getCase(caseId);
}

export interface JudgeDashboard {
  connector: { ok: boolean; lastSync: string | null; note: string };
  totalCases: number;
  upcomingHearings: Array<{ caseId: string; caseNumber: string; court: string; hearing: Hearing }>;
  deadlines: Array<{ caseId: string; caseNumber: string; deadline: Deadline }>;
  readyCases: CaseSummaryRow[];
  stageCounts: Array<{ label: string; count: number }>;
}

/** يبني لوحة القاضي: أولويّات اليوم — جلسات، مدد، أعمال جاهزة (§20 شاشة ١). */
export async function getJudgeDashboard(): Promise<JudgeDashboard> {
  const [health, cases] = await Promise.all([activeConnector.health(), activeConnector.listCases()]);

  const upcomingHearings = cases
    .flatMap((c) => c.hearings.map((h) => ({ caseId: c.id, caseNumber: c.caseNumber, court: c.court, hearing: h })))
    .sort((a, b) => a.hearing.date.localeCompare(b.hearing.date));

  const deadlines = cases
    .flatMap((c) => c.deadlines.map((d) => ({ caseId: c.id, caseNumber: c.caseNumber, deadline: d })))
    .sort((a, b) => a.deadline.dueDate.localeCompare(b.deadline.dueDate));

  const stageMap = new Map<string, number>();
  for (const c of cases) {
    const label = STAGE_META[c.stage].label;
    stageMap.set(label, (stageMap.get(label) ?? 0) + 1);
  }

  return {
    connector: health,
    totalCases: cases.length,
    upcomingHearings,
    deadlines,
    readyCases: cases.map(toRow),
    stageCounts: [...stageMap.entries()].map(([label, count]) => ({ label, count })),
  };
}
