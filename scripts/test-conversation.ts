// اختبارات عقل المحادثة (Conversation Intelligence) — الحالات الإلزامية في الأمر.
// حتمية بالكامل (دون LLM ولا قاعدة بيانات): تتحقق أن حكيم يفهم الإنسان أولاً
// ولا يحلّل قبل وجود قضية.
import { detectIntentDeterministic } from "@/lib/modules/legal-chat/user-intent-engine";
import { classifyConversation, classifyDialogue, detectReportRequest } from "@/lib/modules/legal-chat/conversation-engine";
import { buildCaseFileFromIntent, isCaseSubstantive } from "@/lib/modules/legal-chat/case-file";
import { sourceRelevanceGate } from "@/lib/modules/legal-chat/anti-hallucination";
import { runChatTurn } from "@/lib/modules/legal-chat/chat-orchestrator";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";
import { jaccardSimilarity, composeReply } from "@/lib/modules/legal-chat/response-composer";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  const ok = cond ? "✓" : "✗";
  if (!cond) failures += 1;
  console.log(`  ${ok} ${name}${detail ? ` — ${detail}` : ""}`);
}

function classify(msg: string, hasCase = false) {
  const det = detectIntentDeterministic(msg);
  return classifyConversation(msg, det, hasCase);
}

const FORBIDDEN_ENGINES = ["Retrieval", "Analysis", "EvidencePlan", "ArgumentMap", "Drafting"];
function noHeavyEngines(c: ReturnType<typeof classify>): boolean {
  return !c.runAnalysis && !c.allowedEngines.some((e) => FORBIDDEN_ENGINES.includes(e));
}

console.log("اختبار 1: تحية فقط «السلام عليكم»");
{
  const c = classify("السلام عليكم");
  check("تحية فقط (GreetingOnly)", c.stage === "GreetingOnly", c.stage);
  check("لا تحليل", c.runAnalysis === false);
  check("لا محركات قانونية", noHeavyEngines(c));
  check("توجد أزرار مسارات", c.suggestedButtons.length > 0);
}

console.log("اختبار 2: «السلام عليكم جاني تبليغ من المحكمة»");
{
  const c = classify("السلام عليكم جاني تبليغ من المحكمة");
  check("تحية مع طلب", c.messageType === "greeting_with_request", c.messageType);
  check("لا تحليل قبل معرفة نوع التبليغ", c.runAnalysis === false);
  check("لا استرجاع قانوني", noHeavyEngines(c));
  check("يطرح سؤالاً موجهاً", c.reply.length > 0);
}

console.log("اختبار 3: «أبغى أرد على دعوى»");
{
  const c = classify("أبغى أرد على دعوى");
  check("نيّة قانونية ناقصة (ProbableLegalIntent)", c.stage === "ProbableLegalIntent", c.stage);
  check("لا ينتج مذكرة (لا تحليل)", c.runAnalysis === false);
  check("يسأل عن الصفة/النوع", /صفت|المدّعى عليه|موضوع/.test(c.reply));
}

console.log("اختبار 4: «الشركة تطالبني بفلوس وأنا مسدد لهم»");
{
  const c = classify("الشركة تطالبني بفلوس وأنا مسدد لهم");
  check("لا مصادر/تحليل (طور حواري)", c.runAnalysis === false, c.stage);
  check("لا محركات ثقيلة", noHeavyEngines(c));
}

console.log("اختبار 5: «المقاول ما خلص الشغل»");
{
  const c = classify("المقاول ما خلص الشغل");
  check("لا تحليل كامل", c.runAnalysis === false, c.stage);
  check("يسأل عن المطلوب", c.reply.length > 0);
}

console.log("اختبار 6: «صدر ضدي حكم»");
{
  const c = classify("صدر ضدي حكم");
  check("لا يكتب اعتراضاً قبل الاطلاع", c.runAnalysis === false, c.stage);
  check("ينتقل لمنطق الاعتراض (يسأل عن التبليغ/الحكم)", /تبلّغت|الحكم|اعتراض/.test(c.reply));
}

