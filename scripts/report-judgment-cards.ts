/**
 * report-judgment-cards.ts — تقرير الصباح: reports/night-run-1000.md (RTL، ترقيم عربي، هوية «أمان»).
 * قراءة فقط من جداول المخرجات + الفهرس العكسي (article_judgments). لا كتابة على القاعدة.
 *   npx tsx scripts/report-judgment-cards.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { normalizeAr, type JudgmentCard } from "@/lib/modules/judgment-cards/card-schema";

const AR = "٠١٢٣٤٥٦٧٨٩";
const ar = (n: number | string) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)]);
const pct = (num: number, den: number) => (den ? ar(((num / den) * 100).toFixed(1)) + "٪" : "—");

// أسعار تقديرية لكل مليون رمز (Haiku-فئة) — للتقدير فقط، تُعدَّل حسب المزوّد الفعليّ.
const PRICE_IN_PER_M = 0.8;
const PRICE_OUT_PER_M = 4.0;

type CardRow = { judgmentId: string; card: JudgmentCard; confidence: number; reviewStatus: string; calibration: boolean; verifierAgreed: boolean | null };

async function main() {
  const runs = await prisma.extractionRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 });
  const latest = runs[0];

  const rows = (await prisma.judgmentCard.findMany({
    select: { judgmentId: true, card: true, confidence: true, reviewStatus: true, calibration: true, verifierAgreed: true },
  })) as unknown as CardRow[];

  const total = rows.length;
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.reviewStatus] = (byStatus[r.reviewStatus] ?? 0) + 1;
  const calib = rows.filter((r) => r.calibration).length;

  // توزيع الثقة
  const confBuckets = { "≥0.9": 0, "0.85–0.9": 0, "0.7–0.85": 0, "<0.7": 0 };
  let confSum = 0;
  for (const r of rows) {
    confSum += r.confidence;
    if (r.confidence >= 0.9) confBuckets["≥0.9"]++;
    else if (r.confidence >= 0.85) confBuckets["0.85–0.9"]++;
    else if (r.confidence >= 0.7) confBuckets["0.7–0.85"]++;
    else confBuckets["<0.7"]++;
  }
  const avgConf = total ? confSum / total : 0;

  // توزيع resultCategory وdisputeType
  const byResult: Record<string, number> = {};
  const byDispute: Record<string, number> = {};
  // الدفوع: مفتاح مطبَّع → {raised, accepted}
  const defenseStats = new Map<string, { label: string; raised: number; accepted: number }>();
  for (const r of rows) {
    const rc = r.card.resultCategory ?? "غير محدد";
    byResult[rc] = (byResult[rc] ?? 0) + 1;
    const dt = r.card.disputeType ?? "غير محدد";
    byDispute[dt] = (byDispute[dt] ?? 0) + 1;
    for (const d of r.card.defenses ?? []) {
      if (!d.text) continue;
      const key = normalizeAr(d.text).slice(0, 40);
      const rec = defenseStats.get(key) ?? { label: d.text.slice(0, 60), raised: 0, accepted: 0 };
      rec.raised++;
      if (d.outcome === "قُبل") rec.accepted++;
      defenseStats.set(key, rec);
    }
  }

  // الفهرس العكسي: أكثر ١٠ مواد تطبيقًا
  const topArticles = (await prisma.$queryRawUnsafe(
    `SELECT ls.name AS system, aj.article_number AS article, aj.judgment_count AS count
     FROM article_judgments aj
     LEFT JOIN legal_systems ls ON ls.id = aj.legal_system_id
     ORDER BY aj.judgment_count DESC
     LIMIT 10`
  )) as Array<{ system: string | null; article: string; count: bigint | number }>;

  const sortDesc = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

  // أسباب الاختلاف (من notes التشغيلة الأخيرة إن كانت JSON)
  let failReasons: Record<string, number> = {};
  try { failReasons = JSON.parse((latest?.notes || "").split("|")[0].trim()); } catch { /* ignore */ }

  // تقدير التكلفة: من متوسط طول نصّ الأحكام المعالَجة (نداءان: استخراج + تدقيق)
  const sampleTexts = await prisma.judicialCase.findMany({ where: { id: { in: rows.slice(0, 200).map((r) => r.judgmentId) } }, select: { judgmentText: true } });
  const avgChars = sampleTexts.length ? sampleTexts.reduce((s, t) => s + (t.judgmentText?.length ?? 0), 0) / sampleTexts.length : 0;
  const inTokPerCard = (avgChars / 4) * 2 + 400; // نداءا استخراج+تدقيق (النصّ يدخل مرتين) + تعليمات
  const outTokPerCard = 700; // بطاقة + تدقيق
  const costPerCard = (inTokPerCard / 1e6) * PRICE_IN_PER_M + (outTokPerCard / 1e6) * PRICE_OUT_PER_M;
  const cost1000 = costPerCard * 1000;
  const cost50k = costPerCard * 50000;

  // ٥ بطاقات كاملة للفحص العيني
  const samples = rows.slice(0, 5);

  // ── بناء التقرير ──
  const L: string[] = [];
  L.push("<div dir=\"rtl\" markdown=\"1\">\n");
  L.push("# تقرير التشغيل الليلي — عيّنة الألف حكم تجاري");
  L.push("");
  L.push("> هوية **أمان** · طبقة داخلية للمراجعة — لا تظهر في واجهات المستخدم حتى اعتماد د. عاصم.");
  L.push(`> التشغيلة الأخيرة: \`${latest?.id ?? "—"}\` · بدأت: ${latest?.startedAt?.toISOString() ?? "—"} · انتهت: ${latest?.finishedAt?.toISOString() ?? "لم تُختم"}`);
  L.push("");

  L.push("## ١) الأعداد");
  L.push("");
  L.push("| المقياس | العدد |");
  L.push("|---|---|");
  L.push(`| إجمالي البطاقات | ${ar(total)} |`);
  L.push(`| تلقائي (auto) | ${ar(byStatus["auto"] ?? 0)} |`);
  L.push(`| بحاجة مراجعة (needs_review) | ${ar(byStatus["needs_review"] ?? 0)} |`);
  L.push(`| معتمد (approved) | ${ar(byStatus["approved"] ?? 0)} |`);
  L.push(`| مرفوض (rejected) | ${ar(byStatus["rejected"] ?? 0)} |`);
  L.push(`| ضمن عيّنة المعايرة | ${ar(calib)} |`);
  L.push(`| فاشل (من التشغيلة الأخيرة) | ${ar(latest?.failed ?? 0)} |`);
  L.push("");
  if (Object.keys(failReasons).length) {
    L.push("**أسباب الفشل:**");
    for (const [k, v] of sortDesc(failReasons)) L.push(`- ${k}: ${ar(v)}`);
    L.push("");
  }

  L.push("## ٢) الثقة");
  L.push("");
  L.push(`متوسط الثقة: **${ar(avgConf.toFixed(3))}**`);
  L.push("");
  L.push("| المدى | العدد |");
  L.push("|---|---|");
  for (const [k, v] of Object.entries(confBuckets)) L.push(`| ${k} | ${ar(v)} |`);
  L.push("");

  L.push("## ٣) توزيع النتيجة ونوع النزاع");
  L.push("");
  L.push("**resultCategory:**");
  L.push("");
  L.push("| التصنيف | العدد | النسبة |");
  L.push("|---|---|---|");
  for (const [k, v] of sortDesc(byResult)) L.push(`| ${k} | ${ar(v)} | ${pct(v, total)} |`);
  L.push("");
  L.push("**disputeType (أعلى ١٠):**");
  L.push("");
  L.push("| النوع | العدد |");
  L.push("|---|---|");
  for (const [k, v] of sortDesc(byDispute).slice(0, 10)) L.push(`| ${k} | ${ar(v)} |`);
  L.push("");

  L.push("## ٤) أكثر ١٠ مواد تطبيقًا (الفهرس العكسي)");
  L.push("");
  L.push("| النظام | المادة | عدد الأحكام |");
  L.push("|---|---|---|");
  for (const a of topArticles) L.push(`| ${a.system ?? "«غير مربوط»"} | ${a.article} | ${ar(Number(a.count))} |`);
  if (!topArticles.length) L.push("| — | — | — |");
  L.push("");

  L.push("## ٥) أكثر ١٠ دفوع إثارة ونِسب قبولها الأوليّة");
  L.push("");
  L.push("| الدفع | أُثير | قُبل | نسبة القبول |");
  L.push("|---|---|---|---|");
  const topDef = [...defenseStats.values()].sort((a, b) => b.raised - a.raised).slice(0, 10);
  for (const d of topDef) L.push(`| ${d.label} | ${ar(d.raised)} | ${ar(d.accepted)} | ${pct(d.accepted, d.raised)} |`);
  if (!topDef.length) L.push("| — | — | — | — |");
  L.push("");

  L.push("## ٦) عيّنة ٥ بطاقات كاملة");
  L.push("");
  for (const s of samples) {
    L.push(`### الحكم \`${s.judgmentId}\` — ${s.reviewStatus}${s.calibration ? " · معايرة" : ""}`);
    L.push("");
    L.push("```json");
    L.push(JSON.stringify(s.card, null, 2));
    L.push("```");
    L.push("");
  }

  L.push("## ٧) طابور المراجعة");
  L.push("");
  L.push(`عدد بحاجة مراجعة: **${ar(byStatus["needs_review"] ?? 0)}**`);
  L.push("");
  const disagreeCount = rows.filter((r) => r.verifierAgreed === false).length;
  L.push(`- بطاقات اختلف فيها المدقّق: ${ar(disagreeCount)}`);
  L.push(`- بطاقات دون اتفاق/ثقة كافية أو بتعارض اتساق: تُحال تلقائيًّا (انظر القاعدة في consistency.ts).`);
  L.push("");

  L.push("## ٨) تقدير التكلفة");
  L.push("");
  L.push(`> تقديريّ (نداءان لكل بطاقة: استخراج + تدقيق) — أسعار مرجعية ${ar(PRICE_IN_PER_M)}/${ar(PRICE_OUT_PER_M)} لكل مليون رمز (دخل/خرج).`);
  L.push("");
  L.push("| البند | القيمة |");
  L.push("|---|---|");
  L.push(`| متوسط طول نصّ الحكم | ${ar(Math.round(avgChars))} حرف |`);
  L.push(`| رموز تقديرية لكل بطاقة (دخل+خرج) | ${ar(Math.round(inTokPerCard + outTokPerCard))} |`);
  L.push(`| تكلفة الألف (تقديريّ) | ${ar(cost1000.toFixed(2))}$ |`);
  L.push(`| إسقاط ٥٠ ألفًا (تقديريّ) | ${ar(cost50k.toFixed(2))}$ |`);
  L.push("");
  L.push("---");
  L.push("");
  L.push("_تقرير آليّ — لا يُعتمد إلا بعد مراجعة بشرية للعيّنة. المصدر الوحيد للأحكام: `judicial_cases`._");
  L.push("\n</div>");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/night-run-1000.md", L.join("\n") + "\n");
  console.log(`✓ كُتب reports/night-run-1000.md — بطاقات=${total} · auto=${byStatus["auto"] ?? 0} · needs_review=${byStatus["needs_review"] ?? 0} · متوسط الثقة=${avgConf.toFixed(3)}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("✗ فشل report-judgment-cards:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
