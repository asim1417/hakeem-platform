/**
 * rebuild-civil-from-official — يعيد بناء نظام المعاملات المدنية من الالتقاط الرسمي
 * (وزارة العدل) المحفوظ في data/backfill/official/civil-madani-moj.json:
 *   • رقم كل مادة مشتقّ من عنوانها الترتيبي الرسمي (تحقّق مادةً بمادة).
 *   • يستعيد المادة 237 المفقودة، ويزيل التكرار، ويصحّح الانزياح — من نصّ رسمي.
 *   • idempotent؛ يحفظ نسخة سابقة في ArticleVersion عند تغيّر النصّ؛ يختم provenance.
 *
 * أوضاع:
 *   (افتراضي) dry-run: يتحقّق من اكتمال 1..721 ويطبع الفرق فقط.
 *   --write-export: يعيد كتابة مواد النظام في data/legal_articles_export.json.
 *   --apply-db:     يطبّق على قاعدة **staging** المشار إليها بـ DATABASE_URL.
 *
 * ⚠️ لا يُشغَّل على الإنتاج (Neon) إلا بموافقة كتابية صريحة عبر سكربت الإنتاج المنفصل.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { deriveOfficialNumber, sha256Normalized } from "../../lib/modules/legal-core/article-numbering";
import { upsertLegalArticle } from "../../lib/modules/legal-core/article-upsert";

const LAW = "نظام المعاملات المدنية";
const CAPTURE = "data/backfill/official/civil-madani-moj.json";
const EXPORT = "data/legal_articles_export.json";
const EXPECTED = 721;

const WRITE_EXPORT = process.argv.includes("--write-export");
const APPLY_DB = process.argv.includes("--apply-db");

interface OfficialArticle { ordinalTitle: string; text: string; chapter: string | null; sha256: string; }
interface Capture { system: { name: string; publisher: string; sourceUrl: string; sourceSerial: string; issuanceDateH: string | null; fetchedAt: string }; articles: OfficialArticle[]; }

function buildOfficial(cap: Capture) {
  const rows: Array<{ number: number; title: string; content: string; chapter: string | null }> = [];
  const unparsed: string[] = [];
  for (const a of cap.articles) {
    const d = deriveOfficialNumber(a.ordinalTitle);
    if (d.number === null) { unparsed.push(a.ordinalTitle); continue; }
    rows.push({ number: d.number, title: d.cleanTitle, content: a.text, chapter: a.chapter });
  }
  rows.sort((x, y) => x.number - y.number);
  return { rows, unparsed };
}

function validate(rows: Array<{ number: number }>): string[] {
  const problems: string[] = [];
  const seen = new Map<number, number>();
  for (const r of rows) seen.set(r.number, (seen.get(r.number) ?? 0) + 1);
  for (let i = 1; i <= EXPECTED; i++) if (!seen.has(i)) problems.push(`مفقودة: ${i}`);
  for (const [n, c] of seen) if (c > 1) problems.push(`مكررة: ${n}×${c}`);
  if (rows.length !== EXPECTED) problems.push(`العدد ${rows.length} ≠ ${EXPECTED}`);
  return problems;
}

async function main() {
  const cap: Capture = JSON.parse(fs.readFileSync(CAPTURE, "utf8"));
  const { rows, unparsed } = buildOfficial(cap);
  console.log(`الالتقاط الرسمي: ${cap.articles.length} مادة | مشتقّة الرقم: ${rows.length} | تعذّر: ${unparsed.length}`);
  const problems = validate(rows);
  if (problems.length) {
    console.error("❌ الالتقاط الرسمي غير مكتمل — لا يُطبَّق:");
    problems.slice(0, 20).forEach((p) => console.error("   " + p));
    process.exit(1);
  }
  console.log(`✓ الالتقاط الرسمي مكتمل: 1..${EXPECTED} بلا فجوة ولا تكرار.`);
  const has237 = rows.find((r) => r.number === 237);
  console.log(`  المادة 237: «${has237?.title}» — ${has237?.content.slice(0, 60)}…`);

  if (WRITE_EXPORT) {
    const data: any[] = JSON.parse(fs.readFileSync(EXPORT, "utf8"));
    const others = data.filter((x) => x.law_name !== LAW);
    const civil = rows.map((r) => ({ article_number: r.number, law_name: LAW, title: r.title, content: r.content, keywords: [] as string[] }));
    // أدرج مواد النظام في مكانها الأصلي تقريبًا (نهاية الملف يكفي للـseed المعتمد على upsert).
    const merged = [...others, ...civil];
    const original = fs.readFileSync(EXPORT, "utf8");
    const eol = original.includes("\r\n") ? "\r\n" : "\n";
    const trailing = original.endsWith("\r\n") ? "\r\n" : original.endsWith("\n") ? "\n" : "";
    fs.writeFileSync(EXPORT, JSON.stringify(merged, null, 2).replace(/\n/g, eol) + trailing, "utf8");
    console.log(`✓ أُعيد بناء مواد «${LAW}» في ${EXPORT} من المصدر الرسمي (${civil.length} مادة).`);
  }

  if (APPLY_DB) {
    const prisma = new PrismaClient();
    const url = process.env.DATABASE_URL || "";
    if (/neon\.tech/i.test(url)) {
      console.error("🛑 DATABASE_URL يشير إلى Neon (إنتاج). هذا السكربت لِـstaging فقط. أُلغي.");
      process.exit(2);
    }
    let created = 0, updated = 0, versioned = 0, noop = 0;
    const provenance = {
      sourceUrl: cap.system.sourceUrl,
      sourcePublisher: cap.system.publisher,
      sourcePublishedAt: null,
      sourceFetchedAt: new Date(cap.system.fetchedAt),
    };
    const system = await prisma.legalSystem.findFirst({ where: { name: LAW }, select: { id: true } });
    for (const r of rows) {
      const res = await upsertLegalArticle(prisma, {
        lawName: LAW, articleNumber: r.number, title: r.title, content: r.content,
        legalSystemId: system?.id ?? null, provenance, requestedReviewStatus: "verified",
      }, { apply: true });
      if (res.action === "created") created++;
      else if (res.action === "updated") { updated++; if (res.versioned) versioned++; }
      else noop++;
    }
    console.log(`✓ staging: created=${created} updated=${updated} (versioned=${versioned}) noop=${noop}`);
    await prisma.$disconnect();
  }

  if (!WRITE_EXPORT && !APPLY_DB) console.log("ℹ️  DRY-RUN: أضف --write-export و/أو --apply-db (staging).");
}

main().catch((e) => { console.error(e); process.exit(1); });
