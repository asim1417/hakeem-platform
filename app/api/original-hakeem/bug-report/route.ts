import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.string().max(30).optional(),
  text: z.string().max(500).optional()
});

const requestSchema = z.object({
  type: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(5000),
  suggestedFix: z.string().max(500).optional(),
  timestamp: z.string().max(40).optional(),
  // العميل يرسل currentStage (قيمة hearingStage) — قد تكون رقماً أو نصاً
  currentStage: z.union([z.string(), z.number()]).optional(),
  caseId: z.string().max(120).optional(),
  subject: z.string().max(300).optional(),
  lastMessages: z.array(messageSchema).max(20).optional()
});

// POST: استقبال بلاغ من القاضي التفاعلي وحفظه في قاعدة البيانات.
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("SIMULATIONS_USE", request);
  if (auth.response) return auth.response;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "بيانات البلاغ غير صحيحة." }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const report = await prisma.bugReport.create({
      data: {
        type: data.type,
        description: data.description,
        suggestedFix: data.suggestedFix ?? null,
        caseId: data.caseId ?? null,
        subject: data.subject ?? null,
        stage: data.currentStage != null ? String(data.currentStage) : null,
        context: {
          timestamp: data.timestamp ?? null,
          lastMessages: data.lastMessages ?? []
        },
        actorId: auth.user?.id ?? null
      },
      select: { id: true }
    });

    await auditEvent({
      actorId: auth.user?.id,
      subject: "ADMIN",
      action: "BUG_REPORT_FILED",
      entityId: report.id,
      metadata: { type: data.type, caseId: data.caseId ?? null }
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, id: report.id });
  } catch {
    // الجدول غير مُنشأ بعد (لم يُطبَّق prisma db push) أو تعذّرت قاعدة البيانات —
    // نُعيد 503 ليحفظ العميل البلاغ محلياً احتياطياً دون فقدانه.
    return NextResponse.json(
      { ok: false, error: "تعذّر حفظ البلاغ على الخادم حالياً." },
      { status: 503 }
    );
  }
}

// GET: عرض البلاغات للمالك فقط (صلاحية ADMIN_REPORTS_VIEW).
export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("ADMIN_REPORTS_VIEW", request);
  if (auth.response) return auth.response;

  try {
    const reports = await prisma.bugReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        description: true,
        suggestedFix: true,
        caseId: true,
        subject: true,
        stage: true,
        createdAt: true
      }
    });
    return NextResponse.json({ ok: true, reports });
  } catch {
    return NextResponse.json({ ok: true, reports: [] });
  }
}
