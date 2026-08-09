/**
 * app/api/cron/uqn-ingest/route.ts — خطّ الالتقاط الجاري من أم القرى (خامسًا).
 * الأحد والجمعة (vercel.json). يقرأ RSS → منع تكرار بـ guid → تصنيف → قارئ →
 * إدخال → تقرير IngestRun.
 *
 * ⚠️ يعتمد على شبكةٍ (uqn.gov.sa) + قاعدة. لم يُشغَّل/يُختبر في بيئة الجلسة (المصدر
 * محجوب بسياسة الخروج). يفشل بأمان: بلا CRON_SECRET لا ينفّذ شيئًا. إدارة التعديل
 * (سابعًا) مؤجّلة: التعديل/الإلغاء يُرفع للمراجعة ولا يُطبَّق آليًّا هنا.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseUqnRss } from "@/lib/modules/legal-core/uqn-rss";
import { classifyUqnItem } from "@/lib/modules/legal-core/uqn-classify";
import { persistParsedDocument, type DbDocType } from "@/lib/modules/legal-core/document-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UQN_RSS_URL = process.env.UQN_RSS_URL || "https://www.uqn.gov.sa/rssFeed/21";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // بلا سرّ لا ينفّذ (فشل آمن)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ skipped: "CRON_SECRET غير مضبوط — لا تنفيذ." }, { status: 200 });
  }
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const started = Date.now();
  let captured = 0;
  let classified = 0;
  let inserted = 0;
  let raised = 0;
  const notes: string[] = [];

  try {
    const res = await fetch(UQN_RSS_URL, { headers: { "user-agent": "hakeem-legal-agent/1.0" } });
    if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
    const items = parseUqnRss(await res.text());
    captured = items.length;

    for (const item of items) {
      // منع التكرار بـ guid (خامسًا-٢)
      const exists = await prisma.legalDocument.findUnique({ where: { sourceGuid: item.guid }, select: { id: true } });
      if (exists) continue;

      const category = classifyUqnItem(item.title, item.description);
      classified++;
      if (category === "out_of_scope") continue; // يُؤرشَف ولا يُدخَل

      // إدارة التعديل مؤجّلة: التعديل/الإلغاء يُرفع للمراجعة (لا تطبيق آليّ).
      if (category === "amendment" || category === "repeal_or_replace") {
        raised++;
        notes.push(`مراجعة (${category}): ${item.title.slice(0, 60)}`);
        continue;
      }

      const docType: DbDocType =
        category === "bylaw_or_rules" ? "BYLAW" : category === "instrument" ? "ROYAL_DECREE" : "SYSTEM_TEXT";

      // ربط/إنشاء سجل النظام (خامسًا-٥): بالاسم — تُوحَّد الحزمة لاحقًا عند المراجعة.
      const name = item.title.trim().slice(0, 240) || `عنصر ${item.guid}`;
      const system = await prisma.legalSystem.upsert({
        where: { name }, update: {}, create: { name, completeness: "IN_PROGRESS" },
      });

      const persisted = await persistParsedDocument({
        systemId: system.id, docType, rawText: item.description,
        sourceGuid: item.guid, sourceUrl: item.link ?? null,
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      });
      inserted++;
      if (!persisted.reconstructionOk || persisted.warnings.length) {
        raised++;
        notes.push(`تحذير قراءة: ${name.slice(0, 60)}`);
      }
    }

    await prisma.ingestRun.create({
      data: {
        source: "uqn", runType: "ingest", finishedAt: new Date(),
        captured, classified, inserted, raised, notes: notes.slice(0, 50).join(" | "),
      },
    });
    return NextResponse.json({ ok: true, captured, classified, inserted, raised, ms: Date.now() - started });
  } catch (e) {
    await prisma.ingestRun.create({
      data: { source: "uqn", runType: "ingest", finishedAt: new Date(), captured, classified, inserted, raised, notes: `ERROR: ${(e as Error).message}` },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
