"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postEditorial } from "./api";
import { useQueueKeys } from "./useQueueKeys";
import { btn, Ltr, Notice, Pill } from "./ui";

export interface AmendmentItem {
  op_id: string;
  instrument_kind: string;
  instrument_no: string | null;
  instrument_date_hijri: string | null;
  source_url: string;
  target_law_title: string;
  target_hakeem_code: string | null;
  target_match_status: string | null;
  op_type: string;
  article_number: number | null;
  paragraph_label: string | null;
  term: string | null;
  new_text: string | null;
  old_phrase: string | null;
  new_phrase: string | null;
  effective_from_hijri: string | null;
  effective_from_gregorian: string | null;
  effective_rule: string | null;
  risks: string[];
  confidence: string;
  verbatim_in_source: boolean | null;
  evidence_quote: string;
  bulk_eligible: boolean;
}

const OP_LABELS: Record<string, string> = {
  replace_article_text: "استبدال نص مادة",
  replace_paragraph_text: "استبدال نص فقرة",
  insert_paragraph: "إضافة فقرة",
  insert_article: "إضافة مادة",
  append_text: "إضافة عبارة",
  delete_paragraph: "حذف فقرة",
  repeal_article: "إلغاء مادة",
  substitute_phrase: "إحلال عبارة",
  replace_definition: "استبدال تعريف",
  replace_definition_entry: "استبدال بند تعريف",
  replace_law: "إحلال نظام",
  repeal_law: "إلغاء نظام",
  rename_law: "تعديل اسم نظام",
};

const INSTRUMENT_LABELS: Record<string, string> = {
  royal_decree: "مرسوم ملكي",
  cabinet_decision: "قرار مجلس الوزراء",
  royal_order: "أمر ملكي",
  royal_circular: "تعميم ملكي",
};

const EDIT_FIELDS: Array<{ key: string; label: string; multiline?: boolean; ltr?: boolean }> = [
  { key: "target_law_title", label: "النظام المستهدف" },
  { key: "article_number", label: "رقم المادة", ltr: true },
  { key: "paragraph_label", label: "الفقرة" },
  { key: "new_text", label: "النص الجديد", multiline: true },
  { key: "old_phrase", label: "العبارة القديمة" },
  { key: "new_phrase", label: "العبارة الجديدة" },
  { key: "effective_from_hijri", label: "يسري من (هـ) مثل 1447-05-17", ltr: true },
  { key: "effective_from_gregorian", label: "يسري من (م) مثل 2026-10-17", ltr: true },
];

type Panel = { opId: string; mode: "reject" | "edit" } | null;

