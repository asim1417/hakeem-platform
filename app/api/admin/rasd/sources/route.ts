import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { listRasdSources } from "@/lib/modules/rasd/admin-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("ADMIN_REPORTS_VIEW", request);
  if (gate.response) return gate.response;
  return NextResponse.json({ sources: await listRasdSources() });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_ADMIN", request);
  if (gate.response) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";
  if (!["BOE", "NCAR", "UQN"].includes(code)) {
    return NextResponse.json({ message: "مصدر غير مدعوم." }, { status: 400 });
  }
  const isActive = body.isActive === true;
  try {
    const delegate = (prisma as unknown as {
      monitoringSource?: { update(args: { where: { code: string }; data: { isActive: boolean } }): Promise<unknown> };
    }).monitoringSource;
    const source = await delegate?.update({ where: { code }, data: { isActive } });
    return NextResponse.json({ source });
  } catch {
    return NextResponse.json({ message: "تعذر تحديث المصدر. تحقق من تطبيق جداول رصد." }, { status: 503 });
  }
}