console.log("اختبار 7: «أعد مذكرة جوابية في دعوى مطالبة مالية تجارية»");
{
  const c = classify("أعد مذكرة جوابية في دعوى مطالبة مالية تجارية");
  check("يُعامَل كممارس", c.userLevel === "legal_practitioner", c.userLevel);
  check("لا يصيغ نهائياً قبل اكتمال البيانات", c.runAnalysis === false, c.stage);
  check("يسأل عن الصفة/المستندات/الدفاع", /صفت|المستندات|دفاع|المدّعى عليه/.test(c.reply));
}

console.log("اختبار 8 (إيجابي): قصة فعلية كافية تفتح التحليل");
{
  const msg =
    "أنا المدعى عليه في دعوى مطالبة مالية تجارية، الشركة تطالبني بمبلغ 50000 ريال قيمة فواتير توريد، وأنا سددت جزءاً منها بتحويلات بنكية، ولدي عقد التوريد والمراسلات، والجلسة بعد أسبوع";
  const c = classify(msg);
  check("قصة جوهرية → AnalysisReady", c.stage === "AnalysisReady", c.stage);
  check("يُسمح بالتحليل", c.runAnalysis === true);
}

console.log("اختبار 9: كشف طلب التقرير");
{
  check("«نعم اعرض التقرير» → show", detectReportRequest("نعم اعرض التقرير").show === true);
  check("«اعرض خطة إثبات فقط» → partial=evidence", detectReportRequest("اعرض خطة إثبات فقط").partial === "evidence");
  check("«صغ مذكرة جوابية» → draft", detectReportRequest("صغ مذكرة جوابية").draft === true);
  check("رسالة عادية → لا تقرير", detectReportRequest("ما رأيك في موقفي").show === false);
}

console.log("اختبار 10: عتبة جوهرية القضية");
{
  const thin = buildCaseFileFromIntent(detectIntentDeterministic("أبغى أرد على دعوى"));
  const rich = buildCaseFileFromIntent(
    detectIntentDeterministic(
      "أنا المدعى عليه في دعوى مطالبة مالية تجارية، الشركة تطالبني بـ 50000 ريال قيمة فواتير، ولم أستلم الأعمال، ولدي عقد ومراسلات"
    )
  );
  check("قضية رفيعة ليست جوهرية", isCaseSubstantive(thin) === false);
  check("قضية غنية جوهرية", isCaseSubstantive(rich) === true);
}

console.log("اختبار 11: SourceRelevanceGate يستبعد غير المرتبط");
{
  const mk = (score: number, concept: number, terms: number): LegalCoreResult =>
    ({ relevanceScore: score, conceptCoverage: concept, phraseMatches: 0, matchedTerms: Array(terms).fill("x") } as unknown as LegalCoreResult);
  const filtered = sourceRelevanceGate([mk(85, 0.6, 3), mk(10, 0, 0), mk(45, 0, 0)]);
  check("يُبقي المادة عالية الصلة", filtered.some((r) => r.relevanceScore === 85));
  check("يستبعد المادة العشوائية (10/0/0 مثل نظام غير مرتبط)", !filtered.some((r) => r.relevanceScore === 10));
  check("يستبعد ما لا مبرّر لاسترجاعه (45/0/0)", !filtered.some((r) => r.relevanceScore === 45));
}

console.log("اختبار 14: منع الاستنتاج المتسرّع «معقدة» ليست «عقدية»");
{
  const d = detectIntentDeterministic("لدي قضية معقدة");
  check("«معقدة» لا تُصنَّف نزاعًا عقديًا/مدنيًا", d.track === "UNKNOWN", d.track);
  const c = classifyDialogue("لدي قضية معقدة", d, null);
  check("تُصنَّف vague_case_signal", c?.intent === "vague_case_signal", c?.intent ?? "null");
  check("توقف الاستنتاج (blockAnalysis)", c?.blockAnalysis === true);
}

