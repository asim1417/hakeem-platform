// صلاحيات مكتب التحرير — محلّل نقي يُختبر بلا قاعدة.
// المصدر: تكليف المستخدم في إعدادات المكتب (ق-٢) ونطاقه (ق-٥)، لا RolePermission ولا canUser
// (canUser يمنح SYSTEM_ADMIN كل صلاحية). المالك (SUPER_ADMIN) يملك كل شيء ضمنًا ولا يكون وكيلًا.
import type { EditorialBinding } from "./policy";
import type { EditorialAccess, ItemKind } from "./types";

export type { EditorialAccess, ItemKind };

const NONE: EditorialAccess = {
  superAdmin: false,
  agent: false,
  editorLaws: false,
  editorRulings: false,
  reviewer: false,
  publisher: false,
  qaView: false,
  itemKinds: [],
  domains: [],
};

export function resolveEditorialAccess(role: string, binding: EditorialBinding | null | undefined): EditorialAccess {
  if (role === "SUPER_ADMIN") {
    return {
      superAdmin: true,
      agent: false,
      editorLaws: true,
      editorRulings: true,
      reviewer: true,
      publisher: true,
      qaView: true,
      itemKinds: "all",
      domains: "all",
    };
  }
  if (!binding || !binding.enabled) return { ...NONE };
  const roles = new Set(binding.roles);
  const agent = binding.kind === "agent";
  return {
    superAdmin: false,
    agent,
    editorLaws: roles.has("editor_laws"),
    editorRulings: roles.has("editor_rulings"),
    // الوكيل لا يعتمد ولا ينشر ولو كُلّف بذلك خطأً.
    reviewer: !agent && roles.has("reviewer"),
    publisher: !agent && roles.has("publisher"),
    qaView: roles.has("qa_view"),
    itemKinds: binding.itemKinds === "all" ? "all" : [...binding.itemKinds],
    domains: binding.domains === "all" ? "all" : [...binding.domains],
  };
}

/**
 * النطاق (ق-٥): نوع العنصر دائمًا، والمجال على العناصر التي لها مجال فقط.
 * عناصر الاستقبال (التعديلات والمبادئ) ومجالها '' تُحكم بنوع العنصر وحده.
 */
export function inScope(access: EditorialAccess, kind: ItemKind, domain?: string | null): boolean {
  if (access.superAdmin) return true;
  const kindOk = access.itemKinds === "all" || access.itemKinds.includes(kind);
  if (!kindOk) return false;
  const d = (domain ?? "").trim();
  if (!d) return true;
  return access.domains === "all" || access.domains.includes(d);
}

export function canViewDesk(access: EditorialAccess): boolean {
  return (
    access.superAdmin ||
    access.agent ||
    access.editorLaws ||
    access.editorRulings ||
    access.reviewer ||
    access.publisher ||
    access.qaView
  );
}

/** يقترح تغييرات الأنظمة في نطاق ما (الوكيل المكلَّف بتحرير الأنظمة يقترح أيضًا). */
export function canProposeLaws(access: EditorialAccess): boolean {
  return access.editorLaws;
}

export function canReview(access: EditorialAccess): boolean {
  return access.reviewer && !access.agent;
}

export function canPublish(access: EditorialAccess): boolean {
  return access.publisher && !access.agent;
}

/** إعدادات المكتب للمالك وحده في المرحلة صفر. */
export function canManageSettings(access: EditorialAccess): boolean {
  return access.superAdmin;
}

/** سجل التدقيق (ق-١٢): لصاحب عرض الجودة أو المعتمِد، لا للوكيل. */
export function canReadAudit(access: EditorialAccess): boolean {
  if (access.superAdmin) return true;
  if (access.agent) return false;
  return access.qaView || access.reviewer;
}

export function canProposeIn(access: EditorialAccess, kind: ItemKind, domain?: string | null): boolean {
  return canProposeLaws(access) && inScope(access, kind, domain);
}

export function canReviewIn(access: EditorialAccess, kind: ItemKind, domain?: string | null): boolean {
  return canReview(access) && inScope(access, kind, domain);
}

export function canPublishIn(access: EditorialAccess, kind: ItemKind, domain?: string | null): boolean {
  return canPublish(access) && inScope(access, kind, domain);
}

/** طلب التراجع اقتراح: يطلبه محرر الأنظمة أو الناشر في نطاق «revert» ومجال الهدف. */
export function canRequestRevertIn(access: EditorialAccess, domain?: string | null): boolean {
  if (access.superAdmin) return true;
  return (access.editorLaws || canPublish(access)) && inScope(access, "revert", domain);
}
