// ─────────────────────────────────────────────────────────────────────────────
// مخزن المهامّ الخلفيّة — يُتيح استئناف البحث/التوليد بعد مغادرة الصفحة أو تعليق المتصفّح.
// الخادم يُكمل التوليد ويحفظه دوريًّا في «generation_jobs» بصرف النظر عن اتّصال العميل؛
// وعند العودة يجلب العميل النتيجة بمعرّف المهمّة (jobId). هجرةٌ ذاتيّة idempotent (كنمط
// المعاون القضائيّ) لأنّ بناء Vercel لا يهاجر. سقوطٌ آمن: تعذّر القاعدة ⇒ لا استئناف، بلا كسر.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "generation_jobs" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id"   TEXT NOT NULL,
    "kind"       TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'running',
    "title"      TEXT,
    "text"       TEXT NOT NULL DEFAULT '',
    "meta"       JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "generation_jobs_owner_idx" ON "generation_jobs"("owner_id","created_at")`,
];

let ready: Promise<boolean> | null = null;
async function ensure(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        for (const s of DDL) await prisma.$executeRawUnsafe(s);
        return true;
      } catch {
        ready = null;
        return false;
      }
    })();
  }
  return ready;
}

export type JobStatus = "running" | "done" | "error" | "cancelled";
export interface GenerationJob {
  id: string;
  ownerId: string;
  kind: string;
  status: JobStatus;
  title: string | null;
  text: string;
  meta: Record<string, unknown>;
  updatedAt: string;
}

/** ينشئ مهمّةً جديدة (running) ويعيد معرّفها، أو null عند تعذّر القاعدة. */
export async function createJob(
  ownerId: string,
  kind: string,
  title?: string,
  meta?: Record<string, unknown>
): Promise<string | null> {
  if (!(await ensure())) return null;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `INSERT INTO "generation_jobs"("owner_id","kind","title","meta")
       VALUES ($1,$2,$3,COALESCE($4::jsonb,'{}'::jsonb))
       RETURNING "id"`,
      ownerId,
      kind,
      title ?? null,
      meta ? JSON.stringify(meta) : null
    )) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** يحدّث مهمّةً (نصّ متراكم/بيانات/حالة). لا يمسّ الحقول غير المُمرَّرة. سقوطٌ صامت. */
export async function updateJob(
  id: string,
  patch: { text?: string; meta?: Record<string, unknown>; status?: JobStatus }
): Promise<void> {
  if (!id || !(await ensure())) return;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "generation_jobs"
         SET "text"=COALESCE($2,"text"),
             "meta"=COALESCE($3::jsonb,"meta"),
             "status"=COALESCE($4,"status"),
             "updated_at"=NOW()
       WHERE "id"=$1`,
      id,
      patch.text ?? null,
      patch.meta ? JSON.stringify(patch.meta) : null,
      patch.status ?? null
    );
  } catch {
    /* تجاهل */
  }
}

function mapJobRow(r: {
  id: string;
  owner_id: string;
  kind: string;
  status: string;
  title: string | null;
  text: string;
  meta: unknown;
  updated_at: Date;
}): GenerationJob {
  return {
    id: r.id,
    ownerId: r.owner_id,
    kind: r.kind,
    status: (r.status as JobStatus) ?? "running",
    title: r.title,
    text: r.text ?? "",
    meta:
      typeof r.meta === "string"
        ? JSON.parse(r.meta)
        : ((r.meta as Record<string, unknown>) ?? {}),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** يجلب مهمّةً بمعرّفها مقيّدةً بمالكها (استئناف آمن). */
export async function getJob(id: string, ownerId: string): Promise<GenerationJob | null> {
  if (!id || !(await ensure())) return null;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id","owner_id","kind","status","title","text","meta","updated_at"
         FROM "generation_jobs" WHERE "id"=$1 AND "owner_id"=$2 LIMIT 1`,
      id,
      ownerId
    )) as Array<{
      id: string;
      owner_id: string;
      kind: string;
      status: string;
      title: string | null;
      text: string;
      meta: unknown;
      updated_at: Date;
    }>;
    const r = rows[0];
    if (!r) return null;
    return mapJobRow(r);
  } catch {
    return null;
  }
}

/** جلب مهمة بلا قيد مالك — للاستدعاءات الإدارية فقط. */
export async function getJobByIdAdmin(id: string): Promise<GenerationJob | null> {
  if (!id || !(await ensure())) return null;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id","owner_id","kind","status","title","text","meta","updated_at"
         FROM "generation_jobs" WHERE "id"=$1 LIMIT 1`,
      id
    )) as Array<{
      id: string;
      owner_id: string;
      kind: string;
      status: string;
      title: string | null;
      text: string;
      meta: unknown;
      updated_at: Date;
    }>;
    const r = rows[0];
    return r ? mapJobRow(r) : null;
  } catch {
    return null;
  }
}

