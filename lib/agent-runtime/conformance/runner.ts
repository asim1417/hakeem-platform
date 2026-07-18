import type { AnswerForGuard, EngineResult } from '../types';
import { runEnforcement } from '../enforcement/enforce';

// بوابة اعتماد الوكلاء — تنفيذٌ للحالات المكتوبة في المخطط (HLS-8.x + حالات الموقف).
// لا اعتماد إلا باجتياز الكلّ. المحرّك يُحقَن (adapter) فتُختبر البوابة دون قاعدةٍ حيّة.

export interface RunOutput { answer: AnswerForGuard; engine: EngineResult; }
export type AgentRunner = (input: string) => Promise<RunOutput>;

export interface ConformanceCase {
  id: string;
  kind: 'engine' | 'agent';
  description: string;
  input: string;
  /** يمرّ إن أرجع ok:true. */
  check: (o: RunOutput) => { ok: boolean; reason?: string };
}

export interface ConformanceReport {
  results: { id: string; pass: boolean; reason?: string }[];
  passed: string[];
  failed: string[];
  approved: boolean;
}

export async function runConformance(
  run: AgentRunner, cases: ConformanceCase[]
): Promise<ConformanceReport> {
  const results: ConformanceReport['results'] = [];
  for (const c of cases) {
    try {
      const out = await run(c.input);
      const r = c.check(out);
      results.push({ id: c.id, pass: r.ok, reason: r.reason });
    } catch (e) {
      results.push({ id: c.id, pass: false, reason: (e as Error).message });
    }
  }
  const passed = results.filter((r) => r.pass).map((r) => r.id);
  const failed = results.filter((r) => !r.pass).map((r) => r.id);
  return { results, passed, failed, approved: failed.length === 0 };
}
