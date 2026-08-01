// ─────────────────────────────────────────────────────────────────────────────
// §21/§8 — بذر حزم المجال إلى jds_domain_packs (idempotent upsert).
//
// الجزء «الباني» نقيّ (بلا قاعدة) كي يُختبر دون DB؛ والجزء «الكاتب» يكتب على القاعدة
// الحيّة بعد ensureJudicialCoreSchema. لا يُحقن law_as_of_date مُختلَق — يبقى PENDING
// حتى تُثبته PR3 من النواة القانونيّة.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import { JUDICIAL_DOMAIN_PACKS } from "./domain-packs";
import { ensureJudicialCoreSchema } from "./schema-ensure";
import type { JudicialDomainPack } from "./contracts";

export interface DomainPackSeedRow {
  id: string;
  titleAr: string;
  courtTrack: string;
  version: string;
  lawAsOfDate: string;
  stages: string[];
  playbookCategories: string[];
  prohibitedTransferFrom: string[];
  notesAr: string;
}

/** بانٍ نقيّ: يحوّل سجلّ الحزم إلى صفوفٍ قابلة للكتابة (قابل للاختبار بلا قاعدة). */
export function buildDomainPackRows(packs: readonly JudicialDomainPack[] = JUDICIAL_DOMAIN_PACKS): DomainPackSeedRow[] {
  return packs.map((p) => ({
    id: p.id,
    titleAr: p.titleAr,
    courtTrack: p.courtTrack,
    version: p.version,
    lawAsOfDate: p.lawAsOfDate,
    stages: [...p.stages],
    playbookCategories: [...p.playbookCategories],
    prohibitedTransferFrom: [...p.prohibitedTransferFrom],
    notesAr: p.notesAr,
  }));
}

export interface SeedResult {
  ok: boolean;
  upserted: number;
  error?: string;
}

/**
 * يبذر حزم المجال على القاعدة الحيّة (idempotent). لا يطمس law_as_of_date المُثبَت
 * سابقًا إن كان غير PENDING (تحفَظ إثباتات PR3) — يُحدّث الوصف والفئات فقط.
 */
export async function seedDomainPacks(): Promise<SeedResult> {
  const ensured = await ensureJudicialCoreSchema();
  if (!ensured) return { ok: false, upserted: 0, error: "schema-not-ready" };
  const rows = buildDomainPackRows();
  let upserted = 0;
  try {
    for (const r of rows) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "jds_domain_packs"
           ("id","title_ar","court_track","version","law_as_of_date","stages","playbook_categories","prohibited_transfer_from","notes_ar","updated_at")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,NOW())
         ON CONFLICT ("id") DO UPDATE SET
           "title_ar" = EXCLUDED."title_ar",
           "court_track" = EXCLUDED."court_track",
           "version" = EXCLUDED."version",
           "stages" = EXCLUDED."stages",
           "playbook_categories" = EXCLUDED."playbook_categories",
           "prohibited_transfer_from" = EXCLUDED."prohibited_transfer_from",
           "notes_ar" = EXCLUDED."notes_ar",
           -- لا نُرجع law_as_of_date إلى PENDING إن كان قد أُثبت (PR3):
           "law_as_of_date" = CASE
             WHEN "jds_domain_packs"."law_as_of_date" = 'PENDING' THEN EXCLUDED."law_as_of_date"
             ELSE "jds_domain_packs"."law_as_of_date" END,
           "updated_at" = NOW()`,
        r.id,
        r.titleAr,
        r.courtTrack,
        r.version,
        r.lawAsOfDate,
        JSON.stringify(r.stages),
        JSON.stringify(r.playbookCategories),
        JSON.stringify(r.prohibitedTransferFrom),
        r.notesAr,
      );
      upserted += 1;
    }
    return { ok: true, upserted };
  } catch (e) {
    return { ok: false, upserted, error: e instanceof Error ? e.message : String(e) };
  }
}
