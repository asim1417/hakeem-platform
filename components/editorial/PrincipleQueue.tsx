"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postEditorial } from "./api";
import { useQueueKeys } from "./useQueueKeys";
import { btn, Ltr, Notice, Pill } from "./ui";

export interface PrincipleItem {
  id: string;
  title: string;
  principleText: string;
  sourceCaseId: string;
  court: string | null;
  topic: string | null;
  confidence: number | null;
}

export function PrincipleQueue({ items, canDecide, writeEnabled }: { items: PrincipleItem[]; canDecide: boolean; writeEnabled: boolean }) {
  const router = useRouter();
  const [focus, setFocus] = useState(0);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const refs = useRef<Array<HTMLElement | null>>([]);
  const active = canDecide && writeEnabled;

  const decide = useCallback(
    async (id: string, decision: "approve" | "reject") => {
      if (!active) return;
      if (decision === "reject" && !reason.trim()) {
        setMessage({ tone: "error", text: "اكتب سبب الرفض أولًا." });
        return;
      }
      setBusy(true);
      setMessage(null);
      const res = await postEditorial(`/api/admin/legal/intake/principles/${encodeURIComponent(id)}/decide`, {
        decision,
        reason: reason.trim() || undefined,
      });
      setBusy(false);
      if (!res.ok) {
        setMessage({ tone: "error", text: res.message ?? "تعذّر حفظ القرار." });
        return;
      }
      setMessage({ tone: "success", text: decision === "approve" ? "اعتُمد المبدأ." : "رُفض المبدأ." });
      setRejecting(null);
      setReason("");
      router.refresh();
    },
    [active, reason, router],
  );

  const current = items[focus];
  const move = useCallback(
    (delta: number) =>
      setFocus((i) => {
        const next = Math.min(Math.max(i + delta, 0), Math.max(items.length - 1, 0));
        refs.current[next]?.focus();
        return next;
      }),
    [items.length],
  );
  const handlers = useMemo(
    () => ({
      next: () => move(1),
      prev: () => move(-1),
      approve: () => current && rejecting === null && decide(current.id, "approve"),
      reject: () => current && setRejecting(current.id),
    }),
    [current, decide, move, rejecting],
  );
  useQueueKeys(handlers, active);

  if (!items.length) return <Notice>لا مبادئ تنتظر المراجعة بهذه المرشحات.</Notice>;

  return (
    <div className="space-y-4">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <ol className="space-y-4">
        {items.map((item, index) => (
          <li key={item.id}>
            <article
              ref={(el) => {
                refs.current[index] = el;
              }}
              tabIndex={-1}
              onFocus={() => setFocus(index)}
              className={`rounded-xl border bg-white p-4 outline-none sm:p-5 ${
                focus === index ? "border-[#C69763] ring-2 ring-[rgba(198,151,99,0.35)]" : "border-[rgba(14,52,53,0.12)]"
              }`}
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 text-base font-bold leading-7 text-[#0E3435]">{item.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {item.topic ? <Pill>{item.topic}</Pill> : null}
                  {typeof item.confidence === "number" ? (
                    <Pill tone={item.confidence >= 0.8 ? "good" : "warn"}>ثقة الاستخراج {Math.round(item.confidence * 100)}٪</Pill>
                  ) : null}
                </div>
              </header>
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-[#FBFAF6] p-3 text-sm leading-8 text-[#12211F]">{item.principleText}</p>
              <p className="mt-2 text-xs text-[rgba(18,33,31,0.6)]">
                {item.court ? `${item.court} — ` : ""}الحكم المصدر: <Ltr>{item.sourceCaseId}</Ltr>
              </p>
              {active ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={`${btn.base} ${btn.approve}`} disabled={busy} onClick={() => decide(item.id, "approve")}>
                    اعتماد
                  </button>
                  <button type="button" className={`${btn.base} ${btn.reject}`} disabled={busy} onClick={() => setRejecting(item.id)}>
                    رفض
                  </button>
                </div>
              ) : null}
              {rejecting === item.id ? (
                <div className="mt-3 space-y-2 rounded-lg border border-[rgba(14,52,53,0.12)] bg-[#FBFAF6] p-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-[rgba(18,33,31,0.7)]">سبب الرفض (إلزامي)</span>
                    <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-[rgba(14,52,53,0.18)] bg-white p-2" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={`${btn.base} ${btn.reject}`} disabled={busy} onClick={() => decide(item.id, "reject")}>
                      تأكيد الرفض
                    </button>
                    <button type="button" className={`${btn.base} ${btn.neutral}`} onClick={() => setRejecting(null)}>
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
