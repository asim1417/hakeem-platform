import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStructure, segmentRuling } from "../segment";

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
