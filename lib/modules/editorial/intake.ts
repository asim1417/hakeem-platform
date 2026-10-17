import { Prisma } from "@prisma/client";
import {
  Actor,
  ChangeInput,
  DeskConfig,
  DeskError,
  demand,
  policyFor,
} from "./contracts";
import { amendmentDecision } from "./checks";
import { applyChange, decideInTx } from "./service";
import { Tx, audit, hash, json, targetState, transaction } from "./repository";

export function reviewIntake(
  userId: string,
  source: "amendment" | "principle",
  id: string,
  decision: "approve" | "reject" | "reset",
  reason: string,
  corrections: ChangeInput["after"],
  sessionId: string,
  batch = false,
) {
  return transaction(userId, (tx, actor, c) =>
    reviewIntakeInTx(
      tx,
      actor,
      c.data,
      source,
      id,
      decision,
      reason,
      corrections,
      sessionId,
      batch,
    ),
  );
}
async function reviewIntakeInTx(
  tx: Tx,
  actor: Actor,
  config: DeskConfig,
  source: "amendment" | "principle",
  id: string,
  decision: "approve" | "reject" | "reset",
  reason: string,
  corrections: ChangeInput["after"],
  sessionId: string,
  batch = false,
) {
  const c = { data: config };
  if (!reason.trim()) throw new DeskError(400, "سبب القرار مطلوب.");
  const current = await targetState(tx, source, id);
  demand(actor, c.data, "LEGAL_REVIEWER", current.scope);
  policyFor(c.data, source);
  const raw = current.state as Prisma.InputJsonObject;
  if (
    batch &&
    (source !== "amendment" ||
      raw.confidence !== "rule_exact" ||
      raw.verbatim_in_source !== true)
  )
    throw new DeskError(
      400,
      "الدفعات محصورة في rule_exact مع نص مطابق للمصدر.",
    );
  if (source === "amendment" && decision === "reset")
    throw new DeskError(400, "إعادة التعديل تتطلب قرار مراجعة جديدًا.");
  const after: ChangeInput["after"] =
    source === "principle"
      ? {
          reviewStatus:
            decision === "approve"
              ? "reviewed"
              : decision === "reject"
                ? "rejected"
                : "needs_review",
        }
      : {
          decision:
            decision === "reject"
              ? "rejected"
              : Object.keys(corrections).length
                ? "approved_with_edit"
                : "approved",
          ...corrections,
        };
  if (source === "amendment") amendmentDecision(after);
  const key = `intake:${source}:${id}:${hash(current.state)}`;
  let set = await tx.editorialChangeSet.findUnique({
    where: { idempotencyKey: key },
    include: { changes: true },
  });
  if (set) {
    if (hash(set.changes[0].after) !== hash(after))
      throw new DeskError(409, "يوجد قرار مختلف قيد المراجعة.");
    if (set.status === "published") return set;
  } else {
    const existing = await tx.editorialChange.findFirst({
      where: {
        targetType: source,
        targetId: id,
        status: { in: ["draft", "pending", "approved"] },
      },
    });
    if (existing) throw new DeskError(409, "العنصر ضمن تغيير مفتوح بالفعل.");
    if (source === "amendment" && raw.latestDecision)
      throw new DeskError(409, "سبق البت في هذا التعديل.");
    if (
      source === "principle" &&
      raw.reviewStatus !== "needs_review" &&
      decision !== "reset"
    )
      throw new DeskError(409, "سبق البت في هذا المبدأ.");
    const quote = String(
      source === "amendment"
        ? (raw.evidence_quote ?? raw.new_text ?? "")
        : (raw.principleText ?? ""),
    );
    if (!quote.trim()) throw new DeskError(400, "لا يوجد نص مصدر للمراجعة.");
    set = await tx.editorialChangeSet.create({
      data: {
        title: `مراجعة ${source === "amendment" ? "تعديل" : "مبدأ"}: ${id}`,
        kind: "intake",
        authorId: `intake:${source}`,
        authorKind: "agent",
        status: "pending",
        payloadHash: hash(after),
        idempotencyKey: key,
        changes: {
          create: {
            targetType: source,
            targetId: id,
            domain: current.scope.domain,
            op:
              source === "amendment" ? "review_amendment" : "review_principle",
            before: current.state,
            after,
            evidenceInstrument: String(raw.instrument_no ?? "المصدر القضائي"),
            evidenceUrl:
              source === "amendment"
                ? String(raw.source_url ?? "")
                : `/rulings/${raw.sourceCaseId}`,
            evidenceQuote: quote,
            sourceRank: 1,
            authorId: `intake:${source}`,
            authorKind: "agent",
            sourceHash: hash(quote),
            status: "pending",
          },
        },
      },
      include: { changes: true },
    });
  }
  // A reject verdict is itself an approved review result, not approval of the extracted text.
  const reviewed = await decideInTx(
    tx,
    actor,
    c.data,
    set.id,
    "approve",
    reason,
    sessionId,
  );
  if (reviewed.status === "approved") {
    await applyChange(tx, actor, set.changes[0]);
    await tx.editorialChange.updateMany({
      where: { changeSetId: set.id },
      data: { status: "published" },
    });
    await tx.editorialChangeSet.update({
      where: { id: set.id },
      data: { status: "published", publishedAt: new Date() },
    });
    await audit(tx, actor, "intake_decision_applied", sessionId, {
      changeSetId: set.id,
      targetId: id,
      before: current.state,
      after,
    });
    if (source === "principle")
      await tx.editorialIndexSync.create({
        data: { changeSetId: set.id, targetType: source, targetId: id },
      });
  }
  return tx.editorialChangeSet.findUniqueOrThrow({
    where: { id: set.id },
    include: { changes: true },
  });
}
export function reviewIntakeBatch(
  userId: string,
  ids: string[],
  reason: string,
  sessionId: string,
) {
  if (!ids.length || ids.length > 30 || new Set(ids).size !== ids.length)
    throw new DeskError(400, "اختر من تعديل واحد إلى 30 تعديلًا دون تكرار.");
  return transaction(userId, async (tx, actor, c) => {
    const results = [];
    for (const id of ids)
      results.push(
        await reviewIntakeInTx(
          tx,
          actor,
          c.data,
          "amendment",
          id,
          "approve",
          reason,
          {},
          sessionId,
          true,
        ),
      );
    return results;
  });
}
