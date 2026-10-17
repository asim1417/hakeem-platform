"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, ExternalLink } from "lucide-react";
import type { PrincipleQueueItem } from "@/lib/modules/editorial/intake";
import { ApprovalsBadge, CardError, DecisionRow, Dock, ErrorDock, LiveRegion, ResultLine, UndoLine, WaitingLine } from "./DecisionParts";
import { KbdToggle } from "./KbdToggle";
import { fmt, fmtDateTime, leavesMyQueue, nextUndecided, pendingLine } from "./logic";
import { NEXT_ITEMS_ID, QueuePager, useQueueCounts, ViewSwitch } from "./QueueFrame";
import { Badge, btnClass, Ltr, Message } from "./ui";
import { useDeskKeys, useKbdPreference } from "./useDeskKeys";
import { domIds, useAnnouncer, useDeferredDecisions } from "./useDeferredDecisions";

export type PrincipleItem = PrincipleQueueItem;

const PREFIX = "pr";
const ISO = (s: string) => `⁨${s}⁩`;

interface RejectPanel {
  id: string;
  note: string;
  error: string | null;
}

function labelOf(item: PrincipleItem): string {
  return `المبدأ «${item.title}»`;
}

function pendingByOthers(item: PrincipleItem): boolean {
  return Boolean(item.pending_change_set_id && item.pending_decision && !item.my_approval);
}

