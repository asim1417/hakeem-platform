// صلاحيات مكتب التحرير — دالة نقية تُختبر بلا قاعدة.
// لا تستعمل canUser: لأن canUser يمنح SYSTEM_ADMIN كل صلاحية، والمطلوب ألا تُمنح صلاحيات المكتب
// لغير SUPER_ADMIN إلا بمنح صريح من صفحة الأدوار.
import type { EditorialAccess } from "./types";

export function resolveEditorialAccess(role: string, grantedKeys: Iterable<string>): EditorialAccess {
  const superAdmin = role === "SUPER_ADMIN";
  const granted = new Set(grantedKeys);
  const has = (key: string) => superAdmin || granted.has(key);
  const agent = !superAdmin && granted.has("LEGAL_AGENT_PROPOSE");
  return {
    superAdmin,
    agent,
    laws: has("LEGAL_EDITOR_LAWS"),
    rulings: has("LEGAL_EDITOR_RULINGS"),
    // الوكيل لا يعتمد ولو مُنح صلاحية المعتمِد خطأً.
    reviewer: !agent && has("LEGAL_REVIEWER"),
    qaView: has("LEGAL_QA_VIEW"),
  };
}

export function canViewDesk(access: EditorialAccess): boolean {
  return access.superAdmin || access.laws || access.rulings || access.reviewer || access.qaView || access.agent;
}

export function canProposeLaws(access: EditorialAccess): boolean {
  return access.laws || access.agent;
}

export function canReview(access: EditorialAccess): boolean {
  return access.reviewer && !access.agent;
}

/** سجل التدقيق (ق-١٢): لصاحب عرض الجودة أو المعتمِد، لا للوكيل. */
export function canReadAudit(access: EditorialAccess): boolean {
  if (access.superAdmin) return true;
  if (access.agent) return false;
  return access.qaView || access.reviewer;
}
