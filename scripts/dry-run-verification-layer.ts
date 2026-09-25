/**
 * أرقام تجريبية فقط. لا INSERT ولا UPDATE ولا DELETE.
 * التشغيل: DATABASE_URL=... npx tsx scripts/dry-run-verification-layer.ts
 */
import { PrismaClient } from "@prisma/client";
import { classifyEffectText } from "../lib/modules/legal-core/effect-classifier";

const prisma = new PrismaClient();

async function main() {
  const one = async (sql: string) => {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql);
    const row = rows[0] ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = typeof v === "bigint" ? Number(v) : v;
    return out;
  };
  const many = async (sql: string) => {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql);
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) out[k] = typeof v === "bigint" ? Number(v) : v;
      return out;
    });
  };

  const population = await one(`
    SELECT
      (SELECT count(*) FROM legal_articles) AS articles,
      (SELECT count(*) FROM legal_articles WHERE status = 'سارية') AS marked_in_force,
      (SELECT count(*) FROM legal_articles WHERE status = 'ملغاة') AS marked_repealed,
      (SELECT count(*) FROM uqn_stage.effect) AS effects
  `);

  const repealedWithout = await many(`
    SELECT a."lawName" AS law, a."articleNumber" AS article
    FROM legal_articles a
    WHERE a.status = 'ملغاة'
      AND NOT EXISTS (
        SELECT 1 FROM article_amendments m
        WHERE m."articleId" = a.id AND COALESCE(m."decreeRef", '') <> ''
      )
    ORDER BY a."lawName", a."articleNumber"
  `);

  const repealed = await one(`
    SELECT
      count(*) AS repealed,
      count(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM article_amendments m
          WHERE m."articleId" = a.id AND COALESCE(m."decreeRef", '') <> ''
        )
      ) AS with_amendment_instrument,
      count(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM article_amendments m
          WHERE m."articleId" = a.id AND COALESCE(m."decreeRef", '') <> ''
        )
      ) AS repealed_without_instrument
    FROM legal_articles a
    WHERE a.status = 'ملغاة'
  `);

  const sample = await one(`
    WITH sample AS (
      SELECT id, "lawName", "articleNumber", content
      FROM legal_articles
      WHERE status = 'سارية'
      ORDER BY md5(id || 'verify-sample-200')
      LIMIT 200
    )
    SELECT
      count(*) AS sample_n,
      count(*) FILTER (WHERE u.body IS NOT NULL) AS compared_to_uqn,
      count(*) FILTER (WHERE u.body IS NOT NULL AND s.content = u.body) AS same_text,
      count(*) FILTER (WHERE u.body IS NOT NULL AND s.content IS DISTINCT FROM u.body) AS different_text
    FROM sample s
    LEFT JOIN LATERAL (
      SELECT un.body
      FROM uqn_stage.unit un
      JOIN uqn_stage.work w ON w.source_id = un.source_id AND w.batch_id = un.batch_id
      WHERE w.title = s."lawName" AND un.number::text = s."articleNumber"::text
      LIMIT 1
    ) u ON true
  `);

  const effectRows = await prisma.$queryRawUnsafe<Array<{ operative_text: string; effect_type: string; target_match_status: string }>>(
    `SELECT operative_text, effect_type, target_match_status FROM uqn_stage.effect`,
  );
  const formulas: Record<string, number> = {};
  let blanketOnly = 0;
  for (const row of effectRows) {
    const c = classifyEffectText(row.operative_text ?? "");
    formulas[c.formula] = (formulas[c.formula] ?? 0) + 1;
    if (c.blanketConflictClause && c.formula !== "إلغاء") blanketOnly += 1;
  }

  const unlinked = await many(`
    SELECT target_title_as_cited AS title, source_url, instrument_no, instrument_date_hijri, effect_type
    FROM uqn_stage.effect
    WHERE effect_type = 'amend' AND target_match_status = 'غير موجود'
    ORDER BY target_title_as_cited
  `);

  const excluded = await many(`
    SELECT title, source_url, parse_status
    FROM uqn_stage.work w
    WHERE NOT EXISTS (SELECT 1 FROM legal_systems s WHERE s.name = w.title)
    ORDER BY parse_status, title
  `);

  const vectors = await one(`
    SELECT
      (SELECT count(*) FROM legal_articles a WHERE NOT EXISTS (
        SELECT 1 FROM embeddings e WHERE e.owner_type = 'article' AND e.owner_id = a.id)) AS articles_missing,
      (SELECT coalesce(sum(length(content)), 0) FROM legal_articles a WHERE NOT EXISTS (
        SELECT 1 FROM embeddings e WHERE e.owner_type = 'article' AND e.owner_id = a.id)) AS article_chars,
      (SELECT count(*) FROM judicial_cases j WHERE NOT EXISTS (
        SELECT 1 FROM embeddings e WHERE e.owner_type = 'ruling' AND e.owner_id = j.id)) AS rulings_missing,
      (SELECT coalesce(sum(length("judgmentText")), 0) FROM judicial_cases j WHERE NOT EXISTS (
        SELECT 1 FROM embeddings e WHERE e.owner_type = 'ruling' AND e.owner_id = j.id)) AS ruling_chars,
      (SELECT count(*) FROM embeddings WHERE owner_type = 'principle' AND (content_hash IS NULL OR content_hash = '')) AS principles_null_hash,
      (SELECT coalesce(sum(length("principleText")), 0) FROM judicial_principles p WHERE EXISTS (
        SELECT 1 FROM embeddings e WHERE e.owner_type = 'principle' AND e.owner_id = p.id
          AND (e.content_hash IS NULL OR e.content_hash = ''))) AS principle_chars
  `);

  const chars = Number(vectors.article_chars) + Number(vectors.ruling_chars) + Number(vectors.principle_chars);
  const usdPerMillion = 0.02;
  const report = {
    writes: { update: 0, delete: 0, insert: 0 },
    population,
    repealed,
    repealed_without_instrument: repealedWithout,
    sample,
    sample_error_rate: Number(sample.compared_to_uqn) > 0
      ? Number(sample.different_text) / Number(sample.compared_to_uqn)
      : null,
    effect_formulas: formulas,
    blanket_conflict_not_counted_as_repeal: blanketOnly,
    unlinked_amendments: unlinked,
    excluded_works: excluded,
    vectors: {
      ...vectors,
      model: "text-embedding-3-small",
      dims: 1536,
      fingerprint: "sha256(text + newline + model)",
      token_estimate_low: Math.round(chars / 4),
      token_estimate_high: Math.round(chars / 2),
      usd_low: Number(((chars / 4) / 1_000_000 * usdPerMillion).toFixed(2)),
      usd_high: Number(((chars / 2) / 1_000_000 * usdPerMillion).toFixed(2)),
      price_note: "تقدير على سعر text-embedding-3-small المنشور 0.02 دولار لكل مليون رمز. لم يُشغَّل التضمين.",
    },
  };
  console.log(JSON.stringify(report, null, 2));
  const compared = Number(sample.compared_to_uqn);
  const differ = Number(sample.different_text);
  if (compared > 0 && differ / compared > 0.01) {
    console.error("STOP sample error above 1%");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "failed");
  process.exit(1);
}).finally(() => prisma.$disconnect());