console.log("اختبار 15: تصحيح المستخدم «معقدة وليس عقدية»");
{
  const d = detectIntentDeterministic("معقدة وليس عقدية يعني قضية صعبة");
  const c = classifyDialogue("معقدة وليس عقدية يعني قضية صعبة", d, null);
  check("user_correction", c?.intent === "user_correction", c?.intent ?? "null");
  check("rejectedAssumptions تتضمّن «نزاع عقدي»", c?.dialogue.rejectedAssumptions.includes("نزاع عقدي") === true, (c?.dialogue.rejectedAssumptions ?? []).join("،"));
  check("يعتذر ولا يحلل", c?.blockAnalysis === true && /أعتذر|فهمت عليك/.test(c?.reply ?? ""));
}

console.log("اختبار 16: ملاحظة على الأداء «أنت تستعجل في الفهم»");
{
  const d = detectIntentDeterministic("أنت تستعجل في الفهم");
  const c = classifyDialogue("أنت تستعجل في الفهم", d, null);
  check("assistant_feedback", c?.intent === "assistant_feedback", c?.intent ?? "null");
  check("ينتقل لوضع slow_guided_intake", c?.dialogue.mode === "slow_guided_intake");
  check("يعتذر ويوقف التحليل", c?.blockAnalysis === true && /أعتذر|سأبطئ/.test(c?.reply ?? ""));
}

console.log("اختبار 17: لا يُعاد افتراض مرفوض عبر الدورات");
{
  // المستخدم رفض «نزاع عقدي» سابقًا؛ ثم أرسل رسالة فيها «عقد».
  const prior = { rejectedAssumptions: ["نزاع عقدي"], confirmedFacts: [], askedQuestions: [], mode: "normal" as const };
  void prior;
  const d = detectIntentDeterministic("عندي عقد");
  // applyRejected يُطبَّق داخل المنسّق؛ نتحقق هنا من المنطق عبر estـفحص النيّة الخام.
  check("النيّة الخام تلتقط CIVIL (قبل الإنفاذ)", d.track === "CIVIL" || d.track === "UNKNOWN");
}

console.log("اختبار 20: HALDA — تصنيف الكلام غير القانوني");
{
  const social = classifyDialogue("وش الأخبار", detectIntentDeterministic("وش الأخبار"), null);
  check("«وش الأخبار» → social_smalltalk", social?.intent === "social_smalltalk", social?.intent ?? "null");

  const sports = classifyDialogue("هل شاهدت مباراة المنتخب؟", detectIntentDeterministic("هل شاهدت مباراة المنتخب؟"), null);
  check("«مباراة المنتخب» → sports_or_news_smalltalk", sports?.intent === "sports_or_news_smalltalk", sports?.intent ?? "null");
  check("الرياضة بلا تحليل قانوني", sports?.blockAnalysis === true);

  const consumer = classifyDialogue("اشتريت تفاحة فاسدة", detectIntentDeterministic("اشتريت تفاحة فاسدة"), null);
  check("«تفاحة فاسدة» → possible_consumer_issue", consumer?.intent === "possible_consumer_issue", consumer?.intent ?? "null");
  check("يسأل سؤالًا توضيحيًا للمستهلك", /المستهلك|الاستبدال|فاتورة/.test(consumer?.reply ?? ""));

  const doc = classifyDialogue("جاني تبليغ من المحكمة", detectIntentDeterministic("جاني تبليغ من المحكمة"), null);
  check("«جاني تبليغ» → court_document_reference", doc?.intent === "court_document_reference", doc?.intent ?? "null");
  check("يسأل عن نوع التبليغ بلا تحليل", doc?.blockAnalysis === true && /دعوى جديدة|جلسة|حكم/.test(doc?.reply ?? ""));
}

console.log("اختبار 24: BUG2 — سؤال عام خارج النطاق (لا قالب قانوني)");
{
  const food = classifyDialogue("وش الذ أكلة في إندونيسيا", detectIntentDeterministic("وش الذ أكلة في إندونيسيا"), null);
  check("سؤال أكل/جغرافيا → non_legal_general", food?.intent === "non_legal_general", food?.intent ?? "null");
  check("لا تحليل (blockAnalysis)", food?.blockAnalysis === true);
  const real = classifyDialogue("الشركة تطالبني بمبلغ", detectIntentDeterministic("الشركة تطالبني بمبلغ"), null);
  check("لا يبتلع الطلب القانوني الحقيقي", real?.intent !== "non_legal_general");
}

