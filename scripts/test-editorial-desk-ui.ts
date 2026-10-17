/**
 * اختبارات منطق واجهة المكتب النقي (components/editorial/logic.ts) — بلا React ولا DOM ولا قاعدة ولا تبعيات.
 * تُستدعى من scripts/test-editorial-desk.ts ضمن الجزء النقي، وتعمل وحدها أيضًا:
 *   npx tsx scripts/test-editorial-desk-ui.ts
 * تغطي: مهلة التراجع وإيقافها (ق٢، ق٢٧)، والتحديد الظاهر وحده (ق١-٣، ق٧-٢)، والتصحيح المعبأ وإرسال ما تغيّر وحده
 * وصيغتي التاريخ (ق٨)، ونصوص المهلة والنتيجة مع تعدد الموافقات (ق٢٣-٤)، والتركيز بعد القرار (ق٤-٤، ق٢٦-٢)،
 * وجمل حوار الإعدادات وإعادة تطبيق التغييرات بعد التعارض (٧-٤).
 */
import type { EditorialConfig } from "../lib/modules/editorial/policy";
import {
  bindingSummary,
  CHANGES_NOUN,
  correctionDiff,
  countNoun,
  eligibleApprovers,
  eligibleVisible,
  fmtDateTime,
  impactLines,
  initialCorrection,
  leavesMyQueue,
  nextUndecided,
  normalizeDateInput,
  OPS_NOUN,
  pauseCountdown,
  pendingLine,
  reapplyChanges,
  remainingMs,
  resultLine,
  resumeCountdown,
  secondsLeft,
  settingsChanges,
  startCountdown,
  UNDO_WINDOW_MS,
  visibleSelection,
  unsavedChanges,
  type CorrectionSource,
} from "../components/editorial/logic";

type Ok = (condition: boolean, message: string) => void;

const baseConfig = (): EditorialConfig => ({
  bindings: [
    { userId: "u-r", kind: "human", roles: ["reviewer"], itemKinds: "all", domains: "all", enabled: true },
    { userId: "u-e", kind: "human", roles: ["editor_laws"], itemKinds: ["set_work_status"], domains: ["civil"], enabled: true },
  ],
  policies: {
    set_work_status: { minApprovals: 1, ownerSelfApproval: true, enabled: true },
    review_amendment_op: { minApprovals: 1, ownerSelfApproval: true, enabled: true },
    review_principle: { minApprovals: 1, ownerSelfApproval: true, enabled: true },
    revert: { minApprovals: 1, ownerSelfApproval: true, enabled: true },
  },
});

const USERS = [
  { id: "u-r", name: "نورة", email: "noura@example.test", role: "LAWYER" },
  { id: "u-e", name: "سالم", email: "salem@example.test", role: "LAWYER" },
  { id: "u-n", name: "هند", email: "hind@example.test", role: "LAWYER" },
];

