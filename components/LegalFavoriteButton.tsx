"use client";

import { useState } from "react";
import { BookmarkPlus, Check } from "lucide-react";
import { ComingSoonControl } from "@/components/ui/ComingSoon";

/**
 * حفظ حكم/مستند عبر annotations — يتطلّب معرّف مستند حقيقي.
 * بلا معرّف: وسم «قريبًا» بدل ادّعاء نجاح وهمي.
 */
export function LegalFavoriteButton({
  label = "إضافة للمفضلة",
  documentType = "ruling",
  documentId,
}: {
  label?: string;
  documentType?: string;
  documentId?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  if (!documentId) {
    return (
      <ComingSoonControl className="btn btn-outline" title="حفظ المفضلة لهذه النتيجة سيُتاح قريبًا">
        <BookmarkPlus size={16} aria-hidden />
        {label}
      </ComingSoonControl>
    );
  }

  async function onSave() {
    if (saved || loading || !documentId) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          documentId,
          note: "مفضلة",
          highlightedText: null,
        }),
      });
      if (!res.ok) throw new Error("تعذّر الحفظ.");
      const engage = await fetch("/api/credits/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "save_ruling", targetId: documentId }),
      });
      const data = await engage.json().catch(() => ({}));
      setSaved(true);
      if (data.awarded > 0) setMsg(`+${data.awarded} نقطة`);
    } catch {
      setMsg("تعذّر الحفظ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        className={saved ? "btn btn-primary" : "btn btn-outline"}
        type="button"
        disabled={loading}
        onClick={() => void onSave()}
      >
        {saved ? <Check size={16} /> : <BookmarkPlus size={16} />}
        {saved ? "في المفضلة" : loading ? "جارٍ الحفظ…" : label}
      </button>
      {msg ? <span className="text-xs text-[var(--gold-dark)]">{msg}</span> : null}
    </div>
  );
}