export function AmendmentQueue({
  items,
  canDecide,
  writeEnabled,
}: {
  items: AmendmentItem[];
  canDecide: boolean;
  writeEnabled: boolean;
}) {
  const router = useRouter();
  // لا تركيز افتراضي: الاعتماد بالمفتاح لا يعمل إلا على بطاقة ركّز عليها المراجع بنفسه.
  const [focus, setFocus] = useState(-1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const active = canDecide && writeEnabled;

  const move = useCallback(
    (delta: number) => {
      setFocus((current) => {
        const next = current < 0 ? 0 : Math.min(Math.max(current + delta, 0), Math.max(items.length - 1, 0));
        cardRefs.current[next]?.focus();
        return next;
      });
    },
    [items.length],
  );

  const decide = useCallback(
    async (opId: string, decision: "approved" | "rejected" | "approved_with_edit") => {
      if (!active) return;
      if (decision === "rejected" && !note.trim()) {
        setMessage({ tone: "error", text: "اكتب سبب الرفض أولًا." });
        return;
      }
      const corrected = decision === "approved_with_edit" ? Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim())) : undefined;
      if (decision === "approved_with_edit" && (!corrected || !Object.keys(corrected).length)) {
        setMessage({ tone: "error", text: "«موافق مع تصحيح» يحتاج حقلًا مصحَّحًا واحدًا على الأقل." });
        return;
      }
      setBusy(opId);
      setMessage(null);
      const res = await postEditorial(`/api/admin/legal/intake/amendments/${encodeURIComponent(opId)}/decide`, {
        decision,
        corrected,
        note: note.trim() || undefined,
      });
      setBusy(null);
      if (!res.ok) {
        setMessage({ tone: "error", text: res.message ?? "تعذّر حفظ القرار." });
        return;
      }
      setMessage({ tone: "success", text: decision === "rejected" ? `رُفضت العملية ${opId}.` : `اعتُمدت العملية ${opId}.` });
      setPanel(null);
      setNote("");
      setFields({});
      router.refresh();
    },
    [active, fields, note, router],
  );

  const bulkApprove = async () => {
    if (!active || !selected.size) return;
    setBusy("bulk");
    setMessage(null);
    const res = await postEditorial<{ approved: number }>("/api/admin/legal/intake/amendments/bulk-approve", {
      opIds: Array.from(selected),
      note: note.trim() || undefined,
    });
    setBusy(null);
    if (!res.ok) {
      setMessage({ tone: "error", text: res.message ?? "تعذّر الاعتماد الجماعي." });
      return;
    }
    setMessage({ tone: "success", text: `اعتُمدت ${res.data?.approved ?? selected.size} عملية، ولكل عملية صف قرار مستقل.` });
    setSelected(new Set());
    router.refresh();
  };

  const current = focus >= 0 ? items[focus] : undefined;
  // البطاقة المقصودة يجب أن تكون هي العنصر المركَّز فعلًا (مرئية أمام المراجع).
  const cardInFocus = () => focus >= 0 && typeof document !== "undefined" && cardRefs.current[focus] === document.activeElement;
  const handlers = useMemo(
    () => ({
      next: () => move(1),
      prev: () => move(-1),
      approve: () => {
        if (!current || panel !== null || busy !== null || !cardInFocus()) return;
        void decide(current.op_id, "approved");
      },
      reject: () => current && cardInFocus() && setPanel({ opId: current.op_id, mode: "reject" }),
      edit: () => current && cardInFocus() && setPanel({ opId: current.op_id, mode: "edit" }),
      toggle: () => {
        if (!current?.bulk_eligible || !cardInFocus()) return;
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(current.op_id)) next.delete(current.op_id);
          else next.add(current.op_id);
          return next;
        });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, decide, move, panel, busy, focus],
  );
  useQueueKeys(handlers, active);

  if (!items.length) {
    return <Notice>لا عمليات تعديل تنتظر القرار بهذه المرشحات.</Notice>;
  }

  return (
    <div className="space-y-4">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {active ? (
        <p className="text-xs leading-6 text-[rgba(18,33,31,0.6)]">
          لوحة المفاتيح: <kbd>j</kbd>/<kbd>k</kbd> تنقّل، <kbd>a</kbd> اعتماد، <kbd>r</kbd> رفض، <kbd>e</kbd> تصحيح، <kbd>x</kbd> تحديد للاعتماد الجماعي.
        </p>
      ) : null}
      {active && selected.size ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-[rgba(26,92,65,0.3)] bg-white p-3 shadow-sm">
          <span className="text-sm font-semibold text-[#1A5C41]">محدد: {selected.size}</span>
          <button type="button" className={`${btn.base} ${btn.approve}`} disabled={busy !== null} onClick={bulkApprove}>
            اعتماد المحدد
          </button>
          <button type="button" className={`${btn.base} ${btn.neutral}`} onClick={() => setSelected(new Set())}>
            إلغاء التحديد
          </button>
        </div>
      ) : null}
      <ol className="space-y-4">
        {items.map((item, index) => {
          const open = panel?.opId === item.op_id ? panel.mode : null;
          return (
            <li key={item.op_id}>
              <article
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                tabIndex={-1}
                onFocus={() => setFocus(index)}
                aria-label={`عملية ${item.op_id} على ${item.target_law_title}`}
                className={`rounded-xl border bg-white p-4 outline-none sm:p-5 ${
                  focus === index ? "border-[#C69763] ring-2 ring-[rgba(198,151,99,0.35)]" : "border-[rgba(14,52,53,0.12)]"
                }`}
              >
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold leading-7 text-[#0E3435]">{item.target_law_title}</h3>
                    <p className="text-sm text-[rgba(18,33,31,0.7)]">
                      {OP_LABELS[item.op_type] ?? item.op_type}
                      {item.article_number ? ` — المادة ${item.article_number}` : ""}
                      {item.paragraph_label ? ` — الفقرة ${item.paragraph_label}` : ""}
                      {item.term ? ` — «${item.term}»` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill tone={item.confidence === "rule_exact" ? "good" : "warn"}>
                      {item.confidence === "rule_exact" ? "مطابقة بالقاعدة" : "تحتاج مراجعة"}
                    </Pill>
                    <Pill tone={item.verbatim_in_source ? "good" : "bad"}>
                      {item.verbatim_in_source ? "حرفي في المصدر" : item.verbatim_in_source === false ? "غير حرفي" : "الحرفية غير معروفة"}
                    </Pill>
                    <Pill tone={item.target_hakeem_code ? "neutral" : "warn"}>{item.target_hakeem_code ? "النظام مطابق" : "يُحلّ بالعنوان"}</Pill>
                    {item.bulk_eligible ? <Pill tone="gold">يقبل الجماعي</Pill> : null}
                  </div>
                </header>

                <dl className="mt-3 grid gap-3 text-sm leading-7">
                  {item.new_text ? (
                    <div>
                      <dt className="font-semibold text-[rgba(18,33,31,0.7)]">النص الجديد</dt>
                      <dd className="whitespace-pre-wrap rounded-md bg-[#FBFAF6] p-3 font-[var(--font-amiri,inherit)] text-[#12211F]">{item.new_text}</dd>
                    </div>
                  ) : null}
                  {item.old_phrase || item.new_phrase ? (
                    <div>
                      <dt className="font-semibold text-[rgba(18,33,31,0.7)]">الإحلال</dt>
                      <dd className="rounded-md bg-[#FBFAF6] p-3">
                        <del className="text-[#8C281E]">{item.old_phrase ?? "—"}</del>
                        <span aria-hidden> ← </span>
                        <ins className="text-[#1A5C41] no-underline">{item.new_phrase ?? "—"}</ins>
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span>
                      <span className="font-semibold text-[rgba(18,33,31,0.7)]">يسري من: </span>
                      {item.effective_from_hijri ? <Ltr>{item.effective_from_hijri}هـ</Ltr> : "—"}
                      {item.effective_from_gregorian ? <> (<Ltr>{item.effective_from_gregorian}</Ltr>)</> : null}
                    </span>
                    {item.effective_rule ? <span className="text-[rgba(18,33,31,0.6)]">{item.effective_rule}</span> : null}
                  </div>
                  {item.risks?.length ? (
                    <div className="text-[#7A5427]">
                      <span className="font-semibold">المخاطر: </span>
                      {item.risks.join("، ")}
                    </div>
                  ) : null}
                  <div>
                    <dt className="font-semibold text-[rgba(18,33,31,0.7)]">الدليل من الأداة</dt>
                    <dd>
                      <blockquote className="border-s-4 border-[#C69763] ps-3 text-[#12211F]">{item.evidence_quote}</blockquote>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[#0E3435] underline underline-offset-4"
                      >
                        {INSTRUMENT_LABELS[item.instrument_kind] ?? item.instrument_kind} {item.instrument_no ?? ""}
                        {item.instrument_date_hijri ? ` بتاريخ ${item.instrument_date_hijri}هـ` : ""} — المصدر
                      </a>
                    </dd>
                  </div>
                </dl>

                <footer className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="me-auto text-xs text-[rgba(18,33,31,0.5)]">
                    <Ltr>{item.op_id}</Ltr>
                  </span>
                  {active ? (
                    <>
                      {item.bulk_eligible ? (
                        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 px-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-[#1A5C41]"
                            checked={selected.has(item.op_id)}
                            onChange={(e) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(item.op_id);
                                else next.delete(item.op_id);
                                return next;
                              })
                            }
                          />
                          تحديد
                        </label>
                      ) : null}
                      <button type="button" className={`${btn.base} ${btn.approve}`} disabled={busy !== null} onClick={() => decide(item.op_id, "approved")}>
                        اعتماد
                      </button>
                      <button type="button" className={`${btn.base} ${btn.neutral}`} disabled={busy !== null} onClick={() => setPanel({ opId: item.op_id, mode: "edit" })}>
                        موافق مع تصحيح
                      </button>
                      <button type="button" className={`${btn.base} ${btn.reject}`} disabled={busy !== null} onClick={() => setPanel({ opId: item.op_id, mode: "reject" })}>
                        رفض
                      </button>
                    </>
                  ) : null}
                </footer>

                {open ? (
                  <div className="mt-4 space-y-3 rounded-lg border border-[rgba(14,52,53,0.12)] bg-[#FBFAF6] p-3">
                    {open === "edit" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {EDIT_FIELDS.map((f) => (
                          <label key={f.key} className={`text-sm ${f.multiline ? "sm:col-span-2" : ""}`}>
                            <span className="mb-1 block text-[rgba(18,33,31,0.7)]">{f.label}</span>
                            {f.multiline ? (
                              <textarea
                                rows={4}
                                dir="rtl"
                                value={fields[f.key] ?? ""}
                                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                className="w-full rounded-md border border-[rgba(14,52,53,0.18)] bg-white p-2"
                              />
                            ) : (
                              <input
                                dir={f.ltr ? "ltr" : "rtl"}
                                value={fields[f.key] ?? ""}
                                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                className="min-h-[44px] w-full rounded-md border border-[rgba(14,52,53,0.18)] bg-white px-2"
                              />
                            )}
                          </label>
                        ))}
                        <label className="text-sm">
                          <span className="mb-1 block text-[rgba(18,33,31,0.7)]">نوع العملية</span>
                          <select
                            value={fields.op_type ?? ""}
                            onChange={(e) => setFields((prev) => ({ ...prev, op_type: e.target.value }))}
                            className="min-h-[44px] w-full rounded-md border border-[rgba(14,52,53,0.18)] bg-white px-2"
                          >
                            <option value="">بلا تغيير</option>
                            {Object.entries(OP_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                    <label className="block text-sm">
                      <span className="mb-1 block text-[rgba(18,33,31,0.7)]">{open === "reject" ? "سبب الرفض (إلزامي)" : "ملاحظة (اختيارية)"}</span>
                      <textarea
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded-md border border-[rgba(14,52,53,0.18)] bg-white p-2"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {open === "reject" ? (
                        <button type="button" className={`${btn.base} ${btn.reject}`} disabled={busy !== null} onClick={() => decide(item.op_id, "rejected")}>
                          تأكيد الرفض
                        </button>
                      ) : (
                        <button type="button" className={`${btn.base} ${btn.approve}`} disabled={busy !== null} onClick={() => decide(item.op_id, "approved_with_edit")}>
                          اعتماد مع التصحيح
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${btn.base} ${btn.neutral}`}
                        onClick={() => {
                          setPanel(null);
                          setNote("");
                          setFields({});
                        }}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
