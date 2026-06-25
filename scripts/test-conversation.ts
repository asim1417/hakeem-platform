// اختبارات عقل المحادثة (Conversation Intelligence) — الحالات الإلزامية في الأمر.
// حتمية بالكامل (دون LLM ولا قاعدة بيانات): تتحقق أن حكيم يفهم الإنسان أولاً
// ولا يحلّل قبل وجود قضية.
import { detectIntentDeterministic } from "@/lib/modules/legal-chat/user-intent-engine";
import { classifyConversation, detectReportRequest } from "@/lib/modules/legal-chat/conversation-engine";
import { buildCaseFileFromIntent, isCaseSubstantive } from "@/lib/modules/legal-chat/case-file";
import { sourceRelevanceGate } from "@/lib/modules/legal-chat/anti-hallucination";
import { runChatTurn } from "@/lib/modules/legal-chat/chat-orchestrator";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";

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

async function asyncTests() {
  console.log("اختبار 12: التحية لا تُظهر تقريرًا ولا مصادر (orchestrator)");
  const greet = await runChatTurn({ message: "السلام عليكم ورحمة الله وبركاته", mode: "RESEARCHER", searchStrength: "BALANCED" });
  check("لا بطاقات عند التحية", greet.cards.length === 0, `cards=${greet.cards.length}`);
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
