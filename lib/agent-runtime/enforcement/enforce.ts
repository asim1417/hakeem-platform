import type { AnswerForGuard, EngineResult, GuardVerdict } from '../types';
import { groundingGuard, scopeGuard, enforcementGuard, noFabricationGuard, stanceGuard } from './guards';

/** المنسّق: يجمع الحرّاس الصارمة (رفض). التسامح (حذف الجملة) في طبقة الصياغة. */
export function runEnforcement(ans: AnswerForGuard, er: EngineResult): GuardVerdict {
  const rejects = [
    ...groundingGuard(ans, er),
    ...scopeGuard(ans, er),
    ...enforcementGuard(ans),
    ...noFabricationGuard(ans, er),
    ...stanceGuard(ans),
  ];
  return { ok: rejects.length === 0, rejects, prunedArticles: [] };
}
