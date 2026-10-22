"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleAlert, Info, Layers } from "lucide-react";
import type { AmendmentQueueItem } from "@/lib/modules/editorial/intake";
import { postEditorial } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";
import { ApprovalsBadge, CardError, DecisionRow, Dock, ErrorDock, LiveRegion, ResultLine, UndoLine, WaitingLine } from "./DecisionParts";
import { KbdToggle } from "./KbdToggle";
import {
  COMPARE_OPS,
  CORRECTION_FIELDS,
  CORRECTION_LABEL,
  DESTRUCTIVE_OPS,
  INSTRUMENT_LABELS,
  OP_LABELS,
  REMOVAL_OPS,
  primaryCorrectionFields,
  type CorrectionKey,
} from "./labels";
import {
  correctionDiff,
  correctionSummary,
  countNoun,
  eligibleVisible,
  fmt,
  fmtDateTime,
  initialCorrection,
  leavesMyQueue,
  nextUndecided,
  AMEND_OPS_GEN,
  OPS_NOUN,
  OPS_NOUN_GEN,
  pendingLine,
  visibleSelection,
  type CorrectionValues,
} from "./logic";
import { NEXT_ITEMS_ID, QueuePager, useQueueCounts, ViewSwitch } from "./QueueFrame";
import { Badge, btnClass, HijriDate, Ltr, Message, SourceLink } from "./ui";
import { useDeskKeys, useKbdPreference } from "./useDeskKeys";
import { domIds, useAnnouncer, useDeferredDecisions } from "./useDeferredDecisions";

export type AmendmentItem = AmendmentQueueItem;

const PREFIX = "op";
const ISO = (s: string) => `⁨${s}⁩`;

type PanelState =
  | { id: string; mode: "reject"; note: string; error: string | null }
  | { id: string; mode: "correct"; values: CorrectionValues; note: string; errors: Partial<Record<CorrectionKey, string>>; message: string | null };

const DECISION_SHOWN: Record<string, string> = { approved: "اعتماد", approved_with_edit: "اعتماد مع تصحيح", rejected: "رفض" };

function labelOf(item: AmendmentItem): string {
  return `${ISO(item.op_id)} — ${item.target_law_title}`;
}

