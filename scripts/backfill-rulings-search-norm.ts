/**
 * backfill-rulings-search-norm.ts — يملأ judicial_cases.search_norm بنصّ عربيّ مُطبَّع
 * (نفس normalizeArabicText المستعمل وقت الاستعلام) يجمع: المحكمة + عنوان الحكم + متن الحكم
 * (مقصوصًا) + نصّ الاستئناف + رقم القضية/القرار + المدينة. نظير backfill-search-norm للمواد.
 *
 * لا يلمس أيّ عمودٍ آخر. idempotent: يتخطّى الصفوف المملوءة (إلا مع --all).
 * تشغيل (كتابة مقفولة — عبر workflow):
 *   CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/backfill-rulings-search-norm.ts
 *   … --all   لإعادة بناء الكلّ. لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";

const prisma = new PrismaClient();
const BATCH = 300;
// سقف متن الحكم في نصّ الفهرسة: يكفي للاستدعاء ويحدّ حجم الفهرس (المتون تبلغ مئات الآلاف).
const TEXT_CAP = 20_000;

function assertAlignmentConfirmed() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ الكتابة مقفولة. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED (الهدف Neon).");
    process.exit(1);
  }
}
function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try { return new URL(raw).hostname; } catch { return "غير صالح"; }
}

type Row = {
  id: string;
  judgmentTitle: string | null;
  judgmentText: string | null;
  appealText: string | null;
  caseNo: string | null;
  decisionNo: string | null;
  court: string | null;
  cityName: string | null;
  has: boolean;
};

function buildSearchNorm(r: Row): string {
  const raw = [
    r.court ?? "",
    r.judgmentTitle ?? "",
    (r.judgmentText ?? "").slice(0, TEXT_CAP),
    (r.appealText ?? "").slice(0, TEXT_CAP),
    r.caseNo ?? "",
    r.decisionNo ?? "",
    r.cityName ?? "",
  ].filter(Boolean).join("\n");
  return normalizeArabicText(raw);
}

async function main() {
  assertAlignmentConfirmed();
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  const all = process.argv.includes("--all");

  let cursor = "";
  let scanned = 0;
  let updated = 0;
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, "judgmentTitle", "judgmentText", "appealText", "caseNo", "decisionNo", "court", "cityName",
              (search_norm IS NOT NULL AND length(search_norm) > 0) AS has
       FROM judicial_cases
       WHERE id > $1
       ORDER BY id
       LIMIT ${BATCH}`,
      cursor
    );
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    const pending = all ? rows : rows.filter((r) => !r.has);
    await Promise.all(
      pending.map((r) =>
        prisma
          .$executeRawUnsafe(`UPDATE judicial_cases SET search_norm = $2 WHERE id = $1`, r.id, buildSearchNorm(r))
          .then(() => { updated += 1; })
          .catch(() => { /* تجاهل صفّاً فاشلاً دون كسر الدفعة */ })
      )
    );
    if (scanned % 1500 === 0 || pending.length) {
      console.log(`… مسح ${scanned.toLocaleString("en-US")} · مُحدَّث ${updated.toLocaleString("en-US")}`);
    }
  }

  const [{ total }] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
    `SELECT count(*)::bigint AS total FROM judicial_cases WHERE search_norm IS NOT NULL AND length(search_norm) > 0`
  );
  console.log(`✓ اكتمل. أحكامٌ بعمود search_norm مملوء: ${Number(total).toLocaleString("en-US")} (مسح ${scanned}، مُحدَّث ${updated}).`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
