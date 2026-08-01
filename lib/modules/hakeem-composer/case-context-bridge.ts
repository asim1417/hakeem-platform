/**
 * جسر سياق القضية للصندوق — يربط دون دمج نموذج JDS أو CaseFile في Ask.
 */
import { prisma } from "@/lib/prisma";

export type ComposerCaseContext = {
  caseId: string;
  source: "case-file" | "judicial-work-case" | "none";
  title: string;
  summary?: string;
  owned: boolean;
  /** رابط تسليم للمعاون إن وُجد */
  jdsHref?: string;
};

function envOn(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function isComposerCaseContextEnabled(): boolean {
  return envOn("HAKEEM_COMPOSER_CASE_CONTEXT_V1");
}

/**
 * يحمّل سياق قضية مملوك للمستخدم إن وُجد المعرف.
 * لا يخلط CaseFile مع JudicialWorkCase في نفس السجل — يفضّل case-file ثم JDS.
 */
export async function resolveComposerCaseContext(input: {
  userId: string;
  caseId?: string | null;
  judicialCaseId?: string | null;
}): Promise<ComposerCaseContext | null> {
  if (!isComposerCaseContextEnabled()) return null;

  if (input.caseId) {
    const row = await prisma.caseFile
      .findFirst({
        where: { id: input.caseId, ownerId: input.userId },
        select: { id: true, title: true, summary: true },
      })
      .catch(() => null);
    if (row) {
      return {
        caseId: row.id,
        source: "case-file",
        title: row.title,
        summary: row.summary ?? undefined,
        owned: true,
        jdsHref: undefined,
      };
    }
  }

  if (input.judicialCaseId) {
    // جدول قضائي مستقل — fail-open إن لم يوجد
    try {
      const rows = await prisma.$queryRaw<
        Array<{ id: string; subject: string | null; case_number: string | null }>
      >`
        SELECT id::text, subject, case_number
        FROM judicial_work_cases
        WHERE id = ${input.judicialCaseId}::uuid
          AND owner_id = ${input.userId}::uuid
        LIMIT 1
      `;
      const row = rows[0];
      if (row) {
        return {
          caseId: row.id,
          source: "judicial-work-case",
          title: row.subject || row.case_number || "قضية قضائية",
          owned: true,
          jdsHref: `/dashboard/judicial-assistant/cases/${row.id}`,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}
