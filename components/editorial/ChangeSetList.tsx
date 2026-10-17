"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, CircleAlert, CircleX, Clock, PencilLine, Undo2, type LucideIcon } from "lucide-react";
import type { ChangeSetView, ChangeView } from "@/lib/modules/editorial/read";
import { postEditorial } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";
import { ApprovalsBadge, CardError, DecisionRow, Dock, ErrorDock, LiveRegion, ResultLine, UndoLine, WaitingLine } from "./DecisionParts";
import { CHANGE_SET_STATUS, CHANGE_SET_TONE, instrumentText } from "./labels";
import { fmtDateTime, pendingLine } from "./logic";
import { useQueueCounts } from "./QueueFrame";
import { Badge, btnClass, Ltr, Message, SourceLink, WithCodes } from "./ui";
import { domIds, useAnnouncer, useDeferredDecisions } from "./useDeferredDecisions";

const PREFIX = "cs";

type Panel = { id: string; mode: "reject" | "self"; note: string; error: string | null };

function isIntake(set: ChangeSetView): boolean {
  return set.kind === "agent_review" || set.kind === "agent_review_bulk";
}

/** لكل حالة دفعة أيقونتها مع نصها (لا لون وحده). */
const STATUS_ICON: Record<string, LucideIcon> = {
  draft: PencilLine,
  checks_failed: CircleAlert,
  pending: Clock,
  approved: Check,
  rejected: CircleX,
  published: CheckCheck,
  reverted: Undo2,
};

/** دفعة قرار مقترح: القرار المعروض ومضمونه في بطاقته (التعديلات أو المبادئ)، لا هنا (م١). */
function intakeHome(set: ChangeSetView): { href: string; label: string } {
  const principle = set.changes.some((c) => c.target_type === "principle") || set.title.startsWith("مراجعة مبدأ");
  return principle ? { href: "/admin/legal/queue?tab=principles", label: "المبادئ" } : { href: "/admin/legal/queue?tab=amendments", label: "تعديلات الأنظمة" };
}

function statusOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function setLabel(set: ChangeSetView): string {
  return `الدفعة «${set.title}»`;
}

