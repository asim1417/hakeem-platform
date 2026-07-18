import type { AnswerForGuard, EngineResult, GuardVerdict, Stance } from '../types';
import { runEnforcement } from '../enforcement/enforce';

// المسار المدموج (مرجعيّ): إدراك → إطار/أسبقية → بوابة الخلية → المحرّك → الحارس → إخراج طبقيّ.
// المحرّك يُحقَن (RunEngine) — هو الوصلة الوحيدة للنواة الحيّة.

export type TaskMode = 'ask' | 'consultation' | 'chat' | 'analyze-case' | 'action-plan' | 'verdict-estimate';

const ADVOCATE: Stance[] = ['advocate', 'advocate_debtor', 'advocate_creditor'];
const isAdvocate = (s: Stance) => ADVOCATE.includes(s);
// مصفوفة §٤ (نسخة الخادم — المصدر الواحد يُشارَك مع الواجهة في الإنتاج).
export function isForbiddenCell(stance: Stance, mode: TaskMode, roleKey?: string): boolean {
  if (mode === 'ask' || mode === 'chat' || mode === 'analyze-case') return false;
  if (isAdvocate(stance)) return false;
  if (roleKey === 'researcher') return mode === 'action-plan';
  return true; // محايد/مشرف/خبير: consultation/action-plan/verdict-estimate محظورة
}

export interface SearchDeps {
  runEngine: (normalizedQuery: string, scope: string[]) => Promise<EngineResult>;
  compose: (er: EngineResult, ctx: { stance: Stance; taskMode: TaskMode; scope: string[] }) => AnswerForGuard;
}
export interface SearchReq {
  query: string; normalizedQuery?: string;
  scope: string[]; stance: Stance; taskMode: TaskMode; roleKey?: string;
}
export type SearchResult =
  | { status: 'blocked'; reason: string; suggestion: TaskMode }
  | { status: 'rejected'; verdict: GuardVerdict }
  | { status: 'ok'; answer: AnswerForGuard };

export async function handleSearch(req: SearchReq, deps: SearchDeps): Promise<SearchResult> {
  // بوابة الخلية المحرّمة — قبل أي استرجاع
  if (isForbiddenCell(req.stance, req.taskMode, req.roleKey)) {
    return { status: 'blocked', reason: `النمط «${req.taskMode}» محظورٌ لهذا الموقف`, suggestion: 'analyze-case' };
  }
  const er = await deps.runEngine(req.normalizedQuery ?? req.query, req.scope);
  const answer = deps.compose(er, { stance: req.stance, taskMode: req.taskMode, scope: req.scope });
  const verdict = runEnforcement(answer, er);         // الحارس الصارم
  if (!verdict.ok) return { status: 'rejected', verdict };
  return { status: 'ok', answer };
}