/**
 * إيقاف ناعم لمهمة جارية — لا يقتل عملية التوليد فورًا، لكنه يخرجها من «جارية»
 * ويمنع اعتبارها حيّة في لوحة المراقبة والاستئناف.
 */
export async function cancelJob(
  id: string
): Promise<{ ok: true; job: GenerationJob } | { ok: false; reason: string }> {
  if (!id || !(await ensure())) return { ok: false, reason: "unavailable" };
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `UPDATE "generation_jobs"
          SET "status"='cancelled',
              "meta"="meta" || '{"cancelledAt":true}'::jsonb,
              "updated_at"=NOW()
        WHERE "id"=$1 AND "status"='running'
        RETURNING "id","owner_id","kind","status","title","text","meta","updated_at"`,
      id
    )) as Array<{
      id: string;
      owner_id: string;
      kind: string;
      status: string;
      title: string | null;
      text: string;
      meta: unknown;
      updated_at: Date;
    }>;
    if (!rows[0]) return { ok: false, reason: "not_running" };
    return { ok: true, job: mapJobRow(rows[0]) };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * إعادة تشغيل = مهمة جديدة بنفس النوع/العنوان مع ربط تدقيقي بالمصدر.
 * لا تُعدَّل المهمة الأصلية (سجلّ تدقيق محفوظ).
 */
export async function retryJob(
  id: string
): Promise<{ ok: true; jobId: string; source: GenerationJob } | { ok: false; reason: string }> {
  const source = await getJobByIdAdmin(id);
  if (!source) return { ok: false, reason: "not_found" };
  if (source.status === "running") return { ok: false, reason: "still_running" };

  const newId = await createJob(source.ownerId, source.kind, source.title ?? undefined, {
    retriedFrom: source.id,
    retryOfKind: source.kind,
    retriedAt: new Date().toISOString(),
  });
  if (!newId) return { ok: false, reason: "create_failed" };
  return { ok: true, jobId: newId, source };
}

/** يحصد المهام الجارية المتوقفة منذ مدة (دقائق) ويعلّمها cancelled. */
export async function reapStaleRunningJobs(
  maxAgeMinutes = 30
): Promise<{ reaped: number }> {
  if (!(await ensure())) return { reaped: 0 };
  const minutes = Math.min(Math.max(maxAgeMinutes, 5), 24 * 60);
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `UPDATE "generation_jobs"
          SET "status"='cancelled',
              "meta"="meta" || jsonb_build_object('staleReaped', true, 'reapedAt', NOW()::text),
              "updated_at"=NOW()
        WHERE "status"='running'
          AND "updated_at" < NOW() - ($1::int * INTERVAL '1 minute')
        RETURNING "id"`,
      minutes
    )) as Array<{ id: string }>;
    return { reaped: rows.length };
  } catch {
    return { reaped: 0 };
  }
}

/** إحصاءات المهام للمنصة (سوبر أدمن) — سقوط آمن إن غاب الجدول. */
export async function listJobStats(): Promise<{
  total: number;
  running: number;
  done: number;
  error: number;
  cancelled: number;
}> {
  if (!(await ensure())) return { total: 0, running: 0, done: 0, error: 0, cancelled: 0 };
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "status", COUNT(*)::int AS c FROM "generation_jobs" GROUP BY "status"`
    )) as Array<{ status: string; c: number }>;
    const out = { total: 0, running: 0, done: 0, error: 0, cancelled: 0 };
    for (const r of rows) {
      out.total += r.c;
      if (r.status === "running") out.running = r.c;
      else if (r.status === "done") out.done = r.c;
      else if (r.status === "error") out.error = r.c;
      else if (r.status === "cancelled") out.cancelled = r.c;
    }
    return out;
  } catch {
    return { total: 0, running: 0, done: 0, error: 0, cancelled: 0 };
  }
}

/** أحدث المهام لكل المنصة (مراقبة سوبر أدمن فقط). */
export async function listRecentJobs(limit = 30): Promise<GenerationJob[]> {
  if (!(await ensure())) return [];
  const take = Math.min(Math.max(limit, 1), 100);
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id","owner_id","kind","status","title","text","meta","updated_at"
         FROM "generation_jobs"
         ORDER BY "updated_at" DESC
         LIMIT $1`,
      take
    )) as Array<{
      id: string;
      owner_id: string;
      kind: string;
      status: string;
      title: string | null;
      text: string;
      meta: unknown;
      updated_at: Date;
    }>;
    return rows.map(mapJobRow);
  } catch {
    return [];
  }
}
