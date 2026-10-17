import {
  Prisma,
  EditorialChange,
  EditorialReviewDecision,
} from "@prisma/client";
import { z } from "zod";
import {
  Actor,
  ChangeInput,
  DeskConfig,
  DeskError,
  EditorialPermission,
  actorKind,
  allowed,
  changeInputSchema,
  configSchema,
  demand,
  policyFor,
  targetSchema,
} from "./contracts";
import { amendmentDecision, validatePayload } from "./checks";
import { assertIdentityForChange } from "./identity-gate";
import { Tx, audit, hash, json, targetState, transaction } from "./repository";

function object(value: Prisma.JsonValue): Prisma.JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DeskError(400, "بيانات غير صالحة.");
  return value;
}
function scope(c: EditorialChange) {
  return { target: targetSchema.parse(c.targetType), domain: c.domain };
}
async function allowedChange(
  tx: Tx,
  actor: Actor,
  config: DeskConfig,
  permission: EditorialPermission,
  ch: EditorialChange,
) {
  if (!allowed(actor, config, permission, scope(ch))) return false;
  const next = object(ch.after);
  if (
    ch.op === "update_metadata" &&
    typeof next.domain === "string" &&
    !allowed(actor, config, permission, { target: "work", domain: next.domain })
  )
    return false;
  if (ch.targetType === "relation") {
    for (const id of [next.sourceId, next.targetId]) {
      if (typeof id !== "string") continue;
      const work = await targetState(tx, "work", id);
      if (!allowed(actor, config, permission, work.scope)) return false;
    }
  }
  return true;
}
export async function approvalsComplete(
  tx: Tx,
  config: DeskConfig,
  changes: EditorialChange[],
  decisions: EditorialReviewDecision[],
  payloadHash: string,
) {
  for (const ch of changes) {
    const policy = policyFor(config, targetSchema.parse(ch.targetType));
    let count = 0;
    for (const decision of decisions.filter(
      (d) => d.decision === "approve" && d.payloadHash === payloadHash,
    )) {
      const reviewer = await tx.user.findUnique({
        where: { id: decision.reviewerId },
        select: { id: true, role: true, isActive: true },
      });
      if (
        reviewer &&
        (await allowedChange(tx, reviewer, config, "LEGAL_REVIEWER", ch)) &&
        (!decision.selfApproval ||
          (reviewer.role === "SUPER_ADMIN" && policy.ownerSelfApproval))
      )
        count++;
    }
    if (count < policy.minApprovals) return false;
  }
  return true;
}
export async function createChanges(
  tx: Tx,
  actor: Actor,
  config: DeskConfig,
  inputs: ChangeInput[],
  sessionId: string,
) {
  if (!inputs.length || inputs.length > 50)
    throw new DeskError(400, "الدفعة بين تغيير واحد و50 تغييرًا.");
  const batchKey = hash(inputs.map((i) => i.idempotencyKey));
  const existing = await tx.editorialChangeSet.findUnique({
    where: { idempotencyKey: batchKey },
    include: { changes: true },
  });
  const payloadHash = hash(inputs);
  if (existing) {
    if (existing.payloadHash !== payloadHash || existing.authorId !== actor.id)
      throw new DeskError(409, "مفتاح الطلب مستخدم لطلب مختلف.");
    return existing;
  }
  const kind = actorKind(actor, config);
  const prepared = [];
  for (const input of inputs) {
    validatePayload(input, config);
    policyFor(config, input.targetType);
    const fresh = input.op === "create_work" || input.op === "create_relation";
    const { state, scope: s } = fresh
      ? {
          state: {},
          scope: {
            target: input.targetType,
            domain: String(input.after.domain ?? ""),
          },
        }
      : await targetState(tx, input.targetType, input.targetId);
    demand(
      actor,
      config,
      kind === "agent"
        ? "LEGAL_AGENT_PROPOSE"
        : ["principle", "ruling"].includes(input.targetType)
          ? "LEGAL_EDITOR_RULINGS"
          : "LEGAL_EDITOR_LAWS",
      s,
    );
    await assertIdentityForChange(tx, input, state);
    if (
      input.op === "update_metadata" &&
      typeof input.after.domain === "string"
    )
      demand(
        actor,
        config,
        kind === "agent" ? "LEGAL_AGENT_PROPOSE" : "LEGAL_EDITOR_LAWS",
        { target: "work", domain: input.after.domain },
      );
    if (input.op === "create_work") {
      if (
        await tx.legalSystem.findUnique({
          where: { id: input.targetId },
          select: { id: true },
        })
      )
        throw new DeskError(409, "معرف الوثيقة مستخدم.");
    }
    if (input.op === "create_relation") {
      const endpoints = await tx.legalSystem.findMany({
        where: {
          id: {
            in: [String(input.after.sourceId), String(input.after.targetId)],
          },
        },
        select: { id: true, domain: true },
      });
      if (endpoints.length !== 2)
        throw new DeskError(400, "طرفا العلاقة يجب أن يكونا وثيقتين قائمتين.");
      for (const endpoint of endpoints)
        demand(
          actor,
          config,
          kind === "agent" ? "LEGAL_AGENT_PROPOSE" : "LEGAL_EDITOR_LAWS",
          { target: "work", domain: endpoint.domain ?? "" },
        );
    }
    if (
      await tx.editorialChange.findFirst({
        where: {
          OR: [
            { targetType: input.targetType, targetId: input.targetId },
            {
              evidenceUrl: input.evidenceUrl,
              sourceHash: hash(input.evidenceQuote),
            },
          ],
          status: { in: ["draft", "checks_failed", "pending", "approved"] },
        },
        select: { id: true },
      })
    )
      throw new DeskError(409, "يوجد تغيير مفتوح للعنصر أو للمصدر نفسه.");
    prepared.push({ input, state, domain: s.domain });
  }
  const set = await tx.editorialChangeSet.create({
    data: {
      title: inputs[0].title,
      kind: inputs.length > 1 ? "batch" : inputs[0].op,
      authorId: actor.id,
      authorKind: kind,
      payloadHash,
      idempotencyKey: batchKey,
    },
  });
  for (const { input, state, domain } of prepared) {
    await tx.editorialChange.create({
      data: {
        changeSetId: set.id,
        targetType: input.targetType,
        targetId: input.targetId,
        domain,
        op: input.op,
        before: state,
        after: input.after,
        evidenceInstrument: input.evidenceInstrument,
        evidenceUrl: input.evidenceUrl,
        evidenceQuote: input.evidenceQuote,
        sourceRank: input.sourceRank,
        authorId: actor.id,
        authorKind: kind,
        sourceHash: hash(input.evidenceQuote),
        checks: json([
          { code: "schema", ok: true },
          { code: "target", ok: true },
        ]),
      },
    });
    await tx.editorialSourceSnapshot.create({
      data: {
        sourceUrl: input.evidenceUrl,
        textHash: hash(input.evidenceQuote),
        quote: input.evidenceQuote,
        changeSetId: set.id,
      },
    });
    for (const t of config.taskTemplates.filter(
      (t) => t.enabled && t.target === input.targetType,
    ))
      await tx.editorialTask.create({
        data: {
          changeSetId: set.id,
          templateId: t.id,
          title: t.name,
          roleId: t.roleId,
          dueAt: new Date(Date.now() + t.dueHours * 3600000),
        },
      });
  }
  await audit(tx, actor, "draft_created", sessionId, {
    changeSetId: set.id,
    after: inputs,
    kind,
  });
  return tx.editorialChangeSet.findUniqueOrThrow({
    where: { id: set.id },
    include: { changes: true },
  });
}
export function propose(userId: string, raw: unknown, sessionId: string) {
  const inputs = z.array(changeInputSchema).min(1).max(50).parse(raw);
  return transaction(userId, (tx, actor, c) =>
    createChanges(tx, actor, c.data, inputs, sessionId),
  );
}
export function submit(userId: string, id: string, sessionId: string) {
  return transaction(userId, async (tx, actor, c) => {
    const set = await tx.editorialChangeSet.findUniqueOrThrow({
      where: { id },
      include: { changes: true },
    });
    if (!["draft", "checks_failed"].includes(set.status))
      throw new DeskError(409, "لا يمكن إرسال هذه الحالة للمراجعة.");
    if (set.authorId !== actor.id && actor.role !== "SUPER_ADMIN")
      throw new DeskError(403, "إرسال المسودة للمعد أو المالك.");
    for (const change of set.changes) {
      policyFor(c.data, targetSchema.parse(change.targetType));
      demand(
        actor,
        c.data,
        set.kind === "revert"
          ? "LEGAL_PUBLISHER"
          : actorKind(actor, c.data) === "agent"
            ? "LEGAL_AGENT_PROPOSE"
            : ["principle", "ruling"].includes(change.targetType)
              ? "LEGAL_EDITOR_RULINGS"
              : "LEGAL_EDITOR_LAWS",
        scope(change),
      );
    }
    const checks = await runChecks(
      tx,
      set.changes,
      c.data,
      set.kind === "revert",
    );
    if (checks.some((check) => !check.ok)) {
      await tx.editorialChange.updateMany({
        where: { changeSetId: id },
        data: { status: "checks_failed", checks: json(checks) },
      });
      await audit(tx, actor, "checks_failed", sessionId, {
        changeSetId: id,
        after: checks,
      });
      return tx.editorialChangeSet.update({
        where: { id },
        data: { status: "checks_failed" },
      });
    }
    await tx.editorialChange.updateMany({
      where: { changeSetId: id },
      data: { status: "pending" },
    });
    await audit(tx, actor, "submitted", sessionId, { changeSetId: id });
    return tx.editorialChangeSet.update({
      where: { id },
      data: { status: "pending" },
    });
  });
}
export async function runChecks(
  tx: Tx,
  changes: EditorialChange[],
  config: DeskConfig,
  compensation = false,
) {
  const checks: Array<{
    target: string;
    ok: boolean;
    message: string;
    code?: string;
  }> = [];
  for (const ch of changes) {
    try {
      if (!compensation)
        validatePayload(
          changeInputSchema.parse({
            title: "فحص تغيير",
            targetType: ch.targetType,
            targetId: ch.targetId,
            op: ch.op,
            after: ch.after,
            evidenceInstrument: ch.evidenceInstrument,
            evidenceUrl: ch.evidenceUrl,
            evidenceQuote: ch.evidenceQuote,
            sourceRank: ch.sourceRank,
            idempotencyKey: ch.id,
          }),
          config,
        );
      if (!["create_work", "create_relation"].includes(ch.op)) {
        const current = await targetState(
          tx,
          targetSchema.parse(ch.targetType),
          ch.targetId,
        );
        if (hash(current.state) !== hash(ch.before))
          throw new DeskError(409, "تغيرت النسخة منذ إعداد المسودة.");
      }
      checks.push({
        target: ch.targetId,
        ok: true,
        message: "السند والحقول وبصمة النسخة متحققة",
      });
    } catch (e) {
      checks.push({
        target: ch.targetId,
        ok: false,
        code:
          e instanceof DeskError && e.status === 409
            ? "conflict"
            : "validation",
        message:
          e instanceof DeskError ? e.message : "لم تجتز الحقول فحص الصلاحية",
      });
    }
  }
  return checks;
}
export async function decideInTx(
  tx: Tx,
  actor: Actor,
  config: DeskConfig,
  id: string,
  decision: "approve" | "reject",
  reason: string,
  sessionId: string,
) {
  const set = await tx.editorialChangeSet.findUniqueOrThrow({
    where: { id },
    include: { changes: true, decisions: true },
  });
  if (!["pending", "approved"].includes(set.status))
    throw new DeskError(409, "الطلب غير متاح للمراجعة.");
  const self = set.authorId === actor.id;
  for (const change of set.changes) {
    if (!(await allowedChange(tx, actor, config, "LEGAL_REVIEWER", change)))
      throw new DeskError(403, "المراجعة خارج نطاق صلاحياتك.");
    const next = object(change.after);
    if (change.op === "update_metadata" && typeof next.domain === "string")
      demand(actor, config, "LEGAL_REVIEWER", {
        target: "work",
        domain: next.domain,
      });
    const policy = policyFor(config, targetSchema.parse(change.targetType));
    if (
      self &&
      !(
        actor.role === "SUPER_ADMIN" &&
        policy.ownerSelfApproval &&
        reason.trim().length >= 10
      )
    )
      throw new DeskError(
        403,
        "الاعتماد الذاتي محظور؛ استثناء المالك يتطلب سياسة مفعلة وسببًا مفصلًا.",
      );
  }
  if (set.decisions.some((d) => d.reviewerId === actor.id))
    throw new DeskError(409, "سبق تسجيل قرارك؛ القرار ثابت.");
  await tx.editorialReviewDecision.create({
    data: {
      changeSetId: id,
      reviewerId: actor.id,
      decision,
      reason,
      selfApproval: self,
      payloadHash: set.payloadHash,
    },
  });
  const decisions = await tx.editorialReviewDecision.findMany({
    where: { changeSetId: id },
  });
  const complete = await approvalsComplete(
    tx,
    config,
    set.changes,
    decisions,
    set.payloadHash,
  );
  const status =
    decision === "reject" ? "rejected" : complete ? "approved" : "pending";
  await tx.editorialChange.updateMany({
    where: { changeSetId: id },
    data: { status },
  });
  await audit(
    tx,
    actor,
    decision === "approve" ? "approved" : "rejected",
    sessionId,
    {
      changeSetId: id,
      after: { status },
      metadata: { reason, selfApproval: self },
    },
  );
  return tx.editorialChangeSet.update({ where: { id }, data: { status } });
}
export function decide(
  userId: string,
  id: string,
  decision: "approve" | "reject",
  reason: string,
  sessionId: string,
) {
  if (!reason.trim()) throw new DeskError(400, "سبب القرار مطلوب.");
  return transaction(userId, (tx, actor, c) =>
    decideInTx(tx, actor, c.data, id, decision, reason, sessionId),
  );
}
export async function applyChange(tx: Tx, actor: Actor, ch: EditorialChange) {
  const after = object(ch.after);
  const evidence = {
    evidenceInstrument: ch.evidenceInstrument,
    evidenceUrl: ch.evidenceUrl,
    evidenceQuote: ch.evidenceQuote,
  };
  if (ch.op === "create_work")
    await tx.legalSystem.create({
      data: {
        id: ch.targetId,
        name: String(after.officialName),
        domain: String(after.domain ?? ""),
      },
    });
  if (ch.targetType === "work") {
    const before = object(ch.before);
    const keys = Array.isArray(after._restoreOverlayKeys)
      ? after._restoreOverlayKeys
      : [
          ...new Set([
            ...(Array.isArray(before._overlayKeys) ? before._overlayKeys : []),
            ...Object.keys(after),
          ]),
        ];
    const data: Prisma.JsonObject = { ...before, ...after, _overlayKeys: keys };
    delete data._restoreOverlayKeys;
    await tx.editorialWorkVersion.create({
      data: {
        workId: ch.targetId,
        changeSetId: ch.changeSetId,
        data: json(data),
      },
    });
    if (ch.op === "set_work_status") {
      const prev = await tx.verification.findFirst({
        where: { objectType: "work", objectId: ch.targetId },
        orderBy: [{ verifiedAt: "desc" }, { id: "desc" }],
      });
      await tx.verification.create({
        data: {
          objectType: "work",
          objectId: ch.targetId,
          verifiedStatus: String(after.status ?? "قيد التحقق"),
          ...evidence,
          method: "manual",
          verifiedBy: actor.id,
          supersedesVerificationId: prev?.id,
        },
      });
    }
  }
  if (ch.op === "set_unit_text") {
    const validFrom = new Date(String(after.validFrom));
    if (
      await tx.unitVersion.count({ where: { unitId: ch.targetId, validFrom } })
    )
      throw new DeskError(
        409,
        "توجد نسخة تسري في اليوم نفسه؛ يلزم حسم الإصدارات قبل نشر أخرى.",
      );
    await tx.unitVersion.create({
      data: {
        unitId: ch.targetId,
        body: String(after.body),
        validFrom,
        ...evidence,
      },
    });
  }
  if (ch.op === "review_principle")
    await tx.judicialPrinciple.update({
      where: { id: ch.targetId },
      data: { reviewStatus: String(after.reviewStatus) },
    });
  if (ch.op === "review_ruling")
    await tx.judicialCase.update({
      where: { id: ch.targetId },
      data: { reviewStatus: String(after.reviewStatus) },
    });
  if (ch.op === "review_amendment") {
    const parsed = amendmentDecision(after as ChangeInput["after"]);
    await tx.$executeRaw`INSERT INTO uqn_fix.amendment_review(op_id,decision,corrected,reviewer,note) VALUES (${ch.targetId},${parsed.decision},${JSON.stringify(parsed.corrected)}::jsonb,${actor.id},${`editorial:${ch.changeSetId}`})`;
  }
  if (ch.op === "create_relation")
    await tx.legalRelation.create({
      data: {
        id: ch.targetId,
        sourceType: "work",
        sourceId: String(after.sourceId),
        targetType: "work",
        targetId: String(after.targetId),
        relation: "IMPLEMENTS",
        status: "VERIFIED",
        evidenceId: ch.id,
        description: ch.evidenceQuote,
      },
    });
}
export function publish(userId: string, id: string, sessionId: string) {
  return transaction(userId, (tx, actor, c) =>
    publishInTx(tx, actor, c.data, id, sessionId),
  );
}
async function publishInTx(
  tx: Tx,
  actor: Actor,
  config: DeskConfig,
  id: string,
  sessionId: string,
  urgent = false,
) {
  const c = { data: config };
  const set = await tx.editorialChangeSet.findUniqueOrThrow({
    where: { id },
    include: { changes: true, decisions: true },
  });
  if (set.status !== "approved")
    throw new DeskError(409, "النشر يتطلب اكتمال الاعتماد.");
  if (
    !urgent &&
    !(await approvalsComplete(
      tx,
      c.data,
      set.changes,
      set.decisions,
      set.payloadHash,
    ))
  )
    throw new DeskError(409, "الموافقات الفعالة لا تحقق السياسة الحالية.");
  for (const change of set.changes) {
    if (!(await allowedChange(tx, actor, c.data, "LEGAL_PUBLISHER", change)))
      throw new DeskError(403, "النشر خارج نطاق صلاحياتك.");
    const next = object(change.after);
    if (change.op === "update_metadata" && typeof next.domain === "string")
      demand(actor, c.data, "LEGAL_PUBLISHER", {
        target: "work",
        domain: next.domain,
      });
    if (!["create_work", "create_relation"].includes(change.op)) {
      const current = await targetState(
        tx,
        targetSchema.parse(change.targetType),
        change.targetId,
      );
      if (hash(current.state) !== hash(change.before))
        throw new DeskError(
          409,
          "تغير العنصر منذ إعداد المسودة؛ أعد المراجعة.",
        );
    }
  }
  // Check the entire batch before applying; transaction rolls back every evidence row on failure.
  for (const change of set.changes) {
    await applyChange(tx, actor, change);
    const validFrom =
      change.op === "set_unit_text"
        ? new Date(String(object(change.after).validFrom))
        : new Date();
    await tx.editorialIndexSync.create({
      data: {
        changeSetId: id,
        targetType: change.targetType,
        targetId: change.targetId,
        nextAttemptAt: validFrom > new Date() ? validFrom : new Date(),
      },
    });
  }
  await tx.editorialChange.updateMany({
    where: { changeSetId: id },
    data: { status: "published" },
  });
  if (set.revertsChangeSetId) {
    await tx.editorialChangeSet.update({
      where: { id: set.revertsChangeSetId },
      data: { status: "reverted" },
    });
    await tx.editorialChange.updateMany({
      where: { changeSetId: set.revertsChangeSetId },
      data: { status: "reverted" },
    });
  }
  await audit(tx, actor, "published", sessionId, {
    changeSetId: id,
    before: set.changes.map((ch) => ch.before),
    after: set.changes.map((ch) => ch.after),
  });
  return tx.editorialChangeSet.update({
    where: { id },
    data: { status: "published", publishedAt: new Date() },
  });
}
export function saveConfig(
  userId: string,
  raw: unknown,
  expectedRevision: number,
  reason: string,
  sessionId: string,
) {
  const next = configSchema.parse(raw);
  return transaction(userId, async (tx, actor, c) => {
    demand(actor, c.data, "LEGAL_CONFIG_MANAGE");
    if (c.revision !== expectedRevision)
      throw new DeskError(409, "تغيرت الإعدادات؛ أعد تحميلها قبل الحفظ.");
    if (reason.trim().length < 5)
      throw new DeskError(400, "سبب تعديل الصلاحيات مطلوب.");
    const identities = [...new Set(next.bindings.map((b) => b.userId))];
    const users = await tx.user.findMany({
      where: { id: { in: identities } },
      select: { id: true, role: true, isActive: true },
    });
    if (users.length !== identities.length)
      throw new DeskError(400, "أحد معرفات المستخدمين غير موجود.");
    if (
      next.bindings.some(
        (b) =>
          b.kind === "agent" &&
          users.some((u) => u.id === b.userId && u.role === "SUPER_ADMIN"),
      )
    )
      throw new DeskError(400, "لا يمكن تحويل حساب المالك إلى وكيل.");
    const row = await tx.editorialConfig.create({
      data: { data: next, actorId: actor.id, reason },
    });
    await audit(tx, actor, "config_changed", sessionId, {
      before: c.data,
      after: next,
      metadata: { revision: row.revision, reason },
    });
    return row;
  });
}

