/**
 * segment-store — صفوف ruling_segments ومناطق الحدود المفقودة (لإكمال التقطيع بالنموذج). دوال نقية.
 */
import { segmentRuling, SEGMENT_EXTRACTOR_VERSION } from "./segment";
import { contentHash } from "./meta";
import { buildRulingSearchNorm } from "@/lib/modules/legal-core/rulings-search";

/** الأجزاء المفهرسة لفظيًّا: علّة الحكم ونتيجته. */
const INDEXED = new Set(["reasons", "disposition"]);

export interface SegmentRow {
  ruling_id: string; part: string; start_char: number; end_char: number; confidence: number;
  part_norm: string | null; content_hash: string; segment_version: string;
}

export function segmentRows(id: string, text: string): SegmentRow[] {
  const hash = contentHash(text);
  return segmentRuling(text).segments.map((s) => ({
    ruling_id: id, part: s.type, start_char: s.start, end_char: s.end, confidence: s.confidence,
    part_norm: INDEXED.has(s.type) ? buildRulingSearchNorm(null, text.slice(s.start, s.end)) : null,
    content_hash: hash, segment_version: SEGMENT_EXTRACTOR_VERSION,
  }));
}


export type Missing = "claims" | "reasons" | "disposition";

/** مناطق الحدود المفقودة [start,end) في النص الأصلي. */
export function boundaryRegions(text: string): Array<{ missing: Missing; start: number; end: number }> {
  const seg = segmentRuling(text);
  if (!seg.needsModel) return [];
  const at = (t: string) => seg.segments.find((s) => s.type === t)?.start ?? null;
  const n = text.length;
  const out: Array<{ missing: Missing; start: number; end: number }> = [];
  const disp = at("disposition");
  const claims = at("claims");
  const defense = at("defense");
  const reasons = at("reasons");
  if (!seg.found.claims) out.push({ missing: "claims", start: 0, end: defense ?? reasons ?? disp ?? Math.round(n * 0.6) });
  if (!seg.found.reasons) out.push({ missing: "reasons", start: defense ?? claims ?? 0, end: disp ?? n });
  if (!seg.found.disposition) out.push({ missing: "disposition", start: Math.round(n * 0.6), end: n });
  return out.filter((r) => r.end > r.start);
}
