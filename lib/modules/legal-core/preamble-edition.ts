/**
 * HKM-023-B ب-١/ب-٤ — تحويل تفكيك المقدمة إلى صفوف preamble_edition/preamble_unit، وكتابتها في معاملة.
 *
 * الكتابة هنا مخصّصة لخطوة النشر في مكتب التحرير (نوع التغيير import_preamble، انظر reports/hkm-023-b.md §ب-٤)
 * بعد اعتماد معتمِد غير المُعِدّ، ولاختبارات القاعدة المحلية. لا يستدعيها أي مسار ويب في هذا الفرع.
 * الكتابة على الإنتاج ف١١ للمالك. القاعدة نفسها ترفض ما لا يعيد النص حرفيًا (قيد مؤجل في الترحيل).
 */
import { createHash, randomUUID } from "node:crypto";
import { normalizeArabicText } from "./arabic-morphology";
import { parsePreamble, type PreambleParse } from "./preamble-parser";
import type { SqlClient } from "./sql-port";

export const PREAMBLE_SOURCES = ["أم القرى", "هيئة الخبراء بمجلس الوزراء"] as const;
export type PreambleSourceName = (typeof PREAMBLE_SOURCES)[number];

export interface PreambleEditionMeta {
  systemId: string;
  sourceName: PreambleSourceName;
  sourceUrl: string;
  /** YYYY-MM-DD */
  sourceRetrievedOn: string;
  sourceRecord?: string | null;
  legacyPreamble?: string | null;
  supersedesEditionId?: string | null;
  changeRef: string;
  preparedBy: string;
  approvedBy: string;
}

export interface PreambleEditionRow {
  id: string;
  system_id: string;
  raw_text: string;
  raw_sha256: string;
  source_name: string;
  source_url: string;
  source_retrieved_on: string;
  source_record: string | null;
  completeness: string;
  parser_version: string;
  units_count: number;
  legacy_preamble_sha256: string | null;
  supersedes_edition_id: string | null;
  change_ref: string;
  prepared_by: string;
  approved_by: string;
}

export interface PreambleUnitRow {
  id: string;
  edition_id: string;
  system_id: string;
  parent_id: string | null;
  unit_type: string;
  ordinal: number;
  instrument_index: number | null;
  instrument_kind: string | null;
  instrument_number: string | null;
  instrument_date_hijri: string | null;
  label_ar: string | null;
  number: string | null;
  text_raw: string;
  text_normalized: string | null;
  path: string;
  anchor: string | null;
  char_start: number;
  char_end: number;
}

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export class PreambleRejected extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(`رُفض التفكيك: ${reasons.join("؛ ")}`);
    this.name = "PreambleRejected";
    this.reasons = reasons;
  }
}

/** فحوص ما قبل الإرسال إلى الطابور (ب-٤). تعيد الأسباب، فارغة = صالح. */
export function checkPreambleImport(raw: string, meta: Pick<PreambleEditionMeta, "sourceName" | "sourceUrl" | "sourceRetrievedOn" | "preparedBy" | "approvedBy">, parse: PreambleParse): string[] {
  const reasons: string[] = [];
  if (!raw.length) reasons.push("النص فارغ");
  if (!PREAMBLE_SOURCES.includes(meta.sourceName)) reasons.push("المصدر ليس أم القرى ولا هيئة الخبراء");
  if (!/^https:\/\/(?:[a-z0-9-]+\.)*(?:uqn\.gov\.sa|boe\.gov\.sa)(?:\/|$)/i.test(meta.sourceUrl)) reasons.push("رابط المصدر ليس من uqn.gov.sa أو boe.gov.sa");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.sourceRetrievedOn)) reasons.push("تاريخ الاسترجاع ليس YYYY-MM-DD");
  if (!meta.preparedBy || !meta.approvedBy || meta.preparedBy === meta.approvedBy) reasons.push("المعتمِد يجب أن يكون غير المُعِدّ");
  if (!parse.reconstructionOk) reasons.push("إعادة التركيب لا تطابق النص حرفيًا");
  if (!parse.units.length) reasons.push("لا وحدات");
  return reasons;
}

