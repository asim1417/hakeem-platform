/**
 * live-snapshot.ts — جرد قراءة فقط لقاعدة التشغيل القانونية.
 *
 * لا يكتب أي صف، ولا يشغّل هجرات، ولا يستدعي /api/health (لأنها قد تُهيّئ مخططاً).
 * يتطلب DATABASE_URL يشير إلى قاعدة يُراد جردها. يطبع بصمة غير سرية للمضيف/القاعدة.
 *
 * التشغيل:
 *   npx tsx scripts/audit/live-snapshot.ts
 *   npx tsx scripts/audit/live-snapshot.ts --out=reports/live-snapshot.json
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

type CountRow = { n: bigint | number };

async function countSafe(label: string, fn: () => Promise<number>): Promise<{ label: string; count: number | null; error?: string }> {
  try {
    return { label, count: await fn() };
  } catch (e) {
    return { label, count: null, error: e instanceof Error ? e.message.split("\n")[0].slice(0, 180) : "unknown" };
  }
}

function redactDatabaseUrl(raw: string | undefined): {
  present: boolean;
  protocol?: string;
  hostFingerprint?: string;
  hostLabel?: string;
  database?: string;
  providerGuess?: string;
} {
  if (!raw) return { present: false };
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const hostFingerprint = createHash("sha256").update(host).digest("hex").slice(0, 16);
    let providerGuess = "unknown";
    if (host.includes("neon.tech")) providerGuess = "neon";
    else if (host.includes("supabase")) providerGuess = "supabase";
    else if (host.includes("amazonaws.com")) providerGuess = "aws-rds-or-similar";
    return {
      present: true,
      protocol: u.protocol.replace(":", ""),
      hostFingerprint,
      hostLabel: host.replace(/^ep-[^.]+\./, "ep-<id>.").replace(/^[^.]+\./, "<branch-or-endpoint>."),
      database: u.pathname.replace(/^\//, "").split("?")[0] || undefined,
      providerGuess,
    };
  } catch {
    return { present: true, providerGuess: "unparseable" };
  }
}

async function serverIdentity(): Promise<Record<string, unknown>> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        db: string;
        usr: string;
        server_addr: string | null;
        server_port: number | null;
        pg_version: string;
      }>
    >(`SELECT current_database() AS db,
              current_user AS usr,
              inet_server_addr()::text AS server_addr,
              inet_server_port() AS server_port,
              version() AS pg_version`);
    const r = rows[0];
    if (!r) return { ok: false };
    return {
      ok: true,
      database: r.db,
      user: r.usr,
      serverAddrPresent: Boolean(r.server_addr),
      serverPort: r.server_port,
      pgVersionMajor: (r.pg_version.match(/PostgreSQL\s+(\d+)/) || [])[1] || null,
      // بصمة غير سرية لعنوان الخادم إن وُجد
      serverAddrFingerprint: r.server_addr
        ? createHash("sha256").update(r.server_addr).digest("hex").slice(0, 16)
        : null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.split("\n")[0].slice(0, 180) : "unknown" };
  }
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      name
    );
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

async function main() {
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const outPath = outArg?.slice("--out=".length);

  const connection = redactDatabaseUrl(process.env.DATABASE_URL || process.env.DIRECT_URL);
  if (!connection.present) {
    console.error("✗ لا DATABASE_URL/DIRECT_URL — توقف دون اتصال.");
    process.exit(2);
  }

  const identity = await serverIdentity();

  const tables = [
    "legal_systems",
    "legal_articles",
    "article_versions",
    "article_amendments",
    "embeddings",
    "legal_article_case_links",
    "legal_relations",
    "judicial_cases",
    "legal_documents",
    "document_units",
    "document_relations",
    "ingest_runs",
  ];

  const tablePresence: Record<string, boolean> = {};
  for (const t of tables) tablePresence[t] = await tableExists(t);

  const counts = await Promise.all([
    countSafe("legal_systems", () => prisma.legalSystem.count()),
    countSafe("legal_articles", () => prisma.legalArticle.count()),
    countSafe("legal_articles_preamble0", () =>
      prisma.legalArticle.count({ where: { articleNumber: 0 } })
    ),
    countSafe("legal_articles_positive", () =>
      prisma.legalArticle.count({ where: { articleNumber: { gt: 0 } } })
    ),
    countSafe("judicial_cases", () => prisma.judicialCase.count()),
    countSafe("legal_relations", () => prisma.legalRelation.count()),
    countSafe("legal_article_case_links", () => prisma.legalArticleCaseLink.count()),
    countSafe("embeddings", async () => {
      if (!tablePresence.embeddings) return 0;
      const rows = await prisma.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*)::bigint AS n FROM embeddings`);
      return Number(rows[0]?.n ?? 0);
    }),
    countSafe("embeddings_with_content_hash", async () => {
      if (!tablePresence.embeddings) return 0;
      const rows = await prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::bigint AS n FROM embeddings WHERE content_hash IS NOT NULL AND content_hash <> ''`
      );
      return Number(rows[0]?.n ?? 0);
    }),
    countSafe("legal_documents", async () => {
      if (!tablePresence.legal_documents) return 0;
      return prisma.legalDocument.count();
    }),
    countSafe("document_units", async () => {
      if (!tablePresence.document_units) return 0;
      return prisma.documentUnit.count();
    }),
  ]);

  // عيّنة انزياح المعاملات المدنية — قراءة فقط (lawName هو مفتاح المواد الفعلي)
  const madani = await prisma.legalSystem
    .findFirst({
      where: { name: { contains: "المعاملات المدنية" } },
      select: { id: true, name: true },
    })
    .catch(() => null);

  let madaniProbe: Record<string, unknown> | null = null;
  const madaniLawName = madani?.name || "نظام المعاملات المدنية";
  {
    const nums = [237, 238, 465, 466, 468, 469, 474, 475, 720, 721];
    const rows = await prisma.legalArticle
      .findMany({
        where: { lawName: madaniLawName, articleNumber: { in: nums } },
        select: { id: true, articleNumber: true, title: true, content: true },
        orderBy: { articleNumber: "asc" },
      })
      .catch(() => []);
    madaniProbe = {
      systemId: madani?.id ?? null,
      systemName: madaniLawName,
      articleTotal: await prisma.legalArticle
        .count({ where: { lawName: madaniLawName } })
        .catch(() => null),
      preamble0: await prisma.legalArticle
        .findFirst({
          where: { lawName: madaniLawName, articleNumber: 0 },
          select: { id: true, title: true },
        })
        .catch(() => null),
      rows: rows.map((r) => ({
        id: r.id,
        articleNumber: r.articleNumber,
        title: (r.title || "").slice(0, 120),
        contentHead: (r.content || "").slice(0, 160),
        contentSha256: createHash("sha256")
          .update(r.content || "")
          .digest("hex"),
      })),
    };
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY",
    connection,
    identity,
    tablePresence,
    counts: Object.fromEntries(counts.map((c) => [c.label, c])),
    madaniProbe,
    notes: [
      "هذا الجرد لا يثبت بمفرده أن القاعدة هي runtime الإنتاج؛ قارن hostFingerprint/providerGuess مع Vercel runtime.",
      "لا تستخدم /api/health كفحص قراءة فقط — قد يهيّئ مخطط محرك الجلسات.",
      "legal_articles_export.json في المستودع (1981) يشير تاريخياً إلى قاعدة صغيرة مختلفة عن Neon.",
    ],
  };

  const text = JSON.stringify(snapshot, null, 2) + "\n";
  if (outPath) {
    writeFileSync(outPath, text, "utf8");
    console.log(`✓ كُتب ${outPath}`);
  }
  console.log(text);
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
