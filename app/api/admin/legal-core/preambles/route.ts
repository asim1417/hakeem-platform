// /api/admin/legal-core/preambles — أقوى حلٍّ للديباجات: تحقّقٌ واستيرادٌ من المنصّة نفسها
// (حيث توجد قاعدة النواة)، دون سكربتاتٍ محليّة ولا هجرة سكيمة.
//
//  GET  ?system=المعاملات المدنية   → هل النظام موجود؟ وله ديباجة؟ ومُضمَّنة/مفهرسة؟ (تحقّق)
//  POST { lawName, preamble, royalDecree?, effectiveFrom? }
//       → يخزّن الديباجة مادّةً رقم صفر + يولّد متجهها (بحث دلاليّ) + يملأ فهرس البحث المعجميّ — دفعةً واحدة.
//
// صلاحية LEGAL_CORE_ADMIN + تسجيل تدقيق. لا يخترع نصًّا — النصّ يأتي من المشرف/المصدر الرسميّ.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { embedText, buildEmbeddingText, EMBEDDING_MODEL } from "@/lib/modules/ai/embeddings";
import { buildVectorLiteral } from "@/lib/modules/legal-search/embedding-fallback";
import { reindexSearchNorm } from "@/lib/modules/legal-core/reindex";
import { PREAMBLE_ARTICLE_NUMBER, PREAMBLE_TITLE } from "@/lib/modules/legal-core/article-ref";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PREAMBLE = 200_000;

/** أيّ من معرّفات المواد لها متجهٌ في جدول embeddings؟ */
async function embeddedIds(articleIds: string[]): Promise<Set<string>> {
  if (!articleIds.length) return new Set();
  const rows = await prisma.$queryRawUnsafe<Array<{ owner_id: string }>>(
    `SELECT "owner_id" FROM "embeddings" WHERE "owner_type" = 'article' AND "owner_id" = ANY($1::text[])`,
    articleIds
  ).catch(() => [] as Array<{ owner_id: string }>);
  return new Set(rows.map((r) => r.owner_id));
}

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_ADMIN", request);
  if (gate.response) return gate.response;

  const q = (request.nextUrl.searchParams.get("system") ?? request.nextUrl.searchParams.get("q") ?? "").trim();

  // تحقّق نظامٍ بعينه: مطابقةٌ حرفيّة ثمّ احتواء (اقتراحات إن لم تُطابق).
  const systems = q
    ? await prisma.legalSystem.findMany({
        where: { OR: [{ name: q }, { name: { contains: q, mode: "insensitive" } }] },
        select: { id: true, name: true },
        take: 20,
        orderBy: { name: "asc" },
      })
    : await prisma.legalSystem.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  const names = systems.map((s) => s.name);
  const preambles = await prisma.legalArticle.findMany({
    where: { lawName: { in: names }, articleNumber: PREAMBLE_ARTICLE_NUMBER },
    select: { id: true, lawName: true, content: true },
  });
  const byLaw = new Map(preambles.map((p) => [p.lawName, p]));
  const embedded = await embeddedIds(preambles.map((p) => p.id));

  const report = systems.map((s) => {
    const p = byLaw.get(s.name);
    return {
      system: s.name,
      systemId: s.id,
      exists: true,
      hasPreamble: Boolean(p),
      preambleChars: p ? p.content.length : 0,
      embedded: p ? embedded.has(p.id) : false,
      articleId: p?.id,
    };
  });

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
    // اقتراحاتٌ بالاحتواء كي يختار المشرف الاسم الصحيح (تحقّق وجود النظام).
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
  const data = {
    legalSystemId: system.id,
    classification: system.classification ?? undefined,
    title: PREAMBLE_TITLE,
    content: preamble,
    status: "سارية",
    royalDecree: body.royalDecree?.trim() || undefined,
    effectiveFrom: effective && !Number.isNaN(effective.getTime()) ? effective : undefined,
  };

  // ① التخزين: الديباجة مادّةً رقم صفر (idempotent).
  const article = await prisma.legalArticle.upsert({
    where: { lawName_articleNumber: { lawName, articleNumber: PREAMBLE_ARTICLE_NUMBER } },
    update: data,
    create: { lawName, articleNumber: PREAMBLE_ARTICLE_NUMBER, ...data },
    select: { id: true },
  });

  // ② التضمين الدلاليّ: نولّد المتجه ونحفظه في جدول embeddings (بحثٌ دلاليّ فوريّ).
  let embedded = false;
  try {
    const vec = await embedText(buildEmbeddingText({ systemName: lawName, title: PREAMBLE_TITLE, content: preamble }));
    if (vec && vec.length) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "embeddings" ("id","owner_type","owner_id","embedding","model","created_at")
         VALUES (gen_random_uuid()::text, 'article', $1, $2::vector, $3, now())
         ON CONFLICT ("owner_type","owner_id")
         DO UPDATE SET "embedding" = EXCLUDED."embedding", "model" = EXCLUDED."model"`,
        article.id, buildVectorLiteral(vec), EMBEDDING_MODEL
      );
      embedded = true;
    }
  } catch { /* التضمين أفضل-جهد: الديباجة تبقى قابلةً للبحث المعجميّ */ }

  // ③ الفهرس المعجميّ: نملأ search_norm للمواد الفارغة (منها الديباجة الجديدة).
  const reindex = await reindexSearchNorm(false).catch(() => ({ scanned: 0, updated: 0, total: 0 }));

  await auditEvent({
    actorId: gate.user?.id, subject: "ADMIN", action: "LEGAL_CORE_PREAMBLE_IMPORTED",
    metadata: { lawName, articleId: article.id, chars: preamble.length, embedded },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    system: lawName,
    articleId: article.id,
    chars: preamble.length,
    embedded,
    lexicalIndexed: reindex.updated > 0 || reindex.total > 0,
    message: embedded
      ? `حُفِظت ديباجة «${lawName}» وأصبحت قابلةً للبحث الدلاليّ والمعجميّ (${preamble.length.toLocaleString("ar-SA")} حرفًا).`
      : `حُفِظت ديباجة «${lawName}» وفُهرِست معجميًّا. تعذّر توليد المتجه (تحقّق من مفتاح التضمين) — يبقى البحث المعجميّ عاملًا.`,
  });
}
