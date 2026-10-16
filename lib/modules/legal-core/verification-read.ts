import { prisma } from "@/lib/prisma";
import type { UnitVersionRecord, VerificationRecord } from "./verified-status";

type VerificationRow = {
  id: string;
  verified_status: string;
  evidence_instrument: string | null;
  evidence_url: string | null;
  evidence_quote: string | null;
  verified_at: Date;
};

function mapVerification(row: VerificationRow): VerificationRecord {
  return {
    id: row.id,
    verifiedStatus: row.verified_status,
    evidenceInstrument: row.evidence_instrument,
    evidenceUrl: row.evidence_url,
    evidenceQuote: row.evidence_quote,
    verifiedAt: new Date(row.verified_at).toISOString(),
  };
}

/** آخر سجل تحقق. غياب الجدول أو الصف = بلا حالة مؤكدة. */
export async function latestVerification(objectType: string, objectId: string): Promise<VerificationRecord | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<VerificationRow[]>(
      `SELECT id, verified_status, evidence_instrument, evidence_url, evidence_quote, verified_at
       FROM verification
       WHERE object_type = $1 AND object_id = $2
       ORDER BY verified_at DESC, id DESC
       LIMIT 1`,
      objectType,
      objectId,
    );
    return rows[0] ? mapVerification(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function latestVerifications(objectType: string, objectIds: string[]): Promise<Map<string, VerificationRecord>> {
  const out = new Map<string, VerificationRecord>();
  if (!objectIds.length) return out;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<VerificationRow & { object_id: string }>>(
      `SELECT DISTINCT ON (object_id) object_id, id, verified_status, evidence_instrument, evidence_url, evidence_quote, verified_at
       FROM verification
       WHERE object_type = $1 AND object_id = ANY($2::text[])
       ORDER BY object_id, verified_at DESC, id DESC`,
      objectType,
      objectIds,
    );
    for (const row of rows) out.set(row.object_id, mapVerification(row));
  } catch {
    /* الجدول غير مطبَّق بعد */
  }
  return out;
}

export async function unitVersions(unitId: string): Promise<UnitVersionRecord[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      body: string;
      valid_from: Date;
      evidence_instrument: string | null;
      evidence_url: string | null;
    }>>(
      `SELECT id, body, valid_from, evidence_instrument, evidence_url
       FROM unit_version WHERE unit_id = $1 ORDER BY valid_from ASC`,
      unitId,
    );
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      validFrom: new Date(r.valid_from).toISOString(),
      evidenceInstrument: r.evidence_instrument,
      evidenceUrl: r.evidence_url,
    }));
  } catch {
    return [];
  }
}

export async function storedInstrumentKinds(ids: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (!ids.length) return out;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; instrument_kind: string | null }>>(
      `SELECT id, instrument_kind FROM legal_systems WHERE id = ANY($1::text[])`,
      ids,
    );
    for (const row of rows) out.set(row.id, row.instrument_kind);
  } catch {
    /* العمود غير مطبَّق بعد */
  }
  return out;
}

export interface IssuanceInstrument {
  instrumentKind: string;
  instrumentNo: string;
  instrumentDateHijri: string;
  approvingClause: string;
  sourceUrl: string;
}

/** بند اعتماد العمل من منطقة الاستقبال. غياب الجدول = لا شيء. */
export async function issuanceInstrument(lawTitle: string): Promise<IssuanceInstrument | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      instrument_kind: string;
      instrument_no: string;
      instrument_date_hijri: string;
      approving_clause: string;
      source_url: string;
    }>>(
      `SELECT instrument_kind, instrument_no, instrument_date_hijri, approving_clause, source_url
       FROM uqn_fix.issuance_instrument
       WHERE law_title = $1
       ORDER BY id DESC
       LIMIT 1`,
      lawTitle,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      instrumentKind: row.instrument_kind,
      instrumentNo: row.instrument_no,
      instrumentDateHijri: row.instrument_date_hijri,
      approvingClause: row.approving_clause,
      sourceUrl: row.source_url,
    };
  } catch {
    return null;
  }
}