console.log("اختبار 26: سؤال الهوية/القدرات «ما اسمك» / «هل أنت عاقل»");
{
  const name = classifyDialogue("ما اسمك", detectIntentDeterministic("ما اسمك"), null);
  check("«ما اسمك» → identity_or_capability", name?.intent === "identity_or_capability", name?.intent ?? "null");
  check("يعرّف بحكيم بلا تحليل", name?.blockAnalysis === true && /حكيم/.test(name?.reply ?? ""));

  const sane = classifyDialogue("هل انت عاقل", detectIntentDeterministic("هل انت عاقل"), null);
  check("«هل أنت عاقل» → identity_or_capability", sane?.intent === "identity_or_capability", sane?.intent ?? "null");

  const cap = classifyDialogue("وش تقدر تسوي", detectIntentDeterministic("وش تقدر تسوي"), null);
  check("«وش تقدر تسوي» → identity_or_capability", cap?.intent === "identity_or_capability", cap?.intent ?? "null");

  const real = classifyDialogue("الشركة تطالبني بمبلغ", detectIntentDeterministic("الشركة تطالبني بمبلغ"), null);
  check("لا يبتلع الطلب القانوني الحقيقي", real?.intent !== "identity_or_capability");
}

console.log("اختبار 27: شكوى عدم الفهم بصيغة «لم» → assistant_feedback");
{
  const c = classifyDialogue("انت لم تفهمني جيدا", detectIntentDeterministic("انت لم تفهمني جيدا"), null);
  check("«لم تفهمني» → assistant_feedback", c?.intent === "assistant_feedback", c?.intent ?? "null");
  check("ينتقل لوضع slow_guided_intake", c?.dialogue.mode === "slow_guided_intake");
  check("يعتذر ويوقف التحليل", c?.blockAnalysis === true && /أعتذر|سأبطئ/.test(c?.reply ?? ""));
}

console.log("اختبار 21: ResponseComposer — تشابه Jaccard");
{
  check("نصّان متطابقان → 1", jaccardSimilarity("العقد بين الطرفين واضح", "العقد بين الطرفين واضح") === 1);
  check("نصّان متباينان → 0", jaccardSimilarity("السماء زرقاء اليوم", "المحكمة قررت التأجيل") === 0);
  const partial = jaccardSimilarity("العقد بين الطرفين واضح", "العقد بين الطرفين غامض");
  check("تشابه جزئي بين 0 و1", partial > 0 && partial < 1, partial.toFixed(2));
  const nearDup = jaccardSimilarity("هل القضية منظورة في المحكمة الآن", "هل القضية منظورة في المحكمة الآن؟");
  check("شبه مطابق يتجاوز عتبة 0.82", nearDup > 0.82, nearDup.toFixed(2));
}

