import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStructure, isProceduralDecision, segmentRuling } from "../segment";

// نص اصطناعي بترتيب الحكم المعتاد (كتلة واحدة بلا أسطر، كما في القاعدة).
const ruling =
  "الحمد لله وحده أما بعد فلدى الدائرة التجارية الأولى وبناء على القضية المحالة " +
  "تتلخص وقائع هذه الدعوى في أن المدعي تقدم بلائحة يطلب فيها إلزام المدعى عليه بسداد مبلغ مائة ألف ريال قيمة توريد " +
  "وبعرض ذلك على المدعى عليه أجاب بأنه سدد جزءًا من المبلغ ودفع بعدم سماع الدعوى " +
  "وحيث إن المدعي يطلب إلزام المدعى عليه بالمبلغ ولما كان المدعى عليه قد أقر بأصل الدين وبما أن الإقرار حجة على المقر " +
  "لذلك حكمت الدائرة بإلزام المدعى عليه بأن يدفع للمدعي مبلغًا قدره سبعون ألف ريال " +
  "وقرر المدعى عليه عدم القناعة بالحكم ورفع الاعتراض إلى محكمة الاستئناف " +
  "وصلى الله وسلم على نبينا محمد";

test("التقطيع الكامل بالقواعد", () => {
  const s = segmentRuling(ruling);
  assert.deepEqual(s.segments.map((x) => x.type), ["header", "claims", "defense", "reasons", "disposition", "appeal", "other"]);
  assert.equal(s.needsModel, false);
  const byType = Object.fromEntries(s.segments.map((x) => [x.type, ruling.slice(x.start, x.end)]));
  assert.ok(byType.claims.startsWith("تتلخص وقائع"));
  assert.ok(byType.defense.startsWith("وبعرض ذلك"));
  assert.ok(byType.reasons.startsWith("وحيث إن"));
  assert.ok(byType.disposition.startsWith("لذلك حكمت الدائرة"));
  assert.ok(byType.appeal.startsWith("القناعة") || byType.appeal.includes("القناعة"));
  assert.ok(byType.other.startsWith("وصلى الله"));
});

test("الشرط الهيكلي: تغطية كاملة متجاورة ومرتبة", () => {
  const s = segmentRuling(ruling);
  assert.deepEqual(checkStructure(s, ruling.length), { contiguous: true, ordered: true });
});

test("«إلزام» في الطلبات لا تُعدّ منطوقًا، والمنطوق هو المرسى المتأخر", () => {
  const s = segmentRuling(ruling);
  const d = s.segments.find((x) => x.type === "disposition")!;
  assert.ok(d.start > ruling.indexOf("وحيث إن"));
});

test("الإزاحات صحيحة مع الكشيدة", () => {
  const t = ruling.replace("لذلك حكمت", "لذلـــك حكمت");
  const s = segmentRuling(t);
  const d = s.segments.find((x) => x.type === "disposition")!;
  assert.ok(t.slice(d.start).startsWith("لذلـــك حكمت"));
  assert.deepEqual(checkStructure(s, t.length), { contiguous: true, ordered: true });
});

test("بلا مرسى أسباب يُوسم للنموذج", () => {
  const t = "تتلخص وقائع الدعوى في أن المدعي يطلب كذا لذلك حكمت الدائرة برفض الدعوى";
  const s = segmentRuling(t);
  assert.equal(s.found.reasons, false);
  assert.equal(s.needsModel, true);
  assert.equal(checkStructure(s, t.length).contiguous, true);
});

test("نص فارغ", () => {
  assert.equal(segmentRuling("").segments.length, 0);
});

test("صيغة «تتحصل وقائع» تبدأ الدعوى", () => {
  const t = "الحمد لله أما بعد فلدى الدائرة التجارية تتحصل وقائع هذه الدعوى بالقدر اللازم لإصدار هذا الحكم في أن المدعي يطلب كذا وحيث إن الثابت كذا لذلك حكمت الدائرة بإلزامه";
  const s = segmentRuling(t);
  const c = s.segments.find((x) => x.type === "claims")!;
  assert.ok(t.slice(c.start).startsWith("تتحصل وقائع"));
  assert.equal(s.needsModel, false);
});

test("قالب الهيئة الدائمة: الطلب ثم الأسباب ثم القرار", () => {
  const t = "الحمد لله وحده والصلاة والسلام على نبينا محمد وبعد ففي يوم كذا انعقدت الدائرة الخامسة بالمحكمة العليا المشكلة من [اسم] رئيسًا وذلك للنظر في طلب النقض المقدم من [اسم] على الحكم الصادر وبعد الاطلاع على الأوراق ودراستها وبعد المداولة وحيث إن محل الاعتراض لم يقم على أي من الحالات لذلك قررت الدائرة عدم قبول طلب النقض وصلى الله وسلم على نبينا محمد";
  const s = segmentRuling(t, { permanentPanel: true });
  assert.deepEqual(s.segments.map((x) => x.type), ["header", "claims", "reasons", "disposition", "other"]);
  assert.equal(s.needsModel, false);
  assert.deepEqual(checkStructure(s, t.length), { contiguous: true, ordered: true });
});

