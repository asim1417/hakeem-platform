import { prisma } from "@/lib/prisma";
import {
  MIXED_RECORD_STATUS,
  editionStatus,
  pickEdition,
  type EditionStatus,
  type EditionWindow,
} from "./work-edition";

interface EditionRow {
  mixed_system_id: string;
  edition_system_id: string;
  instrument: string | null;
  role: string;
  valid_from: Date | string;
  valid_to: Date | string | null;
}

function dayOf(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toWindow(row: EditionRow): EditionWindow | null {
  if (row.role !== "old" && row.role !== "new") return null;
  const validFrom = dayOf(row.valid_from);
  if (!validFrom) return null;
  return {
    editionSystemId: row.edition_system_id,
    instrument: row.instrument,
    role: row.role,
    validFrom,
    validTo: dayOf(row.valid_to),
  };
}

export interface DisplayRoute {
  id: string;
  redirected: boolean;
  status: EditionStatus | null;
  instrument: string | null;
  edition: boolean;
}

async function rowsForMixed(systemId: string): Promise<EditionWindow[]> {
  const rows = await prisma.$queryRawUnsafe<EditionRow[]>(
    `SELECT mixed_system_id, edition_system_id, instrument, role, valid_from, valid_to
     FROM work_edition WHERE mixed_system_id = $1`,
    systemId,
  );
  return rows.map(toWindow).filter((x): x is EditionWindow => Boolean(x));
}

async function rowForEdition(systemId: string): Promise<EditionWindow | null> {
  const rows = await prisma.$queryRawUnsafe<EditionRow[]>(
    `SELECT mixed_system_id, edition_system_id, instrument, role, valid_from, valid_to
     FROM work_edition WHERE edition_system_id = $1 LIMIT 1`,
    systemId,
  );
  return rows[0] ? toWindow(rows[0]) : null;
}

/** إن كان العمل سجلًا مخلوطًا يُعرض العمل المستقل المطابق للتاريخ. غياب الجدول = بلا تحويل. */
export async function displayedSystem(systemId: string, asOf: Date): Promise<DisplayRoute> {
  const same: DisplayRoute = { id: systemId, redirected: false, status: null, instrument: null, edition: false };
  try {
    const editions = await rowsForMixed(systemId);
    if (editions.length) {
      const picked = pickEdition(editions, asOf);
      if (!picked) return same;
      return {
        id: picked.editionSystemId,
        redirected: true,
        status: editionStatus(picked, asOf),
        instrument: picked.instrument,
        edition: true,
      };
    }
    const own = await rowForEdition(systemId);
    if (!own) return same;
    return {
      id: systemId,
      redirected: false,
      status: editionStatus(own, asOf),
      instrument: own.instrument,
      edition: true,
    };
  } catch {
    return same;
  }
}

export async function hiddenMixedIds(): Promise<Set<string>> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ object_id: string }>>(
      `SELECT object_id FROM (
         SELECT DISTINCT ON (object_id) object_id, verified_status
         FROM verification
         WHERE object_type = 'work'
         ORDER BY object_id, verified_at DESC, id DESC
       ) latest
       WHERE verified_status = $1`,
      MIXED_RECORD_STATUS,
    );
    return new Set(rows.map((r) => r.object_id));
  } catch {
    return new Set();
  }
}

export async function hiddenArticleIds(articleIds: string[]): Promise<Set<string>> {
  if (!articleIds.length) return new Set();
  try {
    const hidden = await hiddenMixedIds();
    if (!hidden.size) return new Set();
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; legalSystemId: string | null }>>(
      `SELECT id, "legalSystemId" FROM legal_articles WHERE id = ANY($1::text[])`,
      articleIds,
    );
    return new Set(rows.filter((r) => r.legalSystemId && hidden.has(r.legalSystemId)).map((r) => r.id));
  } catch {
    return new Set();
  }
}
