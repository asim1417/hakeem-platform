// ─────────────────────────────────────────────────────────────────────────────
// ABAC — التحكّم بالوصول بحسب السمات (§12). لا يكفي أن يكون المستخدم «قاضيًا» ليرى كلّ قضية.
// القضية مشروعٌ يملكه منشئها: تُرى للمالك، أو لمدير النظام. (إسناد الدائرة/التفويض لاحقًا.)
// ─────────────────────────────────────────────────────────────────────────────
import type { JudicialCase } from "./types";

export interface JudicialAccessContext {
  userId: string;
  role: string;
}

export function caseVisibleTo(ctx: JudicialAccessContext, kase: Pick<JudicialCase, "ownerId">): boolean {
  if (ctx.role === "SYSTEM_ADMIN") return true;
  return kase.ownerId === ctx.userId;
}
