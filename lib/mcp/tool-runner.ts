/**
 * غلاف تنفيذ أدوات /mcp: حدّ المعدّل، الباقة، حجز الرصيد، السقف الزمني، الخصم بعد النجاح، والسجل.
 * لا يُحفظ نص السؤال ولا النتيجة في السجل — اسم الأداة والنتيجة والمدة والخصم فقط.
 */
import { randomUUID } from "node:crypto";
import { mcpToolPolicy } from "@/config/mcp-tools";
import { mcpUserRateLimit } from "@/lib/mcp/config";
import { principalFromContext, type McpPrincipal } from "@/lib/mcp/principal";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import type { AccessDecision } from "@/lib/modules/billing/access-gate";
import type { UsageServiceCode } from "@/config/usage-credits";

export type ToolResult = { content: Array<{ type: "text"; text: string }> };

export type ToolAuditEvent = {
  actorId?: string;
  entityId?: string;
  tool: string;
  ok: boolean;
  ms: number;
  outcome: "ok" | "error" | "timeout" | "rate_limited" | "plan_required" | "credits_exhausted";
  principal: McpPrincipal["kind"];
  via?: string;
  clientId?: string;
  charged?: string;
};

export type ToolRunnerDeps = {
  hitWindow(key: string, windowStart: number): Promise<number>;
  planAllowsPaid(userId: string): Promise<boolean>;
  gate(userId: string, service: UsageServiceCode, referenceId: string): Promise<AccessDecision>;
  settle(userId: string, decision: AccessDecision, referenceId: string): Promise<void>;
  release(decision: AccessDecision): Promise<void>;
  audit(event: ToolAuditEvent): Promise<void>;
  siteUrl(): string;
};

const defaultDeps: ToolRunnerDeps = {
  async hitWindow(key, windowStart) {
    const { getGrantStore } = await import("@/lib/mcp/grants/prisma-store");
    return getGrantStore().hitWindow(key, windowStart);
  },
  async planAllowsPaid(userId) {
    // الأدوات المدفوعة: للمشرفين، وللمشترك، أو لمن له رصيد وحدات حين يعمل نظام الوحدات.
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role === "SUPER_ADMIN" || user?.role === "SYSTEM_ADMIN") return true;
    const { canConsume } = await import("@/lib/modules/billing/quota");
    const q = await canConsume(userId);
    if (q.isSubscribed) return true;
    const { usageCreditsEnabled, getUsageCreditStatus } = await import("@/lib/modules/credits/usage-ledger");
    if (await usageCreditsEnabled()) {
      const status = await getUsageCreditStatus(userId, 1);
      return status.availableMilliUnits > 0;
    }
    // الفوترة لم تُفعَّل في القاعدة بعد (canConsume يسقط مفتوحًا: remaining = -1 بلا اشتراك):
    // نتبع بقية المنصة المفتوحة حتى إطلاق الباقات. خطأ غير متوقع هنا ← رفض (catch في المستدعي).
    return q.remaining === -1;
  },
  async gate(userId, service, referenceId) {
    const { gateAdvancedUse } = await import("@/lib/modules/billing/access-gate");
    return gateAdvancedUse(userId, { serviceCode: service, idempotencyKey: `mcp:${referenceId}`, referenceId });
  },
  async settle(userId, decision, referenceId) {
    if (!decision.allowed) return;
    const { settleAdvancedUse } = await import("@/lib/modules/billing/access-gate");
    await settleAdvancedUse(userId, decision.via, { reservationId: decision.reservationId ?? null, referenceId });
  },
  async release(decision) {
    const { releaseAdvancedUse } = await import("@/lib/modules/billing/access-gate");
    await releaseAdvancedUse(decision);
  },
  async audit(event) {
    const { auditEvent } = await import("@/lib/modules/audit/audit");
    await auditEvent({
      actorId: event.actorId,
      subject: "AI_GATEWAY",
      action: "MCP_TOOL_CALL",
      entityId: event.entityId,
      metadata: {
        tool: event.tool,
        ok: event.ok,
        ms: event.ms,
        outcome: event.outcome,
        principal: event.principal,
        ...(event.via ? { via: event.via } : {}),
        ...(event.clientId ? { clientId: event.clientId } : {}),
        ...(event.charged ? { charged: event.charged } : {}),
      },
    });
  },
  // HKM-061: الأصل الموحّد (يتجاوز قيمة *.vercel.app القديمة في البيئة).
  siteUrl: getSiteUrl,
};

let depsOverride: Partial<ToolRunnerDeps> | null = null;

/** للاختبارات فقط. */
export function setToolRunnerDepsForTests(deps: Partial<ToolRunnerDeps> | null): void {
  depsOverride = deps;
}