test("«فأجاب قائلًا» و«وبعرضها على وكيل» تبدأ الإجابة", () => {
  for (const cue of ["فأجاب قائلا", "وبعرضها على وكيل المدعى عليها", "وقدم مذكرة جوابية"]) {
    const t = `تتحصل وقائع هذه الدعوى في أن المدعي يطلب إلزام المدعى عليها بالمبلغ ${cue} إن المبلغ مسدد وحيث إن الثابت كذا لذلك حكمت الدائرة برفض الدعوى`;
    const d = segmentRuling(t).segments.find((x) => x.type === "defense");
    assert.ok(d, cue);
    assert.ok(t.slice(d!.start).startsWith(cue.replace(/^وقدم /, "")) || t.slice(d!.start, d!.start + 30).includes("مذكرة"), cue);
  }
});

// ── v4: القرارات الإجرائية المرحلية ليست منطوقًا، وعنوان «الأسباب:» الصريح ──
const interim =
  "الحمد لله وحده وبعد فلدى الدائرة التجارية الثانية " +
  "تتلخص وقائع هذه الدعوى في أن المدعي يطلب إلزام المدعى عليها بسداد مبلغ خمسين ألف ريال قيمة أعمال منفذة. " +
  "وبعرض الدعوى على وكيل المدعى عليها أجاب بأن الأعمال لم تنجز في موعدها المتفق عليه. " +
  "وفي الجلسة المنعقدة بتاريخ كذا طلب وكيل المدعى عليها مهلة للرد على ما قدمه المدعي فقررت الدائرة إمهاله، ثم قررت الدائرة تأجيل الجلسة. " +
  "وفي الجلسة المنعقدة بتاريخ كذا قدم الطرفان ما لديهما ثم قررت الدائرة قفل باب المرافعة لصلاحية القضية للحكم فيها." +
  "الأسباب:وقد حصر المدعي طلباته في إلزام المدعى عليها بالمبلغ وحيث إن المدعى عليها لم تقدم ما يثبت إنجاز الأعمال " +
  "نص الحكم: حكمت الدائرة بإلزام المدعى عليها بأن تدفع للمدعي خمسين ألف ريال. " +
  "وصلى الله وسلم على نبينا محمد";

test("v4: «قررت الدائرة تأجيل/قفل باب المرافعة» ليست منطوقًا، والأسباب تبدأ عند «الأسباب:»", () => {
  const s = segmentRuling(interim);
  const part = (t: string) => {
    const x = s.segments.find((y) => y.type === t)!;
    return interim.slice(x.start, x.end);
  };
  assert.ok(part("disposition").startsWith("نص الحكم:"), part("disposition").slice(0, 20));
  assert.ok(part("reasons").startsWith("الأسباب:"));
  assert.ok(part("defense").includes("قررت الدائرة تأجيل الجلسة"));
  assert.ok(part("defense").includes("قفل باب المرافعة"));
  assert.equal(s.needsModel, false);
  assert.equal(s.version, "segment-rules-v4");
  assert.deepEqual(checkStructure(s, interim.length), { contiguous: true, ordered: true });
});

test("v4: بلا عنوان «الأسباب:» يُتجاوز القرار المرحلي إلى المنطوق القاطع", () => {
  const t = interim.replace("الأسباب:وقد", " وقد").replace("نص الحكم: حكمت", "لذلك حكمت");
  const s = segmentRuling(t);
  const d = s.segments.find((x) => x.type === "disposition")!;
  assert.ok(t.slice(d.start).startsWith("لذلك حكمت الدائرة"));
  assert.deepEqual(checkStructure(s, t.length), { contiguous: true, ordered: true });
});

test("v4: العنوان الصريح «(منطوق الحكم)» يبدأ المنطوق ولو سبقه «قررت الدائرة» مرحليًّا", () => {
  const t = interim.replace("نص الحكم: حكمت الدائرة بإلزام", "(منطوق الحكم) إلزام");
  const s = segmentRuling(t);
  const d = s.segments.find((x) => x.type === "disposition")!;
  assert.ok(t.slice(d.start).startsWith("(منطوق الحكم)"), t.slice(d.start, d.start + 20));
  assert.deepEqual(checkStructure(s, t.length), { contiguous: true, ordered: true });
});

