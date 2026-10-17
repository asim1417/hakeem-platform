/**
 * HKM-023-B (القسم أ) — اختبارات عرض صفحة النظام بدوال نقية (lib/modules/legal-core/law-page-view.ts).
 * بلا قاعدة ولا متصفح ولا تبعية جديدة: `npx tsx scripts/test-law-page-view.ts`. الأسماء برموز الأمر (U-*).
 * البيانات اصطناعية موسومة «اصطناعي».
 */
import type { PreambleView, RepealInfo, LawPageData, ArticleView } from "../lib/modules/legal-core/law-page-data";
import { NOT_AVAILABLE, PREAMBLE_INCOMPLETE_LABEL, BOE_LAW_STATUSES } from "../lib/modules/legal-core/law-page-data";
import * as V from "../lib/modules/legal-core/law-page-view";

let passed = 0;
let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (c) passed++;
  else failed++;
};

const basePre: PreambleView = { kind: "none", label: null, completeness: null, units: null, sourceBlocks: null, legacy: null, officialSourceUrl: "https://laws.boe.gov.sa/اصطناعي" };

// ── U-4 المقدمة بحالاتها الثلاث (والرابعة: كتل المصدر) ──
{
  const units: PreambleView = {
    ...basePre,
    kind: "units",
    units: {
      editionId: "e1",
      source: { name: "هيئة الخبراء", url: "https://laws.boe.gov.sa/اصطناعي", retrievedOn: "2026-09-28" },
      rawSha256: "x",
      outside: [],
      instruments: [
        { index: 1, kind: "royal_decree", number: "م/0", dateHijri: "1400/1/1", heading: "مرسوم ملكي رقم (م/0) اصطناعي", anchor: "preamble-i1", units: [
          { id: "u1", type: "operative_clause", ordinal: 1, label: "أولاً", number: "1", text: "أولاً: اصطناعي", anchor: "preamble-i1-clause-1", path: "1" },
          { id: "u2", type: "operative_clause", ordinal: 2, label: "ثانياً", number: "2", text: "ثانياً: اصطناعي", anchor: "preamble-i1-clause-2", path: "2" },
        ] },
        { index: 2, kind: "cabinet_decision", number: "0", dateHijri: null, heading: "قرار مجلس الوزراء اصطناعي", anchor: "preamble-i2", units: [] },
      ],
    },
  };
  const d = V.preambleDisplay(units);
  ok(d.mode === "units" && d.tag === null && d.instrumentCount === 2 && d.clauseCount === 2, "U-4 preamble units: وحدات بلا وسم، أداتان وبندان");
  ok(V.preambleAnchor("preamble-i1-clause-2") === "preamble-1-clause-2", "U-4 مرساة البند بصيغة المواصفة #preamble-1-clause-2");
  ok(V.resolvePreambleAlias("#preamble-clause-2") === "preamble-1-clause-2", "U-4.4 الاسم البديل #preamble-clause-2 يعني الأداة الأولى");

  const legacy: PreambleView = { ...basePre, kind: "legacy_text", label: PREAMBLE_INCOMPLETE_LABEL, legacy: { text: "أداة الإصدار: مرسوم ملكي رقم (م/0) اصطناعي", chars: 40, royalDecree: null, completeness: "issuance_line" } };
  const l = V.preambleDisplay(legacy);
  ok(l.mode === "legacy" && l.tag === "مقدمة غير مكتملة" && l.sourceUrl === "https://laws.boe.gov.sa/اصطناعي", "U-4 preamble fallback to article zero: وسم «مقدمة غير مكتملة» ورابط المصدر");

  const none = V.preambleDisplay(basePre);
  ok(none.mode === "none" && /المقدمة غير متوفرة/.test(none.note ?? "") && Boolean(none.sourceUrl), "U-4 preamble missing: «المقدمة غير متوفرة» مع رابط المصدر");
  const noneNoSrc = V.preambleDisplay({ ...basePre, officialSourceUrl: null });
  ok(/ولا يتوفر رابط المصدر الرسمي/.test(noneNoSrc.note ?? ""), "U-4 preamble missing بلا مصدر: يصرّح بغياب الرابط");

  const blocks = V.preambleDisplay({ ...basePre, kind: "source_blocks", sourceBlocks: { blocks: [{ kind: "royal_decree", heading: "اصطناعي", text: "بعون الله (اصطناعي)" }], sourceUrl: "https://laws.boe.gov.sa/اصطناعي", retrievedOn: null } });
  ok(blocks.mode === "blocks" && blocks.tag === null, "U-4 كتل المصدر نص كامل بلا وسم «غير مكتملة» (§٧-٥)");
}

// ── U-4.1 الطي بعد ١٢ سطرًا ──
{
  ok(!V.shouldCollapse(V.estimateLines(["سطر واحد اصطناعي"])), "U-4.1 مقدمة قصيرة لا تُطوى (ولا زر)");
  ok(V.shouldCollapse(V.estimateLines(Array.from({ length: 13 }, () => "سطر اصطناعي"))), "U-4.1 ثلاثة عشر سطرًا تُطوى");
  ok(V.estimateLines(["ا".repeat(101)]) === 3, "U-4.1 السطر الطويل يُقدَّر بعرض ٥٠ حرفًا للجوال");
}

