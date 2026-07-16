// ─────────────────────────────────────────────────────────────────────────────
// مرحلة التحقّق المستقلّة (المرحلة ٤) [تاج المحرّك] — طورٌ صريح **بعد الاسترجاع وقبل الصياغة**،
// **لا يزيد المصادر**، يجمع أربع بوّابات على المواد المسترجَعة:
//   ① النطاق   — ينفي كل مادة خارج الأنظمة المستهدفة (صفر تسريب).
//   ② النفاذ   — يُسقِط كل مادة لاغية/موقوفة (لا يُبنى على ملغى — صفر لاغٍ يُقدَّم).
//   ③ التأريض  — يتحقّق فعلاً من ورود كل مادة في النواة (verifyCitations) فالمُختلَق يُحجَب.
//   ④ التغطية  — يوسم كل مسألة في coverageManifest «مُجابة» أو «لا نصّ» (بوّابة التسليم).
// نقيّ قابل للحقن (validator) — يُختبَر بلا قاعدة. لا يلمس النواة ولا الأمن.
// ─────────────────────────────────────────────────────────────────────────────
import { verifyCitations, type VerifiedCitation, type CitationValidator } from "./verifier";
import { resolveEnforcement } from "../substrate/enforcement";
import { normalizeSystemName, type SystemRef } from "../substrate/systems-registry";
import type { CoverageIssue, QueryPlan } from "./planner";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";

export interface CoverageState {
  issues: CoverageIssue[];
  answered: number;
  noText: number;
  /** بوّابة التسليم: صحيح حين لا مسألة «pending» (كلها وُسِمت). */
  gatePassed: boolean;
}

export interface VerificationReport {
  verified: VerifiedCitation[];
  droppedOutOfScope: number;
  droppedRepealed: number;
  blocked: number;
  coverage: CoverageState;
}

/** هل المادة ضمن الأنظمة المستهدفة؟ (تطبيع الاسم + مطابقة المعرّف/الاحتواء ثنائيّ الاتجاه.) */
export function belongsToScope(a: { systemId: string | null; systemName: string }, targets: SystemRef[]): boolean {
  if (!targets.length) return true; // بلا نطاق محدَّد → لا تقييد
  const an = normalizeSystemName(a.systemName);
  return targets.some((t) => {
    if (a.systemId && a.systemId === t.id) return true;
    const tn = normalizeSystemName(t.name);
    return an === tn || (an.length >= 3 && tn.length >= 3 && (an.includes(tn) || tn.includes(an)));
  });
}

function matchesIssueSystem(v: VerifiedCitation, issue: CoverageIssue): boolean {
  if (!issue.systemName) return true;
  const vn = normalizeSystemName(v.systemName ?? "");
  const inm = normalizeSystemName(issue.systemName);
  return vn === inm || (vn.length >= 3 && inm.length >= 3 && (vn.includes(inm) || inm.includes(vn)));
}

/** يوسم كل مسألة «answered» (وُجدت مادة مُتحقَّقة لنظامها) أو «no_text». حتميّ ونقيّ. */
export function markCoverage(plan: QueryPlan | undefined, verified: VerifiedCitation[]): CoverageState {
  const issues: CoverageIssue[] = (plan?.issues ?? []).map((i) => ({ ...i }));
  for (const issue of issues) {
    const answered = issue.systemName
      ? verified.some((v) => matchesIssueSystem(v, issue))
      : verified.length > 0;
    issue.status = answered ? "answered" : "no_text";
  }
  const answered = issues.filter((i) => i.status === "answered").length;
  const noText = issues.filter((i) => i.status === "no_text").length;
  const gatePassed = issues.every((i) => i.status !== "pending");
  return { issues, answered, noText, gatePassed };
}

/**
 * يشغّل مرحلة التحقّق كاملةً على المواد المسترجَعة (بلا استرجاع جديد).
 * الترتيب: نطاق → نفاذ → تأريض → تغطية. validator قابل للحقن للاختبار.
 */
export async function runVerification(input: {
  articles: LegalCoreResult[];
  plan?: QueryPlan;
  validator?: CitationValidator;
}): Promise<VerificationReport> {
  const targets = input.plan?.targetSystems ?? [];

  // ① النطاق — إسقاط كل مادة خارج الأنظمة المستهدفة (صفر تسريب).
  const inScope = input.articles.filter((a) => belongsToScope(a, targets));
  const droppedOutOfScope = input.articles.length - inScope.length;

  // ② النفاذ — إسقاط اللاغي/الموقوف (لا يُبنى على ملغى).
  const inForce = inScope.filter((a) => resolveEnforcement(a.status).inForce);
  const droppedRepealed = inScope.length - inForce.length;

  // ③ التأريض — تحقّق فعليّ من ورود كل مادة في النواة (المُختلَق يُحجَب).
  const outcome = await verifyCitations(
    inForce.map((a) => ({ articleId: a.articleId, systemName: a.systemName, articleNumber: Number(a.articleNumber), quote: a.snippet, status: a.status })),
    input.validator
  );

  // ④ التغطية — وسم كل مسألة (بوّابة التسليم).
  const coverage = markCoverage(input.plan, outcome.verified);

  return {
    verified: outcome.verified,
    droppedOutOfScope,
    droppedRepealed,
    blocked: outcome.blocked.length,
    coverage,
  };
}

/** ملخّص نصّي موجز لخطوة `verify` المبثوثة. */
export function describeVerification(r: VerificationReport): string {
  return `مؤصَّل ${r.verified.length} · محجوب ${r.blocked} · خارج النطاق ${r.droppedOutOfScope} · لاغٍ مُسقَط ${r.droppedRepealed} · تغطية ${r.coverage.answered}/${r.coverage.issues.length}`;
}