/** عمود النوع إن وُجد. لا يُنشئ قيمة. */
export async function storedInstrumentKind(systemId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ instrument_kind: string | null }>>(
      `SELECT instrument_kind FROM legal_systems WHERE id = $1`,
      systemId,
    );
    return rows[0]?.instrument_kind ?? null;
  } catch {
    return null;
  }
}

/** نسخ مؤرخة لعدة مواد دفعة واحدة (لصفحة النظام الكاملة). غياب الجدول = لا نسخ. */
export async function unitVersionsFor(unitIds: string[]): Promise<Map<string, UnitVersionRecord[]>> {
  const out = new Map<string, UnitVersionRecord[]>();
  if (!unitIds.length) return out;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      unit_id: string;
      body: string;
      valid_from: Date;
      evidence_instrument: string | null;
      evidence_url: string | null;
    }>>(
      `SELECT id, unit_id, body, valid_from, evidence_instrument, evidence_url
       FROM unit_version WHERE unit_id = ANY($1::text[]) ORDER BY unit_id, valid_from ASC`,
      unitIds,
    );
    for (const r of rows) {
      const list = out.get(r.unit_id) ?? [];
      list.push({ id: r.id, body: r.body, validFrom: new Date(r.valid_from).toISOString(), evidenceInstrument: r.evidence_instrument, evidenceUrl: r.evidence_url });
      out.set(r.unit_id, list);
    }
  } catch {
    /* الجدول غير مطبَّق بعد */
  }
  return out;
}

export interface LawCardBlock {
  kind: "title" | "year" | "basmala" | "royal_decree" | "cabinet_decision" | "royal_order" | "preamble_other" | "law_title";
  heading?: string | null;
  text: string;
}

export interface LawCardRecord {
  officialName: string;
  summary: string | null;
  issuedHijri: string | null;
  issuedGregorian: string | null;
  publishedHijri: string | null;
  publishedGregorian: string | null;
  statusAtSource: string | null;
  categoryPath: string[];
  instruments: Array<{ kind: string; text: string }>;
  textBlocks: LawCardBlock[];
  sourceName: string;
  sourceUrl: string;
  retrievedOn: string;
}

/** بطاقة النظام: آخر صف في law_card (إضافة فقط). غياب الجدول أو الصف = لا بطاقة. */
export async function lawCard(systemId: string): Promise<LawCardRecord | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      official_name: string;
      summary: string | null;
      issued_hijri: string | null;
      issued_gregorian: Date | null;
      published_hijri: string | null;
      published_gregorian: Date | null;
      status_at_source: string | null;
      category_path: string[] | null;
      instruments: unknown;
      text_blocks: unknown;
      source_name: string;
      source_url: string;
      retrieved_on: Date;
    }>>(
      `SELECT official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian,
              status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on
       FROM law_card WHERE system_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
      systemId,
    );
    const r = rows[0];
    if (!r) return null;
    const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    return {
      officialName: r.official_name,
      summary: r.summary,
      issuedHijri: r.issued_hijri,
      issuedGregorian: day(r.issued_gregorian),
      publishedHijri: r.published_hijri,
      publishedGregorian: day(r.published_gregorian),
      statusAtSource: r.status_at_source,
      categoryPath: r.category_path ?? [],
      instruments: Array.isArray(r.instruments) ? (r.instruments as Array<{ kind: string; text: string }>) : [],
      textBlocks: Array.isArray(r.text_blocks) ? (r.text_blocks as LawCardBlock[]) : [],
      sourceName: r.source_name,
      sourceUrl: r.source_url,
      retrievedOn: day(r.retrieved_on) ?? "",
    };
  } catch {
    return null;
  }
}
