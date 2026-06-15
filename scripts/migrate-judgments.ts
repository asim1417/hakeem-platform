/**
 * ترحيل الأحكام من قاعدة Hostinger MySQL (جدول ahkam_moj) إلى قاعدة منصّة
 * حكيم على Supabase (جدول judicial_cases) عبر Prisma.
 *
 * يتطلّب: DATABASE_URL (Supabase) + HOSTINGER_DB_URL (MySQL).
 * التشغيل: npm run migrate:judgments            (عيّنة ~200)
 *          npm run migrate:judgments -- --all   (الكل)
 * آمن للتكرار: createMany مع skipDuplicates على sourceId الفريد.
 */
import mysql from "mysql2/promise";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const TABLE = process.env.HOSTINGER_TABLE || "ahkam_moj";
const SCOPE: "all" | "sample" = process.argv.includes("--all") ? "all" : "sample";
const SAMPLE_SIZE = 200;
const BATCH = 500;

type Row = {
  id: number;
  id_page: number | null;
  decision_no: string | null;
  case_no: string | null;
  court_of_appeal: string | null;
  city_of_appeal: string | null;
  court: string | null;
  city_name: string | null;
  decision_date: string | null;
  case_date: string | null;
  classification: string | null;
  judgment_title: string | null;
  judgment_text: string | null;
  appeal_text: string | null;
  link: string | null;
  decision_date_search: Date | string | null;
  case_date_search: Date | string | null;
};

function toDate(v: Date | string | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function mapRow(r: Row): Prisma.JudicialCaseCreateManyInput | null {
  const judgmentText = (r.judgment_text || "").trim();
  if (judgmentText.length < 20) return null; // تجاهل الأحكام بلا نص
  return {
    sourceId: r.id ?? null,
    sourcePageId: r.id_page ?? null,
    decisionNo: r.decision_no ?? null,
    caseNo: r.case_no ?? null,
    courtOfAppeal: r.court_of_appeal ?? null,
    cityOfAppeal: r.city_of_appeal ?? null,
    court: r.court ?? null,
    cityName: r.city_name ?? null,
    decisionDateText: r.decision_date ?? null,
    caseDateText: r.case_date ?? null,
    decisionDate: toDate(r.decision_date_search),
    caseDate: toDate(r.case_date_search),
    classification: r.classification ? { raw: r.classification } : Prisma.JsonNull,
    judgmentTitle: r.judgment_title ?? null,
    judgmentText,
    appealText: r.appeal_text ?? null,
    sourceLink: r.link ?? null,
    source: "ahkam_moj",
    reviewStatus: "needs_review",
  };
}

async function main() {
  if (!process.env.HOSTINGER_DB_URL) throw new Error("HOSTINGER_DB_URL غير مضبوط.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL غير مضبوط.");

  console.log("🚚 ترحيل الأحكام: Hostinger → Supabase");
  console.log("=".repeat(50));
  const my = await mysql.createConnection(process.env.HOSTINGER_DB_URL);

  const [cntRows] = await my.query(`SELECT COUNT(*) AS c FROM \`${TABLE}\``);
  const total = Number((cntRows as Array<{ c: number }>)[0].c);
  const target = SCOPE === "all" ? total : Math.min(SAMPLE_SIZE, total);
  console.log(`المصدر: ${total} حكم — سيُرحَّل: ${target} (${SCOPE})`);

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let cursor = 0;

  while (processed < target) {
    const take = Math.min(BATCH, target - processed);
    const [rows] = await my.query(
      `SELECT id, id_page, decision_no, case_no, court_of_appeal, city_of_appeal, court,
              city_name, decision_date, case_date, classification, judgment_title,
              judgment_text, appeal_text, link, decision_date_search, case_date_search
       FROM \`${TABLE}\` WHERE id > ${cursor} ORDER BY id LIMIT ${take}`
    );
    const batch = rows as Row[];
    if (batch.length === 0) break;
    cursor = Number(batch[batch.length - 1].id);
    processed += batch.length;

    const data = batch.map(mapRow).filter((x): x is Prisma.JudicialCaseCreateManyInput => x !== null);
    skipped += batch.length - data.length;
    if (data.length > 0) {
      const res = await prisma.judicialCase.createMany({ data, skipDuplicates: true });
      migrated += res.count;
    }
    process.stdout.write(`\r  عولج ${processed}/${target} — أُدخل ${migrated}، تُخطّي ${skipped}...`);
  }

  await my.end();
  const dbCount = await prisma.judicialCase.count();
  await prisma.$disconnect();

  console.log(`\n\n✅ اكتمل الترحيل.`);
  console.log(`  أُدخل في هذه الجولة: ${migrated}`);
  console.log(`  تُخطّي (مكرّر/بلا نص): ${skipped}`);
  console.log(`  إجمالي الأحكام الآن في judicial_cases: ${dbCount}`);
}

main().catch((e) => {
  console.error("\n❌ فشل الترحيل:", e instanceof Error ? e.message : e);
  process.exit(1);
});
