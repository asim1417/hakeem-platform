/**
 * stored-segments — أجزاء الحكم المخزّنة في ruling_segments للعرض (المقتطف وhakeem_get_ruling).
 *
 * التقطيع وقت السؤال بالقواعد لا يرى الحدود التي أكملها النموذج (segment-model). فتُقرأ الأجزاء المخزّنة
 * ويُعتمد عليها فقط متى:
 *   - طابقت بصمة النص (content_hash = sha256 للنص الحالي) — النص لم يتغير بعد التقطيع؛
 *   - وكانت بنسخة القواعد الحالية (segment_version = SEGMENT_EXTRACTOR_VERSION أو «…+نموذج») — القواعد لم تتقدم بعده؛
 *   - وكانت الإزاحات سليمة (داخل النص، مرتبة، بلا تداخل).
 * وإلا يُسقط إلى التقطيع بالقواعد كما كان (السقوط مغلقًا). أي خطأ في القراءة = لا أجزاء مخزّنة.
 */
import { prisma } from "@/lib/prisma";
import { contentHash } from "./meta";
import { SEGMENT_EXTRACTOR_VERSION, type SegmentType } from "./segment";
import type { PlainSegment } from "./segment-model";

export interface StoredSegmentRow {
  ruling_id: string;
  part: string;
  start_char: number;
  end_char: number;
  content_hash: string;
  segment_version: string;
}

const TYPES = new Set<SegmentType>(["header", "claims", "defense", "evidence", "reasons", "disposition", "appeal", "other"]);

const currentVersion = (v: string) => v === SEGMENT_EXTRACTOR_VERSION || v.startsWith(`${SEGMENT_EXTRACTOR_VERSION}+`);

/** صفوف حكم واحد ← أجزاؤه إن صلحت للنص الحالي، وإلا null. دالة نقية. */
export function validStoredSegments(rows: StoredSegmentRow[], text: string): PlainSegment[] | null {
  if (!rows.length) return null;
  const hash = contentHash(text);
  const version = rows[0].segment_version;
  if (!currentVersion(version)) return null;
  const segs: PlainSegment[] = [];
  for (const r of rows) {
    if (r.content_hash !== hash || r.segment_version !== version || !TYPES.has(r.part as SegmentType)) return null;
    const start = Number(r.start_char);
    const end = Number(r.end_char);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return null;
    segs.push({ type: r.part as SegmentType, start, end });
  }
  segs.sort((a, b) => a.start - b.start);
  for (let i = 1; i < segs.length; i++) if (segs[i].start < segs[i - 1].end) return null;
  return segs;
}

let _ready: { at: number; ok: boolean } | null = null;

async function segmentsReady(): Promise<boolean> {
  if (_ready && Date.now() - _ready.at < 10 * 60_000) return _ready.ok;
  const r = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM "ruling_segments" LIMIT 1) AS ok`,
  ).catch(() => [{ ok: false }]);
  _ready = { at: Date.now(), ok: Boolean(r?.[0]?.ok) };
  return _ready.ok;
}

/** للاختبار: يفرغ حفظ الجاهزية. */
export function clearStoredSegmentsReady(): void {
  _ready = null;
}

/** الأجزاء المخزّنة الصالحة لكل حكم (المعرّف ← نصه الحالي). ما لا يصلح لا يُعاد. */
export async function loadStoredSegments(texts: Map<string, string>): Promise<Map<string, PlainSegment[]>> {
  const out = new Map<string, PlainSegment[]>();
  const ids = [...texts.keys()];
  if (!ids.length || !(await segmentsReady())) return out;
  const rows = await prisma.$queryRawUnsafe<StoredSegmentRow[]>(
    `SELECT "ruling_id","part","start_char","end_char","content_hash","segment_version"
     FROM "ruling_segments" WHERE "ruling_id" = ANY($1::text[])`,
    ids,
  ).catch(() => [] as StoredSegmentRow[]);
  const byId = new Map<string, StoredSegmentRow[]>();
  for (const r of rows) {
    const list = byId.get(r.ruling_id);
    if (list) list.push(r);
    else byId.set(r.ruling_id, [r]);
  }
  for (const [id, list] of byId) {
    const segs = validStoredSegments(list, texts.get(id) ?? "");
    if (segs) out.set(id, segs);
  }
  return out;
}
