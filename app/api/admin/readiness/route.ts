import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { prisma } from "@/lib/prisma";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { getAiStatus } from "@/lib/modules/ai/ai-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/readiness — لوحة جاهزيّة القاعدة والميزات (للمالك فقط، بلا أسرار).
 *
 * تُجيب بنظرة: هل تقوّت القاعدة؟ هل جداول/أعمدة البحث والمتجهات والتعديلات موجودة ومملوءة؟
 * ما وضع المصادقة والذكاء والأعلام؟ — فيُتحقَّق قبل تشغيل أزرار Neon وبعده (رصد الفرق).
 * كل قراءة معزولة بـ try/catch: غياب جدول/عمود ⇒ "unavailable"، لا يكسر الاستجابة.
 */

async function scalar(sql: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(sql);
    const v = rows?.[0]?.n;
    return v === undefined || v === null ? null : Number(v);
  } catch {
    return null;
  }
}

/** تغطية عمودٍ نصّيّ مفهرَس: {total, filled, pct} أو null إن غاب الجدول/العمود. */
async function coverage(table: string, col: string): Promise<{ total: number; filled: number; pct: number } | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint; filled: bigint }>>(
      `SELECT count(*)::bigint AS total,
              count(*) FILTER (WHERE "${col}" IS NOT NULL AND length("${col}") > 0)::bigint AS filled
       FROM "${table}"`
    );
    const total = Number(rows?.[0]?.total ?? 0);
    const filled = Number(rows?.[0]?.filled ?? 0);
    return { total, filled, pct: total ? Math.round((filled / total) * 1000) / 10 : 0 };
  } catch {
    return null; // العمود غير مطبَّق بعد (الهجرة لم تُشغَّل)
  }
}

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  // ── القاعدة حيّة؟ ──
  let database: "up" | "down" = "down";
  try { await prisma.$queryRaw`SELECT 1`; database = "up"; } catch { database = "down"; }

  // ── جرد البيانات (تقوية القاعدة) ──
  const data = {
    legalSystems: await scalar(`SELECT count(*)::bigint AS n FROM "legal_systems"`),
    legalArticles: await scalar(`SELECT count(*)::bigint AS n FROM "legal_articles"`),
    judicialCases: await scalar(`SELECT count(*)::bigint AS n FROM "judicial_cases"`),
    articleAmendments: await scalar(`SELECT count(*)::bigint AS n FROM "article_amendments"`),
    legalRelations: await scalar(`SELECT count(*)::bigint AS n FROM "legal_relations"`),
  };

  // ── جاهزيّة البحث (هل شُغّلت أزرار الفهرسة؟) ──
  const search = {
    articlesSearchNorm: await coverage("legal_articles", "search_norm"),
    rulingsSearchNorm: await coverage("judicial_cases", "search_norm"), // null = هجرة #638 لم تُشغَّل بعد
  };

  // ── تغطية المتجهات حسب النوع (هل جدول embeddings موجود ومملوء؟) ──
  let embeddings: Record<string, number> | "unavailable" = "unavailable";
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ owner_type: string; n: bigint }>>(
      `SELECT owner_type, count(*)::bigint AS n FROM "embeddings" GROUP BY owner_type`
    );
    embeddings = Object.fromEntries(rows.map((r) => [r.owner_type, Number(r.n)]));
  } catch {
    embeddings = "unavailable"; // جدول pgvector غير منشور على هذه القاعدة
  }

  // ── التعديلات: هل شُغّل المُستخرِج؟ (حسب المصدر والمراجعة) ──
  let amendments: { bySource: Record<string, number>; needsReview: number | null } | "unavailable" = "unavailable";
  try {
    const bySrc = await prisma.$queryRawUnsafe<Array<{ source: string; n: bigint }>>(
      `SELECT source, count(*)::bigint AS n FROM "article_amendments" GROUP BY source`
    );
    amendments = {
      bySource: Object.fromEntries(bySrc.map((r) => [r.source, Number(r.n)])),
      needsReview: await scalar(`SELECT count(*)::bigint AS n FROM "article_amendments" WHERE "reviewStatus" = 'needs_review'`),
    };
  } catch {
    amendments = "unavailable";
  }

  // ── وضع المصادقة (تحصين #639) ──
  const prod = process.env.NODE_ENV === "production";
  const clerk = isClerkConfigured();
  const requireAuthFlag = (process.env.REQUIRE_AUTH ?? "").toLowerCase();
  const allowGuest = (process.env.ALLOW_INSECURE_GUEST ?? "").toLowerCase();
  const auth = {
    clerkConfigured: clerk,
    authSecretSet: Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
    // فشلٌ مغلق: في الإنتاج المصادقة مطلوبة ما لم يُفتح الضيف صراحةً.
    authRequired: clerk || ["true", "1", "on"].includes(requireAuthFlag) || (prod && !["1", "true", "on"].includes(allowGuest)),
    insecureGuestOpen: !clerk && (prod ? ["1", "true", "on"].includes(allowGuest) : true),
  };

  // ── الذكاء ──
  const aiStatus = await getAiStatus().catch(() => null);
  const ai = {
    provider: aiStatus?.provider ?? "unknown",
    configured: aiStatus?.configured ?? false,
    enforceClaudeOnly: ["1", "true", "on"].includes((process.env.ENFORCE_CLAUDE_ONLY ?? "").toLowerCase()),
    webhookSecretSet: Boolean(process.env.MOYASAR_WEBHOOK_SECRET),
  };

  return NextResponse.json({
    ok: database === "up",
    database,
    checkedAt: new Date().toISOString(),
    data,
    search,
    embeddings,
    amendments,
    auth,
    ai,
    hints: {
      rulingsSearch: search.rulingsSearchNorm ? "مُطبَّق" : "شغّل «Apply Rulings Search Index»",
      amendments: amendments === "unavailable" || (amendments.bySource.extractor ?? 0) === 0 ? "شغّل «Extract Article Amendments»" : "مُشغَّل",
      vectors: embeddings === "unavailable" ? "جدول المتجهات غير منشور — راجع سلسلة #635→#631" : "موجود",
    },
  });
}