function d(): ToolRunnerDeps {
  return { ...defaultDeps, ...(depsOverride ?? {}) };
}

function json(data: unknown): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] };
}

function toolTimeoutMs(): number {
  const n = Number(process.env.MCP_TOOL_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 20000;
}

async function withTimeout<T>(name: string, fn: () => Promise<T> | T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`MCP_TOOL_TIMEOUT:${name}:${ms}ms`)), ms);
    });
    return await Promise.race([Promise.resolve().then(fn), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** ينفّذ أداة باسمها لصاحب الطلب في ctx، ويعيد مخرجات MCP (الخطأ داخل الجسم لا HTTP). */
export async function runMcpTool<T>(name: string, ctx: unknown, fn: () => Promise<T> | T): Promise<ToolResult> {
  const deps = d();
  const started = Date.now();
  const principal = principalFromContext(ctx) ?? { kind: "open" as const };
  const isUser = principal.kind === "user";
  const actorId = isUser ? principal.userId : undefined;
  const entityId = isUser ? (principal.via === "grant" ? principal.grantId : principal.apiKeyId) : undefined;
  const base = {
    actorId,
    entityId,
    tool: name,
    principal: principal.kind,
    via: principal.kind === "user" || principal.kind === "internal" ? principal.via : undefined,
    clientId: principal.kind === "user" || principal.kind === "internal" ? principal.clientId : undefined,
  };
  const audit = (event: Omit<ToolAuditEvent, keyof typeof base>) => {
    if (principal.kind === "open") return;
    void deps.audit({ ...base, ...event }).catch(() => undefined);
  };

  let decision: AccessDecision | null = null;
  const referenceId = `${name}:${randomUUID()}`;

  if (isUser) {
    // ١) حدّ المعدّل لكل مستخدم في الدقيقة (سقوط مفتوح إن تعذّر العدّاد).
    const limit = principal.via === "api_key" ? principal.rateLimit : mcpUserRateLimit();
    const count = await deps.hitWindow(`user:${principal.userId}`, Math.floor(Date.now() / 60000)).catch(() => 0);
    if (count > limit) {
      audit({ ok: false, ms: Date.now() - started, outcome: "rate_limited" });
      return json({
        error: "rate_limited",
        tool: name,
        retry_after_seconds: 60,
        message: `تجاوزت حدّ الاستدعاءات (${limit} في الدقيقة). أعد المحاولة بعد دقيقة.`,
      });
    }

    // ٢) الباقة.
    const policy = mcpToolPolicy(name);
    if (policy.tier === "paid" && !(await deps.planAllowsPaid(principal.userId).catch(() => false))) {
      audit({ ok: false, ms: Date.now() - started, outcome: "plan_required" });
      return json({
        error: "plan_required",
        tool: name,
        message: "هذه الأداة متاحة للمشتركين في حكيم.",
        upgrade_url: `${deps.siteUrl()}/dashboard/billing`,
      });
    }

    // ٣) حجز الرصيد للأدوات المخصومة.
    if (policy.service) {
      decision = await deps.gate(principal.userId, policy.service, referenceId);
      if (!decision.allowed) {
        audit({ ok: false, ms: Date.now() - started, outcome: "credits_exhausted" });
        return json({
          error: "credits_exhausted",
          tool: name,
          message: decision.message,
          upgrade_url: `${deps.siteUrl()}/dashboard/billing`,
        });
      }
    }
  }

  const ms = toolTimeoutMs();
  try {
    const result = await withTimeout(name, fn, ms);
    if (decision && isUser) await deps.settle(principal.userId, decision, referenceId).catch(() => undefined);
    const took = Date.now() - started;
    console.log(`[mcp] tool=${name} ms=${took} ok=true principal=${principal.kind}`);
    audit({ ok: true, ms: took, outcome: "ok", charged: decision?.allowed ? decision.via : undefined });
    return json(result);
  } catch (e) {
    if (decision) await deps.release(decision).catch(() => undefined);
    const took = Date.now() - started;
    const timedOut = (e as Error)?.message?.startsWith("MCP_TOOL_TIMEOUT");
    console.warn(
      `[mcp] tool=${name} ms=${took} ok=false principal=${principal.kind} ${timedOut ? "timeout" : "error"}=${(e as Error)?.message?.slice(0, 160)}`
    );
    audit({ ok: false, ms: took, outcome: timedOut ? "timeout" : "error" });
    return json({
      error: timedOut ? "timeout" : "tool_error",
      tool: name,
      ms: took,
      message: timedOut
        ? `تجاوزت الأداة الحدّ الزمني (${ms}ms). حصر النطاق أو استخدم count_only/الترقيم.`
        : "تعذّر تنفيذ الأداة.",
    });
  }
}
