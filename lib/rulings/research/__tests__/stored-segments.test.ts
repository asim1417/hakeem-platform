import { test } from "node:test";
import assert from "node:assert/strict";
import { validStoredSegments, type StoredSegmentRow } from "../stored-segments";
import { contentHash } from "../meta";
import { SEGMENT_EXTRACTOR_VERSION } from "../segment";
import { buildRulingExcerpts } from "@/lib/modules/legal-core/ruling-excerpts";
import { maskBySegments, maskedRulingExcerpts } from "@/lib/mcp/ruling-privacy";

// حكم بلا عناوين «الأسباب:» ولا «منطوق الحكم:» — القواعد لا تجد حدّيهما، والنموذج أكملهما.
const text =
  "إنه في يوم الأحد عقدت الدائرة جلستها للنظر في الدعوى المقامة من شركة النور ضد مؤسسة الفجر بشأن عقد توريد. " +
  "وحيث إن الغبن الفاحش لا يثبت إلا ببينة ولم يقدم المدعي بينة على ذلك فإن الدعوى حقيقة بالرفض. " +
  "فلهذه الأسباب حكمت الدائرة برفض الدعوى.";
const reasonsAt = text.indexOf("وحيث إن الغبن");
const dispAt = text.indexOf("فلهذه الأسباب");
const hash = contentHash(text);
const version = `${SEGMENT_EXTRACTOR_VERSION}+segment-model-v1`;
const row = (part: string, start: number, end: number, over: Partial<StoredSegmentRow> = {}): StoredSegmentRow => ({
  ruling_id: "r1", part, start_char: start, end_char: end, content_hash: hash, segment_version: version, ...over,
});
const rows = [row("disposition", dispAt, text.length), row("header", 0, reasonsAt), row("reasons", reasonsAt, dispAt)];

test("الأجزاء المخزّنة تُعتمد متى طابقت بصمة النص ونسخة القواعد، مرتبةً بالموضع", () => {
  const segs = validStoredSegments(rows, text);
  assert.deepEqual(segs?.map((s) => s.type), ["header", "reasons", "disposition"]);
  assert.equal(segs?.[1].start, reasonsAt);
});

test("بصمة لا تطابق النص الحالي (تغيّر النص بعد التقطيع) = لا أجزاء مخزّنة", () => {
  assert.equal(validStoredSegments(rows, text + " "), null);
  assert.equal(validStoredSegments([...rows.slice(0, 2), row("reasons", reasonsAt, dispAt, { content_hash: "x" })], text), null);
});

test("نسخة قواعد قديمة أو مختلطة = لا أجزاء مخزّنة", () => {
  assert.equal(validStoredSegments(rows.map((r) => ({ ...r, segment_version: "segment-rules-v3" })), text), null);
  assert.equal(validStoredSegments([...rows.slice(0, 2), row("reasons", reasonsAt, dispAt, { segment_version: SEGMENT_EXTRACTOR_VERSION })], text), null);
  assert.ok(validStoredSegments(rows.map((r) => ({ ...r, segment_version: SEGMENT_EXTRACTOR_VERSION })), text));
});

test("إزاحات خارج النص أو متداخلة أو جزء مجهول = لا أجزاء مخزّنة", () => {
  assert.equal(validStoredSegments([row("reasons", reasonsAt, text.length + 5)], text), null);
  assert.equal(validStoredSegments([row("header", 0, reasonsAt + 3), row("reasons", reasonsAt, dispAt)], text), null);
  assert.equal(validStoredSegments([row("preamble", 0, reasonsAt)], text), null);
  assert.equal(validStoredSegments([], text), null);
});

test("المقتطف يقرأ الحدود المخزّنة: الأسباب والمنطوق كما أكملها النموذج", () => {
  const segs = validStoredSegments(rows, text)!;
  const ex = buildRulingExcerpts(text, "", 320, segs);
  assert.equal(ex.matchedIn, "reasons");
  assert.ok(ex.snippet.startsWith("وحيث إن الغبن"));
  assert.ok(ex.disposition?.startsWith("فلهذه الأسباب"));
  const hit = buildRulingExcerpts(text, "الغبن", 320, segs);
  assert.equal(hit.matchedIn, "reasons");
});

test("الحجب جزءًا جزءًا بالحدود المخزّنة، والمقتطف المحجوب من الأسباب", () => {
  const segs = validStoredSegments(rows, text)!;
  const { parts } = maskBySegments(text, segs);
  assert.deepEqual(parts.map((p) => p.type), ["header", "reasons", "disposition"]);
  const ex = maskedRulingExcerpts(text, "", null, segs);
  assert.ok(ex.snippet.startsWith("وحيث إن الغبن"));
  assert.ok(ex.disposition?.startsWith("فلهذه الأسباب"));
});
