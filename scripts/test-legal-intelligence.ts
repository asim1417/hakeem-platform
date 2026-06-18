/**
 * اختبارات الذكاء القانوني المُسنَد — نقيّة (بلا قاعدة بيانات، بلا مفاتيح، بلا كتابة).
 * تغطّي: حارس الأبعاد + cosine الاحتياطي، اشتقاق نوع المطابقة، ربط المواد بالأحكام،
 * حارس الإسناد، وبناء الاستشهادات من السياق فقط (منع الاختلاق).
 *
 * التشغيل: npm run test:intel
 */
import { parseEmbedding, hasValidDimension, rankByCosine, cosineSimilarity, buildVectorLiteral } from "@/lib/modules/legal-search/embedding-fallback";
import { deriveMatchedBy } from "@/lib/modules/legal-search/hybrid-search";
import { mapLinkedJudgments, type ArticleCaseLinkRow } from "@/lib/modules/legal-rag/judgment-links";
import { hasSufficientGrounding, NO_EXPLICIT_TEXT, GROUNDING_FALLBACK } from "@/lib/modules/legal-rag/grounding-guard";
import { buildCitations } from "@/lib/modules/citations/citation-engine";
import type { LegalContext } from "@/lib/modules/legal-rag/context-builder";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

// ── مُساعد لبناء سياق وهمي ──
function ctx(over: Partial<LegalContext> = {}): LegalContext {
  return {
    articles: [],
    rulings: [],
    principles: [],
    relations: [],
    confidence: 0,
    sources: [],
    ...over,
  };
}

function jcLinkRow(over: Partial<ArticleCaseLinkRow> = {}): ArticleCaseLinkRow {
  return {
    articleId: "art1",
    caseId: "case1",
    relationType: "يستند",
    excerpt: "مقتطف الحكم",
    confidence: 0.9,
    judicialCase: {
      id: "case1",
      judgmentTitle: "عنوان",
      judgmentText: "نص الحكم الكامل",
      caseNo: "123",
      decisionNo: "456",
      court: "المحكمة التجارية",
      cityName: "الرياض",
      decisionDate: null,
    },
    ...over,
  };
}