// ── U-2 البطاقة ──
{
  ok(V.orNA(null) === NOT_AVAILABLE && V.orNA("  ") === NOT_AVAILABLE && V.orNA("x") === "x", "U-2.1 الحقل الفارغ «غير متوفر» لا يُخفى");
  const tones = BOE_LAW_STATUSES.map((s) => V.statusTone(s));
  ok(JSON.stringify(tones) === JSON.stringify(["draft", "pending", "inforce", "inforce", "repealed", "repealed"]), "U-2.2 الحالات الست لكل منها شارة");
  ok(V.statusTone(null) === null, "U-2.2 لا شارة سابعة: غير الست = بلا شارة («غير متوفر»)");
  ok(V.statusRangeLine("ساري خلال مدة", null) === `من ${NOT_AVAILABLE} إلى ${NOT_AVAILABLE}`, "U-2.2 «خلال مدة» معها سطر المدة ولو غابت بياناتها");
  ok(V.statusRangeLine("ساري", null) === null, "U-2.2 «ساري» بلا سطر مدة");
}

// ── U-3 المرشحات وعدّاداتها ──
{
  const counts = { total: 10, inForce: 5, amended: 2, repealed: 3, unverified: 0 };
  const c = V.filterCounts(counts);
  ok(c.all === 10 && c.amended === 2 && c.repealed === 3 && c.live === 7, "U-3.3 العدّادات: الكل ١٠، المعدّل ٢، الملغى ٣، إخفاء الملغى ٧");
  const tones: V.ArticleTone[] = ["amended", "amended", "repealed", "repealed", "repealed", "plain", "plain", "plain", "plain", "plain"];
  ok(tones.filter((t) => V.matchesFilter(t, "amended")).length === c.amended, "U-3.3 «المعدّل فقط» يعرض عدد العدّاد");
  ok(tones.filter((t) => V.matchesFilter(t, "repealed")).length === c.repealed, "U-3.3 «الملغى فقط» يعرض عدد العدّاد");
  ok(tones.filter((t) => V.matchesFilter(t, "live")).length === c.live, "U-3.3 «إخفاء الملغى» يعرض الكل ناقص الملغى");
  ok(V.parseFilter("amended") === "amended" && V.parseFilter("x") === "all" && V.parseFilter(null) === "all", "U-3 المرشح من الرابط ?show= وما سواه «الكل»");
}

// ── U-3.1 البحث داخل النظام ──
{
  const t = "تُرفع الدَّعوى أمام المحكمة، والمحكمة تنظر الدعوى (اصطناعي).";
  const hits = V.findMatches(t, "الدعوى");
  ok(hits.length === 2, "U-3.1 البحث يتجاهل التشكيل ويطابق المرتين");
  ok(t.slice(hits[0][0], hits[0][1]) === "الدَّعوى", "U-3.1 مواضع المطابقة تعود إلى النص الأصلي بتشكيله");
  ok(V.findMatches("أحكام إضافية", "احكام").length === 1, "U-3.1 الهمزات موحّدة في المطابقة");
  ok(V.findMatches(t, "د").length === 0, "U-3.1 حرف واحد لا يُبحث به");
  ok(V.matchCounter(3, 12) === "٣ من ١٢" && V.matchCounter(0, 0) === "لا مطابقة", "U-3.1 العدّاد «٣ من ١٢» و«لا مطابقة»");
}

// ── U-5 المتن ──
{
  const p = V.splitParagraphs("نص المادة الافتتاحي (اصطناعي):\n1- الفقرة الأولى.\n2- الفقرة الثانية:\nأ- بند أول.\nب- بند ثان.");
  ok(p.length === 5 && p[0].num === null && p[1].num === "1-" && p[2].num === "2-" && p[3].item && p[4].item, "U-5.3 الفقرات أسطر منفصلة بترقيمها الأصلي والبنود بإزاحة");
  ok(p.map((x) => (x.num ? `${x.num} ${x.text}` : x.text)).join("\n").replace(/\s/g, "") === "نص المادة الافتتاحي (اصطناعي):\n1- الفقرة الأولى.\n2- الفقرة الثانية:\nأ- بند أول.\nب- بند ثان.".replace(/\s/g, ""), "U-5.3 التقسيم لا يغيّر النص");
  ok(V.splitParagraphs("نص واحد بلا ترقيم.").length === 1, "U-5.3 نص بلا فقرات كتلة واحدة");
  ok(V.articlesPhrase(0) === "لا مواد منشورة" && V.articlesPhrase(1) === "مادة واحدة" && V.articlesPhrase(2) === "مادتان" && V.articlesPhrase(7) === "٧ مواد" && V.articlesPhrase(721) === "٧٢١ مادة", "U-5 صيغة العدد (§٥)");
}

