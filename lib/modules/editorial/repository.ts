import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  Actor,
  DEFAULT_CONFIG,
  DeskError,
  Scope,
  TargetType,
  actorKind,
  assertWriteEnabled,
  configSchema,
} from "./contracts";

export type Tx = Prisma.TransactionClient;
export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export function missingTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" ||
      (error.code === "P2010" && error.meta?.code === "42P01"))
  );
}
export async function loadConfig(db: Tx = prisma) {
  const row = await db.editorialConfig.findFirst({
    orderBy: { revision: "desc" },
  });
  return {
    revision: row?.revision ?? 0,
    data: row ? configSchema.parse(row.data) : DEFAULT_CONFIG,
  };
}
export async function readConfig() {
  try {
    return { ...(await loadConfig()), installed: true };
  } catch (error) {
    if (!missingTable(error)) throw error;
    return { revision: 0, data: DEFAULT_CONFIG, installed: false };
  }
}
export async function transaction<T>(
  userId: string,
  action: (
    tx: Tx,
    actor: Actor,
    config: Awaited<ReturnType<typeof loadConfig>>,
  ) => Promise<T>,
): Promise<T> {
  assertWriteEnabled();
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Configuration changes/revocations and all editorial mutations share this lock.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(723023)`;
        const actor = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, isActive: true },
        });
        if (!actor?.isActive) throw new DeskError(401, "يلزم حساب فعال.");
        return action(tx, actor, await loadConfig(tx));
      },
      { maxWait: 10000, timeout: 20000 },
    );
  } catch (error) {
    if (error instanceof DeskError && error.status === 403) {
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      });
      if (actor) {
        const config = await loadConfig();
        await audit(prisma, actor, "access_denied", randomUUID(), {
          kind: actorKind(actor, config.data),
          metadata: { reason: error.message },
        });
      }
    }
    throw error;
  }
}
export async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  sessionId: string,
  data: {
    changeSetId?: string;
    targetId?: string;
    before?: unknown;
    after?: unknown;
    metadata?: Prisma.InputJsonValue;
    kind?: string;
  } = {},
) {
  return tx.editorialAuditEvent.create({
    data: {
      actorId: actor.id,
      actorKind: data.kind ?? "human",
      action,
      sessionId,
      changeSetId: data.changeSetId,
      targetId: data.targetId,
      beforeHash: data.before === undefined ? undefined : hash(data.before),
      afterHash: data.after === undefined ? undefined : hash(data.after),
      metadata: data.metadata ?? {},
    },
  });
}
export async function workState(tx: Tx, id: string) {
  const work = await tx.legalSystem.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      domain: true,
      preamble: true,
      preambleRoyalDecree: true,
      preambleEffectiveFrom: true,
    },
  });
  if (!work) throw new DeskError(404, "الوثيقة غير موجودة.");
  const [version, verification] = await Promise.all([
    tx.editorialWorkVersion.findFirst({
      where: { workId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    tx.verification.findFirst({
      where: { objectType: "work", objectId: id },
      orderBy: [{ verifiedAt: "desc" }, { id: "desc" }],
    }),
  ]);
  const data =
    version?.data &&
    typeof version.data === "object" &&
    !Array.isArray(version.data)
      ? version.data
      : {};
  return {
    officialName: work.name,
    domain: work.domain ?? "",
    preamble: work.preamble,
    preambleRoyalDecree: work.preambleRoyalDecree,
    preambleEffectiveFrom:
      work.preambleEffectiveFrom?.toISOString().slice(0, 10) ?? null,
    ...data,
    status: verification?.verifiedStatus ?? null,
  };
}
export async function targetState(
  tx: Tx,
  type: TargetType,
  id: string,
): Promise<{ state: Prisma.InputJsonValue; scope: Scope }> {
  let state: Prisma.InputJsonValue | null = null;
  let domain = "";
  if (type === "work") {
    state = json(await workState(tx, id));
    domain = String((state as Prisma.InputJsonObject).domain ?? "");
  }
  if (type === "unit") {
    const row = await tx.legalArticle.findUnique({
      where: { id },
      select: {
        content: true,
        legalSystem: { select: { domain: true } },
        legalSystemId: true,
      },
    });
    if (row) {
      const version = await tx.unitVersion.findFirst({
        where: { unitId: id },
        orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      });
      state = json({
        body: version?.body ?? row.content,
        validFrom: version?.validFrom.toISOString().slice(0, 10) ?? null,
        workId: row.legalSystemId,
      });
      domain = row.legalSystem?.domain ?? "";
    }
  }
  if (type === "principle") {
    const row = await tx.judicialPrinciple.findUnique({
      where: { id },
      select: {
        id: true,
        reviewStatus: true,
        principleText: true,
        sourceCaseId: true,
      },
    });
    if (row) state = json(row);
  }
  if (type === "ruling") {
    const row = await tx.judicialCase.findUnique({
      where: { id },
      select: {
        id: true,
        reviewStatus: true,
        judgmentText: true,
        sourceId: true,
        caseNo: true,
        court: true,
        decisionDateText: true,
      },
    });
    if (row) state = json(row);
  }
  if (type === "relation") {
    const row = await tx.legalRelation.findUnique({ where: { id } });
    if (row) state = json(row);
  }
  if (type === "amendment") {
    const rows = await tx.$queryRaw<
      Array<{ raw: Prisma.JsonObject }>
    >`SELECT to_jsonb(o) AS raw FROM uqn_fix.amendment_op o WHERE op_id=${id}`;
    if (rows[0]) {
      const decisions = await tx.$queryRaw<
        Array<{ decision: string; corrected: Prisma.JsonValue }>
      >`SELECT decision,corrected FROM uqn_fix.amendment_decision WHERE op_id=${id}`;
      state = json({ ...rows[0].raw, latestDecision: decisions[0] ?? null });
    }
  }
  if (!state) throw new DeskError(404, "العنصر غير موجود.");
  return { state, scope: { target: type, domain } };
}
