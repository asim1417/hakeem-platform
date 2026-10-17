import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { gate, response, failure } from "@/lib/modules/editorial/access";
import {
  allowed,
  demand,
  PERMISSIONS,
  changeInputSchema,
} from "@/lib/modules/editorial/contracts";
import {
  propose,
  submit,
  decide,
  publish,
  revert,
  saveConfig,
  assignTask,
  withdraw,
  urgentRevert,
} from "@/lib/modules/editorial/service";
import {
  intakeQueue,
  queue,
  records,
  systems,
} from "@/lib/modules/editorial/queries";
import {
  reviewIntake,
  reviewIntakeBatch,
} from "@/lib/modules/editorial/intake";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const { actor, config, writeEnabled } = await gate(request);
    const q = request.nextUrl.searchParams;
    const view = q.get("view") ?? "queue";
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(q.get("page") ?? 1);
    const base = {
      writeEnabled,
      installed: config.installed,
      permissions: PERMISSIONS.filter((p) => allowed(actor, config.data, p)),
      actorId: actor.id,
      owner: actor.role === "SUPER_ADMIN",
    };
    if (view === "settings") {
      demand(actor, config.data, "LEGAL_CONFIG_MANAGE");
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        take: 500,
        orderBy: { name: "asc" },
      });
      return response({
        ...base,
        config: config.data,
        revision: config.revision,
        users,
      });
    }
    if (!config.installed)
      return response({
        ...base,
        items: [],
        total: 0,
        message: "بانتظار تطبيق الترحيل على بيئة معزولة.",
      });
    if (view === "systems")
      return response({
        ...base,
        ...(await systems(actor, config.data, {
          q: q.get("q") ?? "",
          domain: q.get("domain") ?? "",
          status: q.get("status") ?? "",
          kind: q.get("kind") ?? "",
          source: q.get("source") ?? "",
          completeness: q.get("completeness") ?? "",
          conflict: q.get("conflict") ?? "",
          page,
        })),
      });
    if (view === "intake")
      return response({
        ...base,
        ...(await intakeQueue(actor, config.data, page)),
      });
    if (view === "audit" || view === "index" || view === "tasks") {
      const result = await records(actor, config.data, view, page, {
        author: q.get("author") ?? "",
        action: q.get("event") ?? "",
        since: q.get("since") ?? "",
      });
      const health =
        view === "index"
          ? await (
              await import("@/lib/modules/editorial/index-health")
            ).indexHealth()
          : undefined;
      return response({ ...base, ...result, health });
    }
    return response({
      ...base,
      ...(await queue(actor, config.data, page, {
        target: q.get("target") ?? "",
        author: q.get("author") ?? "",
        status: q.get("status") ?? "",
        olderDays: q.get("olderDays") ?? "",
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("urgent_revert"),
    id: z.string().min(1),
    reason: z.string().trim().min(10).max(2000),
  }),
  z.object({
    action: z.literal("intake_batch"),
    ids: z.array(z.string().min(1)).min(1).max(30),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal("propose"),
    changes: z.array(changeInputSchema).min(1).max(50),
  }),
  z.object({ action: z.literal("submit"), id: z.string().min(1) }),
  z.object({
    action: z.literal("withdraw"),
    id: z.string().min(1),
    reason: z.string().min(1).max(2000),
  }),
  z.object({
    action: z.literal("decide"),
    id: z.string().min(1),
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({ action: z.literal("publish"), id: z.string().min(1) }),
  z.object({
    action: z.literal("revert"),
    id: z.string().min(1),
    reason: z.string().min(10).max(2000),
  }),
  z.object({
    action: z.literal("settings"),
    config: z.unknown(),
    revision: z.number().int().min(0),
    reason: z.string().min(5).max(2000),
  }),
  z.object({
    action: z.literal("task"),
    id: z.string().min(1),
    assigneeId: z.string().nullable(),
    status: z.enum(["open", "in_progress", "done", "cancelled"]),
  }),
  z.object({
    action: z.literal("intake"),
    source: z.enum(["amendment", "principle"]),
    id: z.string().min(1),
    decision: z.enum(["approve", "reject", "reset"]),
    reason: z.string().trim().min(1).max(2000),
    corrections: changeInputSchema.shape.after.default({}),
  }),
]);
export async function POST(request: NextRequest) {
  try {
    const { actor, sessionId } = await gate(request, true);
    if (Number(request.headers.get("content-length") ?? 0) > 1000000)
      return response({ message: "الطلب كبير جدًا." }, 413);
    const raw = await request.text();
    if (raw.length > 1000000)
      return response({ message: "الطلب كبير جدًا." }, 413);
    const data = actionSchema.parse(JSON.parse(raw));
    let result;
    let syncWarning: string | undefined;
    switch (data.action) {
      case "urgent_revert":
        result = await urgentRevert(actor.id, data.id, data.reason, sessionId);
        syncWarning =
          "تم التراجع؛ راجع طابور المزامنة وإشعارات الفريق في صفحة المهام.";
        break;
      case "intake_batch":
        result = await reviewIntakeBatch(
          actor.id,
          data.ids,
          data.reason,
          sessionId,
        );
        break;
      case "propose":
        result = await propose(actor.id, data.changes, sessionId);
        break;
      case "submit":
        result = await submit(actor.id, data.id, sessionId);
        break;
      case "withdraw":
        result = await withdraw(actor.id, data.id, data.reason, sessionId);
        break;
      case "decide":
        result = await decide(
          actor.id,
          data.id,
          data.decision,
          data.reason,
          sessionId,
        );
        break;
      case "publish": {
        result = await publish(actor.id, data.id, sessionId);
        // Durable outbox is already committed. A failed sync never reports publication as rolled back.
        const { runSync } = await import("@/lib/modules/editorial/sync");
        try {
          const sync = await runSync(actor.id);
          if (sync.processed && !sync.complete) syncWarning = sync.message;
        } catch {
          syncWarning =
            "تم النشر وبقيت المزامنة في الطابور؛ راجع صفحة حالة النشر.";
        }
        break;
      }
      case "revert":
        result = await revert(actor.id, data.id, data.reason, sessionId);
        break;
      case "settings":
        result = await saveConfig(
          actor.id,
          data.config,
          data.revision,
          data.reason,
          sessionId,
        );
        break;
      case "task":
        result = await assignTask(
          actor.id,
          data.id,
          data.assigneeId,
          data.status,
          sessionId,
        );
        break;
      case "intake":
        result = await reviewIntake(
          actor.id,
          data.source,
          data.id,
          data.decision,
          data.reason,
          data.corrections,
          sessionId,
        );
        break;
    }
    return response({ ok: true, result, syncWarning });
  } catch (e) {
    return failure(e);
  }
}
