import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { buildAccountExport } from "@/lib/modules/exports/account-export";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/export — تصدير كامل لبيانات المستخدم نفسه (§33/§4.1).
 * سيادة البيانات: يُصدّر المستخدم بياناته بصيغة مفتوحة (JSON) دون حبس.
 */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  try {
    const archive = await buildAccountExport(user.id, new Date().toISOString());
    await auditEvent({
      actorId: user.id,
      subject: "ADMIN",
      action: "ACCOUNT_DATA_EXPORTED",
      metadata: { counts: archive.counts },
    }).catch(() => undefined);
    return new NextResponse(JSON.stringify(archive, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="hakeem-export-${user.id}.json"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "تعذّر التصدير." },
      { status: 500 }
    );
  }
}
