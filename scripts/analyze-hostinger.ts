/**
 * محلّل الاستشهادات المباشر لقاعدة Hostinger MySQL (جدول ahkam_moj).
 * يتصل بـ HOSTINGER_DB_URL، يكتشف عمود نص الحكم تلقائياً، يستخرج الاستشهادات
 * من كل حكم عبر المستخرج الشامل، ويطبع تقرير الأنماط.
 *
 * التشغيل: npm run analyze:hostinger            (عيّنة ~200 حكم)
 *          npm run analyze:hostinger -- --all   (كل الأحكام)
 */
import mysql from "mysql2/promise";
import { extractAllCitations, type Citation } from "./citation-extractor";

const TABLE = process.env.HOSTINGER_TABLE || "ahkam_moj";
const SCOPE: "all" | "sample" = process.argv.includes("--all") ? "all" : "sample";
const SAMPLE_SIZE = 200;
const BATCH = 500;

function connectUrl(): string {
  const url = process.env.HOSTINGER_DB_URL;
  if (!url) throw new Error("HOSTINGER_DB_URL غير مضبوط (سرّ الاتصال بقاعدة Hostinger).");
  return url;
}

// اختيار عمود نص الحكم: تفضيل الأسماء المعروفة ثم أطول عمود نصّي
function pickTextColumn(cols: Array<{ COLUMN_NAME: string; DATA_TYPE: string }>): string {
  const preferred = ["judgment_text", "judgment", "text", "body", "content", "نص_الحكم", "details"];
  const byName = cols.find((c) => preferred.includes(c.COLUMN_NAME.toLowerCase()));
  if (byName) return byName.COLUMN_NAME;
  const textTypes = ["longtext", "mediumtext", "text", "varchar"];
  const textCols = cols.filter((c) => textTypes.includes(c.DATA_TYPE.toLowerCase()));
  // رجّح الأنواع الأكبر
  const order = (t: string) => textTypes.indexOf(t.toLowerCase());
  textCols.sort((a, b) => order(a.DATA_TYPE) - order(b.DATA_TYPE));
  if (textCols[0]) return textCols[0].COLUMN_NAME;
  throw new Error("تعذّر تحديد عمود نص الحكم.");
}

async function main() {
  console.log("🚀 تحليل أحكام Hostinger");
  console.log("=".repeat(50));
  const conn = await mysql.createConnection(connectUrl());

  // ١. أعمدة الجدول
  const [colRows] = await conn.query(
    `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION`,
    [TABLE]
  );
  const cols = colRows as Array<{ COLUMN_NAME: string; DATA_TYPE: string }>;
  if (cols.length === 0) throw new Error(`الجدول ${TABLE} غير موجود.`);
  console.log(`\n📋 أعمدة ${TABLE}: ${cols.map((c) => c.COLUMN_NAME).join(", ")}`);

  const textCol = pickTextColumn(cols);
  const hasId = cols.some((c) => c.COLUMN_NAME.toLowerCase() === "id");
  console.log(`📝 عمود نص الحكم المعتمد: ${textCol}`);

  // ٢. العدد الإجمالي
  const [cntRows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${TABLE}\``);
  const total = Number((cntRows as Array<{ c: number }>)[0].c);
  const target = SCOPE === "all" ? total : Math.min(SAMPLE_SIZE, total);
  console.log(`📊 إجمالي الأحكام: ${total} — سيُحلَّل: ${target} (${SCOPE})`);

  // ٣. المعالجة على دفعات
  const stats = {
    judgmentsProcessed: 0,
    judgmentsWithCitations: 0,
    totalCitations: 0,
    bySystem: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    topArticles: {} as Record<string, number>,
    withArticleNumber: 0,
  };

  let processed = 0;
  let cursor = 0;
  while (processed < target) {
    const take = Math.min(BATCH, target - processed);
    const order = hasId ? "ORDER BY id" : "";
    const where = hasId ? `WHERE id > ${cursor}` : "";
    const [rows] = await conn.query(
      `SELECT ${hasId ? "id, " : ""}\`${textCol}\` AS body FROM \`${TABLE}\` ${where} ${order} LIMIT ${take}`
    );
    const batch = rows as Array<{ id?: number; body: string | null }>;
    if (batch.length === 0) break;
    if (hasId) cursor = Number(batch[batch.length - 1].id);

    for (const r of batch) {
      processed++;
      const text = r.body || "";
      if (text.length < 20) continue;
      const cits: Citation[] = extractAllCitations(text);
      if (cits.length > 0) stats.judgmentsWithCitations++;
      for (const c of cits) {
        stats.totalCitations++;
        if (c.articleNumber) stats.withArticleNumber++;
        stats.bySystem[c.systemName] = (stats.bySystem[c.systemName] || 0) + 1;
        stats.byType[c.extractedBy] = (stats.byType[c.extractedBy] || 0) + 1;
        const key = `${c.systemName} م/${c.articleNumber ?? "—"}`;
        stats.topArticles[key] = (stats.topArticles[key] || 0) + 1;
      }
    }
    stats.judgmentsProcessed = processed;
    process.stdout.write(`\r  عولج ${processed}/${target}...`);
    if (!hasId) break; // بلا مفتاح ترتيب لا نُكمل بأمان
  }

  await conn.end();

  // ٤. التقرير
  console.log("\n\n=== نتائج التحليل ===");
  console.log(`أحكام معالَجة: ${stats.judgmentsProcessed}`);
  console.log(`أحكام فيها استشهادات: ${stats.judgmentsWithCitations}`);
  console.log(`إجمالي الاستشهادات: ${stats.totalCitations} (منها ${stats.withArticleNumber} برقم مادة)`);
  const top = (obj: Record<string, number>, n: number) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
  console.log("\nأكثر الأنظمة استشهاداً:");
  top(stats.bySystem, 10).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)} — ${k}`));
  console.log("\nتوزيع طرق الاستخراج:");
  top(stats.byType, 10).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)} — ${k}`));
  console.log("\nأكثر المواد استشهاداً:");
  top(stats.topArticles, 20).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)} — ${k}`));
  console.log("\n✅ اكتمل التحليل.");
}

main().catch((e) => {
  console.error("\n❌ فشل التحليل:", e instanceof Error ? e.message : e);
  process.exit(1);
});
