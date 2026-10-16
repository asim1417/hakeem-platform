// /api/admin/legal-core/preambles — إدارة ديباجات الأنظمة.
//
// DATA-001 (الخيار الثاني): الديباجة تُخزَّن حقلًا مخصّصًا على مستوى النظام
// (LegalSystem.preamble)، لا «مادة صفر». لا توجد مادة رقمها صفر.
//
//  GET  ?system=المعاملات المدنية   → هل النظام موجود؟ وله ديباجة؟
//  POST { lawName, preamble, royalDecree?, effectiveFrom? } → يخزّن/يحدّث ديباجة النظام.
//
// صلاحية LEGAL_CORE_ADMIN + تسجيل تدقيق. لا يخترع نصًّا — النصّ من المشرف/المصدر الرسميّ.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PREAMBLE = 200_000;

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_ADMIN", request);
  if (gate.response) return gate.response;

  const q = (request.nextUrl.searchParams.get("system") ?? request.nextUrl.searchParams.get("q") ?? "").trim();

  const systems = q
    ? await prisma.legalSystem.findMany({
        where: { OR: [{ name: q }, { name: { contains: q, mode: "insensitive" } }] },
        select: { id: true, name: true, preamble: true },
        take: 20,
        orderBy: { name: "asc" },
      })
    : await prisma.legalSystem.findMany({ select: { id: true, name: true, preamble: true }, orderBy: { name: "asc" } });

  const report = systems.map((s) => ({
    system: s.name,
    systemId: s.id,
    exists: true,
    hasPreamble: Boolean(s.preamble && s.preamble.trim()),
    preambleChars: s.preamble?.length ?? 0,
  }));

  return NextResponse.json({
    ok: true,
    query: q || null,
    matched: report.length,
    withPreamble: report.filter((r) => r.hasPreamble).length,
    systems: report,
    message: q && !report.length ? `لا نظامَ باسمٍ يطابق «${q}» في النواة.` : undefined,
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_ADMIN", request);
  if (gate.response) return gate.response;

  let body: { lawName?: string; preamble?: string; royalDecree?: string; effectiveFrom?: string } = {};
  try { body = await request.json(); } catch { /* فارغ */ }

  const lawName = String(body.lawName ?? "").trim();
  const preamble = String(body.preamble ?? "").trim().slice(0, MAX_PREAMBLE);
  if (!lawName || !preamble) {
    return NextResponse.json({ ok: false, message: "يلزم lawName + preamble." }, { status: 400 });
  }

  const system = await prisma.legalSystem.findUnique({ where: { name: lawName } });
  if (!system) {
    const suggestions = await prisma.legalSystem.findMany({
      where: { name: { contains: lawName, mode: "insensitive" } },
      select: { name: true }, take: 10,
    });
    return NextResponse.json(
      { ok: false, message: `لا نظامَ باسم «${lawName}» في النواة.`, suggestions: suggestions.map((s) => s.name) },
      { status: 404 }
    );
  }

  const effective = body.effectiveFrom ? new Date(body.effectiveFrom) : undefined;
  await prisma.legalSystem.update({
    where: { id: system.id },
    data: {
      preamble,
      preambleRoyalDecree: body.royalDecree?.trim() || undefined,
      preambleEffectiveFrom: effective && !Number.isNaN(effective.getTime()) ? effective : undefined,
      preambleUpdatedAt: new Date(),
    },
    select: { id: true },
  });

  await auditEvent({
    actorId: gate.user?.id, subject: "ADMIN", action: "LEGAL_CORE_PREAMBLE_IMPORTED",
    metadata: { lawName, systemId: system.id, chars: preamble.length },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    system: lawName,
    systemId: system.id,
    chars: preamble.length,
    message: `حُفِظت ديباجة «${lawName}» على مستوى النظام (${preamble.length.toLocaleString("ar-SA")} حرفًا).`,
  });
}
