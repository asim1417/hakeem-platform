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
import { gate, response, failure } from "@/lib/modules/editorial/access";
import { propose } from "@/lib/modules/editorial/service";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;



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

export async function POST(request:NextRequest) {
  try {
    const {actor,sessionId}=await gate(request,true);
    const b=z.object({lawName:z.string().min(1),preamble:z.string().min(1).max(200000),royalDecree:z.string().optional(),effectiveFrom:z.string().date().optional(),evidenceUrl:z.string().url(),evidenceQuote:z.string().min(2),idempotencyKey:z.string().min(1)}).parse(await request.json());
    const work=await prisma.legalSystem.findUniqueOrThrow({where:{name:b.lawName},select:{id:true}});
    const result=await propose(actor.id,[{title:"تحديث ديباجة "+b.lawName,targetType:"work",targetId:work.id,op:"set_preamble",after:{preamble:b.preamble,...(b.royalDecree?{preambleRoyalDecree:b.royalDecree}:{}),...(b.effectiveFrom?{preambleEffectiveFrom:b.effectiveFrom}:{})},evidenceInstrument:b.royalDecree??"مصدر الديباجة",evidenceUrl:b.evidenceUrl,evidenceQuote:b.evidenceQuote,sourceRank:1,idempotencyKey:b.idempotencyKey}],sessionId);
    return response({ok:true,changeSetId:result.id,message:"حُفظت مسودة الديباجة؛ يلزم الاعتماد ثم النشر."},202);
  }catch(e){return failure(e);}
}
