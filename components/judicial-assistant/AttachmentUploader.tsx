"use client";

// رفع مرفقٍ للقضية — الاستخراج **محليّ في المتصفّح** (extractFile)؛ الملفّ لا يغادر الجهاز،
// يُرسَل النصّ المُستخرَج فقط (PDPL). المدخل الأساسيّ للقضية بدل موصل «تقاضي».
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractFile } from "@/lib/modules/doc-tool/extract";
import { JaIcon } from "./icons";

export function AttachmentUploader({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File) {
    setBusy(true); setError(""); setStatus("جارٍ استخراج النصّ محليًّا…");
    try {
      const { text, kind } = await extractFile(file, (m) => setStatus(m));
      if (!text || text.trim().length < 2) throw new Error(`تعذّر استخراج نصٍّ من الملفّ (${kind}).`);
      setStatus("جارٍ الحفظ…");
      const res = await fetch(`/api/judicial-assistant/cases/${caseId}/attachments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر حفظ المرفق.");
      setStatus("أُضيف المرفق.");
      router.refresh();
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      const network = /load failed|failed to fetch|networkerror/i.test(m);
      setError(network ? "تعذّر رفع المرفق — تحقّق من الاتصال وأعد المحاولة." : m || "تعذّر إضافة المرفق.");
      setStatus("");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="ja-uploader">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
        className="sr-only"
        id={`ja-file-${caseId}`}
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
      />
      <label htmlFor={`ja-file-${caseId}`} className={`btn btn-outline ja-uploader__btn ${busy ? "is-busy" : ""}`}>
        <JaIcon name="documents" size={16} /> {busy ? "جارٍ…" : "إضافة مرفق"}
      </label>
      {status ? <span className="ja-uploader__status">{status}</span> : null}
      {error ? <span className="ja-uploader__err">{error}</span> : null}
      <span className="ja-uploader__hint">الاستخراج بمحرّك «منصّة الوثائق» — محليّ في متصفّحك؛ يُرسَل النصّ فقط.</span>
    </div>
  );
}
