/**
 * backfill-rulings-search-norm.ts — يملأ judicial_cases.search_norm بنصّ عربيّ مُطبَّع
 * بعد تنقية عرض آمنة (sanitizeJudgmentDisplay): المحكمة + عنوان الحكم + متن الحكم
 * (مقصوصًا) + نصّ الاستئناف + رقم القضية/القرار + المدينة.
 *
 * لا يلمس judgmentText ولا أيّ عمودٍ آخر. idempotent: يتخطّى الصفوف المملوءة (إلا مع --all).
 *
 * تشغيل:
 *   # dry-run (قراءة فقط — بلا تأكيد):
 *   npx tsx scripts/backfill-rulings-search-norm.ts --dry-run [--all]
 *   # كتابة:
 *   CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/backfill-rulings-search-norm.ts --all
 */
import { PrismaClient } from "@prisma/client";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { sanitizeJudgmentDisplay } from "@/lib/modules/legal-core/display-text";

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
  search_norm: string | null;
  has: boolean;
};

/** يبني search_norm: تنقية عرض → تطبيع عربي. لا يخزّن النص الأصلي. */
export function buildRulingsSearchNormRow(r: Omit<Row, "has" | "search_norm">): string {
  const raw = [
    r.court ?? "",
    sanitizeJudgmentDisplay(r.judgmentTitle),
    sanitizeJudgmentDisplay((r.judgmentText ?? "").slice(0, TEXT_CAP)),
    sanitizeJudgmentDisplay((r.appealText ?? "").slice(0, TEXT_CAP)),
    r.caseNo ?? "",
    r.decisionNo ?? "",
    r.cityName ?? "",
  ].filter(Boolean).join("\n");
  return normalizeArabicText(raw);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const all = process.argv.includes("--all");
  if (!dryRun) assertAlignmentConfirmed();

  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  console.log(dryRun ? "🔎 DRY-RUN — لا كتابة" : "🛠️ APPLY — تحديث search_norm فقط");
  console.log(all ? "نطاق: إعادة بناء الكل" : "نطاق: الناقص فقط");

  let cursor = "";
  let scanned = 0;
  let updated = 0;
  let wouldChange = 0;
  let unchanged = 0;
  const sampleDiffs: Array<{ id: string; beforeTail: string; afterTail: string }> = [];

  for (;;) {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, "judgmentTitle", "judgmentText", "appealText", "caseNo", "decisionNo", "court", "cityName",
              search_norm,
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

    if (dryRun) {
      for (const r of pending) {
        const next = buildRulingsSearchNormRow(r);
        const prev = r.search_norm ?? "";
        if (next !== prev) {
          wouldChange += 1;
          if (sampleDiffs.length < 15) {
            sampleDiffs.push({
              id: r.id,
              beforeTail: prev.slice(-100),
              afterTail: next.slice(-100),
            });
          }
        } else {
          unchanged += 1;
        }
      }
    } else {
      await Promise.all(
        pending.map((r) =>
          prisma
            .$executeRawUnsafe(
              `UPDATE judicial_cases SET search_norm = $2 WHERE id = $1`,
              r.id,
              buildRulingsSearchNormRow(r),
            )
            .then(() => { updated += 1; })
            .catch(() => { /* تجاهل صفّاً فاشلاً دون كسر الدفعة */ })
        )
      );
    }

    if (scanned % 1500 === 0 || pending.length) {
      if (dryRun) {
        console.log(`… مسح ${scanned.toLocaleString("en-US")} · سيتغيّر ${wouldChange.toLocaleString("en-US")} · ثابت ${unchanged.toLocaleString("en-US")}`);
      } else {
        console.log(`… مسح ${scanned.toLocaleString("en-US")} · مُحدَّث ${updated.toLocaleString("en-US")}`);
      }
    }
  }

  if (dryRun) {
    console.log(`✓ DRY-RUN اكتمل. مسح ${scanned} · سيتغيّر ${wouldChange} · ثابت ${unchanged}`);
    if (sampleDiffs.length) {
      console.log("<BEGIN-SAMPLE-DIFFS-JSONL>");
      for (const s of sampleDiffs) console.log(JSON.stringify(s));
      console.log("<END-SAMPLE-DIFFS-JSONL>");
    }
  } else {
    const [{ total }] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total FROM judicial_cases WHERE search_norm IS NOT NULL AND length(search_norm) > 0`
    );
    console.log(`✓ اكتمل. أحكامٌ بعمود search_norm مملوء: ${Number(total).toLocaleString("en-US")} (مسح ${scanned}، مُحدَّث ${updated}).`);
    console.log("ملاحظة: لم يُمسّ عمود judgmentText.");
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
