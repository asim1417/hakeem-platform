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
