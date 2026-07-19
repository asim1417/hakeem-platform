import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalPageHeader, LegalEmptyState } from "@/components/ui/legal";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { caseVisibleTo } from "@/lib/modules/judicial-assistant/abac";
import { formatDateTime } from "@/lib/modules/judicial-assistant/labels";
import { JaIcon } from "@/components/judicial-assistant/icons";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  JA_CASE_CREATED: "إنشاء القضية",
  JA_ATTACHMENT_ADDED: "إضافة مرفق",
  JA_SUMMARY_GENERATED: "إنشاء ملخّص تنفيذيّ (JS-001)",
  JA_SUMMARY_BLOCKED: "ملخّص محجوب (لا سند)",
  JA_DETERMINISTIC_ACTION: "تشغيل عملٍ حتميّ",
  JA_DRAFT_GENERATED: "مشروع حكم (JS-018)",
  JA_DRAFT_BLOCKED: "مشروع حكم محجوب (لا سند)",
};

export default async function CaseAuditPage({ params }: { params: { caseId: string } }) {
  const user = await requirePagePermission("JUDICIAL_ASSISTANT_USE");
  const kase = await getCase(params.caseId);
  if (!kase) notFound();
  if (!caseVisibleTo({ userId: user.id, role: user.role }, kase)) notFound();

  // سجلّ نشاط القضية من جدول التدقيق الفعليّ (§20 شاشة ١٧). سقوطٌ آمن إن تعذّر.
  const events = await prisma.auditEvent
    .findMany({
      where: { subject: "CASE", entityId: kase.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, action: true, createdAt: true, metadata: true, actorId: true },
    })
    .catch(() => []);

  return (
    <div className="ja">
      <LegalPageHeader
        eyebrow={`القضية ${kase.caseNumber}`}
        title="سجلّ النشاط"
        description="كلّ تشغيلٍ وتحليلٍ على هذه القضية موثّقٌ للمراجعة القضائيّة والأمنيّة."
        actions={
          <Link href={`/dashboard/judicial-assistant/cases/${kase.id}`} className="btn btn-outline">
            <JaIcon name="case" size={16} /> مساحة القضية
          </Link>
        }
      />

      {events.length === 0 ? (
        <LegalEmptyState title="لا نشاطٌ بعد" description="لم يُشغَّل أيّ عملٍ على هذه القضية حتى الآن. سيظهر كلّ تشغيلٍ هنا." />
      ) : (
        <div className="card ja-panel">
          <ul className="ja-list">
            {events.map((e) => {
              const meta = (e.metadata ?? {}) as Record<string, unknown>;
              const service = typeof meta.service === "string" ? meta.service : "";
              return (
                <li key={e.id} className="ja-list__row">
                  <div>
                    <div className="ja-list__title">{ACTION_LABEL[e.action] ?? e.action}{service ? ` — ${service}` : ""}</div>
                    <div className="ja-list__sub">
                      {formatDateTime(e.createdAt.toISOString())}
                      {e.actorId ? ` · بمعرّف المستخدم ${e.actorId.slice(0, 8)}…` : ""}
                    </div>
                  </div>
                  <JaIcon name="audit" size={16} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
