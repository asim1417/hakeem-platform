/**
 * app/api/cron/stale-audit/route.ts — فحص التقادم الشهريّ (تاسعًا).
 * يقارن تاريخ آخر تعديل لكل نظام في حكيم بتاريخه في بوابة هيئة الخبراء، فيَسِم الأحدث
 * في البوابة «متقادم-قيد التحقق» (STALE_UNVERIFIED) على وحداته، ويسجّل تقرير IngestRun.
 *
 * ⚠️ يعتمد على شبكةٍ (laws.boe.gov.sa) + قاعدة. لم يُشغَّل في بيئة الجلسة (المصدر
 * محجوب). يفشل بأمان بلا CRON_SECRET. الوسم لا يُرفع إلا بعد دمج التعديل والتحقق
 * المزدوج (تاسعًا-٣) — تُنفَّذ إزالة الوسم في مسار المراجعة لا هنا.
 *
 * TODO(boe): مطابقة مخطّط قراءة «تاريخ آخر تعديل» من صفحة البوابة لكل نظام.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** تاريخ آخر تعديل من البوابة — TODO: تنفيذ القراءة الفعليّة. يعيد null حاليًّا. */
async function boeLastModified(_system: { id: string; name: string; eliSlug: string | null }): Promise<Date | null> {
  return null;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ skipped: "CRON_SECRET غير مضبوط — لا تنفيذ." }, { status: 200 });
  }
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  let checked = 0;
  let flagged = 0;
  try {
    const systems = await prisma.legalSystem.findMany({ select: { id: true, name: true, eliSlug: true, updatedAt: true } });
    for (const s of systems) {
      const boeDate = await boeLastModified(s);
      checked++;
      if (boeDate && boeDate > s.updatedAt) {
        // وسم وحدات النظام «متقادم-قيد التحقق» (لا يُرفع إلا بالمراجعة).
        await prisma.documentUnit.updateMany({ where: { systemId: s.id, status: "IN_FORCE" }, data: { status: "STALE_UNVERIFIED" } });
        flagged++;
      }
    }
    await prisma.ingestRun.create({
      data: { source: "boe", runType: "stale_audit", finishedAt: new Date(), captured: checked, flagged },
    });
    return NextResponse.json({ ok: true, checked, flagged });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