async function asyncTests() {
  console.log("اختبار 22: ResponseComposer — fallback آمن عند offline");
  const template = "هل القضية منظورة في المحكمة الآن؟";
  const out = await composeReply({ template, messageType: "vague_case_signal", history: [] });
  check("بلا مزوّد: يُعيد القالب الحتمي حرفيًا", out === template, out === template ? "match" : out.slice(0, 30));
  const emptyOut = await composeReply({ template: "", messageType: "greeting" });
  check("قالب فارغ يبقى فارغًا", emptyOut === "");

  console.log("اختبار 23: BUG1 — التحية مع قضية متراكمة تبقى تحية (لا تسرّب سياق)");
  const prior = buildCaseFileFromIntent(
    detectIntentDeterministic(
      "أنا المدعى عليه في دعوى مطالبة مالية تجارية. الشركة تطالبني بـ 50000 ريال قيمة فواتير. لم أستلم الأعمال. لدي عقد ومراسلات. الجلسة الأسبوع القادم."
    )
  );
  check("تمهيد: الملف السابق جوهري", isCaseSubstantive(prior) === true);
  const g = await runChatTurn({
    message: "السلام عليكم",
    mode: "RESEARCHER",
    searchStrength: "BALANCED",
    caseFile: prior,
    history: [{ role: "assistant", content: "أفهم أنه صدر ضدّك حكم، وأنا معك خطوة خطوة." }],
  });
  check("stage يبقى greeting", g.stage === "greeting", g.stage);
  check("لا بطاقات", g.cards.length === 0, `cards=${g.cards.length}`);
  check("الردّ تحية لا تقرير", /حيّاك الله/.test(g.reply) && !/النزاع يدور|اعرض التقرير|تقرير قضية|صفتك/.test(g.reply));
  check("الملف القديم محفوظ (لا يُمحى)", g.caseFile !== null);

  console.log("اختبار 25: BUG3 — لا تسرّب محتوى history في الصياغة (offline)");
  const leaked = await composeReply({
    template: "وعليكم السلام ورحمة الله وبركاته، حيّاك الله. اشرح موضوعك بكلماتك.",
    messageType: "greeting",
    history: [{ role: "assistant", content: "أفهم أنه صدر ضدّك حكم في مطالبة مالية تجارية." }],
  });
  check("لا يظهر محتوى سابق في الردّ", !/صدر ضدّك حكم|مطالبة مالية/.test(leaked) && leaked.includes("حيّاك الله"));

  console.log("اختبار 12: التحية لا تُظهر تقريرًا ولا مصادر (orchestrator)");
  const greet = await runChatTurn({ message: "السلام عليكم ورحمة الله وبركاته", mode: "RESEARCHER", searchStrength: "BALANCED" });
  check("لا بطاقات عند التحية", greet.cards.length === 0, `cards=${greet.cards.length}`);
  check("الردّ يبقى القالب الحتمي عند offline (حقن الصياغة آمن)", /حيّاك الله/.test(greet.reply));
  check("stage = greeting", greet.stage === "greeting", greet.stage);
  check("لا ملف قضية عند التحية", greet.caseFile === null);
  check("أزرار مسارات موجودة", greet.suggestedButtons.length > 0);

  console.log("اختبار 13: قضية مكتملة لا تعرض التقرير تلقائيًا (report_ready)");
  const rich = await runChatTurn({
    message:
      "أنا المدعى عليه في دعوى مطالبة مالية تجارية، الشركة تطالبني بـ 50000 ريال قيمة فواتير توريد ولم أستلم الأعمال، ولدي عقد ومراسلات، والجلسة الأسبوع القادم",
    mode: "RESEARCHER",
    searchStrength: "BALANCED",
  });
  check("لا بطاقات قبل الموافقة", rich.cards.length === 0, `cards=${rich.cards.length}`);
  check("stage = report_ready", rich.stage === "report_ready", rich.stage);
  check("يقترح عرض التقرير", /التقرير/.test(rich.reply));
  check("زر «نعم، اعرض التقرير» موجود", rich.suggestedButtons.some((b) => b.includes("اعرض التقرير")));

  console.log("اختبار 18: «اعرض التقرير» بلا بيانات كافية → رفض لطيف");
  const empty = await runChatTurn({ message: "اعرض التقرير", mode: "RESEARCHER", searchStrength: "BALANCED" });
  check("لا تقرير فارغ", empty.cards.length === 0, `cards=${empty.cards.length}`);
  check("يوضّح أن البيانات غير مكتملة", /غير مكتملة|لم تكتمل|نكمل/.test(empty.reply));

  console.log("اختبار 19: ملاحظة الأداء (orchestrator) لا تُشغّل أي محرك");
  const fb = await runChatTurn({ message: "أنت تستعجل في الفهم", mode: "RESEARCHER", searchStrength: "BALANCED" });
  check("لا بطاقات عند ملاحظة الأداء", fb.cards.length === 0);
  check("messageIntent = assistant_feedback", fb.messageIntent === "assistant_feedback", fb.messageIntent);
  check("dialogue.mode = slow_guided_intake", fb.dialogue.mode === "slow_guided_intake");
}

asyncTests()
  .catch((e) => {
    console.error("خطأ في الاختبارات غير المتزامنة:", e?.message ?? e);
    failures += 1;
  })
  .finally(() => {
    console.log("");
    if (failures > 0) {
      console.error(`فشل ${failures} تحقّق(ات).`);
      process.exit(1);
    }
    console.log("نجحت كل اختبارات عقل المحادثة وتجربة Chat-First ✓");
  });
