"use client";

// رفع مرفقٍ للقضية — بقوّة «منصّة الوثائق» نفسها داخل المعاون (لا انتقال):
// استخراجٌ محليّ في المتصفّح (PDPL: الملفّ لا يغادر الجهاز، يُرسَل النصّ فقط)، مع خيار
// **قراءةٍ سحابيّةٍ عالية الدقّة عبر Gemini** للوثائق الممسوحة والخطّ اليدويّ (كمنصّة الوثائق).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractFile } from "@/lib/modules/doc-tool/extract";
import { JaIcon } from "./icons";

export function AttachmentUploader({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // قوّة منصّة الوثائق: القراءة السحابيّة (Gemini) — تُعرض إن كانت مفعّلة في المنصّة.
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [cloudOcr, setCloudOcr] = useState(false);
  const [cloudHiQ, setCloudHiQ] = useState(false); // نموذج Pro للخطّ اليدويّ والوثائق الصعبة
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/doc-tool/ocr/available")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setCloudAvailable(Boolean(d?.configured)); })
      .catch(() => { if (active) setCloudAvailable(false); });
    return () => { active = false; };
  }, []);

  async function onFile(file: File) {
    setBusy(true); setError(""); setStatus("جارٍ استخراج النصّ…");
    try {
      const { text, kind } = await extractFile(file, {
        onProgress: (m) => setStatus(m),
        cloudOcr: cloudAvailable && cloudOcr,
        cloudModel: cloudHiQ ? "pro" : "flash",
        cloudRange: { from: Number(rangeFrom) || undefined, to: Number(rangeTo) || undefined },
      });
      if (!text || text.trim().length < 2) throw new Error(`تعذّر استخراج نصٍّ من الملفّ (${kind}).`);
      setStatus("جارٍ الحفظ…");
      const res = await fetch(`/api/judicial-assistant/cases/${caseId}/attachments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر حفظ المرفق.");
      setStatus(`أُضيف المرفق — ${kind}.`);
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
      <div className="ja-uploader__row">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
          className="sr-only"
          id={`ja-file-${caseId}`}
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />
        <label htmlFor={`ja-file-${caseId}`} className={`btn btn-gold ja-uploader__btn ${busy ? "is-busy" : ""}`}>
          <JaIcon name="documents" size={16} /> {busy ? "جارٍ…" : "إضافة مرفق"}
        </label>
        {status ? <span className="ja-uploader__status">{status}</span> : null}
        {error ? <span className="ja-uploader__err">{error}</span> : null}
      </div>

      {/* قوّة القراءة — كمنصّة الوثائق، داخل المعاون */}
      <div className="ja-readopts">
        {cloudAvailable ? (
          <>
            <label className="ja-readopt">
              <input type="checkbox" checked={cloudOcr} disabled={busy} onChange={(e) => setCloudOcr(e.target.checked)} />
              <span><JaIcon name="evidence" size={13} /> قراءة سحابيّة عالية الدقّة (Gemini)</span>
            </label>
            {cloudOcr ? (
              <>
                <label className="ja-readopt">
                  <input type="checkbox" checked={cloudHiQ} disabled={busy} onChange={(e) => setCloudHiQ(e.target.checked)} />
                  <span>دقّة قصوى للخطّ اليدويّ والوثائق الصعبة (Pro)</span>
                </label>
                <span className="ja-readopt ja-readopt--range">
                  صفحات PDF:
                  <input type="number" min={1} inputMode="numeric" placeholder="من" value={rangeFrom} disabled={busy} onChange={(e) => setRangeFrom(e.target.value)} />
                  <input type="number" min={1} inputMode="numeric" placeholder="إلى" value={rangeTo} disabled={busy} onChange={(e) => setRangeTo(e.target.value)} />
                </span>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <span className="ja-uploader__hint">
        بمحرّك «منصّة الوثائق» نفسه — محليٌّ في متصفّحك (يُرسَل النصّ فقط){cloudAvailable ? "، أو قراءةٌ سحابيّةٌ فائقة الدقّة للممسوح والخطّ اليدويّ" : ""}.
      </span>
    </div>
  );
}
