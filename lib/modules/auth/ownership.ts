/**
 * عزل بيانات المستخدمين (Row-level tenancy).
 *
 * الخيار المعتمد لحكيم: قاعدة PostgreSQL مشتركة + عمود ملكيّة على كل سجلّ مستخدم
 * (userId / ownerId). المدير يرى الجميع؛ غيره لا يرى إلا ملكه.
 *
 * لماذا ليس قواعد منفصلة أو نطاقات فرعية لكل مستخدم؟
 * - الجمهور: محامٍ فرد ومكتب صغير — لا حاجة لعزل بنية تحتية ثقيلة.
 * - المكتبة القانونية (أنظمة/مواد/أحكام) مشتركة عمدًا كمرجع عام.
 * - الحصّة والنقاط معزولة أصلًا عبر userId في طبقات billing/credits.
 *
 * مدير النظام يرى بيانات الجميع؛ غيره يُقيَّد بملكيّته فقط.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SafeUser } from "@/lib/modules/auth/session";

type Actor = Pick<SafeUser, "id" | "role">;

/** مدير النظام أو مالك المنصة (سوبر أدمن) يرى بيانات الجميع؛ غيره يُقيَّد بملكيّته فقط. */
export function isSystemAdmin(user: Actor): boolean {
  return user.role === "SYSTEM_ADMIN" || user.role === "SUPER_ADMIN";
}

/** شرط قائمة/عدّ جلسات المحاكاة للمستخدم الحالي. */
export function simulationListWhere(user: Actor): Prisma.SimulationWhereInput | undefined {
  return isSystemAdmin(user) ? undefined : { userId: user.id };
}

/** شرط جلب جلسة محاكاة بالمعرّف مع فحص الملكيّة (المدير يتجاوز). */
export function simulationOwnedWhere(user: Actor, id: string): Prisma.SimulationWhereInput {
  return isSystemAdmin(user) ? { id } : { id, userId: user.id };
}

type SimulationFindArgs = {
  include?: Prisma.SimulationInclude;
};

/**
 * يجلب جلسة محاكاة إن كانت مملوكة للمستخدم (أو المدير).
 * يُرجع null إن لم توجد أو لم تكن مملوكة — استخدمه بدل findUnique لمنع IDOR.
 */
export function findOwnedSimulation<T extends SimulationFindArgs["include"]>(
  user: Actor,
  id: string,
  include?: T
): Promise<
  Prisma.SimulationGetPayload<{
    include: T extends undefined ? undefined : T;
  }> | null
> {
  return prisma.simulation.findFirst({
    where: simulationOwnedWhere(user, id),
    ...(include ? { include } : {})
  }) as Promise<
    Prisma.SimulationGetPayload<{
      include: T extends undefined ? undefined : T;
    }> | null
  >;
}

/** شرط قائمة/عدّ ملفات القضايا. */
export function caseListWhere(user: Actor): Prisma.CaseFileWhereInput | undefined {
  return isSystemAdmin(user) ? undefined : { ownerId: user.id };
}

/** شرط قائمة/عدّ المرفقات عبر ملكيّة القضية أو uploadedBy في metadata. */
export function attachmentListWhere(user: Actor): Prisma.AttachmentWhereInput | undefined {
  if (isSystemAdmin(user)) return undefined;
  return {
    OR: [
      { caseFile: { ownerId: user.id } },
      {
        AND: [{ caseId: null }, { extractedText: { contains: `"uploadedBy":"${user.id}"` } }]
      }
    ]
  };
}

/** شرط الاستشارات. */
export function consultationListWhere(user: Actor): Prisma.ConsultationWhereInput | undefined {
  return isSystemAdmin(user) ? undefined : { userId: user.id };
}

/**
 * يتحقق أن القضية مملوكة للمستخدم قبل ربط مرفق بها.
 * المرفقات بلا قضية تُسمح للرفع (تُسجَّل uploadedBy في metadata).
 */
export async function assertCaseOwnedForAttachment(
  user: Actor,
  caseId: string | undefined
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!caseId) return { ok: true };
  if (isSystemAdmin(user)) {
    const exists = await prisma.caseFile.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!exists) return { ok: false, message: "لم يتم العثور على ملف القضية." };
    return { ok: true };
  }
  const owned = await prisma.caseFile.findFirst({
    where: { id: caseId, ownerId: user.id },
    select: { id: true }
  });
  if (!owned) return { ok: false, message: "لا يمكن ربط المرفق بقضية لا تملكها." };
  return { ok: true };
}
