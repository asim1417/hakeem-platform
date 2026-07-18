import type { AnswerForGuard, EngineResult, RetrievedArticle, Stance } from '../types';

// الحرّاس البرمجيّة — إنفاذٌ لا تعليمة. كلٌّ يُرجِع قائمة مخالفات (فارغة = سليم).

const key = (system: string, article: string) => `${system}::${article}`;
const retrievedSet = (er: EngineResult): Set<string> =>
  new Set(er.articles.map((a) => key(a.system, a.article)));

/** HLS-3.3 التأريض: كل مصدرٍ معروض يوجد في نتيجة المحرّك (لا اختلاق). */
export function groundingGuard(ans: AnswerForGuard, er: EngineResult): string[] {
  const have = retrievedSet(er);
  return ans.sources
    .filter((s) => !have.has(key(s.system, s.article)))
    .map((s) => `مصدرٌ غير مؤرَّض: ${s.system} م/${s.article}`);
}

/** HLS-3.4 النطاق: لا مصدرٌ من نظامٍ خارج نطاق الجلسة. */
export function scopeGuard(ans: AnswerForGuard, er: EngineResult): string[] {
  const scope = new Set(ans.scope.length ? ans.scope : er.scopeSystems);
  return ans.sources
    .filter((s) => !scope.has(s.system))
    .map((s) => `تسريب نطاق: ${s.system} خارج النطاق`);
}

/** HLS-4.2 النفاذ: لا مادّة لاغية تُقدَّم قانونًا قائمًا. */
export function enforcementGuard(ans: AnswerForGuard): string[] {
  return ans.sources
    .filter((s) => s.enforcement === 'لاغٍ')
    .map((s) => `مادّة لاغية مقدَّمة قانونًا قائمًا: ${s.system} م/${s.article}`);
}

/** منع الاختلاق: أرقام موادّ في المتن غير موجودة في نتيجة المحرّك. */
export function noFabricationGuard(ans: AnswerForGuard, er: EngineResult): string[] {
  const have = new Set(er.articles.map((a: RetrievedArticle) => a.article));
  const rejects: string[] = [];
  const re = /المادّ?ة\s*\(?\s*(\d{1,4})\s*\)?/g;
  for (const sec of ans.sections) {
    for (const m of sec.body.matchAll(re)) {
      if (!have.has(m[1])) rejects.push(`رقم مادّة مختلَق في المتن: ${m[1]}`);
    }
  }
  return rejects;
}

const NEUTRAL: Stance[] = ['neutral', 'expert', 'supervisor'];
const STANCE_MARKERS = ['المنطوق المقترح', 'نقترح الحكم', 'يُقضى', 'أرجّح', 'تقدير الحكم', 'في مصلحة موكّلي', 'نطالب المحكمة'];

/** حارس الموقف: لا منطوق/ترجيح من موقفٍ محايد أو مشرف. */
export function stanceGuard(ans: AnswerForGuard): string[] {
  if (!NEUTRAL.includes(ans.stance)) return [];
  const rejects: string[] = [];
  const texts = [ans.title, ...ans.sections.map((s) => s.body)];
  for (const t of texts) for (const m of STANCE_MARKERS) {
    if (t.includes(m)) rejects.push(`موقفٌ محايد يحمل: «${m}»`);
  }
  return rejects;
}
