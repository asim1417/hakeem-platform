import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { isSystemAdmin } from "@/lib/modules/auth/ownership";

export const dynamic = "force-dynamic";

// [إصلاح تدقيق SEC-002: كان بلا مصادقة ولا فحص ملكيّة → قراءة أي ملفّ قضية بمعرّفه.]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("CONSULTATIONS_LIMITED", request);
  if (gate.response) return gate.response;

  // القصر على مالك القضية (أو مدير النظام / السوبر أدمن) — يمنع قراءة قضايا مستخدمين آخرين.
  const isAdmin = isSystemAdmin(gate.user!);
  const caseFile = await prisma.caseFile.findFirst({
    where: isAdmin ? { id: params.id } : { id: params.id, ownerId: gate.user!.id },
    include: {
      owner: { select: { name: true, email: true } },
      attachments: true
    }
  });

  if (!caseFile) {
    // نفس الردّ لغير الموجود وغير المملوك (لا نُفشي وجود المورد).
    return NextResponse.json({ message: "لم يتم العثور على القضية." }, { status: 404 });
  }

  return NextResponse.json({ case: caseFile });
}
