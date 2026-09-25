/**
 * normalize-article-numbering — يصحّح ترقيم المواد باشتقاقه من العنوان الرسمي
 * لكل مادة (تحققًا مادةً بمادة)، وينظّف العناوين الملوّثة، ويختم provenance، دون
 * حذف أي بيانات ودون إزاحة رقمية عامة عمياء.
 *
 * ⚠️ آمن افتراضيًّا: يعمل dry-run ما لم يُمرَّر --apply. يعمل داخل transaction.
 *    لا يُشغَّل على الإنتاج إلا بموافقة بشرية صريحة (راجع خطة التشغيل).
 *
 * الاستعمال:
 *   npx tsx scripts/backfill/normalize-article-numbering.ts --system="نظام المعاملات المدنية"
 *   npx tsx scripts/backfill/normalize-article-numbering.ts --all --apply \
 *       --source-url=https://laws.boe.gov.sa/... --publisher="هيئة الخبراء بمجلس الوزراء"
 *
 * لا يُلفّق نصّ مادة مفقودة: الفجوة (مثل المادة 237) تُدرَج في قائمة المراجعة
 * البشرية بحالة missing_official_source، ولا تُنشأ لها مادة بنصّ مُخمَّن.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { planRenumber, sha256Normalized, splitTitleFromBody } from "../../lib/modules/legal-core/article-numbering";
import { isOfficialSourceUrl } from "../../lib/modules/legal-core/article-upsert";

type SystemStatus =
  | "verified"
  | "needs_review"
  | "missing_official_source"
  | "numbering_conflict"
  | "duplicate_candidate"
  | "outdated_source"
  | "unparsed_document";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const APPLY = has("apply");
const ALL = has("all");
const OUT = arg("out") || "reports/legal-source-integrity";
const provenance = {
  sourceUrl: arg("source-url") || null,
  sourcePublisher: arg("publisher") || null,
  sourcePublishedAt: arg("published-at") ? new Date(arg("published-at")!) : null,
  sourceFetchedAt: new Date(),
};
const provenanceIsOfficial = isOfficialSourceUrl(provenance.sourceUrl);

interface SystemReport {
  law: string;
  articles: number;
  maxNumber: number;
  renumbered: number;
  titlesCleaned: number;
  gaps: number[];
  duplicateNewNumbers: number[];
  unparsedTitles: Array<{ oldNumber: number; title: string }>;
  bodyMergeConflicts: Array<{
    number: number;
    note: string;
    proposed?: { title: string; content: string; chapter?: string };
  }>;
  status: SystemStatus;
  applied: boolean;
}

async function collectSystems(prisma: PrismaClient): Promise<string[]> {
  if (ALL) {
    const groups = await prisma.legalArticle.groupBy({ by: ["lawName"] });
    return groups.map((g) => g.lawName).sort((a, b) => a.localeCompare(b, "ar"));
  }
  const systems = process.argv
    .filter((a) => a.startsWith("--system="))
    .map((a) => a.slice("--system=".length));
  if (!systems.length) {
    console.error("مرّر --system=\"اسم النظام\" (يمكن تكراره) أو --all");
    process.exit(2);
  }
  return systems;
}

async function processSystem(prisma: PrismaClient, law: string): Promise<SystemReport> {
  const rows = await prisma.legalArticle.findMany({
    where: { lawName: law, articleNumber: { gt: 0 } },
    select: { id: true, articleNumber: true, title: true, content: true },
    orderBy: { articleNumber: "asc" },
  });

  const plan = planRenumber(rows.map((r) => ({ id: r.id, articleNumber: r.articleNumber, title: r.title, content: r.content })));
  const contentById = new Map(rows.map((r) => [r.id, r.content]));

  // تحقق من عدم فقدان نصّ عند تنظيف عنوان ملوّث: المتن المستخرج يجب أن يكون
  // موجودًا مسبقًا في content، وإلا لا نُنظّف العنوان (نرفعه للمراجعة).
  const bodyMergeConflicts: SystemReport["bodyMergeConflicts"] = [];
  const safeTitleClean = new Set<string>();
  for (const c of plan.changes) {
    if (!c.id) continue;
    const split = splitTitleFromBody(c.oldTitle);
    if (split.cleaned) {
      const content = contentById.get(c.id) ?? "";
      const bodyIn = sha256Normalized(content).length > 0 &&
        (content.includes(split.extractedBody) || split.extractedBody.length < 8);
      if (bodyIn) safeTitleClean.add(c.id);
      else {
        // نمط شائع: متن المادة مُلصق بالعنوان، بينما content يحمل عنوان فصل/باب.
        // نقترح إعادة توزيع دقيقة (عنوان نظيف · متن من العنوان · الفصل من content)
        // كـمراجعة بشرية — لا نطبّقها آليًّا (استبدال نصّ = review_required).
        const content = contentById.get(c.id) ?? "";
        const looksLikeHeading = /^\s*(الفصل|الباب|القسم|الفرع|الكتاب)\b/.test(content.trim());
        bodyMergeConflicts.push({
          number: c.oldNumber,
          note: looksLikeHeading
            ? "متن المادة مُلصق بالعنوان وحقل content يحمل عنوان فصل — إعادة توزيع مقترحة للمراجعة"
            : "متن ملتصق بالعنوان غير موجود في content — مراجعة يدوية",
          proposed: looksLikeHeading
            ? { title: c.newTitle, content: split.extractedBody, chapter: content.trim() }
            : undefined,
        });
      }
    }
  }

  const duplicateNewNumbers = plan.duplicateNewNumbers;
  const gaps = plan.gaps;
  const unparsedTitles = plan.unparsed.map((u) => ({ oldNumber: u.oldNumber, title: u.oldTitle.slice(0, 60) }));

  let status: SystemStatus = "needs_review";
  if (duplicateNewNumbers.length) status = "duplicate_candidate";
  else if (plan.renumbered > 0 && gaps.length) status = "numbering_conflict";
  else if (gaps.length) status = "missing_official_source";
  else if (unparsedTitles.length > rows.length * 0.5) status = "unparsed_document";
  else if (plan.renumbered === 0 && plan.changes.every((c) => c.status === "noop")) status = "verified";
  else status = "needs_review";

  const canApplyNumbers = APPLY && duplicateNewNumbers.length === 0;

  let titlesCleaned = 0;
  if (canApplyNumbers) {
    await prisma.$transaction(async (tx) => {
      // ── المرحلة أ: نقل كل مادة يتغيّر رقمها إلى رقم سالب مؤقت فريد (تفادي تصادم القيد) ──
      let temp = 0;
      for (const c of plan.changes) {
        if (!c.id || c.status !== "renumber" || c.newNumber === null) continue;
        temp += 1;
        await tx.legalArticle.update({ where: { id: c.id }, data: { articleNumber: -temp } });
      }
      // ── المرحلة ب: تثبيت الأرقام النهائية + تنظيف العنوان + provenance + بصمة ──
      for (const c of plan.changes) {
        if (!c.id) continue;
        const cleanTitleSafe = safeTitleClean.has(c.id);
        const data: Record<string, unknown> = {
          contentSha256: sha256Normalized(contentById.get(c.id) ?? ""),
          sourceFetchedAt: provenance.sourceFetchedAt,
        };
        if (provenance.sourceUrl) data.sourceUrl = provenance.sourceUrl;
        if (provenance.sourcePublisher) data.sourcePublisher = provenance.sourcePublisher;
        if (provenance.sourcePublishedAt) data.sourcePublishedAt = provenance.sourcePublishedAt;

        if (c.status === "renumber" && c.newNumber !== null) {
          data.articleNumber = c.newNumber;
          if (cleanTitleSafe) { data.title = c.newTitle; titlesCleaned++; }
          data.reviewStatus = provenanceIsOfficial ? "needs_review" : "needs_review";
        } else if (c.status === "title-clean") {
          if (cleanTitleSafe) { data.title = c.newTitle; titlesCleaned++; data.reviewStatus = "needs_review"; }
        } else {
          // noop: نختم البصمة/الجلب فقط، ولا نغيّر حالة المراجعة تلقائيًّا.
          if (!provenance.sourceUrl) { /* لا تغيير جوهري */ }
        }
        await tx.legalArticle.update({ where: { id: c.id }, data });
      }
    }, { timeout: 120_000 });

    // تحديث حالة إطلاق النظام (تحفّظيًّا) — لا يدّعي الجاهزية عند وجود فجوة/تعارض.
    await prisma.legalSystem.updateMany({
      where: { name: law },
      data: {
        launchStatus: status === "verified" ? "READY" : status === "needs_review" ? "REVIEW_REQUIRED" : "NOT_READY",
        completeness: gaps.length ? "IN_PROGRESS" : "COMPLETE",
        launchValidatedAt: new Date(),
      },
    }).catch(() => {});

    await prisma.ingestRun.create({
      data: {
        source: "normalize-numbering",
        runType: "fix",
        finishedAt: new Date(),
        captured: rows.length,
        classified: plan.renumbered,
        inserted: 0,
        flagged: gaps.length + duplicateNewNumbers.length + unparsedTitles.length,
        raised: gaps.length,
        notes: `law=${law} status=${status} renumbered=${plan.renumbered} gaps=${gaps.join(",") || "-"}`.slice(0, 480),
      },
    }).catch(() => {});
  }

  return {
    law,
    articles: rows.length,
    maxNumber: plan.maxNumber,
    renumbered: plan.renumbered,
    titlesCleaned,
    gaps,
    duplicateNewNumbers,
    unparsedTitles,
    bodyMergeConflicts,
    status,
    applied: canApplyNumbers,
  };
}