/** صفوف النسخة ووحداتها من النص الخام. يرمي PreambleRejected إن لم تصلح. */
export function buildPreambleEditionRows(raw: string, meta: PreambleEditionMeta, idOf: () => string = randomUUID): { edition: PreambleEditionRow; units: PreambleUnitRow[]; parse: PreambleParse } {
  const parse = parsePreamble(raw);
  const reasons = checkPreambleImport(raw, meta, parse);
  if (reasons.length) throw new PreambleRejected(reasons);
  const editionId = idOf();
  const unitIds = parse.units.map(() => idOf());
  const units: PreambleUnitRow[] = parse.units.map((u, i) => ({
    id: unitIds[i],
    edition_id: editionId,
    system_id: meta.systemId,
    parent_id: u.parentOrdinal === null ? null : unitIds[u.parentOrdinal],
    unit_type: u.type,
    ordinal: u.ordinal,
    instrument_index: u.instrumentIndex,
    instrument_kind: u.type === "issuing_instrument" ? u.instrument?.kind ?? null : null,
    instrument_number: u.type === "issuing_instrument" ? u.instrument?.number ?? null : null,
    instrument_date_hijri: u.type === "issuing_instrument" ? u.instrument?.dateHijri ?? null : null,
    label_ar: u.label,
    number: u.number,
    text_raw: u.text,
    text_normalized: u.type === "issuing_instrument" ? null : normalizeArabicText(u.text),
    path: u.path,
    anchor: u.anchor,
    char_start: u.charStart,
    char_end: u.charEnd,
  }));
  const edition: PreambleEditionRow = {
    id: editionId,
    system_id: meta.systemId,
    raw_text: raw,
    raw_sha256: sha256(raw),
    source_name: meta.sourceName,
    source_url: meta.sourceUrl,
    source_retrieved_on: meta.sourceRetrievedOn,
    source_record: meta.sourceRecord ?? null,
    completeness: parse.completeness,
    parser_version: parse.parserVersion,
    units_count: units.length,
    legacy_preamble_sha256: meta.legacyPreamble ? sha256(meta.legacyPreamble) : null,
    supersedes_edition_id: meta.supersedesEditionId ?? null,
    change_ref: meta.changeRef,
    prepared_by: meta.preparedBy,
    approved_by: meta.approvedBy,
  };
  return { edition, units, parse };
}

const EDITION_COLS = [
  "id", "system_id", "raw_text", "raw_sha256", "source_name", "source_url", "source_retrieved_on", "source_record", "completeness",
  "parser_version", "units_count", "legacy_preamble_sha256", "supersedes_edition_id", "change_ref", "prepared_by", "approved_by",
] as const;
const UNIT_COLS = [
  "id", "edition_id", "system_id", "parent_id", "unit_type", "ordinal", "instrument_index", "instrument_kind", "instrument_number",
  "instrument_date_hijri", "label_ar", "number", "text_raw", "text_normalized", "path", "anchor", "char_start", "char_end",
] as const;

/**
 * يكتب النسخة ووحداتها على العميل المعطى. يجب أن يكون داخل معاملة (BEGIN … COMMIT): قيد إعادة التركيب مؤجل
 * إلى الالتزام، فإن خالف شيء رُدّت المعاملة كاملة.
 */
export async function insertPreambleEdition(tx: SqlClient, rows: { edition: PreambleEditionRow; units: PreambleUnitRow[] }): Promise<void> {
  const e = rows.edition;
  await tx.query(
    `INSERT INTO preamble_edition (${EDITION_COLS.map((c) => `"${c}"`).join(", ")}) VALUES (${EDITION_COLS.map((_, i) => `$${i + 1}`).join(", ")})`,
    EDITION_COLS.map((c) => e[c]),
  );
  // الآباء أولًا لقيد parent_id.
  const ordered = [...rows.units].sort((a, b) => Number(a.unit_type !== "issuing_instrument") - Number(b.unit_type !== "issuing_instrument") || a.ordinal - b.ordinal);
  for (const u of ordered) {
    await tx.query(
      `INSERT INTO preamble_unit (${UNIT_COLS.map((c) => `"${c}"`).join(", ")}) VALUES (${UNIT_COLS.map((_, i) => `$${i + 1}`).join(", ")})`,
      UNIT_COLS.map((c) => u[c]),
    );
  }
}