// ── U-6/U-7 الحالة والإلغاء ──
{
  ok(V.articleTone("معدّل") === "amended" && V.articleTone("ملغى") === "repealed" && V.articleTone("ساري") === "plain" && V.articleTone(null) === "plain", "U-6.1/U-7a.1 حالة العرض من حالة المادة");
  const r: RepealInfo = { type: "express_partial", typeDerived: true, instrument: "مرسوم ملكي رقم م/43 وتاريخ 1443/5/26هـ", url: null, quote: null, effectiveDate: null, effectiveDateSource: null, repealingSystem: { id: "s", name: "نظام الإثبات", slug: "نظام-الاثبات" }, repealingSystemBasis: "instrument_number", repealingArticle: null };
  const s = V.repealSentence(r);
  ok(s.includes("بموجب نظام الإثبات") && s.includes("م/43") && s.endsWith(`نافذة من ${NOT_AVAILABLE}.`), "U-7a.2 بيان الإلغاء: الأداة والنظام الملغي، وتاريخ النفاذ «غير متوفر» لا يُخترع");
  const withArt = V.repealSentence({ ...r, repealingArticle: { systemId: "s", articleNumber: 128 }, effectiveDate: "2022-07-08" });
  ok(withArt.startsWith("أُلغيت بالمادة 128 من نظام الإثبات") && withArt.includes("2022-07-08"), "U-7a.2 حين تتوفر المادة الملغية: «أُلغيت بالمادة ١٢٨ من نظام الإثبات»");
  ok(V.REPEAL_TYPE_LABEL.implicit === "إلغاء ضمني معتمد" && V.REPEAL_TYPE_LABEL.replacement === "إحلال نظام محل نظام", "U-7 تسميات نوع الإلغاء");
  const g = V.groupOutgoingRepeals([101, 102, 103, 150].map((n) => ({ systemId: "m", systemName: "نظام المرافعات (اصطناعي)", articleNumber: n })));
  ok(g.length === 2 && g[0].label === "المواد من 101 إلى 103 من نظام المرافعات (اصطناعي)" && g[1].label.startsWith("المادة 150"), "U-7a.3 ما ألغته الأداة مجمّع نطاقات لا سطرًا لكل مادة");
}

// ── U-9 كما في تاريخ ──
{
  const art = (over: Partial<ArticleView>): ArticleView => ({ id: "a", number: 1, title: null, heading: "المادة ١", chapter: null, text: "اصطناعي", effectiveText: "اصطناعي", status: null, statusLabel: "", statusSource: null, inheritedFromWork: false, amendment: null, repeal: null, repealedLaterOn: null, anchor: "art-1", url: "", ...over });
  const mk = (a: ArticleView[]) => ({ body: { divisions: [{ heading: null, articles: a, allRepealed: false }], counts: { total: a.length, inForce: 0, amended: 0, repealed: 0, unverified: 0 } } }) as Pick<LawPageData, "body">;
  ok(!V.hasHistory(mk([art({})])), "U-9.2 نظام بلا نسخ ولا إلغاء مؤرّخ: لا تاريخ");
  ok(V.hasHistory(mk([art({ amendment: { versions: 1, currentFrom: "2020-01-01", instrument: null, url: null, pendingFrom: null } })])), "U-9 نظام فيه نسخة: له تاريخ");
  ok(V.asOfMode(null, false) === "today" && V.asOfMode("2020-08-20", false) === "no_history" && V.asOfMode("2020-08-20", true) === "historical", "U-9.2 «كما في» بلا نسخ = no_history، لا يُعرض الحالي على أنه تاريخي");
  ok(V.noHistoryRequestedMessage("2020-08-20").includes("لا نص ذلك التاريخ") && V.NO_HISTORY_MESSAGE.startsWith("لا تتوفر نسخ تاريخية لهذا النظام بعد"), "U-9.2 نصا الرسالتين");
  ok(V.parseAsOfParam({ asof: "2020-08-20" }) === "2020-08-20" && V.parseAsOfParam({ asOf: "2020-08-20" }) === "2020-08-20" && V.parseAsOfParam({ asof: "1444-1-1" }) === null, "U-9 يُقبل asof وasOf بصيغة YYYY-MM-DD");
}

// ── U-15 الروابط الدائمة ──
{
  ok(V.lawPath("نظام-الاثبات") === `/law/${encodeURIComponent("نظام-الاثبات")}`, "U-15 رابط النظام /law/<معرّف>");
  ok(V.articlePath("m-43-1443", 5) === "/law/m-43-1443/art/5" && V.articleAnchor(5) === "art-5", "U-15.1 رابط المادة /law/<معرّف>/art/5 ومرساتها #art-5");
  const c = V.citationText("نظام اصطناعي", { number: 6, status: "ملغى", statusLabel: "ملغاة", repeal: { effectiveDate: "2022-07-08" } as RepealInfo }, "https://hakeemai.net/law/x/art/6");
  ok(c === "نظام اصطناعي، المادة (6) — ملغاة منذ 2022-07-08 — https://hakeemai.net/law/x/art/6", "U-15.3 «نسخ الإحالة» تحمل الرابط المستقل للمادة");
}

console.log(`\n${passed} نجح، ${failed} فشل`);
process.exitCode = failed ? 1 : 0;