export function PrincipleQueue({
  items,
  canDecide,
  writeEnabled,
  view,
  nextHref,
  firstHref,
  total,
  mineHref,
  waitingHref,
}: {
  items: PrincipleItem[];
  canDecide: boolean;
  writeEnabled: boolean;
  view: "mine" | "waiting_others";
  nextHref: string | null;
  firstHref: string | null;
  total: number;
  mineHref: string;
  waitingHref: string;
}) {
  const router = useRouter();
  const { decrement, addWaiting } = useQueueCounts();
  const [announcement, announce] = useAnnouncer();
  const active = canDecide && writeEnabled && view === "mine";
  const order = useMemo(() => items.map((i) => i.id), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [panel, setPanel] = useState<RejectPanel | null>(null);
  const [kbdOn, setKbdOn] = useKbdPreference();
  const containerRef = useRef<HTMLDivElement>(null);

  const decisions = useDeferredDecisions<RejectPanel>({
    prefix: PREFIX,
    announce,
    focusAfterSuccess: (id, decided) => {
      const next = nextUndecided(order, decided, id);
      return next ? domIds(PREFIX, next).card : NEXT_ITEMS_ID;
    },
    onSuccess: (_id, outcome) => {
      if (!leavesMyQueue(outcome)) return;
      decrement("principles");
      if (outcome.status === "pending") addWaiting(1);
    },
    onError: (_id, pending) => {
      if (pending.snapshot) setPanel(pending.snapshot);
    },
  });
  const { states } = decisions;
  const phaseOf = (id: string) => states[id]?.phase ?? "idle";
  const decidedHere = Object.values(states).filter((s) => s.phase === "done").length;
  const url = (id: string) => `/api/admin/legal/intake/principles/${encodeURIComponent(id)}/decide`;
  const ctx = (item: PrincipleItem) => ({ approvals: pendingByOthers(item) ? item.pending_approvals : 0, required: item.required_approvals });

  const approve = (item: PrincipleItem) => {
    if (!active || phaseOf(item.id) === "pending" || phaseOf(item.id) === "sending") return;
    setPanel((p) => (p?.id === item.id ? null : p));
    if (pendingByOthers(item) && item.pending_decision) {
      const shown = item.pending_decision.decision;
      decisions.start(item.id, {
        verb: "agree",
        line: pendingLine("agree", labelOf(item), ctx(item), shown, "m"),
        label: labelOf(item),
        request: { url: url(item.id), body: { decision: shown, expectedDecisionHash: item.pending_decision_hash ?? undefined } },
        snapshot: null,
        summary: [],
        decision: shown,
        gender: "m",
      });
      return;
    }
    decisions.start(item.id, {
      verb: "approve",
      line: pendingLine("approve", labelOf(item), ctx(item), null, "m"),
      label: labelOf(item),
      request: { url: url(item.id), body: { decision: "approve" } },
      snapshot: null,
      summary: [],
      decision: "approve",
      gender: "m",
    });
  };

  const openReject = (item: PrincipleItem) => {
    decisions.reset(item.id);
    setPanel({ id: item.id, note: "", error: null });
    decisions.focusLater(domIds(PREFIX, item.id).firstField);
  };

  const confirmReject = (item: PrincipleItem, p: RejectPanel) => {
    const note = p.note.trim();
    if (!note) {
      setPanel({ ...p, error: "اكتب سبب الرفض؛ لا يُرفض بلا سبب مكتوب." });
      decisions.focusLater(domIds(PREFIX, item.id).firstField);
      return;
    }
    const shown = pendingByOthers(item);
    setPanel(null);
    decisions.start(item.id, {
      verb: shown ? "rejectShown" : "reject",
      line: pendingLine(shown ? "rejectShown" : "reject", labelOf(item), ctx(item), null, "m"),
      label: labelOf(item),
      request: { url: url(item.id), body: { decision: "reject", reason: note, expectedDecisionHash: shown ? item.pending_decision_hash ?? undefined : undefined } },
      snapshot: p,
      summary: [`سبب الرفض: ${note}`],
      decision: shown ? "rejectShown" : "reject",
      gender: "m",
    });
  };

  const undo = (item: PrincipleItem) => {
    const snapshot = decisions.undo(item.id);
    const ids = domIds(PREFIX, item.id);
    if (snapshot) {
      setPanel(snapshot);
      decisions.focusLater(ids.firstField);
    } else decisions.focusLater(ids.approve);
  };

  const keyHandlers = useMemo(
    () => ({
      approve: (id: string) => {
        const item = byId.get(id);
        if (item && phaseOf(id) === "idle" && panel === null) approve(item);
      },
      reject: (id: string) => {
        const item = byId.get(id);
        if (item && phaseOf(id) === "idle") openReject(item);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byId, panel, states],
  );
  const requestInFlight = Object.values(states).some((s) => s.phase === "sending");
  useDeskKeys(containerRef, keyHandlers, active && kbdOn && !requestInFlight);

  return (
    <div ref={containerRef}>
      <LiveRegion text={announcement} />
      <div className="dk-toolbar">
        <ViewSwitch view={view} mineHref={mineHref} waitingHref={waitingHref} />
        {active ? <KbdToggle on={kbdOn} onChange={setKbdOn} /> : null}
      </div>
      {items.length === 0 ? (
        <div className="mt-4">
          <Message tone="info">{view === "waiting_others" ? "لا مبادئ وافقتَ عليها تنتظر موافقة غيرك." : "لا مبادئ تنتظر المراجعة بهذه المرشحات."}</Message>
        </div>
      ) : (
        <ol className="dk-list mt-4">
          {items.map((item) => {
            const ids = domIds(PREFIX, item.id);
            const state = states[item.id];
            const phase = state?.phase ?? "idle";
            if (phase === "done" && state?.result) {
              return (
                <li key={item.id}>
                  <ResultLine id={ids.card} text={state.result.text} tone={state.result.tone} />
                </li>
              );
            }
            const others = pendingByOthers(item);
            const open = panel?.id === item.id ? panel : null;
            const describedBy = `${ids.title} ${ids.ref}`;
            const errId = `${ids.firstField}-err`;
            const confidence = typeof item.confidence === "number" ? item.confidence : null;
            return (
              <li key={item.id}>
                <article
                  id={ids.card}
                  data-card=""
                  data-id={item.id}
                  tabIndex={-1}
                  aria-labelledby={ids.title}
                  aria-busy={phase === "sending" ? true : undefined}
                  data-phase={phase}
                  className="dk-card"
                >
                  <h3 id={ids.title} className="dk-card__title">
                    {item.title}
                  </h3>
                  <div className="dk-badges">
                    {item.topic ? <Badge icon={null}>{item.topic}</Badge> : null}
                    {confidence !== null ? (
                      <Badge tone={confidence >= 0.8 ? "neutral" : "risk"}>ثقة الاستخراج {fmt(Math.round(confidence * 100))}٪</Badge>
                    ) : null}
                    <ApprovalsBadge approvals={others || item.my_approval ? item.pending_approvals : 0} required={item.required_approvals} />
                  </div>
                  <div className="dk-card__body">
                    <div>
                      <p className="dk-label">نص المبدأ</p>
                      <div className="dk-legal">{item.principleText}</div>
                    </div>
                    <div>
                      {item.court ? <p className="dk-meta">{item.court}</p> : null}
                      <a href={`/dashboard/legal-core/judgments/${encodeURIComponent(item.source_case_id)}`} target="_blank" rel="noopener noreferrer" className="dk-source">
                        <ExternalLink size={16} aria-hidden className="rtl:-scale-x-100" />
                        <span>
                          الحكم المصدر{" "}
                          <Ltr>
                            <span id={ids.ref}>{item.source_case_id}</span>
                          </Ltr>
                          <span className="dk-sr"> (يفتح في لسان جديد)</span>
                        </span>
                      </a>
                    </div>
                    {others ? (
                      <div className="dk-pendingbox">
                        <dl>
                          <div>
                            <dt>القرار المعروض للموافقة</dt>
                            <dd>
                              <strong>{item.pending_decision?.decision === "reject" ? "رفض" : "اعتماد"}</strong>
                            </dd>
                          </div>
                          <div>
                            <dt>صاحب القرار</dt>
                            <dd>
                              {item.pending_approvers.length
                                ? item.pending_approvers.map((a, i) => (
                                    <span key={a.id}>
                                      {i ? "، " : ""}
                                      {a.name ?? "معتمِد بلا اسم"}
                                      {a.at ? (
                                        <>
                                          {" — "}
                                          <time dateTime={a.at}>{fmtDateTime(a.at)}</time>
                                        </>
                                      ) : null}
                                    </span>
                                  ))
                                : "لا موافقة صالحة قائمة الآن"}
                            </dd>
                          </div>
                          {item.pending_note ? (
                            <div>
                              <dt>الملاحظة</dt>
                              <dd>{item.pending_note}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}
                  </div>

                  {view === "waiting_others" || item.my_approval ? (
                    <WaitingLine>وافقتَ على هذا المبدأ؛ ينتظر موافقة معتمِد آخر.</WaitingLine>
                  ) : !active ? null : phase === "pending" || phase === "sending" ? (
                    state ? <UndoLine ids={ids} state={state} now={decisions.now} onUndo={() => undo(item)} /> : null
                  ) : phase === "error" && state?.error?.stale ? null : (
                    <>
                      <DecisionRow
                        ids={ids}
                        describedBy={describedBy}
                        approveLabel={others ? "موافقة" : "اعتماد"}
                        onApprove={() => approve(item)}
                        onReject={others && item.pending_decision?.decision === "reject" ? undefined : () => (open ? (setPanel(null), decisions.focusLater(ids.reject)) : openReject(item))}
                        rejectOpen={Boolean(open)}
                      />
                      {open ? (
                        <div id={ids.panel} className="dk-panel">
                          {others ? <p className="dk-meta">يرفض القرار المعروض كله، ويعود المبدأ إلى المراجعة بلا قرار.</p> : null}
                          <label className="dk-field">
                            <span className="dk-field__label">سبب الرفض (إلزامي)</span>
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
                            <button type="button" className={btnClass("reject", { lg: true })} onClick={() => confirmReject(item, open)}>
                              <span>تأكيد الرفض</span>
                            </button>
                            <button
                              type="button"
                              className={btnClass("correct", { lg: true })}
                              onClick={() => {
                                setPanel(null);
                                decisions.focusLater(ids.reject);
                              }}
                            >
                              <span>إلغاء</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                  {state?.phase === "error" && state.error ? (
                    <CardError ids={ids} error={state.error} onRetry={() => void decisions.retry(item.id)} onRefresh={() => router.refresh()} />
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}
      <QueuePager nextHref={nextHref} firstHref={firstHref} shown={items.length} total={total} decidedHere={decidedHere} />
      <Dock>
        <ErrorDock prefix={PREFIX} decisions={decisions} labelOf={(id) => (byId.get(id) ? labelOf(byId.get(id) as PrincipleItem) : ISO(id))} />
      </Dock>
    </div>
  );
}
