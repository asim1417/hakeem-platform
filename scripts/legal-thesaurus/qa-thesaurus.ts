/**
 * qa-thesaurus.ts — فحص جودة المكنز (قراءة فقط، لا يكتب في القاعدة).
 *
 * يُجيب على أسئلة المراجعة قبل الربط بالنواة:
 *   ① دقّة حقول التكرار (total/distinct_articles/distinct_sources/distribution) مقابل
 *      ما يُحتسب فعلياً من جدول المواضع — مع كشف المفاهيم «المُعيّنة» (عيّنة مواضع ≤5).
 *   ② سؤال «الأنظمة»: هل distinct_sources_count = عدد أنظمة فعلية (lawName) أم
 *      معرّفات نظام (legalSystemId) أم ورود؟ — مقارنة صريحة + الحقيقة العالمية.
 *   ③ عيّنة مراجعة 300 مفهوم (100 عالي/100 متوسط/50 تعريفات/50 متن) → CSV.
 *   ④ تصنيف المفاهيم إلى 8 فئات + إحصاء.
 *   ⑤ تقرير false positives (عبارات تبدو قانونية لكنها عامة/متعددة المعنى).
 *   ⑥ تقرير الأزواج المتقاربة (يُمنع دمجها) — إثبات انفصالها.
 *   ⑦ تقرير نهائي: الإجماليات + المعتمد/المراجعة + التعريفات/المتن + أعلى 100 تكراراً
 *      + أكثر 100 يحتاج مراجعة + نسبة النتائج الضعيفة/العامة.
 *
 * المخرجات: out/legal-thesaurus-qa/*.csv|*.md  + ملخّصات إلى stdout.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const q = <T = Record<string, unknown>>(sql: string, ...a: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...a);
const n = (v: unknown) => Number(v ?? 0);

function csv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return "﻿" + headers.map(esc).join(",") + "\n" + rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n") + "\n";
}

// ── التصنيف إلى 8 فئات (قاعدي، شفّاف) ──
type Category =
  | "explicit_legal_concept" | "compound_legal_concept" | "admin_entity"
  | "legal_instrument" | "procedure" | "effect_penalty" | "general_needs_review" | "not_a_concept";

const ADMIN = /(الوزاره|الوزير|الهيئه|اللجنه|المجلس|الاداره|المركز|الامانه|الديوان|المؤسسه|الجهه|الصندوق|المكتب|الوكاله|المحكمه|الدائره)/;
const INSTRUMENT = /(لائحه|شهاده|رخصه|تصريح|سند|وثيقه|بطاقه|سجل|نموذج|عقد|اتفاقيه|قائمه|تقرير|محضر|صك)/;
const PROCEDURE = /(دعوى|طلب|تبليغ|اعلان|اخطار|جلسه|مرافعه|طعن|استئناف|تمييز|نقض|تنفيذ|حجز|اجراء|قيد|تسجيل|مهله|اعتراض)/;
const EFFECT = /(بطلان|فسخ|انفساخ|ابطال|تعويض|غرامه|عقوبه|جزاء|مصادره|ضمان|كفاله|مسؤوليه|الغاء|سحب|شطب)/;
/** ألفاظ عامة/متعددة المعنى تُحال للمراجعة (لا تُعتمد بلا تصنيف بشري). */
const GENERAL = new Set<string>([
  "الحكم", "القرار", "الامر", "الجهه المختصه", "الاداره المختصه", "اللائحه التنفيذيه", "الجهات المختصه",
  "الادارات المختصه", "النظام", "اللائحه", "الاحكام", "القرارات", "الطلب", "الطلبات", "الموافقه", "التقرير",
  "القائمه", "المده", "النسبه", "البدل", "الرسوم", "الوثيقه", "السجل",
]);

function classify(searchLabel: string, type: string, basis: string, hasDef: boolean, isCompound: boolean, occ: number, arts: number): { cat: Category; reason: string } {
  if (GENERAL.has(searchLabel)) return { cat: "general_needs_review", reason: "لفظ عام/متعدد المعنى بحسب السياق" };
  if (arts <= 1 && occ <= 1 && !hasDef) return { cat: "not_a_concept", reason: "ورود وحيد بلا تعريف — قد لا يكون مفهوماً" };
  if (ADMIN.test(searchLabel)) return { cat: "admin_entity", reason: "جهة/صفة إدارية" };
  if (EFFECT.test(searchLabel)) return { cat: "effect_penalty", reason: "أثر/جزاء قانوني" };
  if (PROCEDURE.test(searchLabel)) return { cat: "procedure", reason: "إجراء" };
  if (INSTRUMENT.test(searchLabel)) return { cat: "legal_instrument", reason: "وثيقة/أداة نظامية" };
  if (hasDef) return { cat: "explicit_legal_concept", reason: "مُعرَّف صراحةً في النظام" };
  if (isCompound) return { cat: "compound_legal_concept", reason: "عبارة قانونية مركّبة من المتن" };
  return { cat: "general_needs_review", reason: "يحتاج تصنيفاً بشرياً" };
}