function main() {
  console.log("🧪 اختبارات الذكاء القانوني المُسنَد (Neon RAG)");
  console.log("=".repeat(56));

  // ١) parseEmbedding — أشكال متعدّدة وسقوط آمن
  console.log("\n[parseEmbedding]");
  check(parseEmbedding([0.1, 0.2, 0.3])?.length === 3, "مصفوفة أرقام → متجه");
  check(JSON.stringify(parseEmbedding(["1", "2", "3"])) === JSON.stringify([1, 2, 3]), "مصفوفة نصوص رقمية → أرقام");
  check(parseEmbedding("[0.5, 0.5]")?.[0] === 0.5, "سلسلة JSON → متجه");
  check(parseEmbedding(null) === null && parseEmbedding(undefined) === null, "null/undefined → null");
  check(parseEmbedding("نص") === null && parseEmbedding("") === null, "سلسلة غير JSON → null");
  check(parseEmbedding([1, "x", 3]) === null && parseEmbedding([]) === null, "عنصر غير رقمي/فارغ → null");

  // ١ب) buildVectorLiteral — تمثيل pgvector النصّي (لتعبئة جدول embeddings)
  check(buildVectorLiteral([1, 2, 3]) === "[1,2,3]", "متجه → '[1,2,3]'");
  check(buildVectorLiteral([0.5, -0.25]) === "[0.5,-0.25]", "يحفظ القيم العشرية والسالبة");
  check(buildVectorLiteral([1, Number.NaN, 3]) === "[1,0,3]", "غير المنتهي → 0 (لا يكسر)");

  // ٢) حارس الأبعاد — يتجاهل المخالف ولا يفشل
  console.log("\n[hasValidDimension]");
  check(hasValidDimension([1, 2, 3], 3) === true, "بُعد مطابق → صالح");
  check(hasValidDimension([1, 2], 3) === false, "بُعد مخالف → غير صالح");
  check(hasValidDimension(null, 3) === false && hasValidDimension([], 3) === false, "null/فارغ → غير صالح");

  // ٣) rankByCosine — ترتيب + تجاهل الأبعاد المخالفة دون كسر
  console.log("\n[rankByCosine]");
  const q = [1, 0, 0];
  const ranked = rankByCosine(q, [
    { id: "same", embedding: [1, 0, 0] },
    { id: "ortho", embedding: [0, 1, 0] },
    { id: "wrongdim", embedding: [1, 0] }, // يُتجاهل (بُعد مخالف)
    { id: "bad", embedding: "ليس متجهاً" }, // يُتجاهل (غير صالح)
  ]);
  check(ranked.length === 2, "يتجاهل المخالف/الفاسد ويُبقي الصالح فقط (سجلّ واحد فاسد لا يُفشل)");
  check(ranked[0]?.id === "same" && ranked[0].score > 0.99, "الأعلى تشابهاً أولاً");
  check(rankByCosine(q, [{ id: "a", embedding: [1, 0, 0] }], { limit: 0 }).length === 0, "limit=0 → فارغ");
  check(cosineSimilarity([1, 0], [1, 0]) > 0.99, "cosine مُعاد تصديره يعمل");

  // ٤) deriveMatchedBy — اشتقاق نوع المطابقة (يعمل مع تعطيل الدلالي)
  console.log("\n[deriveMatchedBy]");
  check(deriveMatchedBy(["postgres"]) === "lexical", "postgres فقط → lexical");
  check(deriveMatchedBy(["vector"]) === "semantic", "vector فقط → semantic");
  check(deriveMatchedBy(["postgres", "vector"]) === "hybrid", "الاثنان → hybrid");
  check(deriveMatchedBy(["knowledge_graph"]) === "lexical", "kg → lexical (لا يكسر عند تعطيل الدلالي)");

  // ٥) mapLinkedJudgments — السقوف وإزالة التكرار والترتيب بالثقة
  console.log("\n[mapLinkedJudgments]");
  const rows: ArticleCaseLinkRow[] = [
    jcLinkRow({ caseId: "c1", confidence: 0.5, judicialCase: { ...jcLinkRow().judicialCase!, id: "c1" } }),
    jcLinkRow({ caseId: "c2", confidence: 0.9, judicialCase: { ...jcLinkRow().judicialCase!, id: "c2" } }),
    jcLinkRow({ caseId: "c3", confidence: 0.7, judicialCase: { ...jcLinkRow().judicialCase!, id: "c3" } }),
    jcLinkRow({ caseId: "c4", confidence: 0.8, judicialCase: { ...jcLinkRow().judicialCase!, id: "c4" } }),
  ];
  const perArticleCapped = mapLinkedJudgments(rows, { perArticle: 2, total: 8 });
  check(perArticleCapped.length === 2, "سقف لكل مادة (perArticle=2) يُحترم");
  check(perArticleCapped[0].id === "c2", "الأعلى ثقةً أولاً داخل السقف");
  const totalCapped = mapLinkedJudgments(rows, { perArticle: 10, total: 3 });
  check(totalCapped.length === 3, "السقف الإجمالي (total=3) يُحترم");
  const dupRows = [
    jcLinkRow({ articleId: "a1", caseId: "dup", judicialCase: { ...jcLinkRow().judicialCase!, id: "dup" } }),
    jcLinkRow({ articleId: "a2", caseId: "dup", judicialCase: { ...jcLinkRow().judicialCase!, id: "dup" } }),
  ];
  check(mapLinkedJudgments(dupRows, { perArticle: 5, total: 8 }).length === 1, "إزالة تكرار الحكم عبر مواد متعدّدة");
  check(mapLinkedJudgments([], { perArticle: 3, total: 8 }).length === 0, "بلا روابط → فارغ (تدهور آمن)");
  const noCase = mapLinkedJudgments([jcLinkRow({ judicialCase: null })], { perArticle: 3, total: 8 });
  check(noCase.length === 0, "رابط بلا حكم → يُتخطّى");
  check(perArticleCapped[0].reason.includes("مرتبط"), "سبب الظهور يوضّح الارتباط بالمادة");

  // ٦) hasSufficientGrounding — يمنع الإجابة بلا مصدر/ثقة
  console.log("\n[grounding-guard]");
  check(hasSufficientGrounding(ctx()) === false, "بلا مصادر → غير كافٍ (يُحظر)");
  check(
    hasSufficientGrounding(
      ctx({ articles: [{ id: "a", title: "t", content: "c", lawName: "ل", articleNumber: 1, score: 0.9, reason: "r", weight: 0.9 }], confidence: 0.9 })
    ) === true,
    "مادة بثقة عالية → كافٍ"
  );
  check(
    hasSufficientGrounding(
      ctx({ articles: [{ id: "a", title: "t", content: "c", lawName: "ل", articleNumber: 1, score: 0.1, reason: "r", weight: 0.1 }], confidence: 0.1 })
    ) === false,
    "ثقة دون الحدّ الأدنى → غير كافٍ"
  );
  check(GROUNDING_FALLBACK.length > 0 && NO_EXPLICIT_TEXT.length > 0, "رسالتا الإسناد معرّفتان");

  // ٧) buildCitations — استشهادات من السياق فقط (لا اختلاق)
  console.log("\n[citation-engine]");
  const cContext = ctx({
    articles: [{ id: "a1", title: "مادة", content: "نص", lawName: "نظام العمل", articleNumber: 5, score: 0.8, reason: "r", weight: 0.8 }],
    rulings: [{ id: "r1", title: "حكم", text: "نص", caseNo: "1", decisionNo: "2", court: "ت", score: 0.6, reason: "r", weight: 0.6 }],
  });
  const cites = buildCitations(cContext);
  check(cites.length === 2, "استشهاد لكل مصدر في السياق");
  check(cites.some((c) => c.sourceId === "a1" && c.reference.includes("المادة (5)")), "مرجع المادة رسمي (نظام + رقم)");
  check(cites.every((c) => ["a1", "r1"].includes(c.sourceId)), "لا استشهاد بمصدر خارج السياق (منع الاختلاق)");
  check(buildCitations(ctx()).length === 0, "سياق فارغ → لا استشهادات");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجحت اختبارات الذكاء القانوني المُسنَد.");
}

main();