function opLine(item: AmendmentItem): string {
  return [
    OP_LABELS[item.op_type] ?? "عملية تعديل",
    item.article_number ? `المادة ${item.article_number}` : null,
    item.paragraph_label ? `الفقرة ${item.paragraph_label}` : null,
    item.term ? `«${item.term}»` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

function correctFieldId(opId: string, key: CorrectionKey): string {
  return `${domIds(PREFIX, opId).panel}-${key}`;
}

function pendingByOthers(item: AmendmentItem): boolean {
  return Boolean(item.pending_change_set_id && item.pending_decision && !item.my_approval);
}

export function AmendmentQueue({
  items,
  canDecide,
  writeEnabled,
  view,
  bulkView,
  nextHref,
  firstHref,
  total,
  mineHref,
  waitingHref,
}: {
  items: AmendmentItem[];
  canDecide: boolean;
  writeEnabled: boolean;
  view: "mine" | "waiting_others";
  bulkView: boolean;
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
  const order = useMemo(() => items.map((i) => i.op_id), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.op_id, i])), [items]);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [kbdOn, setKbdOn] = useKbdPreference();
  const containerRef = useRef<HTMLDivElement>(null);

  const decisions = useDeferredDecisions<PanelState>({
    prefix: PREFIX,
    announce,
    focusAfterSuccess: (id, decided) => {
      const next = nextUndecided(order, decided, id);
      return next ? domIds(PREFIX, next).card : NEXT_ITEMS_ID;
    },
    onSuccess: (id, outcome) => {
      setSelected((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (!leavesMyQueue(outcome)) return; // رُفض المقترح المعروض: يعود العنصر بلا قرار.
      decrement("amendments");
      if (outcome.status === "pending") addWaiting(1);
    },
    // فشل الإرسال: يعود ما كتبه المستخدم في اللوحة ليصحّحه (لا إعادة كتابة).
    onError: (_id, pending) => {
      if (pending.snapshot) setPanel(pending.snapshot);
    },
  });
  const { states } = decisions;
  const phaseOf = (id: string) => states[id]?.phase ?? "idle";
  const decidedHere = Object.values(states).filter((s) => s.phase === "done").length;

  const selectable = items.map((i) => ({
    id: i.op_id,
    eligible: i.bulk_eligible && !i.pending_change_set_id,
    blocked: phaseOf(i.op_id) !== "idle",
  }));
  const eligibleIds = eligibleVisible(selectable);
  const toSend = visibleSelection(selected, order).filter((id) => eligibleIds.includes(id));

  const openPanel = useCallback(
    (item: AmendmentItem, mode: "reject" | "correct") => {
      decisions.reset(item.op_id);
      setPanel(
        mode === "reject"
          ? { id: item.op_id, mode: "reject", note: "", error: null }
          : { id: item.op_id, mode: "correct", values: initialCorrection(item), note: "", errors: {}, message: null },
      );
      decisions.focusLater(mode === "reject" ? domIds(PREFIX, item.op_id).firstField : correctFieldId(item.op_id, primaryCorrectionFields(item.op_type)[0]));
    },
    [decisions],
  );

  const closePanel = (id: string, back: "reject" | "correct") => {
    setPanel(null);
    decisions.focusLater(back === "reject" ? domIds(PREFIX, id).reject : domIds(PREFIX, id).correct);
  };

  const ctx = (item: AmendmentItem) => ({ approvals: pendingByOthers(item) ? item.pending_approvals : 0, required: item.required_approvals });

  const approve = useCallback(
    (item: AmendmentItem) => {
      if (!active || phaseOf(item.op_id) === "pending" || phaseOf(item.op_id) === "sending") return;
      const url = `/api/admin/legal/intake/amendments/${encodeURIComponent(item.op_id)}/decide`;
      setPanel((p) => (p?.id === item.op_id ? null : p));
      if (pendingByOthers(item) && item.pending_decision) {
        const shown = item.pending_decision.decision;
        decisions.start(item.op_id, {
          verb: "agree",
          line: pendingLine("agree", labelOf(item), ctx(item), shown),
          label: labelOf(item),
          request: { url, body: { decision: shown, expectedDecisionHash: item.pending_decision_hash ?? undefined } },
          snapshot: null,
          summary: [],
          decision: shown,
        });
        return;
      }
      decisions.start(item.op_id, {
        verb: "approve",
        line: pendingLine("approve", labelOf(item), ctx(item)),
        label: labelOf(item),
        request: { url, body: { decision: "approved" } },
        snapshot: null,
        summary: [],
        decision: "approved",
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, decisions, states],
  );

  const confirmReject = (item: AmendmentItem, p: Extract<PanelState, { mode: "reject" }>) => {
    const note = p.note.trim();
    if (!note) {
      setPanel({ ...p, error: "اكتب سبب الرفض؛ لا يُرفض بلا سبب مكتوب." });
      decisions.focusLater(domIds(PREFIX, item.op_id).firstField);
      return;
    }
    const shown = pendingByOthers(item);
    const url = `/api/admin/legal/intake/amendments/${encodeURIComponent(item.op_id)}/decide`;
    setPanel(null);
    decisions.start(item.op_id, {
      verb: shown ? "rejectShown" : "reject",
      line: pendingLine(shown ? "rejectShown" : "reject", labelOf(item), ctx(item)),
      label: labelOf(item),
      request: { url, body: { decision: "rejected", note, expectedDecisionHash: shown ? item.pending_decision_hash ?? undefined : undefined } },
      snapshot: p,
      summary: [`سبب الرفض: ${note}`],
      decision: shown ? "rejectShown" : "rejected",
    });
  };

  const confirmCorrect = (item: AmendmentItem, p: Extract<PanelState, { mode: "correct" }>) => {
    const diff = correctionDiff(initialCorrection(item), p.values);
    const errorKeys = Object.keys(diff.errors) as CorrectionKey[];
    if (errorKeys.length) {
      setPanel({ ...p, errors: diff.errors, message: null });
      decisions.focusLater(correctFieldId(item.op_id, errorKeys[0]));
      return;
    }
    if (!Object.keys(diff.changed).length) {
      setPanel({ ...p, errors: {}, message: "لم تغيّر أي حقل؛ استعمل «اعتماد» مباشرة." });
      return;
    }
    const note = p.note.trim();
    setPanel(null);
    decisions.start(item.op_id, {
      verb: "correct",
      line: pendingLine("correct", labelOf(item), ctx(item)),
      label: labelOf(item),
      request: {
        url: `/api/admin/legal/intake/amendments/${encodeURIComponent(item.op_id)}/decide`,
        body: { decision: "approved_with_edit", corrected: diff.changed, note: note || undefined },
      },
      snapshot: { ...p, errors: {}, message: null },
      summary: [`الحقول المصححة: ${correctionSummary(diff.changed).join("، ")}`, ...(note ? [`ملاحظة: ${note}`] : [])],
      decision: "approved_with_edit",
    });
  };

  const undo = (item: AmendmentItem) => {
    const snapshot = decisions.undo(item.op_id);
    const ids = domIds(PREFIX, item.op_id);
    if (snapshot) {
      setPanel(snapshot);
      decisions.focusLater(snapshot.mode === "reject" ? ids.firstField : correctFieldId(item.op_id, primaryCorrectionFields(item.op_type)[0]));
    } else {
      decisions.focusLater(ids.approve);
    }
  };

  const retryOrRestore = (item: AmendmentItem) => void decisions.retry(item.op_id);

  const toggle = (id: string, on?: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const want = on ?? !next.has(id);
      if (want) next.add(id);
      else next.delete(id);
      return next;
    });

  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));

  const bulkApprove = async () => {
    if (!toSend.length) return;
    setBulkBusy(true);
    setBulkError(null);
    const res = await postEditorial<{ status: string; approvals: number; requiredApprovals: number; approved: number }>(
      "/api/admin/legal/intake/amendments/bulk-approve",
      { opIds: toSend },
    );
    setBulkBusy(false);
    if (!res.ok || !res.data) {
      setBulkError(res.message ?? "تعذّر الاعتماد الجماعي، ولم يُسجَّل شيء.");
      return;
    }
    const status = res.data.status === "pending" ? "pending" : "published";
    for (const id of toSend) {
      const item = byId.get(id);
      if (!item) continue;
      decisions.markDone(id, labelOf(item), {
        status,
        approvals: res.data.approvals,
        requiredApprovals: res.data.requiredApprovals,
        decision: "approved",
      });
    }
    decrement("amendments", toSend.length);
    if (status === "pending") addWaiting(toSend.length);
    const n = toSend.length;
    announce(
      status === "pending"
        ? `سُجّلت موافقتك على ${countNoun(n, OPS_NOUN)}، وتحتاج موافقة أخرى قبل التطبيق.`
        : n === 1
          ? "اعتُمدت عملية واحدة."
          : n === 2
            ? "اعتُمدت عمليتان."
            : `اعتُمدت ${countNoun(n, OPS_NOUN)}.`,
    );
    setSelected(new Set());
    setBulkOpen(false);
    const decided = new Set([...Object.entries(states).filter(([, s]) => s.phase === "done").map(([k]) => k), ...toSend]);
    const next = nextUndecided(order, decided, null);
    decisions.focusLater(next ? domIds(PREFIX, next).card : NEXT_ITEMS_ID);
  };

  const keyHandlers = useMemo(
    () => ({
      approve: (id: string) => {
        const item = byId.get(id);
        if (item && phaseOf(id) === "idle" && panel === null) approve(item);
      },
      reject: (id: string) => {
        const item = byId.get(id);
        if (item && phaseOf(id) === "idle") openPanel(item, "reject");
      },
      correct: (id: string) => {
        const item = byId.get(id);
        if (item && phaseOf(id) === "idle" && !pendingByOthers(item)) openPanel(item, "correct");
      },
      toggle: (id: string) => {
        if (eligibleIds.includes(id)) toggle(id);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approve, byId, eligibleIds, openPanel, panel, states],
  );
  // لا اختصار أثناء طلب سابق (حفظ قرار أو اعتماد جماعي جارٍ).
  const requestInFlight = bulkBusy || Object.values(states).some((s) => s.phase === "sending");
  useDeskKeys(containerRef, keyHandlers, active && kbdOn && !requestInFlight);

  const required = items[0]?.required_approvals ?? 1;
  const bulkItems = toSend.map((id) => byId.get(id)).filter((x): x is AmendmentItem => Boolean(x));

  return (
    <div ref={containerRef}>
      <LiveRegion text={announcement} />
      <div className="dk-toolbar">
        <ViewSwitch view={view} mineHref={mineHref} waitingHref={waitingHref} />
        {active && bulkView && eligibleIds.length ? (
          <button
            type="button"
            className={btnClass("correct")}
            onClick={() => {
              if (allEligibleSelected) setSelected(new Set());
              else setSelected(new Set(eligibleIds));
            }}
          >
            <Layers size={18} aria-hidden />
            <span>
              {allEligibleSelected ? "إلغاء تحديد الظاهر" : "تحديد المؤهَّل الظاهر"} ({fmt(eligibleIds.length)})
            </span>
          </button>
        ) : null}
        {active ? <KbdToggle on={kbdOn} onChange={setKbdOn} /> : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-4">
          <Message tone="info">
            {view === "waiting_others" ? "لا عمليات وافقتَ عليها تنتظر موافقة غيرك." : "لا عمليات تعديل تنتظر القرار بهذه المرشحات."}
          </Message>
        </div>
      ) : (
        <ol className="dk-list mt-4">
          {items.map((item) => {
            const ids = domIds(PREFIX, item.op_id);
            const state = states[item.op_id];
            const phase = state?.phase ?? "idle";
            if (phase === "done" && state?.result) {
              return (
                <li key={item.op_id}>
                  <ResultLine id={ids.card} text={state.result.text} tone={state.result.tone} />
                </li>
              );
            }
            const open = panel?.id === item.op_id ? panel : null;
            const others = pendingByOthers(item);
            const eligible = item.bulk_eligible && !item.pending_change_set_id;
            const describedBy = `${ids.title} ${ids.ref}`;
            return (
              <li key={item.op_id}>
                <article
                  id={ids.card}
                  data-card=""
                  data-id={item.op_id}
                  tabIndex={-1}
                  aria-labelledby={ids.title}
                  aria-busy={phase === "sending" ? true : undefined}
                  data-phase={phase}
                  data-selected={selected.has(item.op_id) && active ? "" : undefined}
                  className="dk-card"
                >
                  <h3 id={ids.title} className="dk-card__title">
                    {item.target_law_title}
                  </h3>
                  <p className="dk-card__meta dk-meta">
                    <Ltr>
                      <span id={ids.ref}>{item.op_id}</span>
                    </Ltr>
                    {" · "}
                    {INSTRUMENT_LABELS[item.instrument_kind] ?? "أداة"} {item.instrument_no ?? ""}
                  </p>
                  <p className="dk-card__op">{opLine(item)}</p>

                  <div className="dk-badges">
                    {item.risks?.length ? <Badge tone="risk">مخاطر: {item.risks.join("، ")}</Badge> : null}
                    {DESTRUCTIVE_OPS[item.op_type] ? <Badge tone="destructive">{DESTRUCTIVE_OPS[item.op_type]}</Badge> : null}
                    <ApprovalsBadge approvals={others || item.my_approval ? item.pending_approvals : 0} required={item.required_approvals} />
                    {item.confidence === "rule_exact" ? <Badge>مطابقة بالقاعدة</Badge> : <Badge tone="risk">تحتاج مراجعة</Badge>}
                    {item.verbatim_in_source === true ? (
                      <Badge>حرفي في المصدر</Badge>
                    ) : item.verbatim_in_source === false ? (
                      <Badge tone="danger">غير حرفي</Badge>
                    ) : null}
                    {item.target_hakeem_code ? <Badge>النظام مطابق</Badge> : <Badge tone="risk">يُحلّ بالعنوان</Badge>}
                    {item.bulk_eligible ? <Badge icon={Layers}>يقبل الجماعي</Badge> : null}
                  </div>

                  {active && eligible ? (
                    <label className="dk-join dk-bleed" data-on={selected.has(item.op_id) ? "" : undefined} aria-disabled={phase !== "idle" ? true : undefined}>
                      <input
                        type="checkbox"
                        checked={selected.has(item.op_id)}
                        disabled={phase !== "idle"}
                        aria-describedby={describedBy}
                        onChange={(e) => toggle(item.op_id, e.target.checked)}
                      />
                      <span>ضمّ إلى الاعتماد الجماعي</span>
                    </label>
                  ) : null}

                  <div className="dk-card__body">
                    <AmendmentBody item={item} />
                    {others ? <PendingDecisionBox item={item} /> : null}
                    <div>
                      <p className="dk-label">الدليل من الأداة</p>
                      <blockquote className="dk-quote">{item.evidence_quote}</blockquote>
                      <SourceLink href={item.source_url}>
                        {INSTRUMENT_LABELS[item.instrument_kind] ?? "الأداة"} {item.instrument_no ?? ""}
                        {item.instrument_date_hijri ? (
                          <>
                            {" بتاريخ "}
                            <HijriDate value={item.instrument_date_hijri} />
                          </>
                        ) : null}
                        {" — فتح المصدر"}
                      </SourceLink>
                    </div>
                  </div>

                  {view === "waiting_others" || item.my_approval ? (
                    <WaitingLine>وافقتَ على هذه العملية؛ تنتظر موافقة معتمِد آخر.</WaitingLine>
                  ) : !active ? null : phase === "pending" || phase === "sending" ? (
                    state ? <UndoLine ids={ids} state={state} now={decisions.now} onUndo={() => undo(item)} /> : null
                  ) : phase === "error" && state?.error?.stale ? null : (
                    <>
                      <DecisionRow
                        ids={ids}
                        describedBy={describedBy}
                        approveLabel={others ? "موافقة" : "اعتماد"}
                        onApprove={() => approve(item)}
                        onCorrect={others ? undefined : () => (open?.mode === "correct" ? closePanel(item.op_id, "correct") : openPanel(item, "correct"))}
                        correctOpen={open?.mode === "correct"}
                        onReject={
                          others && (item.pending_decision?.decision === "rejected")
                            ? undefined
                            : () => (open?.mode === "reject" ? closePanel(item.op_id, "reject") : openPanel(item, "reject"))
                        }
                        rejectOpen={open?.mode === "reject"}
                      />
                      {open?.mode === "reject" ? (
                        <RejectPanel
                          ids={ids}
                          panel={open}
                          consequence={others ? "يرفض القرار المعروض كله، وتعود العملية إلى الطابور بلا قرار." : undefined}
                          onChange={(note) => setPanel({ ...open, note, error: null })}
                          onConfirm={() => confirmReject(item, open)}
                          onCancel={() => closePanel(item.op_id, "reject")}
                        />
                      ) : null}
                      {open?.mode === "correct" ? (
                        <CorrectPanel
                          ids={ids}
                          item={item}
                          panel={open}
                          onChange={(next) => setPanel(next)}
                          onConfirm={() => confirmCorrect(item, open)}
                          onCancel={() => closePanel(item.op_id, "correct")}
                        />
                      ) : null}
                    </>
                  )}
                  {state?.phase === "error" && state.error ? (
                    <CardError ids={ids} error={state.error} onRetry={() => retryOrRestore(item)} onRefresh={() => router.refresh()} />
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}

      <QueuePager nextHref={nextHref} firstHref={firstHref} shown={items.length} total={total} decidedHere={decidedHere} />

      <Dock>
        <ErrorDock prefix={PREFIX} decisions={decisions} labelOf={(id) => (byId.get(id) ? labelOf(byId.get(id) as AmendmentItem) : id)} />
        {active && toSend.length ? (
          <div className="dk-bar" aria-busy={bulkBusy ? true : undefined}>
            <div className="dk-bar__inner">
              <p className="dk-bar__count">محدد {countNoun(toSend.length, OPS_NOUN)} من هذه الصفحة</p>
              <div className="dk-bar__buttons">
                <button type="button" className={btnClass("approve", { lg: true })} disabled={bulkBusy} onClick={() => setBulkOpen(true)}>
                  <span>اعتماد المحدد ({fmt(toSend.length)})…</span>
                </button>
                <button type="button" className={btnClass("correct", { lg: true })} disabled={bulkBusy} onClick={() => setSelected(new Set())}>
                  <span>إلغاء التحديد</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Dock>

      <ConfirmDialog
        open={bulkOpen}
        title={`اعتماد ${countNoun(bulkItems.length, AMEND_OPS_GEN)}؟`}
        consequence={
          required > 1
            ? `تُسجَّل موافقتك على كل عملية، وتحتاج ${countNoun(bulkItems.length, OPS_NOUN)} منها موافقة أخرى قبل التطبيق.`
            : "يُسجَّل لكل عملية قرار مستقل باسمك. لا يُعاد فتح القرار من المكتب في المرحلة صفر."
        }
        confirmLabel={`اعتماد ${countNoun(bulkItems.length, OPS_NOUN_GEN)}`}
        busyLabel={`جارٍ اعتماد ${countNoun(bulkItems.length, OPS_NOUN_GEN)}…`}
        confirmVariant="approve"
        busy={bulkBusy}
        error={bulkError}
        onConfirm={() => void bulkApprove()}
        onClose={() => {
          setBulkOpen(false);
          setBulkError(null);
        }}
      >
        <ul className="dk-sheet__list">
          {bulkItems.map((item) => (
            <li key={item.op_id}>
              <span className="dk-card__op">
                {item.target_law_title} — {opLine(item)}
              </span>
              <span className="dk-meta">
                <Ltr>{item.op_id}</Ltr>
              </span>
              {DESTRUCTIVE_OPS[item.op_type] ? (
                <span>
                  <Badge tone="destructive">{DESTRUCTIVE_OPS[item.op_type]}</Badge>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}

/** الجسم: المقارنة (النص الساري الآن | الجديد)، والإحلال بتسميتين ظاهرتين، والسريان (ح٥-ب، ح١٧). */
function AmendmentBody({ item }: { item: AmendmentItem }) {
  const compare = COMPARE_OPS.has(item.op_type);
  const removal = REMOVAL_OPS.has(item.op_type);
  const substitute = item.op_type === "substitute_phrase" || ((item.old_phrase || item.new_phrase) && !item.new_text);
  return (
    <>
      {compare ? (
        <div className="dk-compare dk-compare--2">
          <div>
            <p className="dk-label">{removal ? "النص الساري الآن (سيُلغى)" : "النص الساري الآن"}</p>
            {item.current_text_resolved && item.current_text ? (
              <div className="dk-legal dk-legal--old">{item.current_text}</div>
            ) : (
              <div className="dk-legal dk-legal--placeholder">
                <Info size={18} aria-hidden />
                <span>لم يُعثر على النص الساري في حكيم.</span>
              </div>
            )}
          </div>
          <div>
            <p className="dk-label">{removal ? "بعد الاعتماد" : "النص الجديد"}</p>
            {removal ? (
              <div className="dk-legal dk-legal--placeholder">
                <span>{item.op_type === "repeal_law" ? "يُلغى النظام، ولا يبقى له نص ساري." : item.op_type === "delete_paragraph" ? "تُحذف الفقرة، ولا يبقى لها نص ساري." : "تُلغى المادة، ولا يبقى لها نص ساري."}</span>
              </div>
            ) : item.new_text ? (
              <div className="dk-legal dk-legal--new">{item.new_text}</div>
            ) : (
              <div className="dk-legal dk-legal--placeholder">
                <span>لا نص جديد في المقترح.</span>
              </div>
            )}
          </div>
        </div>
      ) : item.new_text ? (
        <div>
          <p className="dk-label">النص الجديد</p>
          <div className="dk-legal dk-legal--new">{item.new_text}</div>
        </div>
      ) : null}
      {substitute ? (
        <div>
          <p className="dk-label">الإحلال</p>
          <dl className="dk-subst">
            <div>
              <dt>العبارة الحالية:</dt>
              <dd>
                <del>{item.old_phrase ?? "—"}</del>
              </dd>
            </div>
            <div>
              <dt>العبارة الجديدة:</dt>
              <dd>
                <ins>{item.new_phrase ?? "—"}</ins>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      <div>
        <p className="dk-body-text">
          <span className="dk-label">يسري من: </span>
          {item.effective_from_hijri ? <HijriDate value={item.effective_from_hijri} /> : "غير محدد في المقترح"}
          {item.effective_from_gregorian ? (
            <>
              {" ("}
              <span className="dk-nowrap">
                <bdi dir="ltr">{item.effective_from_gregorian.replace(/-/g, "/")}</bdi>م
              </span>
              {")"}
            </>
          ) : null}
        </p>
        {item.effective_rule ? <p className="dk-meta">{item.effective_rule}</p> : null}
      </div>
    </>
  );
}

/** القرار المعروض للموافقة ومضمونه للمعتمِد الثاني (م١، ق٢٣-١). */
function PendingDecisionBox({ item }: { item: AmendmentItem }) {
  const decision = item.pending_decision?.decision ?? "approved";
  const corrected = item.pending_corrected ?? {};
  return (
    <div className="dk-pendingbox">
      <dl>
        <div>
          <dt>القرار المعروض للموافقة</dt>
          <dd>
            <strong>{DECISION_SHOWN[decision] ?? "قرار"}</strong>
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
        {Object.keys(corrected).length
          ? Object.entries(corrected).map(([key, value]) => (
              <div key={key}>
                <dt>{CORRECTION_LABEL[key] ?? "حقل"} — المقترح ثم المصحح</dt>
                <dd>
                  <span className="dk-meta">المقترح: </span>
                  {String((item as unknown as Record<string, unknown>)[key] ?? "—")}
                  <br />
                  <span className="dk-meta">المصحح: </span>
                  <strong>{String(value)}</strong>
                </dd>
              </div>
            ))
          : null}
        {item.pending_note ? (
          <div>
            <dt>الملاحظة</dt>
            <dd>{item.pending_note}</dd>
          </div>
        ) : null}
        {decision === "rejected" ? (
          <div>
            <dd className="dk-meta">رفض مقترح الرفض غير متاح من هذه البطاقة؛ يُسحب من دفعته في «دفعات المحررين».</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function RejectPanel({
  ids,
  panel,
  consequence,
  onChange,
  onConfirm,
  onCancel,
}: {
  ids: ReturnType<typeof domIds>;
  panel: Extract<PanelState, { mode: "reject" }>;
  consequence?: string;
  onChange: (note: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const errId = `${ids.firstField}-err`;
  return (
    <div id={ids.panel} className="dk-panel">
      {consequence ? <p className="dk-meta">{consequence}</p> : null}
      <label className="dk-field">
        <span className="dk-field__label">سبب الرفض (إلزامي)</span>
        <textarea
          id={ids.firstField}
          rows={2}
          className="dk-input"
          value={panel.note}
          aria-invalid={panel.error ? true : undefined}
          aria-describedby={panel.error ? errId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {panel.error ? (
          <span id={errId} className="dk-field-error">
            <CircleAlert size={16} aria-hidden />
            <span>{panel.error}</span>
          </span>
        ) : null}
      </label>
      <div className="dk-panel__actions">
        <button type="button" className={btnClass("reject", { lg: true })} onClick={onConfirm}>
          <span>تأكيد الرفض</span>
        </button>
        <button type="button" className={btnClass("correct", { lg: true })} onClick={onCancel}>
          <span>إلغاء</span>
        </button>
      </div>
    </div>
  );
}

function CorrectPanel({
  ids,
  item,
  panel,
  onChange,
  onConfirm,
  onCancel,
}: {
  ids: ReturnType<typeof domIds>;
  item: AmendmentItem;
  panel: Extract<PanelState, { mode: "correct" }>;
  onChange: (next: PanelState) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const initial = initialCorrection(item);
  const primary = primaryCorrectionFields(item.op_type);
  const fields = CORRECTION_FIELDS.filter((f) => primary.includes(f.key)).sort((a, b) => primary.indexOf(a.key) - primary.indexOf(b.key));
  const others = CORRECTION_FIELDS.filter((f) => !primary.includes(f.key));
  const othersModified = others.some((f) => (panel.values[f.key] ?? "") !== (initial[f.key] ?? "") || panel.errors[f.key]);
  const renderField = (f: (typeof CORRECTION_FIELDS)[number]) => {
    const id = `${ids.panel}-${f.key}`;
    const errId = `${ids.panel}-${f.key}-err`;
    const value = panel.values[f.key] ?? "";
    const modified = value !== (initial[f.key] ?? "");
    const err = panel.errors[f.key];
    const set = (v: string) => onChange({ ...panel, values: { ...panel.values, [f.key]: v }, errors: { ...panel.errors, [f.key]: undefined }, message: null });
    return (
      <div key={f.key} className={`dk-field${f.multiline ? " dk-field--wide" : ""}`}>
        <label htmlFor={id} className="dk-field__label">
          {f.label}
          {f.hint ? <span className="dk-meta">({f.hint})</span> : null}
          {modified ? <Badge>معدّل</Badge> : null}
        </label>
        {f.key === "op_type" ? (
          <select id={id} className="dk-input" value={value} data-modified={modified ? "" : undefined} onChange={(e) => set(e.target.value)}>
            {Object.entries(OP_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        ) : f.multiline ? (
          <textarea
            id={id}
            rows={4}
            className="dk-input dk-input--legal"
            value={value}
            data-modified={modified ? "" : undefined}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? errId : undefined}
            onChange={(e) => set(e.target.value)}
          />
        ) : (
          <input
            id={id}
            dir={f.ltr ? "ltr" : "rtl"}
            inputMode={f.key === "article_number" ? "numeric" : undefined}
            className="dk-input"
            value={value}
            data-modified={modified ? "" : undefined}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? errId : undefined}
            onChange={(e) => set(e.target.value)}
          />
        )}
        {err ? (
          <span id={errId} className="dk-field-error">
            <CircleAlert size={16} aria-hidden />
            <span>{err}</span>
          </span>
        ) : null}
      </div>
    );
  };
  return (
    <div id={ids.panel} className="dk-panel">
      <div>
        <p className="dk-panel__title">تصحيح العملية ثم اعتمادها</p>
        <p className="dk-help">الحقول معبأة بالقيم المقترحة؛ غيّر ما يلزم فقط، ويُرسل ما تغيّر وحده.</p>
      </div>
      <div className="dk-fields">{fields.map((f) => renderField(f))}</div>
      <details className="dk-more" open={othersModified || undefined}>
        <summary>
          <ChevronDown size={18} aria-hidden className="dk-chev" />
          <span>حقول أخرى ({fmt(others.length)})</span>
        </summary>
        <div className="dk-fields">{others.map((f) => renderField(f))}</div>
      </details>
      <label className="dk-field">
        <span className="dk-field__label">ملاحظة (اختيارية)</span>
        <textarea rows={2} className="dk-input" value={panel.note} onChange={(e) => onChange({ ...panel, note: e.target.value, message: null })} />
      </label>
      {panel.message ? (
        <Message tone="warn" role="alert">
          {panel.message}
        </Message>
      ) : null}
      <div className="dk-panel__actions">
        <button type="button" className={btnClass("approve", { lg: true })} onClick={onConfirm}>
          <span>اعتماد مع التصحيح</span>
        </button>
        <button type="button" className={btnClass("correct", { lg: true })} onClick={onCancel}>
          <span>إلغاء</span>
        </button>
      </div>
    </div>
  );
}
