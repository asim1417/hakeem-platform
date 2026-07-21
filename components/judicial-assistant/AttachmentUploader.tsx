"use client";

// رفع مرفقٍ للقضية — **قراءةٌ تلقائيّة ذكيّة** بلا خياراتٍ يدويّة: استخراجٌ محليّ في المتصفّح
// (PDPL: الملفّ لا يغادر الجهاز، يُرسَل النصّ فقط)، ومتى كان الملفّ صورةً أو خرج النصّ مشوّهًا
// (طبقة نصٍّ معطوبة/ممسوح) يُحوَّل **تلقائيًّا** لقراءة Gemini البصريّة عالية الدقّة إن كانت مفعّلة.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractFile } from "@/lib/modules/doc-tool/extract";
import { isBrokenExtraction } from "@/lib/modules/document-inspection/reshape";
import { JaIcon } from "./icons";

/** نصٌّ طويلٌ ومشوّه (طبقة نصٍّ معطوبة/ممسوحة/خطّ مُرمَّز) — لا يصلح مادّةً للقضية. */
function garbled(text: string): boolean {
  return isBrokenExtraction(text);
}

export function AttachmentUploader({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cloudAvailable, setCloudAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/doc-tool/ocr/available")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setCloudAvailable(Boolean(d?.configured)); })
      .catch(() => { if (active) setCloudAvailable(false); });
    return () => { active = false; };
  }, []);

  async function onFile(file: File) {
    setBusy(true); setError(""); setStatus("جارٍ قراءة الوثيقة…");
    try {
      const isImage = /\.(png|jpe?g|webp|bmp|tiff?|gif)$/i.test(file.name);
      // صورةٌ + سحابيّةٌ مفعّلة → قراءةٌ بصريّة مباشرةً (أدقّ للعربيّة من OCR المحليّ).
      const primaryCloud = cloudAvailable && isImage;
      let { text, kind } = await extractFile(file, {
        onProgress: (m) => setStatus(m), cloudOcr: primaryCloud, cloudModel: "pro",
      });

      // نصٌّ مشوّه من طبقةٍ معطوبة/ممسوح → تحويلٌ تلقائيّ لقراءة Gemini البصريّة عالية الدقّة.
      if (garbled(text) && cloudAvailable && !primaryCloud) {
        setStatus("النصّ مشوّه — أُحوّل تلقائيًّا لقراءة Gemini البصريّة…");
        const cloud = await extractFile(file, { onProgress: (m) => setStatus(m), cloudOcr: true, cloudModel: "pro" });
        if (cloud.text && cloud.text.trim().length >= 2) { text = cloud.text; kind = cloud.kind; }
      }

      if (!text || text.trim().length < 2) throw new Error(`تعذّرت قراءة نصٍّ من الملفّ (${kind}).`);
      if (garbled(text)) {
        throw new Error(cloudAvailable
          ? "النصّ المقروء مشوّه (الوثيقة ممسوحة أو خطّها غير قابل للنسخ). حاول بنسخةٍ أوضح."
          : "النصّ المقروء مشوّه (الوثيقة ممسوحة). فعّل القراءة السحابيّة (Gemini) من إعدادات منصّة الوثائق، أو أرفق نسخةً نصّيّةً أوضح.");
      }

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
          ref={inputRef} type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg" className="sr-only"
          id={`ja-file-${caseId}`} disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />
        <label htmlFor={`ja-file-${caseId}`} className={`btn btn-gold ja-uploader__btn ${busy ? "is-busy" : ""}`}>
          <JaIcon name="documents" size={16} /> {busy ? "جارٍ…" : "إضافة مرفق"}
        </label>
        {status ? <span className="ja-uploader__status">{status}</span> : null}
        {error ? <span className="ja-uploader__err">{error}</span> : null}
      </div>
      <span className="ja-uploader__hint">
        قراءةٌ تلقائيّة بمحرّك «منصّة الوثائق» — محليًّا في متصفّحك{cloudAvailable ? "، وتحويلٌ تلقائيّ لقراءة Gemini البصريّة للممسوح والخطّ اليدويّ" : ""}؛ يُرسَل النصّ فقط.
      </span>
    </div>
  );
}
