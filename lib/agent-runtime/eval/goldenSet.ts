import type { RunOutput, AgentRunner } from '../conformance/runner';
import { runEnforcement } from '../enforcement/enforce';

// حزمة القياس (golden set) — الحالات البنيويّة تُختبَر آليًّا؛ والحالات ذات المحتوى القانونيّ
// تُملأ إجاباتها الذهبيّة من ممارسٍ للدور (كما تشترط المواصفة). هنا الهيكل + المصحّح.

export interface GoldenCase {
  id: string;
  agentId: string;
  input: string;
  expect: {
    system?: string;           // النظام المتوقّع في المصادر
    grounded?: boolean;        // كل مصدرٍ مؤرَّض
    stanceClean?: boolean;     // لا مخالفة موقف
    minSources?: number;
  };
}

export interface GoldenScore {
  id: string; pass: boolean; checks: Record<string, boolean>;
}

export function scoreCase(o: RunOutput, c: GoldenCase): GoldenScore {
  const checks: Record<string, boolean> = {};
  if (c.expect.system !== undefined)
    checks.system = o.answer.sources.some((s) => s.system === c.expect.system);
  if (c.expect.grounded)
    checks.grounded = runEnforcement(o.answer, o.engine).ok;
  if (c.expect.stanceClean)
    checks.stanceClean = runEnforcement(o.answer, o.engine).rejects.every((r) => !r.includes('موقف'));
  if (c.expect.minSources !== undefined)
    checks.minSources = o.answer.sources.length >= c.expect.minSources;
  return { id: c.id, pass: Object.values(checks).every(Boolean), checks };
}

export async function scoreAgent(run: AgentRunner, cases: GoldenCase[]): Promise<{
  scores: GoldenScore[]; passRate: number;
}> {
  const scores: GoldenScore[] = [];
  for (const c of cases) scores.push(scoreCase(await run(c.input), c));
  const passRate = scores.length ? scores.filter((s) => s.pass).length / scores.length : 0;
  return { scores, passRate };
}

/** حالاتٌ بنيويّة جاهزة (لا تحتاج ممارسًا) — تُوسَّع بحالات المحتوى لاحقًا. */
export const STRUCTURAL_GOLDEN: GoldenCase[] = [
  { id: 'G-JDG-neutral', agentId: 'aman-judge-aide', input: 'حرّر محل النزاع',
    expect: { grounded: true, stanceClean: true } },
  { id: 'G-INS-priority', agentId: 'aman-insolvency-practitioner', input: 'رتّب أولوية الدائنين',
    expect: { grounded: true, stanceClean: true, minSources: 1 } },
];
