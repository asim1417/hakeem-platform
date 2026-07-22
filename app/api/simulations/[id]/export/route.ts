import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { buildSimulationExport, toDocx, toPdf } from "@/lib/modules/exports/legal-documents";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["claim-sheet", "hearing-record", "judgment", "settlement", "full-report"]);
const allowedFormats = new Set(["docx", "pdf"]);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const type = request.nextUrl.searchParams.get("type") || "full-report";
  const format = request.nextUrl.searchParams.get("format") || "docx";
  if (!allowedTypes.has(type) || !allowedFormats.has(format)) {
    return NextResponse.json({ message: "نوع التصدير أو الصيغة غير مدعوم." }, { status: 400 });
  }

  const session = await findOwnedSimulation(gate.user!, params.id, {
    messages: { orderBy: { createdAt: "asc" } },
    decisions: { orderBy: { createdAt: "asc" } },
    judgments: { orderBy: { createdAt: "desc" } }
  });
  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });

  const payload = buildSimulationExport(session, type);
  const file = format === "docx" ? toDocx(payload) : toPdf(payload);
  const contentType = format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";
  const filename = `hakeem-${type}-${params.id}.${format}`;

  await auditEvent({
    actorId: gate.user!.id,
    subject: "SIMULATION",
    action: "SIMULATION_DOCUMENT_EXPORTED",
    entityId: params.id,
    metadata: { description: `تم تصدير مستند محاكاة: ${type}.${format}`, type, format }
  });

  return new NextResponse(file, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
