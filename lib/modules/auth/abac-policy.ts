// محرك ABAC — المخطط السيادي §20. تقييم قائم على السمات، نواة نقيّة.
// يكمّل RBAC القائم دون استبداله: يجمع الدور + الملكيّة + تصنيف الحساسية.

import type { DataClass } from "@prisma/client";
import { clearanceSatisfies } from "@/lib/modules/security/data-classification";

export interface AbacSubject {
  userId: string;
  role: string;
  clearance?: DataClass | null;
  isAdmin?: boolean;
}
export interface AbacResource {
  ownerId?: string | null;
  dataClass?: DataClass | null;
  workspaceId?: string | null;
}
export type AbacAction = "read" | "write" | "delete" | "share";

export interface AbacDecision {
  allowed: boolean;
  reasons: string[];
}

/**
 * قرار وصول قائم على السمات (§20). القاعدة:
 * - المدير يتجاوز (مع تسجيل السبب).
 * - المالك يقرأ/يكتب مورده.
 * - غير المالك: قراءة فقط، ومشروطة بكفاية تصنيف الحساسية.
 * - الحذف/المشاركة: للمالك أو المدير فقط.
 */
export function evaluateAbac(
  subject: AbacSubject,
  resource: AbacResource,
  action: AbacAction
): AbacDecision {
  const reasons: string[] = [];

  if (subject.isAdmin) {
    reasons.push("admin-override");
    return { allowed: true, reasons };
  }

  const isOwner = Boolean(resource.ownerId) && resource.ownerId === subject.userId;
  if (isOwner) reasons.push("owner");

  // كفاية تصنيف الحساسية (§21) — تُطبَّق لغير المالك.
  const clearanceOk = isOwner || clearanceSatisfies(subject.clearance, resource.dataClass);
  if (!clearanceOk) reasons.push("insufficient-clearance");

  switch (action) {
    case "read":
      return { allowed: isOwner || clearanceOk, reasons: reasons.length ? reasons : ["clearance-ok"] };
    case "write":
      if (!isOwner) reasons.push("write-requires-owner");
      return { allowed: isOwner, reasons };
    case "delete":
    case "share":
      if (!isOwner) reasons.push(`${action}-requires-owner-or-admin`);
      return { allowed: isOwner, reasons };
    default:
      return { allowed: false, reasons: ["unknown-action"] };
  }
}
