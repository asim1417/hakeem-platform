// ─────────────────────────────────────────────────────────────────────────────
// ABAC — التحكّم بالوصول بحسب السمات (§12). لا يكفي أن يكون المستخدم «قاضيًا» ليرى كلّ قضية.
// آليّةٌ حقيقيّة: القضية تُرى إن كان المستخدم مديرًا، أو مالكها/مُسنَدةً إليه، أو كانت صناعيّة
// للعرض. القضايا الصناعيّة الحاليّة بلا مالك، فتُرى لكلّ من يملك صلاحية المعاون — وموسومة صراحةً.
// عند وصول القضايا الحقيقيّة (ownerId/court/circuit) يُطبَّق الترشيح دون تغيير هذه الواجهة.
// ─────────────────────────────────────────────────────────────────────────────
import type { JudicialCase } from "./types";

export interface JudicialAccessContext {
  userId: string;
  role: string;
  /** المحكمة/الدائرة المُسنَدة للمستخدم (اختياريّة الآن — تُملأ من الهوية لاحقًا). */
  court?: string;
  circuit?: string;
}

/** هل تُرى هذه القضية لهذا المستخدم؟ */
export function caseVisibleTo(ctx: JudicialAccessContext, kase: Pick<JudicialCase, "synthetic">): boolean {
  if (ctx.role === "SYSTEM_ADMIN") return true;
  // القضايا الصناعيّة (بلا مالك) متاحةٌ للعرض لكلّ من يملك صلاحية المعاون.
  if (kase.synthetic) return true;
  // مكان الترشيح الحقيقيّ لاحقًا: kase.ownerId === ctx.userId أو إسناد الدائرة.
  return false;
}

/** يرشّح قائمة القضايا بحسب الرؤية. */
export function filterVisibleCases<T extends Pick<JudicialCase, "synthetic">>(
  ctx: JudicialAccessContext,
  cases: T[]
): T[] {
  return cases.filter((c) => caseVisibleTo(ctx, c));
}