/** Reversion is a compensating proposal; it follows the same review/publish policy. */
export function revert(
  userId: string,
  id: string,
  reason: string,
  sessionId: string,
) {
  return transaction(userId, (tx, actor, c) =>
    revertInTx(tx, actor, c.data, id, reason, sessionId),
  );
}
async function revertInTx(
  tx: Tx,
  actor: Actor,
  config: DeskConfig,
  id: string,
  reason: string,
  sessionId: string,
) {
  const c = { data: config };
  const set = await tx.editorialChangeSet.findUniqueOrThrow({
    where: { id },
    include: { changes: true },
  });
  if (set.status !== "published")
    throw new DeskError(409, "التراجع متاح عن نشر قائم فقط.");
  if (reason.trim().length < 10)
    throw new DeskError(400, "سبب التراجع المفصل مطلوب.");
  const inputs: ChangeInput[] = [];
  for (const ch of set.changes) {
    demand(actor, c.data, "LEGAL_PUBLISHER", scope(ch));
    if (
      ![
        "set_work_status",
        "update_metadata",
        "set_preamble",
        "review_principle",
        "review_ruling",
      ].includes(ch.op)
    )
      throw new DeskError(
        409,
        "هذا النوع يتطلب تغييرًا تعويضيًا يدويًا بسند جديد.",
      );
    const before = object(ch.before);
    const after = object(ch.after);
    const inverse: ChangeInput["after"] = {};
    for (const key of Object.keys(after))
      inverse[key] = (before[key] ?? null) as ChangeInput["after"][string];
    if (ch.targetType === "work")
      inverse._restoreOverlayKeys = Array.isArray(before._overlayKeys)
        ? before._overlayKeys.map(String)
        : [];
    const current = await targetState(
      tx,
      targetSchema.parse(ch.targetType),
      ch.targetId,
    );
    const currentObject = object(current.state as Prisma.JsonValue);
    if (
      Object.keys(after).some(
        (k) => hash(currentObject[k] ?? null) !== hash(after[k] ?? null),
      )
    )
      throw new DeskError(409, "هناك تغيير لاحق؛ راجعه قبل التراجع.");
    // Null restoration is accepted only here; users cannot bypass ordinary payload checks.
    inputs.push({
      title: `تراجع: ${set.title}`,
      targetType: targetSchema.parse(ch.targetType),
      targetId: ch.targetId,
      op: ch.op as ChangeInput["op"],
      after: inverse,
      evidenceInstrument: ch.evidenceInstrument,
      evidenceUrl: ch.evidenceUrl,
      evidenceQuote: ch.evidenceQuote,
      sourceRank: ch.sourceRank,
      idempotencyKey: `revert:${id}:${ch.id}`,
    });
  }
  const result = await tx.editorialChangeSet.create({
    data: {
      title: `تراجع: ${set.title}`,
      kind: "revert",
      authorId: actor.id,
      authorKind: "human",
      payloadHash: hash(inputs),
      idempotencyKey: `revert:${id}`,
      revertsChangeSetId: id,
    },
  });
  for (const input of inputs) {
    const current = await targetState(tx, input.targetType, input.targetId);
    await tx.editorialChange.create({
      data: {
        changeSetId: result.id,
        targetType: input.targetType,
        targetId: input.targetId,
        domain: current.scope.domain,
        op: input.op,
        before: current.state,
        after: input.after,
        evidenceInstrument: input.evidenceInstrument,
        evidenceUrl: input.evidenceUrl,
        evidenceQuote: input.evidenceQuote,
        sourceRank: input.sourceRank,
        sourceHash: hash(input.evidenceQuote),
        authorId: actor.id,
        authorKind: "human",
        checks: json([{ code: "compensation", ok: true, reason }]),
      },
    });
  }
  await audit(tx, actor, "revert_proposed", sessionId, {
    changeSetId: result.id,
    metadata: { reverts: id, reason },
  });
  return result;
}
export function assignTask(
  userId: string,
  id: string,
  assigneeId: string | null,
  status: "open" | "in_progress" | "done" | "cancelled",
  sessionId: string,
) {
  return transaction(userId, async (tx, actor, c) => {
    const task = await tx.editorialTask.findUniqueOrThrow({
      where: { id },
      include: { changeSet: { include: { changes: true } } },
    });
    for (const ch of task.changeSet.changes)
      demand(actor, c.data, "LEGAL_TASK_MANAGE", scope(ch));
    if (assigneeId) {
      const recipient = await tx.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, role: true, isActive: true },
      });
      if (
        !recipient?.isActive ||
        !task.changeSet.changes.every(
          (ch) =>
            recipient.role === "SUPER_ADMIN" ||
            c.data.bindings.some(
              (b) =>
                b.enabled &&
                b.kind === "human" &&
                b.userId === recipient.id &&
                (!task.roleId || b.roleId === task.roleId) &&
                b.targets.includes(targetSchema.parse(ch.targetType)) &&
                (!b.domains.length || b.domains.includes(ch.domain)) &&
                c.data.roles.some(
                  (r) => r.id === b.roleId && r.enabled && r.permissions.length,
                ),
            ),
        )
      )
        throw new DeskError(
          400,
          "المكلف لا يملك الدور المطلوب ضمن نطاق المهمة.",
        );
    }
    const updated = await tx.editorialTask.update({
      where: { id },
      data: { assigneeId, status },
    });
    await audit(tx, actor, "task_assigned", sessionId, {
      changeSetId: task.changeSetId,
      before: task,
      after: updated,
    });
    return updated;
  });
}
/** Explicit emergency policy: owner only, atomic compensation and a follow-up task. */
export function urgentRevert(
  userId: string,
  id: string,
  reason: string,
  sessionId: string,
) {
  return transaction(userId, async (tx, actor, c) => {
    if (actor.role !== "SUPER_ADMIN" || actorKind(actor, c.data) === "agent")
      throw new DeskError(403, "التراجع العاجل متاح للمالك فقط.");
    const original = await tx.editorialChangeSet.findUniqueOrThrow({
      where: { id },
      include: { changes: true },
    });
    if (
      !original.changes.every(
        (ch) =>
          policyFor(c.data, targetSchema.parse(ch.targetType))
            .urgentOwnerRevert,
      )
    )
      throw new DeskError(403, "سياسة التراجع العاجل غير مفعلة لهذا النوع.");
    const inverse = await revertInTx(tx, actor, c.data, id, reason, sessionId);
    await tx.editorialReviewDecision.create({
      data: {
        changeSetId: inverse.id,
        reviewerId: actor.id,
        decision: "approve",
        reason,
        selfApproval: true,
        payloadHash: inverse.payloadHash,
      },
    });
    await tx.editorialChangeSet.update({
      where: { id: inverse.id },
      data: { status: "approved" },
    });
    await tx.editorialChange.updateMany({
      where: { changeSetId: inverse.id },
      data: { status: "approved" },
    });
    const result = await publishInTx(
      tx,
      actor,
      c.data,
      inverse.id,
      sessionId,
      true,
    );
    const recipients = [
      ...new Set([
        original.authorId,
        ...c.data.bindings
          .filter(
            (b) =>
              b.kind === "human" &&
              b.enabled &&
              c.data.roles.some(
                (r) =>
                  r.id === b.roleId &&
                  r.enabled &&
                  r.permissions.includes("LEGAL_REVIEWER"),
              ),
          )
          .map((b) => b.userId),
      ]),
    ];
    const users = await tx.user.findMany({
      where: { id: { in: recipients }, isActive: true },
      select: { id: true },
    });
    for (const user of users)
      await tx.editorialTask.create({
        data: {
          changeSetId: inverse.id,
          title: `إشعار ومراجعة تراجع عاجل: ${original.title}`,
          assigneeId: user.id,
          dueAt: new Date(Date.now() + 86400000),
        },
      });
    await audit(tx, actor, "urgent_revert", sessionId, {
      changeSetId: inverse.id,
      metadata: { reverts: id, reason, notifiedUsers: users.map((u) => u.id) },
    });
    return result;
  });
}
export function withdraw(
  userId: string,
  id: string,
  reason: string,
  sessionId: string,
) {
  return transaction(userId, async (tx, actor, c) => {
    const set = await tx.editorialChangeSet.findUniqueOrThrow({
      where: { id },
      include: { changes: true },
    });
    if (set.authorId !== actor.id && actor.role !== "SUPER_ADMIN")
      throw new DeskError(403, "سحب الطلب متاح لمعده أو المالك.");
    if (!["draft", "checks_failed", "pending", "approved"].includes(set.status))
      throw new DeskError(409, "لا يمكن سحب طلب منشور أو مغلق.");
    if (!reason.trim()) throw new DeskError(400, "سبب السحب مطلوب.");
    for (const ch of set.changes)
      if (actor.role !== "SUPER_ADMIN")
        demand(
          actor,
          c.data,
          actorKind(actor, c.data) === "agent"
            ? "LEGAL_AGENT_PROPOSE"
            : ["principle", "ruling"].includes(ch.targetType)
              ? "LEGAL_EDITOR_RULINGS"
              : "LEGAL_EDITOR_LAWS",
          scope(ch),
        );
    await tx.editorialChange.updateMany({
      where: { changeSetId: id },
      data: { status: "rejected" },
    });
    await audit(tx, actor, "withdrawn", sessionId, {
      changeSetId: id,
      metadata: { reason },
    });
    return tx.editorialChangeSet.update({
      where: { id },
      data: { status: "rejected" },
    });
  });
}
