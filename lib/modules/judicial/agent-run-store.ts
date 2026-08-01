// ─────────────────────────────────────────────────────────────────────────────
// §25 — تخزين تشغيلات الوكيل الخلفيّ الدائم (jds_agent_runs).
//
// الجزء «الباني» نقيّ (بلا قاعدة) كي يُختبر دون DB؛ والجزء «الكاتب/القارئ» يعمل على
// القاعدة الحيّة بعد ensureJudicialCoreSchema (سقوطٌ آمن). الحالة كاملةً تُحفظ في عمود
// state (JSONB) مع أعمدةٍ مفهرسةٍ للاستعلام (status/task_id) — لتُحفظ وتُستأنَف.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import { ensureJudicialCoreSchema } from "./schema-ensure";
import { deserializeAgentRun } from "./durable-agent";
import type { JudicialAgentRun } from "./durable-agent";

export interface AgentRunRow {
  runId: string;
  taskId: string;
  status: string;
  cursor: number;
  pendingDelegateStep: number | null;
  pendingBlockedStep: number | null;
  blockedSteps: number[];
  completedSteps: number[];
  state: JudicialAgentRun;
}

/** بانٍ نقيّ: يحوّل حالة تشغيلٍ إلى صفٍّ قابل للكتابة (قابل للاختبار بلا قاعدة). */
export function buildAgentRunRow(run: JudicialAgentRun): AgentRunRow {
  return {
    runId: run.runId,
    taskId: run.taskId,
    status: run.status,
    cursor: run.cursor,
    pendingDelegateStep: run.pendingDelegateStep,
    pendingBlockedStep: run.pendingBlockedStep,
    blockedSteps: [...run.blockedSteps],
    completedSteps: [...run.completedSteps],
    state: run,
  };
}

export interface StoreResult {
  ok: boolean;
  error?: string;
}

/** يحفظ/يحدّث حالة تشغيلٍ (idempotent upsert على run_id). سقوطٌ آمن. */
export async function saveAgentRun(run: JudicialAgentRun): Promise<StoreResult> {
  const ensured = await ensureJudicialCoreSchema();
  if (!ensured) return { ok: false, error: "schema-not-ready" };
  const r = buildAgentRunRow(run);
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "jds_agent_runs"
         ("run_id","task_id","status","cursor","pending_delegate_step","pending_blocked_step","blocked_steps","completed_steps","state","updated_at")
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,NOW())
       ON CONFLICT ("run_id") DO UPDATE SET
         "task_id" = EXCLUDED."task_id",
         "status" = EXCLUDED."status",
         "cursor" = EXCLUDED."cursor",
         "pending_delegate_step" = EXCLUDED."pending_delegate_step",
         "pending_blocked_step" = EXCLUDED."pending_blocked_step",
         "blocked_steps" = EXCLUDED."blocked_steps",
         "completed_steps" = EXCLUDED."completed_steps",
         "state" = EXCLUDED."state",
         "updated_at" = NOW()`,
      r.runId,
      r.taskId,
      r.status,
      r.cursor,
      r.pendingDelegateStep,
      r.pendingBlockedStep,
      JSON.stringify(r.blockedSteps),
      JSON.stringify(r.completedSteps),
      JSON.stringify(r.state),
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** يستأنف حالة تشغيلٍ من القاعدة (null إن لم يوجد أو تعذّرت القاعدة). سقوطٌ آمن. */
export async function loadAgentRun(runId: string): Promise<JudicialAgentRun | null> {
  const ensured = await ensureJudicialCoreSchema();
  if (!ensured) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ state: unknown }>>(
      `SELECT "state" FROM "jds_agent_runs" WHERE "run_id" = $1 LIMIT 1`,
      runId,
    );
    if (!rows.length) return null;
    const raw = rows[0].state;
    // pg يعيد JSONB كـ object؛ نمرّره عبر التسلسل لضمان النوع.
    return deserializeAgentRun(typeof raw === "string" ? raw : JSON.stringify(raw));
  } catch {
    return null;
  }
}