export function runDeskUiTests(ok: Ok) {
  console.log("\n— منطق واجهة المكتب (نقي) —");

  // ── مهلة التراجع: ست ثوانٍ، وتتوقف حين تُخفى الصفحة وتستأنف بما بقي (ق٢، ق٢٧) ──
  ok(UNDO_WINDOW_MS === 6000, "نافذة التراجع ست ثوانٍ");
  const c0 = startCountdown(1_000);
  ok(remainingMs(c0, 1_000) === 6000 && secondsLeft(c0, 1_000) === 6, "العدّاد يبدأ بست ثوانٍ");
  ok(secondsLeft(c0, 2_500) === 5 && remainingMs(c0, 7_000) === 0 && remainingMs(c0, 9_000) === 0, "العدّاد يتناقص ولا ينزل تحت الصفر");
  const paused = pauseCountdown(c0, 3_000);
  ok(paused.deadline === null && remainingMs(paused, 60_000) === 4000, "الإيقاف يجمّد ما بقي مهما طال الإخفاء");
  ok(pauseCountdown(paused, 70_000) === paused, "إيقاف الموقوف لا يغيّره");
  const resumed = resumeCountdown(paused, 100_000);
  ok(resumed.deadline === 104_000 && remainingMs(resumed, 101_000) === 3000, "الاستئناف يكمل بما بقي من لحظة العودة");
  ok(resumeCountdown(resumed, 200_000) === resumed, "استئناف الجاري لا يغيّره");

  // ── التحديد الجماعي: الظاهر المحدد وحده، والمؤهل غير المعلّق وحده (ق١-٣، ق٧-٢) ──
  const visible = ["a", "b", "c", "d"];
  ok(JSON.stringify(visibleSelection(new Set(["x", "c", "a", "z"]), visible)) === JSON.stringify(["a", "c"]), "الجماعي يرسل المحدد الظاهر في الصفحة الحالية وحده، بترتيب ظهوره");
  ok(visibleSelection(new Set(["x", "y"]), visible).length === 0, "تحديد من صفحة سابقة لا يُرسل شيئًا");
  const sel = eligibleVisible([
    { id: "a", eligible: true, blocked: false },
    { id: "b", eligible: false, blocked: false },
    { id: "c", eligible: true, blocked: true },
    { id: "d", eligible: true, blocked: false },
  ]);
  ok(JSON.stringify(sel) === JSON.stringify(["a", "d"]), "«تحديد المؤهَّل الظاهر» يستثني غير المؤهل والمعلّق والمقرر");

  // ── التصحيح: معبأ بالمقترح، ويرسل ما تغيّر وحده، ويقبل الشرطة المائلة والشرطة (ق٨) ──
  const item: CorrectionSource = {
    article_number: 11,
    paragraph_label: null,
    effective_from_hijri: "1447-01-01",
    effective_from_gregorian: "2025-06-26",
    new_text: "نص المادة الجديد",
    op_type: "replace_article_text",
    old_phrase: null,
    new_phrase: null,
    target_law_title: "نظام الإثبات",
  };
  const init = initialCorrection(item);
  ok(init.article_number === "11" && init.new_text === "نص المادة الجديد" && init.target_law_title === "نظام الإثبات", "ق٨-١: الحقول معبأة بالقيم المقترحة");
  ok(init.effective_from_hijri === "1447/01/01" && init.effective_from_gregorian === "2025/06/26", "التاريخ معبأ بالشرطة المائلة كما يُعرض في البطاقة");
  const none = correctionDiff(init, { ...init });
  ok(Object.keys(none.changed).length === 0 && Object.keys(none.errors).length === 0, "ق٨-٣: بلا تغيير لا شيء يُرسل");
  const one = correctionDiff(init, { ...init, article_number: "12" });
  ok(JSON.stringify(one.changed) === JSON.stringify({ article_number: 12 }), "ق٨-٢: تغيير حقل واحد يرسل مفتاحه وحده");
  ok(Object.keys(correctionDiff(init, { ...init, effective_from_hijri: "1447-01-01" }).changed).length === 0, "التاريخ نفسه بالشرطة لا يُعد تغييرًا");
  ok(Object.keys(correctionDiff(init, { ...init, effective_from_hijri: "١٤٤٧/١/١" }).changed).length === 0, "التاريخ نفسه بالأرقام الهندية وبلا أصفار لا يُعد تغييرًا");
  const slash = correctionDiff(init, { ...init, effective_from_hijri: "1447/05/17" });
  ok(slash.changed.effective_from_hijri === "1447-05-17" && !slash.errors.effective_from_hijri, "ق٨-٤: «1447/05/17» يُقبل ويُرسل بصيغة الخادم");
  ok(normalizeDateInput(" ١٤٤٧/٠٥/١٧ ") === "1447-05-17", "تطبيع التاريخ من الأرقام الهندية والشرطة المائلة");
  ok(Boolean(correctionDiff(init, { ...init, effective_from_hijri: "17/05/1447" }).errors.effective_from_hijri), "ق٨-٤: صيغة هجرية خاطئة = رسالة تحت الحقل نفسه");
  ok(Boolean(correctionDiff(init, { ...init, effective_from_gregorian: "2026/02/30" }).errors.effective_from_gregorian), "تاريخ ميلادي غير موجود = رسالة تحت الحقل");
  ok(correctionDiff(init, { ...init, effective_from_gregorian: "2026/2/3" }).changed.effective_from_gregorian === "2026-02-03", "التاريخ الميلادي يُكمَّل بالأصفار");
  ok(Boolean(correctionDiff(init, { ...init, article_number: "0" }).errors.article_number), "رقم مادة خارج المدى = رسالة تحت الحقل");
  ok(Boolean(correctionDiff(init, { ...init, new_text: "  " }).errors.new_text), "تفريغ حقل معبأ لا يُرسل بل يُنبَّه عليه");
  ok(correctionDiff(init, { ...init, article_number: "١٣" }).changed.article_number === 13, "رقم المادة بالأرقام الهندية يُقبل");

  // ── نصوص المهلة والنتيجة مع تعدد الموافقات (ق٢-١، ق٢٣-٤، ٦-٨) ──
  const label = "OP-1 — نظام الإثبات";
  ok(pendingLine("approve", label, { approvals: 0, required: 1 }) === `سيُعتمد ${label}`, "حين تكفي موافقة واحدة: «سيُعتمد …»");
  ok(pendingLine("approve", label, { approvals: 0, required: 2 }) === `ستُسجَّل موافقتك على ${label} (١ من ٢)`, "ق٢٣-٤: حين المطلوب موافقتان: «ستُسجَّل موافقتك على … (١ من ٢)»");
  ok(pendingLine("agree", label, { approvals: 1, required: 2 }, "approved_with_edit") === `سيُطبَّق اعتماد مع التصحيح ${label}`, "الموافقة المكمّلة تذكر القرار المعروض الذي سيُطبَّق");
  ok(pendingLine("agree", label, { approvals: 1, required: 3 }, "approved").endsWith("(٢ من ٣)"), "الموافقة غير المكمّلة تذكر التقدم");
  ok(pendingLine("reject", label, { approvals: 0, required: 1 }) === `سيُرفض ${label}`, "سطر مهلة الرفض");
  ok(pendingLine("rejectShown", label, { approvals: 1, required: 2 }).startsWith("سيُرفض القرار المعروض"), "رفض القرار المعروض يرفضه كله");
  ok(resultLine(label, { status: "published", approvals: 1, requiredApprovals: 1, decision: "approved" }).text === `اعتُمدت ${label}.`, "سطر نتيجة الاعتماد");
  const waitLine = resultLine(label, { status: "pending", approvals: 1, requiredApprovals: 2, decision: "approved" });
  ok(waitLine.tone === "wait" && waitLine.text.includes("(١ من ٢)"), "٦-٨: نتيجة موافقة لم تكتمل «وافقتَ على … (١ من ٢)»");
  ok(resultLine(label, { status: "rejected", approvals: 0, requiredApprovals: 2, decision: "rejectShown" }).text.includes("عادت إلى الطابور"), "رفض القرار المعروض يعيد العنصر بلا قرار");
  ok(pendingLine("approve", "الدفعة «س»", { approvals: 0, required: 1 }, null, "f") === "ستُعتمد الدفعة «س»", "سطر مهلة الدفعة بصيغة المؤنث");
  ok(resultLine("المبدأ «م»", { status: "published", approvals: 1, requiredApprovals: 1, decision: "approve" }, "m").text === "اعتُمد المبدأ «م».", "سطر نتيجة المبدأ بصيغة المذكر");
  ok(resultLine("المبدأ «م»", { status: "published", approvals: 1, requiredApprovals: 1, decision: "reject" }, "m").text === "رُفض المبدأ «م».", "رفض المبدأ بصيغة المذكر");
  ok(waitLine.text.endsWith("أُرسلت لمعتمِد آخر."), "نص المواصفة لنتيجة موافقة العملية «أُرسلت لمعتمِد آخر»");
  ok(leavesMyQueue({ status: "published", approvals: 1, requiredApprovals: 1 }) && leavesMyQueue({ status: "pending", approvals: 1, requiredApprovals: 2 }), "ق٢٤-٢: ينقص عدّاد «ينتظر قراري» بعد نجاح الاعتماد أو الموافقة");
  ok(!leavesMyQueue({ status: "rejected", approvals: 0, requiredApprovals: 2, decision: "rejectShown" }), "رفض القرار المعروض لا ينقص العدّاد (يعود العنصر)");

  // ── التركيز بعد القرار (ق٤-٤، ق٢٦-٢، ق٢٩) ──
  const order = ["a", "b", "c", "d"];
  ok(nextUndecided(order, new Set(["a", "b"]), "a") === "c", "التركيز إلى أول بطاقة غير مقررة بعد المقررة");
  ok(nextUndecided(order, new Set(["a", "b", "c", "d"]), "b") === null, "لا بطاقة بعدها: null فيذهب التركيز إلى زر العناصر التالية");
  ok(nextUndecided(order, new Set(["a"]), null) === "b", "بعد الجماعي: أول غير مقررة في الصفحة");

  // ── الأعداد والتاريخ ──
  ok(countNoun(1, OPS_NOUN) === "عملية واحدة" && countNoun(2, OPS_NOUN) === "عمليتان", "العدد ١ و٢ بصيغتهما");
  ok(countNoun(3, OPS_NOUN) === "٣ عمليات" && countNoun(11, OPS_NOUN) === "١١ عملية", "٣–١٠ جمع، و١١ فأكثر مفرد منصوب");
  ok(countNoun(103, CHANGES_NOUN) === "١٠٣ تغييرات", "المئات تتبع آخر رقمين");
  ok(
    unsavedChanges(1) === "تغيير واحد غير محفوظ" && unsavedChanges(2) === "تغييران غير محفوظين" && unsavedChanges(3) === "٣ تغييرات غير محفوظة" && unsavedChanges(12) === "١٢ تغييرًا غير محفوظ",
    "شريط الحفظ: الصفة تطابق العدد",
  );
  ok(fmtDateTime("not-a-date") === "—", "تاريخ غير صالح يُعرض «—»");
  ok(fmtDateTime("2026-10-17T05:10:00Z") === fmtDateTime(new Date("2026-10-17T05:10:00Z")), "التاريخ نفسه يُنسَّق بالنتيجة نفسها من نص أو كائن");

  // ── الإعدادات: جمل المراجعة، والكفاية، وإعادة التطبيق بعد التعارض (٧-٣، ٧-٤) ──
  const before = baseConfig();
  const after = baseConfig();
  after.bindings[0].roles = ["reviewer", "publisher"];
  after.bindings.splice(1, 1);
  after.bindings.push({ userId: "u-n", kind: "human", roles: ["qa_view"], itemKinds: "all", domains: "all", enabled: false });
  after.policies.set_work_status.minApprovals = 2;
  const lines = settingsChanges(before, after, USERS);
  ok(lines.includes("منح «ناشر» لـ نورة"), "جملة منح دور بالاسم لا بالمعرّف");
  ok(lines.includes("إزالة تكليف سالم"), "جملة إزالة تكليف");
  ok(lines.some((l) => l.startsWith("إضافة تكليف لـ هند") && l.includes("(معطّل)")), "جملة إضافة تكليف معطّل");
  ok(lines.includes("رفع موافقات «تغيير حالة نظام» من ١ إلى ٢"), "جملة رفع الموافقات");
  ok(settingsChanges(before, baseConfig(), USERS).length === 0, "لا تغيير = لا جملة");
  ok(impactLines(0, 0).length === 0, "ق٣١: أثر صفر = لا جملة");
  ok(JSON.stringify(impactLines(1, 2)) === JSON.stringify(["تسقط موافقات قائمة على دفعة معلّقة واحدة.", "ترتفع الموافقات المطلوبة على دفعتين معلّقتين."]), "ق٣١: جمل الأثر تطابق العدد");
  ok(impactLines(5, 0)[0] === "تسقط موافقات قائمة على ٥ دفعات معلّقة." && impactLines(0, 12)[0] === "ترتفع الموافقات المطلوبة على ١٢ دفعةً معلّقة.", "ق٣١: الجمع والتمييز");
  ok(eligibleApprovers(before, "review_amendment_op") === 2, "المعتمِدون المؤهلون: المالك ومراجع مفعّل");
  const disabled = baseConfig();
  disabled.bindings[0].enabled = false;
  ok(eligibleApprovers(disabled, "review_amendment_op") === 1, "التكليف المعطّل لا يُحسب في الكفاية");
  ok(bindingSummary(before.bindings[1]) === "محرر الأنظمة · تغيير حالة نظام · المعاملات المدنية", "ملخص الصف المطوي بأسماء عربية");

  const latest = baseConfig();
  latest.bindings[0].roles = ["reviewer", "qa_view"]; // غيّر غيري دورًا آخر على التكليف نفسه
  latest.policies.revert.enabled = false;
  const re = reapplyChanges(before, after, latest, USERS);
  const nora = re.config.bindings.find((b) => b.userId === "u-r");
  ok(Boolean(nora && nora.roles.includes("publisher") && nora.roles.includes("qa_view")), "إعادة التطبيق تضيف دوري ولا تمحو دور غيري على التكليف نفسه");
  ok(!re.config.bindings.some((b) => b.userId === "u-e") && re.config.bindings.some((b) => b.userId === "u-n"), "إعادة التطبيق تزيل ما أزلته وتضيف ما أضفته");
  ok(re.config.policies.set_work_status.minApprovals === 2 && re.config.policies.revert.enabled === false, "إعادة التطبيق تغيّر حقلي وحده وتبقي تغيير غيري في السياسات");
  ok(re.failed.length === 0, "لا إخفاق حين بقيت الأهداف");
  const gone = baseConfig();
  gone.bindings = gone.bindings.filter((b) => b.userId !== "u-r");
  const re2 = reapplyChanges(before, after, gone, USERS);
  ok(re2.failed.some((f) => f.includes("نورة") && f.includes("أُزيل")), "تعديل تكليف أُزيل في النسخة الأحدث يُسرد ولا يُطبَّق");
}

// تشغيل منفرد.
if (process.argv[1] && /test-editorial-desk-ui\.ts$/.test(process.argv[1])) {
  let passed = 0;
  let failed = 0;
  runDeskUiTests((condition, message) => {
    if (condition) {
      passed += 1;
      console.log("✓ " + message);
    } else {
      failed += 1;
      console.error("✗ " + message);
    }
  });
  console.log(`\n${passed} ناجح، ${failed} فاشل`);
  if (failed) process.exit(1);
}
