import { test } from "node:test";
import assert from "node:assert/strict";
import { findAnchors, headerCandidates, stripTatweel } from "../anchors";

const ruling = [
  "الوقائع:",
  "تتحصل وقائع هذه الدعوى في أن المدعي تقدم بلائحة.",
  "الأسباب",
  "وحيث إن المدعي يطلب إلزام المدعى عليه بالمبلغ، ولما كان المدعى عليه قد أقر بالدين،",
  "وبمـــا أن الإقرار حجة على المقر.",
  "لذلك حكمت الدائرة بإلزام المدعى عليه بأن يدفع للمدعي مبلغًا قدره ١٠٠٠ ريال.",
  "وقررت الدائرة الاستئنافية تأييد الحكم.",
].join("\n");

test("تُرصد العناوين والتسبيب والمنطوق والاستئناف", () => {
  const hits = findAnchors(ruling);
  const labels = (f: string) => hits.filter((h) => h.family === f).map((h) => h.label);
  assert.deepEqual(labels("section"), ["الوقائع", "الأسباب"]);
  assert.deepEqual(labels("reasoning"), ["وحيث إن", "ولما كان", "وبما أن"]);
  assert.ok(labels("disposition").includes("لذلك حكمت الدائرة/المحكمة"));
  assert.ok(labels("appeal").includes("تأييد"));
  assert.ok(labels("evidence").includes("إقرار"));
});

test("الإزاحات تخص النص الأصلي حتى مع الكشيدة", () => {
  const hit = findAnchors(ruling).find((h) => h.label === "وبما أن")!;
  assert.equal(ruling.slice(hit.start, hit.end), "وبمـــا أن");
  const h2 = findAnchors(ruling).find((h) => h.label === "وحيث إن")!;
  assert.equal(ruling.slice(h2.start, h2.end), "وحيث إن");
});

test("كلمة «دفع» داخل الجملة ليست عنوانًا", () => {
  const hits = findAnchors("وطلب أن يدفع المدعى عليه المبلغ");
  assert.equal(hits.filter((h) => h.family === "section").length, 0);
});

test("خريطة حذف الكشيدة", () => {
  const { text, map } = stripTatweel("الـبيع");
  assert.equal(text, "البيع");
  assert.equal(map[2], 3);
});

test("العناوين المرشحة أسطر قصيرة قائمة بنفسها", () => {
  const c = headerCandidates("الوقائع:\nنص طويل جدًا يتجاوز خمس كلمات في هذا السطر هنا\nالأسباب\nالمادة 12");
  assert.deepEqual(c, ["الوقائع", "الأسباب", "المادة #"]);
});