test("v4: «لذلك حكمت الدائرة بما يلي: نص الحكم:» يبدأ المنطوق من «لذلك»", () => {
  const t = interim.replace("نص الحكم: حكمت الدائرة بإلزام", "لذلك حكمت الدائرة بما يلي: نص الحكم: إلزام");
  const d = segmentRuling(t).segments.find((x) => x.type === "disposition")!;
  assert.ok(t.slice(d.start).startsWith("لذلك حكمت الدائرة بما يلي"));
});

test("v4: قرار مرحلي وحده لا يُعدّ منطوقًا فيُوسم للنموذج", () => {
  const t = "تتلخص وقائع الدعوى في أن المدعي يطلب كذا وحيث إن القضية تحتاج إلى خبرة. قررت الدائرة إحالة القضية إلى الخبير المحاسب";
  const s = segmentRuling(t);
  assert.equal(s.found.disposition, false);
  assert.equal(s.needsModel, true);
  assert.equal(checkStructure(s, t.length).contiguous, true);
});

test("v4: تمييز القرار الإجرائي من المنطوق", () => {
  const procedural = [
    "قررت الدائرة تأجيل الجلسة", "قررت المحكمة بالإجماع قفل باب المرافعة", "قررت الدائرة إعادة فتح باب المرافعة",
    "قررت الدائرة إمهال المدعى عليه", "قررت الدائرة شطب الدعوى", "قررت الدائرة حجز القضية للنطق بالحكم",
    "قررت الدائرة الاكتفاء بما قدم", "قررت الدائرة رفع الجلسة", "قررت الدائرة في هذه الجلسة إحالة الدعوى",
    "قررت الدائرة بتأجيل النظر", "لذلك قررت الدائرة تأجيل الجلسة", "قررت الدائرة ندب خبير",
  ];
  const decisive = [
    "قررت الدائرة عدم سماع الدعوى", "لذلك قررت الدائرة نقض الحكم", "قررت الدائرة رفض الدعوى",
    "قررت المحكمة إلزام المدعى عليه", "قررت الدائرة عدم قبول طلب النقض",
  ];
  for (const t of procedural) assert.equal(isProceduralDecision(t, 0), true, t);
  for (const t of decisive) assert.equal(isProceduralDecision(t, 0), false, t);
});

test("v4: مرسى الدعوى المتأخر لا يضخم الديباجة — بداية احتياطية من محضر الجلسة", () => {
  const minutes = "وطلب الحاضر مهلة لإحضار المستندات المؤيدة لما يذكره عن المعاملة ".repeat(8);
  for (const cue of ["افتتحت الجلسة", "حضر وكيل المدعي", "وردت صحيفة الدعوى"]) {
    const t = `الحمد لله وحده وبعد فلدى الدائرة الثالثة ${cue} بتاريخ كذا ${minutes}وتتلخص وقائع الدعوى في أن المدعي يطلب المبلغ ` +
      "وحيث إن الثابت كذا لذلك حكمت الدائرة بإلزام المدعى عليه بالمبلغ";
    const s = segmentRuling(t);
    const c = s.segments.find((x) => x.type === "claims")!;
    assert.ok(t.slice(c.start).startsWith(cue.replace(/^وردت /, "")), cue);
    assert.equal(c.confidence, 0.6);
    assert.deepEqual(checkStructure(s, t.length), { contiguous: true, ordered: true }, cue);
  }
  // مرسى دعوى مبكر: لا تُستعمل البداية الاحتياطية.
  const early = "الحمد لله تتلخص وقائع الدعوى في أن المدعي حضر المدعي وطلب كذا وحيث إن الثابت كذا لذلك حكمت الدائرة برفض الدعوى";
  const c = segmentRuling(early).segments.find((x) => x.type === "claims")!;
  assert.ok(early.slice(c.start).startsWith("تتلخص وقائع"));
  assert.equal(c.confidence, 0.8);
});

test("v4: صيغ بداية الدعوى التي فاتت v3 فتضخمت الديباجة", () => {
  const pad = "وبناء على المعاملة المحالة إلى هذه الدائرة برقم كذا وتاريخ كذا ".repeat(6);
  for (const cue of ["فادعى المدعي قائلا", "وتقدمت المدعية بطلب", "أقامت الشركة المدعية دعواها", "بموجب صحيفة دعوى", "الوقائع: يطلب المدعي"]) {
    const t = `الحمد لله وحده ${pad}${cue} إلزام المدعى عليه بالمبلغ ${pad}وحيث إن الثابت كذا لذلك حكمت الدائرة برفض الدعوى`;
    const s = segmentRuling(t);
    const c = s.segments.find((x) => x.type === "claims");
    assert.ok(c, cue);
    assert.equal(t.slice(c!.start, c!.start + cue.length), cue, cue);
    assert.deepEqual(checkStructure(s, t.length), { contiguous: true, ordered: true }, cue);
  }
});
