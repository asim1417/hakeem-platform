import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { listAnalyses } from "@/lib/modules/judicial-assistant/persistence";
import { SERVICE_BY_ID } from "@/lib/modules/judicial-assistant/catalog";
import { JURISDICTION_LABEL, CONFIDENTIALITY_LABEL, FACT_STATUS_LABEL, formatDate, formatDateTime } from "@/lib/modules/judicial-assistant/labels";

export const dynamic = "force-dynamic";

/** GET /api/judicial-assistant/cases/[caseId]/export — JS-023 تصدير ملفّ القضية (Markdown). */
export async function GET(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  const kase = await getCase(params.caseId);
  if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
    return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
  }
  const analyses = await listAnalyses(kase.id);

  const md = [
    `# ملفّ القضية — ${kase.caseNumber || kase.subject}`,
    "",
    `- الموضوع: ${kase.subject}`,
    kase.court ? `- المحكمة: ${kase.court}${kase.circuit ? ` — ${kase.circuit}` : ""}` : "",
    `- نوع القضاء: ${JURISDICTION_LABEL[kase.jurisdiction]} · السرّيّة: ${CONFIDENTIALITY_LABEL[kase.confidentiality]}`,
    `- أُنشئت: ${formatDate(kase.createdAt)}`,
    "",
    "## الأطراف",
    ...(kase.parties.length ? kase.parties.map((p) => `- ${p.role}: ${p.name}`) : ["- (لا أطراف)"]),
    "",
    "## الطلبات",
    ...(kase.requests.length ? kase.requests.map((r) => `- ${r.text}`) : ["- (لا طلبات)"]),
    "",
    "## الوقائع",
    ...(kase.facts.length ? kase.facts.map((f) => `- (${FACT_STATUS_LABEL[f.status]}) ${f.text}`) : ["- (لا وقائع)"]),
    "",
    "## المسائل محلّ الفصل",
    ...(kase.issues.length ? kase.issues.map((i) => `- ${i.statement}`) : ["- (لا مسائل)"]),
    "",
    "## المرفقات",
    ...(kase.attachments.length ? kase.attachments.map((a) => `- ${a.name} (${a.chars} حرف)`) : ["- (لا مرفقات)"]),
    "",
    "## سجلّ التحليلات",
    ...(analyses.length ? analyses.map((a) => `- ${SERVICE_BY_ID[a.serviceId]?.title ?? a.serviceId} — ${formatDateTime(a.createdAt)}${a.blocked ? " (محجوب)" : ""}`) : ["- (لا تحليلات محفوظة)"]),
    "",
    "---",
    "مُصدَّرٌ من المعاون القضائي — مسودّةٌ مساعدة تخضع لمراجعة القاضي. لا تُعدّ حكمًا.",
  ].filter((l) => l !== "").join("\n");

  await auditEvent({ actorId, subject: "CASE", action: "JA_EXPORTED", entityId: kase.id, metadata: { service: "JS-023" } }).catch(() => undefined);

  return new NextResponse(md, {
    status: 200,
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="case-${kase.id}.md"` },
  });
}
