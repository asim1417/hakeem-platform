"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postEditorial } from "./api";
import { btn, Notice } from "./ui";

/** أفعال الدفعة بحسب حالتها وصلاحية المستخدم. الخادم هو الحكم النهائي على كل فعل. */
export function ChangeSetActions({
  id,
  status,
  isAuthor,
  canReview,
  canPropose,
  isOwner,
  writeEnabled,
}: {
  id: string;
  status: string;
  isAuthor: boolean;
  canReview: boolean;
  canPropose: boolean;
  isOwner: boolean;
  writeEnabled: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (!writeEnabled) return null;

  const run = async (action: string, body?: unknown, done?: string) => {
    setBusy(true);
    setMessage(null);
    const res = await postEditorial(`/api/admin/legal/change-sets/${encodeURIComponent(id)}/${action}`, body);
    setBusy(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: res.message ?? "تعذّر تنفيذ الفعل." });
      return;
    }
    setMessage({ tone: "success", text: done ?? "تم." });
    setReason("");
    router.refresh();
  };

  const showSubmit = (status === "draft" || status === "checks_failed") && (isAuthor || isOwner);
  const showDecide = status === "pending" && canReview;
  const showPublish = status === "approved" && canReview;
  const showRevert = status === "published" && (canPropose || canReview);
  const showWithdraw =
    ((status === "draft" || status === "checks_failed" || status === "pending") && (isAuthor || isOwner)) ||
    ((status === "checks_failed" || status === "approved") && canReview) ||
    (status === "approved" && isOwner);
  if (!showSubmit && !showDecide && !showPublish && !showRevert && !showWithdraw) return null;

  return (
    <div className="mt-3 space-y-2">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {showDecide || showRevert || showWithdraw ? (
        <label className="block text-sm">
          <span className="mb-1 block text-[rgba(18,33,31,0.7)]">
            {showRevert ? "سبب التراجع (إلزامي)" : showDecide ? (isAuthor ? "سبب الاعتماد الذاتي (إلزامي للمالك)" : "السبب (إلزامي للرفض)") : "سبب السحب (إلزامي)"}
          </span>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-[rgba(14,52,53,0.18)] bg-white p-2" />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {showSubmit ? (
          <button type="button" className={`${btn.base} ${btn.primary}`} disabled={busy} onClick={() => run("submit", undefined, "أُرسلت الدفعة إلى الفحوص.")}>
            إرسال للفحص والطابور
          </button>
        ) : null}
        {showDecide ? (
          <>
            <button type="button" className={`${btn.base} ${btn.approve}`} disabled={busy} onClick={() => run("decide", { decision: "approve", reason: reason || undefined }, "اعتُمدت الدفعة.")}>
              اعتماد
            </button>
            <button type="button" className={`${btn.base} ${btn.reject}`} disabled={busy} onClick={() => run("decide", { decision: "reject", reason: reason || undefined }, "رُفضت الدفعة.")}>
              رفض
            </button>
          </>
        ) : null}
        {showPublish ? (
          <button type="button" className={`${btn.base} ${btn.approve}`} disabled={busy} onClick={() => run("publish", undefined, "نُشرت الدفعة كاملة.")}>
            نشر الدفعة
          </button>
        ) : null}
        {showWithdraw ? (
          <button type="button" className={`${btn.base} ${btn.neutral}`} disabled={busy || reason.trim().length < 3} onClick={() => run("withdraw", { reason }, "سُحبت الدفعة وفُكّ قفل أهدافها.")}>
            سحب الدفعة
          </button>
        ) : null}
        {showRevert ? (
          <>
            <button type="button" className={`${btn.base} ${btn.neutral}`} disabled={busy || reason.trim().length < 3} onClick={() => run("revert", { reason }, "أُنشئت دفعة تراجع تمر بالدورة.")}>
              طلب تراجع
            </button>
            {isOwner ? (
              <button type="button" className={`${btn.base} ${btn.reject}`} disabled={busy || reason.trim().length < 3} onClick={() => run("revert", { reason, emergency: true }, "نُفّذ التراجع العاجل وسُجّل.")}>
                تراجع عاجل (المالك)
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
