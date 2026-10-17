// بصمة حمولة الدفعة (ق-٦): تُحسب من صفوف القاعدة لا من مدخلات العميل،
// عند الإرسال (تُخزَّن في change_set.payload_hash) ثم يُعاد حسابها عند كل قرار وعند النشر.
import { fingerprint } from "./audit";

export interface PayloadSetPart {
  id: string;
  kind: string;
  reverts_change_set_id: string | null;
}

export interface PayloadChangePart {
  id: string;
  target_type: string;
  target_id: string;
  op: string;
  before: unknown;
  after: unknown;
  evidence_instrument: string | null;
  evidence_url: string | null;
  evidence_quote: string | null;
  source_rank: number | null;
  source_ref: string | null;
  domain: string | null;
}

/** المحتوى الثابت وحده (لا الحالة ولا الفحوص ولا التواريخ)، بترتيب ثابت للمفاتيح والتغييرات. */
export function payloadHash(set: PayloadSetPart, changes: readonly PayloadChangePart[]): string {
  const rows = [...changes]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => ({
      id: c.id,
      target_type: c.target_type,
      target_id: c.target_id,
      op: c.op,
      before: c.before ?? null,
      after: c.after ?? null,
      evidence_instrument: c.evidence_instrument ?? null,
      evidence_url: c.evidence_url ?? null,
      evidence_quote: c.evidence_quote ?? null,
      source_rank: c.source_rank === null || c.source_rank === undefined ? null : Number(c.source_rank),
      source_ref: c.source_ref ?? null,
      domain: c.domain ?? "",
    }));
  return fingerprint({
    set: { id: set.id, kind: set.kind, reverts_change_set_id: set.reverts_change_set_id ?? null },
    changes: rows,
  }) as string;
}