export function ChangeSetList({
  sets,
  actorId,
  isOwner,
  canReview,
  canPublish,
  writeEnabled,
  createdId,
}: {
  sets: ChangeSetView[];
  actorId: string;
  isOwner: boolean;
  canReview: boolean;
  canPublish: boolean;
  writeEnabled: boolean;
  createdId: string | null;
}) {
  const router = useRouter();
  const { decrement } = useQueueCounts();
  const [announcement, announce] = useAnnouncer();
  const byId = useMemo(() => new Map(sets.map((s) => [s.id, s])), [sets]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { tone: "success" | "error"; text: string } | undefined>>({});
  const [publishFor, setPublishFor] = useState<ChangeSetView | null>(null);
  const [emergencyFor, setEmergencyFor] = useState<ChangeSetView | null>(null);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const decisions = useDeferredDecisions<Panel>({
    prefix: PREFIX,
    announce,
    focusAfterSuccess: () => null,
    onSuccess: (_id, outcome) => {
      if (outcome.status === "rejected" || outcome.status === "published") decrement("changes");
    },
    onError: (_id, pending) => {
      if (pending.snapshot) setPanel(pending.snapshot);
    },
  });
  const { states } = decisions;

  // الدفعة المنشأة للتو تأخذ التركيز (ق١١-٣).
  useEffect(() => {
    if (createdId && byId.has(createdId)) decisions.focusLater(domIds(PREFIX, createdId).card);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdId]);

  const ctx = (set: ChangeSetView) => ({ approvals: set.approvals, required: set.required_approvals });

  const startApprove = (set: ChangeSetView, reason: string | null, snapshot: Panel | null) => {
    decisions.start(set.id, {
      verb: "approve",
      line: pendingLine("approve", setLabel(set), ctx(set), null, "f"),
      label: setLabel(set),
      request: { url: `/api/admin/legal/change-sets/${encodeURIComponent(set.id)}/decide`, body: { decision: "approve", reason: reason ?? undefined } },
      snapshot,
      summary: reason ? [`سبب الاعتماد الذاتي: ${reason}`] : [],
      decision: "approve",
    });
  };

  const confirmPanel = (set: ChangeSetView, p: Panel) => {
    const note = p.note.trim();
    if (!note) {
      setPanel({ ...p, error: p.mode === "reject" ? "اكتب سبب الرفض؛ لا يُرفض بلا سبب مكتوب." : "اكتب سبب الاعتماد الذاتي؛ لا يعتمد المالك ما أعدّه بلا سبب." });
      decisions.focusLater(domIds(PREFIX, set.id).firstField);
      return;
    }
    setPanel(null);
    if (p.mode === "self") {
      startApprove(set, note, p);
      return;
    }
    decisions.start(set.id, {
      verb: "reject",
      line: pendingLine("reject", setLabel(set), { approvals: 0, required: 1 }, null, "f"),
      label: setLabel(set),
      request: { url: `/api/admin/legal/change-sets/${encodeURIComponent(set.id)}/decide`, body: { decision: "reject", reason: note } },
      snapshot: p,
      summary: [`سبب الرفض: ${note}`],
      decision: "reject",
    });
  };

  const undo = (set: ChangeSetView) => {
    const snapshot = decisions.undo(set.id);
    const ids = domIds(PREFIX, set.id);
    if (snapshot) {
      setPanel(snapshot);
      decisions.focusLater(ids.firstField);
    } else decisions.focusLater(ids.approve);
  };

  const run = async (set: ChangeSetView, action: "submit" | "withdraw" | "revert", body: unknown, done: string) => {
    setBusy(set.id);
    setMessages((m) => ({ ...m, [set.id]: undefined }));
    const res = await postEditorial(`/api/admin/legal/change-sets/${encodeURIComponent(set.id)}/${action}`, body);
    setBusy(null);
    if (!res.ok) {
      setMessages((m) => ({ ...m, [set.id]: { tone: "error", text: res.message ?? "تعذّر تنفيذ الفعل، ولم يُسجَّل شيء." } }));
      return;
    }
    setMessages((m) => ({ ...m, [set.id]: { tone: "success", text: done } }));
    setReasons((r) => ({ ...r, [set.id]: "" }));
    announce(done);
    router.refresh();
  };

  const publish = async () => {
    if (!publishFor) return;
    setBusy(publishFor.id);
    setDialogError(null);
    const res = await postEditorial(`/api/admin/legal/change-sets/${encodeURIComponent(publishFor.id)}/publish`);
    setBusy(null);
    if (!res.ok) {
      setDialogError(res.message ?? "تعذّر النشر.");
      return;
    }
    const done = `نُشرت ${setLabel(publishFor)}.`;
    setMessages((m) => ({ ...m, [publishFor.id]: { tone: "success", text: done } }));
    announce(done);
    setPublishFor(null);
    decrement("changes");
    router.refresh();
  };

  const emergency = async () => {
    if (!emergencyFor || emergencyReason.trim().length < 3) return;
    setBusy(emergencyFor.id);
    setDialogError(null);
    const res = await postEditorial(`/api/admin/legal/change-sets/${encodeURIComponent(emergencyFor.id)}/revert`, { reason: emergencyReason.trim(), emergency: true });
    setBusy(null);
    if (!res.ok) {
      setDialogError(res.message ?? "تعذّر التراجع العاجل.");
      return;
    }
    const done = `نُفّذ التراجع العاجل عن ${setLabel(emergencyFor)} وسُجّل باسمك.`;
    setMessages((m) => ({ ...m, [emergencyFor.id]: { tone: "success", text: done } }));
    announce(done);
    setEmergencyFor(null);
    setEmergencyReason("");
    router.refresh();
  };

  if (!sets.length) {
    return (
      <div className="mt-4">
        <LiveRegion text={announcement} />
        <Message tone="info">لا دفعات في هذا القسم.</Message>
      </div>
    );
  }

  return (
    <div>
      <LiveRegion text={announcement} />
      <ol className="dk-list mt-4">
        {sets.map((set) => {
          const ids = domIds(PREFIX, set.id);
          const state = states[set.id];
          const phase = state?.phase ?? "idle";
          if (phase === "done" && state?.result) {
            return (
              <li key={set.id}>
                <ResultLine id={ids.card} text={state.result.text} tone={state.result.tone} />
              </li>
            );
          }
          const isAuthor = set.author_kind === "human" && set.author_id === actorId;
          const intake = isIntake(set);
          // دفعة قرار مقترح لا تُقرَّر من هنا: المعتمِد الثاني يرى القرار المعروض ومضمونه في بطاقته ويوافق ببصمته (م١، ق٢٣).
          const showDecide = writeEnabled && set.status === "pending" && canReview && (!isAuthor || isOwner) && set.my_decision === null && !intake;
          const decideElsewhere = writeEnabled && set.status === "pending" && canReview && set.my_decision === null && intake;
          const waiting = set.status === "pending" && set.my_decision === "approve";
          const showSubmit = writeEnabled && (set.status === "draft" || set.status === "checks_failed") && (isAuthor || isOwner);
          const showWithdraw =
            writeEnabled &&
            ["draft", "checks_failed", "pending", "approved"].includes(set.status) &&
            (isOwner ||
              (set.status !== "approved" && !intake && isAuthor) ||
              ((set.status === "checks_failed" || set.status === "approved") && canReview) ||
              (set.status === "pending" && intake && canReview));
          const showRevert = writeEnabled && set.status === "published" && set.revertible;
          const reason = reasons[set.id] ?? "";
          const reasonOk = reason.trim().length >= 3;
          const reasonId = `${ids.panel}-reason`;
          const helpId = `${ids.panel}-help`;
          const open = panel?.id === set.id ? panel : null;
          const errId = `${ids.firstField}-err`;
          const message = messages[set.id];
          return (
            <li key={set.id}>
              <article
                id={ids.card}
                tabIndex={-1}
                aria-labelledby={ids.title}
                aria-busy={phase === "sending" || busy === set.id ? true : undefined}
                data-phase={phase}
                data-created={createdId === set.id ? "" : undefined}
                className="dk-card"
              >
                <div className="dk-card__head">
                  <h3 id={ids.title} className="dk-card__title">
                    <WithCodes text={set.title} />
                  </h3>
                  <span className="flex-none whitespace-nowrap">
                    <Badge tone={CHANGE_SET_TONE[set.status] ?? "neutral"} icon={STATUS_ICON[set.status]}>
                      {CHANGE_SET_STATUS[set.status] ?? "حالة غير معروفة"}
                    </Badge>
                  </span>
                </div>
                <p className="dk-card__meta dk-meta">
                  {set.author_kind === "agent" ? (
                    <>
                      وكيل: <Ltr>{set.author_agent ?? "—"}</Ltr>
                    </>
                  ) : isAuthor ? (
                    "أعدّه: أنت"
                  ) : (
                    "أعدّه: مُعِدّ بشري"
                  )}
                  {" · "}
                  <time dateTime={set.created_at}>{fmtDateTime(set.created_at)}</time>
                  <span id={ids.ref} className="dk-sr">
                    {set.title}
                  </span>
                </p>
                <div className="dk-badges">
                  <ApprovalsBadge approvals={set.approvals} required={set.required_approvals} />
                  {createdId === set.id ? <Badge tone="success">أُنشئت الآن</Badge> : null}
                </div>

                <div className="dk-card__body">
                  {set.changes.map((change) => (
                    <ChangeBlock key={change.id} change={change} />
                  ))}
                </div>

                {waiting ? <WaitingLine>وافقتَ على هذه الدفعة؛ تنتظر موافقة معتمِد آخر.</WaitingLine> : null}
                {decideElsewhere ? (
                  <p className="dk-statusline dk-bleed">
                    <span>
                      القرار المعروض ومضمونه في بطاقته، والموافقة عليه من هناك؛ ولسحب المقترح كله «سحب الدفعة» أدناه.{" "}
                      <Link href={intakeHome(set).href} className="dk-inline-link">
                        افتح «{intakeHome(set).label}»
                        <ArrowLeft size={16} aria-hidden />
                      </Link>
                    </span>
                  </p>
                ) : null}

                {showDecide ? (
                  phase === "pending" || phase === "sending" ? (
                    state ? <UndoLine ids={ids} state={state} now={decisions.now} onUndo={() => undo(set)} /> : null
                  ) : phase === "error" && state?.error?.stale ? null : (
                    <>
                      <DecisionRow
                        ids={ids}
                        describedBy={ids.title}
                        onApprove={() => {
                          if (isAuthor && isOwner) {
                            decisions.reset(set.id);
                            setPanel({ id: set.id, mode: "self", note: "", error: null });
                            decisions.focusLater(ids.firstField);
                          } else {
                            setPanel(null);
                            startApprove(set, null, null);
                          }
                        }}
                        onReject={() => {
                          if (open?.mode === "reject") {
                            setPanel(null);
                            decisions.focusLater(ids.reject);
                            return;
                          }
                          decisions.reset(set.id);
                          setPanel({ id: set.id, mode: "reject", note: "", error: null });
                          decisions.focusLater(ids.firstField);
                        }}
                        rejectOpen={open?.mode === "reject"}
                      />
                      {open ? (
                        <div id={ids.panel} className="dk-panel">
                          <label className="dk-field">
                            <span className="dk-field__label">{open.mode === "reject" ? "سبب الرفض (إلزامي)" : "سبب الاعتماد الذاتي (إلزامي)"}</span>
                            <textarea
                              id={ids.firstField}
                              rows={2}
                              className="dk-input"
                              value={open.note}
                              aria-invalid={open.error ? true : undefined}
                              aria-describedby={open.error ? errId : undefined}
                              onChange={(e) => setPanel({ ...open, note: e.target.value, error: null })}
                            />
                            {open.error ? (
                              <span id={errId} className="dk-field-error">
                                <CircleAlert size={16} aria-hidden />
                                <span>{open.error}</span>
                              </span>
                            ) : null}
                          </label>
                          <div className="dk-panel__actions">
                            <button type="button" className={btnClass(open.mode === "reject" ? "reject" : "approve", { lg: true })} onClick={() => confirmPanel(set, open)}>
                              <span>{open.mode === "reject" ? "تأكيد الرفض" : "متابعة الاعتماد"}</span>
                            </button>
                            <button
                              type="button"
                              className={btnClass("correct", { lg: true })}
                              onClick={() => {
                                setPanel(null);
                                decisions.focusLater(open.mode === "reject" ? ids.reject : ids.approve);
                              }}
                            >
                              <span>إلغاء</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )
                ) : null}
                {state?.phase === "error" && state.error ? (
                  <CardError ids={ids} error={state.error} onRetry={() => void decisions.retry(set.id)} onRefresh={() => router.refresh()} />
                ) : null}

                {set.status === "published" && intake ? (
                  <div className="mt-4">
                    <Message tone="lock">قرار مثبت؛ إعادة فتحه خارج المرحلة صفر.</Message>
                  </div>
                ) : null}
                {set.status === "approved" && !canPublish ? (
                  <p className="dk-statusline dk-bleed">معتمدة — بانتظار الناشر.</p>
                ) : null}

                {showSubmit || showWithdraw || showRevert || (set.status === "approved" && canPublish && writeEnabled) ? (
                  <section className="mt-4 border-t border-[var(--desk-border-card)] pt-4" aria-label={`أفعال ${setLabel(set)}`}>
                    <p className="dk-label">أفعال الدفعة</p>
                    {showWithdraw || showRevert ? (
                      <div className="dk-field mt-2">
                        <label htmlFor={reasonId} className="dk-field__label">
                          {showRevert ? "سبب التراجع (إلزامي)" : "سبب السحب (إلزامي)"}
                        </label>
                        <textarea
                          id={reasonId}
                          rows={2}
                          className="dk-input"
                          value={reason}
                          onChange={(e) => setReasons((r) => ({ ...r, [set.id]: e.target.value }))}
                        />
                        {!reasonOk ? (
                          <p id={helpId} className="dk-help">
                            اكتب ثلاثة أحرف على الأقل لتفعيل {showRevert ? "«طلب تراجع»" : "«سحب الدفعة»"}.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {showSubmit ? (
                        <button
                          type="button"
                          className={btnClass("primary")}
                          disabled={busy !== null}
                          onClick={() => void run(set, "submit", undefined, `أُرسلت ${setLabel(set)} إلى الفحوص والطابور.`)}
                        >
                          <span>إرسال للفحص والطابور</span>
                        </button>
                      ) : null}
                      {set.status === "approved" && canPublish && writeEnabled ? (
                        <button
                          type="button"
                          className={btnClass("primary")}
                          disabled={busy !== null}
                          onClick={() => {
                            setDialogError(null);
                            setPublishFor(set);
                          }}
                        >
                          <span>نشر الدفعة…</span>
                        </button>
                      ) : null}
                      {showWithdraw ? (
                        <button
                          type="button"
                          className={btnClass("correct")}
                          disabled={busy !== null || !reasonOk}
                          aria-describedby={!reasonOk ? helpId : undefined}
                          onClick={() => void run(set, "withdraw", { reason: reason.trim() }, `سُحبت ${setLabel(set)} وفُكّ قفل أهدافها.`)}
                        >
                          <span>سحب الدفعة</span>
                        </button>
                      ) : null}
                      {showRevert ? (
                        <>
                          <button
                            type="button"
                            className={btnClass("correct")}
                            disabled={busy !== null || !reasonOk}
                            aria-describedby={!reasonOk ? helpId : undefined}
                            onClick={() => void run(set, "revert", { reason: reason.trim() }, `أُنشئت دفعة تراجع عن ${setLabel(set)} تمر بالدورة.`)}
                          >
                            <span>طلب تراجع</span>
                          </button>
                          {isOwner ? (
                            <button
                              type="button"
                              className={btnClass("reject")}
                              disabled={busy !== null}
                              onClick={() => {
                                setDialogError(null);
                                setEmergencyReason(reason);
                                setEmergencyFor(set);
                              }}
                            >
                              <span>تراجع عاجل…</span>
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </section>
                ) : null}
                {message ? (
                  <div className="mt-3">
                    <Message tone={message.tone} role={message.tone === "error" ? "alert" : undefined}>
                      {message.text}
                    </Message>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
      <Dock>
        <ErrorDock prefix={PREFIX} decisions={decisions} labelOf={(id) => (byId.get(id) ? setLabel(byId.get(id) as ChangeSetView) : "الدفعة")} />
      </Dock>

      <ConfirmDialog
        open={publishFor !== null}
        title={publishFor ? `نشر ${setLabel(publishFor)}؟` : ""}
        consequence="يُكتب صف جديد في حكيم ويظهر للمستخدمين فورًا. العكس يكون بطلب تراجع يمر بالدورة."
        confirmLabel="نشر الدفعة"
        busyLabel="جارٍ النشر…"
        busy={busy !== null && busy === publishFor?.id}
        error={dialogError}
        onConfirm={() => void publish()}
        onClose={() => setPublishFor(null)}
      >
        {publishFor ? <SetSummary set={publishFor} mode="publish" /> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={emergencyFor !== null}
        alert
        title={emergencyFor ? `تراجع عاجل عن ${setLabel(emergencyFor)}؟` : ""}
        consequence="يُنفَّذ فورًا دون موافقات، ويُسجَّل باسمك مع السبب، ويُبلَّغ الفريق."
        confirmLabel="تنفيذ التراجع العاجل"
        busyLabel="جارٍ التنفيذ…"
        confirmVariant="destructive"
        busy={busy !== null && busy === emergencyFor?.id}
        error={dialogError}
        confirmDisabled={emergencyReason.trim().length < 3}
        confirmHelp="اكتب سبب التراجع العاجل (ثلاثة أحرف على الأقل) لتفعيل التنفيذ."
        onConfirm={() => void emergency()}
        onClose={() => setEmergencyFor(null)}
      >
        {emergencyFor ? (
          <>
            <SetSummary set={emergencyFor} mode="revert" />
            <label className="dk-field">
              <span className="dk-field__label">سبب التراجع العاجل (إلزامي)</span>
              <textarea rows={3} className="dk-input" value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} />
            </label>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

/** تغيير في الدفعة: سطر الخادم العربي، واسم النظام بجانب رمزه، و«الساري الآن | بعد الاعتماد»، والسند (ق٥-٣، ق١٩). */
function ChangeBlock({ change }: { change: ChangeView }) {
  const isStatus = change.op === "set_work_status";
  const before = statusOf(change.before?.status);
  const after = statusOf(change.after?.status);
  const checkMessage = change.status === "checks_failed" && typeof change.checks?.message === "string" ? change.checks.message : null;
  return (
    <div className="grid gap-3">
      {isStatus ? (
        <p className="dk-card__op">
          {change.target_name ?? <span className="dk-meta">اسم النظام غير متاح</span>} <span className="dk-meta">· الرمز</span>{" "}
          <Ltr>{change.target_id}</Ltr>
        </p>
      ) : null}
      <p className="dk-body-text">
        <WithCodes text={change.summary} />
      </p>
      {isStatus ? (
        <div className="dk-compare dk-compare--2">
          <div>
            <p className="dk-label">الساري الآن</p>
            <div className="dk-legal dk-legal--old">{before ?? "بلا حالة موثّقة"}</div>
          </div>
          <div>
            <p className="dk-label">بعد الاعتماد</p>
            <div className="dk-legal dk-legal--new">{after ?? "—"}</div>
          </div>
        </div>
      ) : null}
      {change.evidence_quote ? <blockquote className="dk-quote">{change.evidence_quote}</blockquote> : null}
      {change.evidence_url ? (
        <SourceLink href={change.evidence_url}>
          <WithCodes text={change.evidence_instrument ? instrumentText(change.evidence_instrument) : "السند"} /> — فتح المصدر
        </SourceLink>
      ) : null}
      {checkMessage ? (
        <Message tone="error" title="فشل الفحص.">
          {checkMessage}
        </Message>
      ) : null}
    </div>
  );
}

function SetSummary({ set, mode }: { set: ChangeSetView; mode: "publish" | "revert" }) {
  const change = set.changes[0];
  const before = statusOf(change?.before?.status);
  const after = statusOf(change?.after?.status);
  return (
    <dl className="dk-sheet__summary">
      <div>
        <dt>النظام</dt>
        <dd>
          {change?.target_name ?? "اسم النظام غير متاح"} {change ? <Ltr>{change.target_id}</Ltr> : null}
        </dd>
      </div>
      {mode === "publish" ? (
        <>
          <div>
            <dt>الحالة</dt>
            <dd>
              {before ?? "بلا حالة موثّقة"} ← {after ?? "—"}
            </dd>
          </div>
          {change?.evidence_url ? (
            <div>
              <dt>السند</dt>
              <dd>
                <SourceLink href={change.evidence_url}>
                  <WithCodes text={change.evidence_instrument ? instrumentText(change.evidence_instrument) : "السند"} />
                </SourceLink>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>الموافقات</dt>
            <dd>
              {set.approvals.toLocaleString("ar-SA")} من {set.required_approvals.toLocaleString("ar-SA")}
            </dd>
          </div>
        </>
      ) : (
        <>
          <div>
            <dt>الآن</dt>
            <dd>{after ?? "—"}</dd>
          </div>
          <div>
            <dt>بعد التراجع</dt>
            <dd>{before ?? "بلا حالة موثّقة"}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
