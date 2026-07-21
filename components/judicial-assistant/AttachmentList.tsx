"use client";

// لوحة تحكّم المرفقات — لكلّ ملفٍّ بطاقة تحكّم: عرض النصّ المُستخرَج، بحثٌ داخل الملفّ
// بتظليل المطابقات، وحذفٌ (المالك فقط). النصّ متاحٌ محليًّا (مُخزَّن مع القضية) فلا طلب إضافيّ.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isGarbledArabicText } from "@/lib/modules/document-inspection/reshape";
import { JaIcon } from "./icons";
import { formatDateTime } from "@/lib/modules/judicial-assistant/labels";
import type { CaseAttachment } from "@/lib/modules/judicial-assistant/types";

const PREVIEW_CAP = 40_000;

/** يقسّم النصّ إلى مقاطعَ مُظلَّلة/عاديّة حول مطابقات الاستعلام (بحثٌ داخل الملفّ). */
function segments(text: string, q: string): Array<{ t: string; m: boolean }> {
  const query = q.trim();
  if (!query) return [{ t: text, m: false }];
  const out: Array<{ t: string; m: boolean }> = [];
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  let i = 0;
  let idx = hay.indexOf(needle, i);
  while (idx !== -1) {
    if (idx > i) out.push({ t: text.slice(i, idx), m: false });
    out.push({ t: text.slice(idx, idx + needle.length), m: true });
    i = idx + needle.length;
    idx = hay.indexOf(needle, i);
  }
  if (i < text.length) out.push({ t: text.slice(i), m: false });
  return out;
}

function AttachmentCard({ caseId, att, onRemoved }: { caseId: string; att: CaseAttachment; onRemoved: () => void }) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  const truncated = att.text.length > PREVIEW_CAP;
  const preview = truncated ? att.text.slice(0, PREVIEW_CAP) : att.text;
  const segs = useMemo(() => segments(preview, find), [preview, find]);
  const matches = useMemo(() => segs.filter((s) => s.m).length, [segs]);
  const poorQuality = useMemo(() => att.text.trim().length > 40 && isGarbledArabicText(att.text).garbled, [att.text]);

  async function remove() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/judicial-assistant/cases/${caseId}/attachments?attId=${encodeURIComponent(att.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر الحذف.");
      onRemoved();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذّر الحذف."); }
    finally { setBusy(false); }
  }

  return (
    <li className="ja-att">
      <div className="ja-att__head">
        <div className="ja-att__id">
          <span className="ja-att__ic"><JaIcon name="documents" size={16} /></span>
          <div>
            <div className="ja-att__name">{att.name}{poorQuality ? <span className="ja-badge ja-badge--warning ja-att__q">نصٌّ مشوّه</span> : null}</div>
            <div className="ja-att__meta">{att.chars.toLocaleString("ar-SA")} حرف · أُضيف {formatDateTime(att.addedAt)}</div>
          </div>
        </div>
        <div className="ja-att__actions">
          <button type="button" className="ja-textbtn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "إخفاء النصّ ▲" : "عرض النصّ ▾"}
          </button>
          {confirm ? (
            <span className="ja-attdel">
              <button type="button" className="ja-danger-btn ja-danger-btn--sm" onClick={() => void remove()} disabled={busy}>{busy ? "…" : "تأكيد"}</button>
              <button type="button" className="ja-textbtn" onClick={() => setConfirm(false)}>إلغاء</button>
            </span>
          ) : (
            <button type="button" className="ja-textbtn ja-textbtn--danger" onClick={() => setConfirm(true)} aria-label={`حذف ${att.name}`}>حذف</button>
          )}
        </div>
      </div>

      {error ? <div className="ja-alert ja-alert--danger">{error}</div> : null}

      {open ? (
        <div className="ja-att__panel">
          {poorQuality ? (
            <div className="ja-alert ja-alert--warning">النصّ المقروء من هذه الوثيقة مشوّه (طبقة نصٍّ معطوبة أو مسحٌ ضوئيّ). احذفها وأعِد رفعها مع تفعيل «قراءة سحابيّة عالية الدقّة (Gemini)» للحصول على نصٍّ سليم.</div>
          ) : null}
          <div className="ja-att__find">
            <JaIcon name="evidence" size={14} />
            <input
              type="search" value={find} onChange={(e) => setFind(e.target.value)}
              placeholder="ابحث داخل هذا الملفّ…" className="ja-att__findinput"
            />
            {find.trim() ? <span className="ja-att__count">{matches.toLocaleString("ar-SA")} مطابقة</span> : null}
          </div>
          <div className="ja-att__text" dir="rtl">
            {segs.map((s, i) => (s.m ? <mark key={i}>{s.t}</mark> : <span key={i}>{s.t}</span>))}
          </div>
          {truncated ? <p className="ja-att__trunc">عُرِض أوّل {PREVIEW_CAP.toLocaleString("ar-SA")} حرف — الملفّ الكامل محفوظٌ ويُبحَث فيه في كلّ عمليّات القضية.</p> : null}
        </div>
      ) : null}
    </li>
  );
}

export function AttachmentList({ caseId, attachments }: { caseId: string; attachments: CaseAttachment[] }) {
  const router = useRouter();
  return (
    <ul className="ja-attlist">
      {attachments.map((a) => (
        <AttachmentCard key={a.id} caseId={caseId} att={a} onRemoved={() => router.refresh()} />
      ))}
    </ul>
  );
}