interface ConceptRow {
  id: string; preferred_label_ar: string; normalized_label: string; concept_type: string; source_basis: string;
  extraction_scope: string; status: string; needs_human_review: boolean; definition_text: string | null;
  total_occurrences_count: unknown; distinct_articles_count: unknown; distinct_sources_count: unknown;
  recurrence_strength: string; occurrence_distribution_json: unknown;
  occ_rows: unknown; occ_articles: unknown; occ_source_ids: unknown; occ_source_names: unknown; sample_quote: string | null;
}

async function main() {
  const outDir = path.join(process.cwd(), "out", "legal-thesaurus-qa");
  fs.mkdirSync(outDir, { recursive: true });

  const tcheck = await q<{ c: bigint }>(`SELECT count(*)::bigint c FROM information_schema.tables WHERE table_name='legal_thesaurus_concepts'`).catch(() => []);
  if (!tcheck.length || Number(tcheck[0].c) === 0) { console.error("✗ لا توجد جداول المكنز."); process.exit(1); }

  // ── الحقيقة العالمية لقاعدة الأنظمة ──
  const g = (await q<{ laws: bigint; sysids: bigint; arts: bigint }>(
    `SELECT count(distinct "lawName")::bigint laws, count(distinct "legalSystemId")::bigint sysids, count(*)::bigint arts FROM legal_articles`
  ))[0];
  console.log("=".repeat(70));
  console.log("① الحقيقة العالمية لقاعدة الأنظمة (legal_articles)");
  console.log(`   أنظمة متمايزة بالاسم (lawName): ${n(g.laws)}`);
  console.log(`   معرّفات نظام متمايزة (legalSystemId): ${n(g.sysids)}`);
  console.log(`   إجمالي المواد: ${n(g.arts)}`);

  // ── تحميل كل المفاهيم مع تجميع المواضع الفعلي ──
  const rows = await q<ConceptRow>(
    `SELECT c.id, c.preferred_label_ar, c.normalized_label, c.concept_type, c.source_basis, c.extraction_scope,
            c.status, c.needs_human_review, c.definition_text,
            c.total_occurrences_count, c.distinct_articles_count, c.distinct_sources_count, c.recurrence_strength,
            c.occurrence_distribution_json,
            o.occ_rows, o.occ_articles, o.occ_source_ids, o.occ_source_names, o.sample_quote
     FROM legal_thesaurus_concepts c
     LEFT JOIN (
       SELECT concept_id,
              count(*) occ_rows,
              count(distinct article_id) occ_articles,
              count(distinct legal_source_id) occ_source_ids,
              count(distinct legal_source_name) occ_source_names,
              max(occurrence_text) sample_quote
       FROM legal_thesaurus_occurrences GROUP BY concept_id
     ) o ON o.concept_id = c.id`
  );
  console.log(`\n② إجمالي المفاهيم المُحمّلة: ${rows.length}`);

  // ── تصنيف الأساس: مُعيّن (sampled) أم شامل ──
  const enrich = rows.map((r) => {
    const stoTotal = n(r.total_occurrences_count), stoArts = n(r.distinct_articles_count), stoSrc = n(r.distinct_sources_count);
    const occRows = n(r.occ_rows), occArts = n(r.occ_articles), occSrcIds = n(r.occ_source_ids), occSrcNames = n(r.occ_source_names);
    const sampled = stoTotal > occRows; // مفهوم مُرقّى: المواضع المخزّنة عيّنة
    const hasDef = r.source_basis === "explicit_legal_definition" || r.source_basis === "mixed_definition_and_body";
    const isCompound = (r.preferred_label_ar || "").trim().split(/\s+/).length > 1;
    const cls = classify(r.normalized_label, r.concept_type, r.source_basis, hasDef, isCompound, stoTotal, stoArts);
    return { r, stoTotal, stoArts, stoSrc, occRows, occArts, occSrcIds, occSrcNames, sampled, hasDef, isCompound, ...cls };
  });

  // ── ① دقّة الحقول: قارن المخزّن بالمُحتسب (للمفاهيم الشاملة فقط؛ المُعيّنة تُعلَّم) ──
  const verifiable = enrich.filter((e) => !e.sampled && e.occRows > 0);
  const mmArts = verifiable.filter((e) => e.stoArts !== e.occArts);
  const mmSrc = verifiable.filter((e) => e.stoSrc !== e.occSrcIds);
  const sampledCount = enrich.filter((e) => e.sampled).length;
  console.log("\n" + "=".repeat(70));
  console.log("③ دقّة حقول التكرار (مقارنة المخزّن بالمُحتسب من جدول المواضع)");
  console.log(`   مفاهيم قابلة للتحقق الكامل (مواضع شاملة): ${verifiable.length}`);
  console.log(`   مفاهيم «مُعيّنة» (مواضعها عيّنة ≤5، العدّ محفوظ من الاستخراج): ${sampledCount}`);
  console.log(`   تطابق distinct_articles_count: ${verifiable.length - mmArts.length}/${verifiable.length} — اختلافات: ${mmArts.length}`);
  console.log(`   تطابق distinct_sources_count: ${verifiable.length - mmSrc.length}/${verifiable.length} — اختلافات: ${mmSrc.length}`);
  if (mmArts.length) console.log("   مثال اختلاف مواد:", mmArts.slice(0, 3).map((e) => `${e.r.preferred_label_ar}(مخزّن ${e.stoArts}/محتسب ${e.occArts})`).join("، "));
  if (mmSrc.length) console.log("   مثال اختلاف مصادر:", mmSrc.slice(0, 3).map((e) => `${e.r.preferred_label_ar}(مخزّن ${e.stoSrc}/محتسب ${e.occSrcIds})`).join("، "));

  // ── ② سؤال «الأنظمة»: stored vs distinct legalSystemId vs distinct lawName ──
  console.log("\n" + "=".repeat(70));
  console.log("④ سؤال «الأنظمة»: هل distinct_sources_count = أنظمة فعلية (lawName)؟");
  console.log("   [المفهوم | sources_مخزّن | معرّفات_نظام_محتسبة | أسماء_أنظمة_محتسبة]");
  const topByOcc = [...enrich].sort((a, b) => b.stoTotal - a.stoTotal).slice(0, 20);
  const sysRows: Array<Record<string, unknown>> = [];
  for (const e of topByOcc) {
    const idEqName = e.occSrcIds === e.occSrcNames ? "=" : "≠";
    const storedEqName = e.stoSrc === e.occSrcNames ? "✓" : (e.sampled ? "?عيّنة" : "✗");
    console.log(`   ${e.r.preferred_label_ar} | ${e.stoSrc} | ${e.occSrcIds} | ${e.occSrcNames} | id${idEqName}name | مخزّن=اسم؟ ${storedEqName}`);
    sysRows.push({ المفهوم: e.r.preferred_label_ar, sources_مخزّن: e.stoSrc, معرفات_نظام: e.occSrcIds, اسماء_انظمة: e.occSrcNames, مُعيّن: e.sampled ? "نعم" : "لا" });
  }
  fs.writeFileSync(path.join(outDir, "qa-systems-count.csv"), csv(sysRows, ["المفهوم", "sources_مخزّن", "معرفات_نظام", "اسماء_انظمة", "مُعيّن"]));

  // ── ③ عيّنة مراجعة 300 ──
  const byOccDesc = [...enrich].sort((a, b) => b.stoTotal - a.stoTotal);
  const high = byOccDesc.slice(0, 100);
  const mid = byOccDesc.filter((e) => e.stoTotal >= 3 && e.stoTotal <= 10).slice(0, 100);
  const defs = enrich.filter((e) => e.r.extraction_scope === "definitions_only").slice(0, 50);
  const body = enrich.filter((e) => e.r.extraction_scope === "full_body" || e.r.source_basis === "body_pattern").slice(0, 50);
  const sample = [...high, ...mid, ...defs, ...body];
  const seen = new Set<string>();
  const sampleRows = sample.filter((e) => !seen.has(e.r.id) && seen.add(e.r.id)).map((e) => ({
    المفهوم: e.r.preferred_label_ar, النوع: e.r.concept_type, الفئة: e.cat, سبب_التصنيف: e.reason,
    النطاق: e.r.extraction_scope, السند: e.r.source_basis, الورود: e.stoTotal, المواد: e.stoArts, الأنظمة: e.stoSrc,
    قوة_التكرار: e.r.recurrence_strength, الحالة: e.r.status, يحتاج_مراجعة: e.r.needs_human_review ? "نعم" : "لا",
    مُعيّن_العيّنة: e.sampled ? "نعم" : "لا", اقتباس: (e.r.sample_quote ?? "").slice(0, 200), التعريف: (e.r.definition_text ?? "").slice(0, 200),
  }));
  fs.writeFileSync(path.join(outDir, "qa-sample-300.csv"), csv(sampleRows, [
    "المفهوم", "النوع", "الفئة", "سبب_التصنيف", "النطاق", "السند", "الورود", "المواد", "الأنظمة", "قوة_التكرار", "الحالة", "يحتاج_مراجعة", "مُعيّن_العيّنة", "اقتباس", "التعريف",
  ]));
  console.log("\n" + "=".repeat(70));
  console.log(`⑤ عيّنة المراجعة: ${sampleRows.length} مفهوماً (عالي ${high.length}/متوسط ${mid.length}/تعريفات ${defs.length}/متن ${body.length}) → qa-sample-300.csv`);

  // ── ④ تصنيف 8 فئات + إحصاء ──
  const catTally = new Map<string, number>();
  for (const e of enrich) catTally.set(e.cat, (catTally.get(e.cat) ?? 0) + 1);
  console.log("\n⑥ تصنيف المفاهيم (8 فئات):");
  for (const [c, cnt] of [...catTally.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${c}: ${cnt} (${((cnt / enrich.length) * 100).toFixed(1)}%)`);

  // ── ⑤ false positives (عامة/متعددة المعنى/مفردة شائعة) ──
  const fps = enrich.filter((e) => e.cat === "general_needs_review" || e.cat === "not_a_concept")
    .sort((a, b) => b.stoTotal - a.stoTotal).slice(0, 100);
  fs.writeFileSync(path.join(outDir, "qa-false-positives.csv"), csv(fps.map((e) => ({
    المفهوم: e.r.preferred_label_ar, الفئة: e.cat, السبب: e.reason, الورود: e.stoTotal, المواد: e.stoArts, الأنظمة: e.stoSrc, النطاق: e.r.extraction_scope,
  })), ["المفهوم", "الفئة", "السبب", "الورود", "المواد", "الأنظمة", "النطاق"]));
  console.log(`\n⑦ false positives (عامة/تحتاج فصل): ${enrich.filter((e) => e.cat === "general_needs_review").length} عامة + ${enrich.filter((e) => e.cat === "not_a_concept").length} ليست مفهوماً → qa-false-positives.csv`);
  console.log("   أبرزها:", fps.slice(0, 12).map((e) => e.r.preferred_label_ar).join("، "));

  // ── ⑥ الأزواج المتقاربة (يُمنع دمجها) ──
  const pairs: Array<[string, string[]]> = [
    ["الحكم/القرار/الأمر", ["الحكم", "القرار", "الامر القضائي"]],
    ["العقد/الاتفاق/الالتزام", ["العقد", "الاتفاق", "الالتزام"]],
    ["البطلان/الفسخ/الانفساخ", ["البطلان", "الفسخ", "الانفساخ"]],
    ["الدائن/طالب التنفيذ/المحكوم له", ["الدائن", "طالب التنفيذ", "المحكوم له"]],
    ["المدين/المنفذ ضده/المحكوم عليه", ["المدين", "المنفذ ضده", "المحكوم عليه"]],
  ];
  const byLabel = new Map(enrich.map((e) => [e.r.normalized_label, e]));
  const { searchableText } = await import("@/lib/modules/legal-thesaurus/normalize");
  const pairLines: string[] = ["# تقرير الأزواج المتقاربة (يُمنع دمجها)\n"];
  console.log("\n⑧ الأزواج المتقاربة — إثبات الانفصال:");
  for (const [name, members] of pairs) {
    pairLines.push(`\n## ${name}`);
    pairLines.push(`| العضو | موجود؟ | id | ورود | مواد | أنظمة |`);
    pairLines.push(`|---|:--:|---|---:|---:|---:|`);
    const present: string[] = [];
    for (const m of members) {
      const e = byLabel.get(searchableText(m));
      if (e) { present.push(m); pairLines.push(`| ${m} | ✓ | \`${e.r.id.slice(0, 8)}\` | ${e.stoTotal} | ${e.stoArts} | ${e.stoSrc} |`); }
      else pairLines.push(`| ${m} | ✗ مفقود | — | — | — | — |`);
    }
    const distinctIds = new Set(present.map((m) => byLabel.get(searchableText(m))!.r.id)).size;
    pairLines.push(`\n→ ${present.length} عضو موجود بـ ${distinctIds} معرّفاً متمايزاً (لا دمج).`);
    console.log(`   ${name}: ${present.length}/${members.length} موجود، ${distinctIds} معرّف متمايز`);
  }
  fs.writeFileSync(path.join(outDir, "qa-careful-pairs.md"), pairLines.join("\n") + "\n");

  // ── ⑦ التقرير النهائي ──
  const approved = enrich.filter((e) => e.r.status === "approved").length;
  const needsRev = enrich.filter((e) => e.r.needs_human_review).length;
  const fromDef = enrich.filter((e) => e.r.extraction_scope === "definitions_only").length;
  const fromBody = enrich.filter((e) => e.r.extraction_scope === "full_body").length;
  const mixed = enrich.filter((e) => e.r.extraction_scope === "mixed").length;
  const weak = enrich.filter((e) => e.cat === "general_needs_review" || e.cat === "not_a_concept").length;
  const fin: string[] = [];
  fin.push(`# التقرير النهائي للجودة — المكنز (قبل الربط بالنواة)\n`);
  fin.push(`- إجمالي المفاهيم: **${enrich.length}**`);
  fin.push(`- معتمدة (approved): **${approved}** · تحتاج مراجعة: **${needsRev}**`);
  fin.push(`- من التعريفات: **${fromDef}** · من المتن: **${fromBody}** · مختلط: **${mixed}**`);
  fin.push(`- نسبة النتائج الضعيفة/العامة: **${((weak / enrich.length) * 100).toFixed(1)}%** (${weak})`);
  fin.push(`- مفاهيم «مُعيّنة» المواضع (مُرقّاة): **${sampledCount}** (مواضعها عيّنة ≤5 — العدّ محفوظ من الاستخراج)\n`);
  fin.push(`## تصنيف الفئات`);
  fin.push(`| الفئة | عدد | % |`); fin.push(`|---|---:|---:|`);
  for (const [c, cnt] of [...catTally.entries()].sort((a, b) => b[1] - a[1])) fin.push(`| ${c} | ${cnt} | ${((cnt / enrich.length) * 100).toFixed(1)}% |`);
  fin.push(`\n## أعلى 100 مفهوماً تكراراً (مع أدلّتها)`);
  fin.push(`| المفهوم | النوع | الفئة | ورود | مواد | أنظمة | اقتباس |`); fin.push(`|---|---|---|---:|---:|---:|---|`);
  for (const e of byOccDesc.slice(0, 100)) fin.push(`| ${e.r.preferred_label_ar} | ${e.r.concept_type} | ${e.cat} | ${e.stoTotal} | ${e.stoArts} | ${e.stoSrc} | ${(e.r.sample_quote ?? "").replace(/\|/g, " ").slice(0, 90)} |`);
  fin.push(`\n## أكثر 100 مفهوماً يحتاج مراجعة (الأعلى تكراراً منها)`);
  fin.push(`| المفهوم | الفئة | السبب | ورود | مواد | أنظمة |`); fin.push(`|---|---|---|---:|---:|---:|`);
  for (const e of enrich.filter((x) => x.r.needs_human_review).sort((a, b) => b.stoTotal - a.stoTotal).slice(0, 100)) fin.push(`| ${e.r.preferred_label_ar} | ${e.cat} | ${e.reason} | ${e.stoTotal} | ${e.stoArts} | ${e.stoSrc} |`);
  fs.writeFileSync(path.join(outDir, "qa-final-report.md"), fin.join("\n") + "\n");

  console.log("\n" + "=".repeat(70));
  console.log("⑨ التقرير النهائي:");
  console.log(`   إجمالي ${enrich.length} · معتمد ${approved} · مراجعة ${needsRev} · تعريفات ${fromDef} · متن ${fromBody} · مختلط ${mixed}`);
  console.log(`   نسبة الضعيفة/العامة: ${((weak / enrich.length) * 100).toFixed(1)}%`);
  console.log(`\n✅ التقارير في out/legal-thesaurus-qa/ (sample-300 · false-positives · careful-pairs · systems-count · final-report).`);
}

main()
  .catch((e) => { console.error("✗ خطأ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => undefined));