async function main() {
  const prisma = new PrismaClient();
  fs.mkdirSync(OUT, { recursive: true });
  const reports: SystemReport[] = [];
  try {
    const systems = await collectSystems(prisma);
    console.log(`${APPLY ? "🛠️  APPLY" : "🔎 DRY-RUN"} — أنظمة مستهدفة: ${systems.length}`);
    if (provenance.sourceUrl) {
      console.log(`   provenance: ${provenanceIsOfficial ? "رسمي ✔" : "غير رسمي ✖ (لن يُعتمد verified)"} ${provenance.sourcePublisher ?? ""}`);
    }
    for (const law of systems) {
      const rep = await processSystem(prisma, law);
      reports.push(rep);
      const mark = rep.status === "verified" ? "✅" : rep.status === "numbering_conflict" || rep.status === "duplicate_candidate" ? "❌" : "⚠️";
      console.log(
        `${mark} ${rep.status.padEnd(24)} | ${String(rep.articles).padStart(4)} مادة | ` +
        `renum=${rep.renumbered} titlesClean=${rep.titlesCleaned} gaps=[${rep.gaps.join(",")}] | ${rep.law.slice(0, 46)}`,
      );
    }

    const reviewRequired = reports
      .filter((r) => r.status !== "verified")
      .map((r) => ({
        law: r.law,
        status: r.status,
        missingArticles: r.gaps,
        duplicateNumbers: r.duplicateNewNumbers,
        unparsedTitles: r.unparsedTitles,
        bodyMergeConflicts: r.bodyMergeConflicts,
      }));

    fs.writeFileSync(
      path.join(OUT, "numbering-normalize-report.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), applied: APPLY, systems: reports }, null, 2) + "\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(OUT, "review-required.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), count: reviewRequired.length, systems: reviewRequired }, null, 2) + "\n",
      "utf8",
    );
    console.log(`\n→ ${OUT}/numbering-normalize-report.json · review-required.json`);
    if (!APPLY) console.log("ℹ️  DRY-RUN: لم تُكتب أي بيانات. أضف --apply للتطبيق على staging.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
