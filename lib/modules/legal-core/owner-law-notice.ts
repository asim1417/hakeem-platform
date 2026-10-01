import { prisma } from "@/lib/prisma";
import { lawSlug } from "./eli";

export const PENDING_MATCH_BADGE = "النص قيد المطابقة مع هيئة الخبراء";

export interface OwnerLawNotice {
  badge: string | null;
  formerName: string | null;
  amendmentNote: string | null;
  pendingInstruments: string[];
}

export interface BisArticle {
  id: string;
  baseNumber: number;
  label: string;
  title: string;
  content?: string;
}

interface NoticeRow {
  title_as_published: string | null;
  text_verification: string;
  text_currency_note: string | null;
  pending_amendment_op_ids: string[] | null;
}

/** وسم المطابقة والاسم السابق وتنبيه التعديلات. غياب الجدول = بلا تنبيه. */
export async function ownerLawNotice(title: string): Promise<OwnerLawNotice | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<NoticeRow[]>(
      `SELECT title_as_published, text_verification, text_currency_note, pending_amendment_op_ids
       FROM uqn_fix.new_law WHERE title = $1`,
      title,
    );
    const row = rows[0];
    if (!row) return null;
    const ids = row.pending_amendment_op_ids ?? [];
    let pendingInstruments: string[] = [];
    if (ids.length) {
      const ops = await prisma.$queryRawUnsafe<Array<{ instrument_kind: string; instrument_no: string | null; instrument_date_hijri: string | null }>>(
        `SELECT instrument_kind, instrument_no, instrument_date_hijri
         FROM uqn_fix.amendment_op WHERE op_id = ANY($1::text[])
         ORDER BY instrument_date_hijri NULLS LAST, op_id`,
        ids,
      );
      pendingInstruments = ops.map((op) =>
        [op.instrument_kind, op.instrument_no, op.instrument_date_hijri].filter(Boolean).join(" "),
      );
    }
    const former = row.title_as_published && row.title_as_published !== title ? row.title_as_published : null;
    return {
      badge: row.text_verification === "pending_official_match" ? PENDING_MATCH_BADGE : null,
      formerName: former,
      amendmentNote: ids.length ? row.text_currency_note : null,
      pendingInstruments,
    };
  } catch {
    return null;
  }
}

export async function bisArticles(systemId: string): Promise<BisArticle[]> {
  try {
    return await prisma.$queryRawUnsafe<BisArticle[]>(
      `SELECT id, base_number AS "baseNumber", label, title
       FROM legal_article_bis WHERE "legalSystemId" = $1 ORDER BY base_number, label`,
      systemId,
    );
  } catch {
    return [];
  }
}

export async function bisArticle(systemId: string, baseNumber: number): Promise<(BisArticle & { content: string }) | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<BisArticle & { content: string }>>(
      `SELECT id, base_number AS "baseNumber", label, title, content
       FROM legal_article_bis WHERE "legalSystemId" = $1 AND base_number = $2 LIMIT 1`,
      systemId,
      baseNumber,
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** الاسم السابق يفتح العمل الجديد. */
export async function systemIdByAliasSlug(slug: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ system_id: string; alias: string }>>(
      `SELECT system_id, alias FROM legal_system_alias`,
    );
    const hit = rows.find((row) => lawSlug(row.alias) === slug);
    return hit?.system_id ?? null;
  } catch {
    return null;
  }
}
