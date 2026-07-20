"use client";

// قائمة المرفقات مع حذفٍ لكلّ مرفق (المالك فقط). حذفٌ بتأكيدٍ خفيف.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { JaIcon } from "./icons";
import { formatDateTime } from "@/lib/modules/judicial-assistant/labels";
import type { CaseAttachment } from "@/lib/modules/judicial-assistant/types";

export function AttachmentList({ caseId, attachments }: { caseId: string; attachments: CaseAttachment[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(attId: string) {
    setBusyId(attId); setError("");
    try {
      const res = await fetch(`/api/judicial-assistant/cases/${caseId}/attachments?attId=${encodeURIComponent(attId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر الحذف.");
      setConfirmId(null); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذّر الحذف."); }
    finally { setBusyId(null); }
  }

  return (
    <>
      {error ? <div className="ja-alert ja-alert--danger">{error}</div> : null}
      <ul className="ja-list">
        {attachments.map((a) => (
          <li key={a.id} className="ja-list__row">
            <div>
              <div className="ja-list__title">{a.name}</div>
              <div className="ja-list__sub">{a.chars.toLocaleString("ar-SA")} حرف · أُضيف {formatDateTime(a.addedAt)}</div>
            </div>
            {confirmId === a.id ? (
              <span className="ja-attdel">
                <button type="button" className="ja-danger-btn ja-danger-btn--sm" onClick={() => void remove(a.id)} disabled={busyId === a.id}>{busyId === a.id ? "…" : "تأكيد"}</button>
                <button type="button" className="ja-textbtn" onClick={() => setConfirmId(null)}>إلغاء</button>
              </span>
            ) : (
              <button type="button" className="ja-textbtn ja-textbtn--danger" onClick={() => setConfirmId(a.id)} aria-label={`حذف ${a.name}`}>حذف</button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
