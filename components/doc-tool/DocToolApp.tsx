"use client";

// أداة معالجة الوثائق العربية — نسخة serverless تعمل على نشر حكيم مباشرة:
// الاستخراج والتطبيع والبحث كلها في المتصفح؛ الحفظ في قاعدة المنصة عبر /api/doc-tool
// (مساحة عمل بكوكي — نمط منصة الوثائق نفسه). النسخة الخادمية (OCR) تحل محل هذه
// الصفحة تلقائياً عند ضبط DOC_TOOL_URL (بروكسي next.config.mjs).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cleanText,
  findRanges,
  norm,
  normMap,
  queryTokens,
  type HighlightRange
} from "@/lib/modules/doc-tool/normalize";
import { extractFile } from "@/lib/modules/doc-tool/extract";
import {
  AlertIcon,
  CheckSealIcon,
  DocScaleIcon,
  PaperclipIcon
} from "@/components/ui/HakeemIcons";
import styles from "./doc-tool.module.css";

interface ToolDoc {
  title: string;
  kind: string;
  rawText: string;
  /* الترويسات/التذييلات المتكررة المفصولة كبيانات وصفية (وفق دليل المعالجة) */
  running?: string;
}

/* مؤشر مراحل المعالجة: رفع ← استخراج ← تعرّف ← جاهز */
const STAGES = ["رفع", "استخراج", "تعرّف", "جاهز"] as const;

const AR = "ar-EG";

function highlightNodes(text: string, ranges: HighlightRange[]): React.ReactNode[] {
  if (!ranges.length) return [text];
  const out: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([a, b], i) => {
    if (a < pos) return;
    if (a > pos) out.push(text.slice(pos, a));
    out.push(<mark key={i}>{text.slice(a, b)}</mark>);
    pos = b;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

function snippetNodes(doc: ToolDoc, tokens: string[]): React.ReactNode[] | null {
  const nm = normMap(doc.rawText);
  const ranges = findRanges(nm, tokens);
  if (!ranges.length) return null;
  const a = Math.max(0, ranges[0][0] - 45);
  const b = Math.min(doc.rawText.length, ranges[0][1] + 90);
  const frag = doc.rawText.slice(a, b).replace(/\s+/g, " ");
  const local = findRanges(normMap(frag), tokens);
  return [
    a > 0 ? "…" : "",
    ...highlightNodes(frag, local),
    b < doc.rawText.length ? "…" : ""
  ];
}

export function DocToolApp() {
  const [docs, setDocs] = useState<ToolDoc[]>([]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [cloudOcr, setCloudOcr] = useState(false);
  const [cloudHiQ, setCloudHiQ] = useState(false); // نموذج pro للخطّ اليدوي والوثائق الصعبة
  const [keyPanel, setKeyPanel] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMsg, setKeyMsg] = useState("");
  const [keySource, setKeySource] = useState<"db" | "env" | "none">("none");
  const [stage, setStage] = useState(0); // 0 خامل · 1 رفع · 2 استخراج · 3 تعرّف · 4 جاهز
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [retryBusy, setRetryBusy] = useState(false);
  const retryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // الخيار السحابي يظهر فقط إن كانت الخدمة السحابية مفعّلة على الخادم.
  // التفضيل يُحفظ في كوكي (قيمة 0/1 فقط — لا بيانات شخصية).
  useEffect(() => {
    fetch("/api/doc-tool/ocr")
      .then((r) => r.json())
      .then((d: { configured?: boolean; source?: "db" | "env" | "none" }) => {
        setCloudAvailable(Boolean(d.configured));
        setKeySource(d.source ?? (d.configured ? "env" : "none"));
        if (d.configured) setCloudOcr(/(?:^|; )docToolCloudOcr=1/.test(document.cookie));
      })
      .catch(() => setCloudAvailable(false));
  }, []);

  const toggleCloud = useCallback((on: boolean) => {
    setCloudOcr(on);
    document.cookie = `docToolCloudOcr=${on ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  // إعداد مفتاح Gemini من داخل منصة الوثائق (مدير فقط — الخادم يتحقق)
  const saveOcrKey = useCallback(async () => {
    const key = keyInput.trim();
    if (key.length < 20) { setKeyMsg("ألصق مفتاح Gemini كاملاً."); return; }
    setKeyBusy(true);
    setKeyMsg("جارٍ اختبار المفتاح…");
    try {
      const res = await fetch("/api/doc-tool/ocr/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, test: true })
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; configured?: boolean; source?: "db" | "env" | "none" };
      if (res.status === 401 || res.status === 403) {
        setKeyMsg(data.message ?? "هذه الخطوة لمدير المنصة — سجّل الدخول بحساب مدير.");
      } else if (!res.ok || !data.ok) {
        setKeyMsg(data.message ?? "تعذّر الحفظ.");
      } else {
        setKeyMsg(data.message ?? "حُفظ المفتاح — الخدمة السحابية مفعّلة.");
        setKeyInput("");
        setCloudAvailable(true);
        setKeySource(data.source ?? "db");
      }
    } catch {
      setKeyMsg("تعذّر الاتصال بالخادم.");
    } finally {
      setKeyBusy(false);
    }
  }, [keyInput]);

  const removeOcrKey = useCallback(async () => {
    setKeyBusy(true);
    try {
      const res = await fetch("/api/doc-tool/ocr/settings", { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; message?: string; configured?: boolean; source?: "db" | "env" | "none" };
      if (res.status === 401 || res.status === 403) {
        setKeyMsg(data.message ?? "هذه الخطوة لمدير المنصة.");
      } else {
        setKeyMsg(data.message ?? "أُزيل المفتاح.");
        setCloudAvailable(Boolean(data.configured));
        setKeySource(data.source ?? "none");
        if (!data.configured) { setCloudOcr(false); }
      }
    } catch {
      setKeyMsg("تعذّر الاتصال بالخادم.");
    } finally {
      setKeyBusy(false);
    }
  }, []);

  // تحميل المحفوظ من الخادم عند الفتح
  useEffect(() => {
    fetch("/api/doc-tool")
      .then((r) => r.json())
      .then((data: { docs?: ToolDoc[]; error?: string }) => {
        if (data.error) setError(data.error);
        else if (Array.isArray(data.docs)) setDocs(data.docs);
      })
      .catch(() => setError("تعذّر الاتصال بالخادم — الوثائق الجديدة ستبقى في هذه الجلسة فقط"))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const persist = useCallback((next: ToolDoc[]) => {
    fetch("/api/doc-tool", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docs: next })
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean; error?: string }) => {
        if (data.error) setError(data.error);
        else setError("");
      })
      .catch(() => setError("تعذّر الحفظ في الخادم — النسخة الحالية في متصفحك فقط"));
  }, []);

  const tokens = useMemo(() => queryTokens(debounced), [debounced]);

  const visible = useMemo(() => {
    const indexed = docs.map((d, i) => ({ d, i }));
    if (!tokens.length) return indexed;
    return indexed.filter(({ d }) => {
      const n = norm(d.rawText);
      return tokens.every((t) => n.includes(t));
    });
  }, [docs, tokens]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setStatus("جارٍ المعالجة…");
      setStage(1);
      const added: ToolDoc[] = [];
      for (const f of list) {
        setStage(2);
        const r = await extractFile(f, {
          onProgress: (label) => {
            setStage(/OCR|ضوئية|تعرّف|Gemini/.test(label) ? 3 : 2);
            setStatus(`${f.name}: ${label}`);
          },
          cloudOcr,
          cloudModel: cloudHiQ ? "pro" : "flash",
          cloudRange: {
            from: rangeFrom ? Number(rangeFrom) : undefined,
            to: rangeTo ? Number(rangeTo) : undefined
          }
        });
        added.push({ title: f.name, kind: r.kind, rawText: cleanText(r.text), running: r.running });
        if (r.warning) setError(`${f.name}: ${r.warning}`);
      }
      setStage(4);
      setTimeout(() => setStage(0), 3000);
      const ok = added.filter((d) => d.rawText.trim()).length;
      setDocs((prev) => {
        const next = [...added, ...prev];
        persist(next);
        return next;
      });
      setStatus(
        `أُضيف ${list.length.toLocaleString(AR)} (نجح استخراج ${ok.toLocaleString(AR)})`
      );
    },
    [persist, cloudOcr, rangeFrom, rangeTo]
  );

  const removeDoc = useCallback(
    (index: number) => {
      setDocs((prev) => {
        const next = prev.filter((_, i) => i !== index);
        persist(next);
        return next;
      });
      setSelected(null);
    },
    [persist]
  );

  const clearAll = useCallback(() => {
    if (!window.confirm("مسح كل الوثائق المحفوظة؟")) return;
    setDocs([]);
    setSelected(null);
    fetch("/api/doc-tool", { method: "DELETE" }).catch(() => undefined);
  }, []);

  const retryFailedPages = useCallback(
    async (file: File) => {
      if (selected === null) return;
      const doc = docs[selected];
      if (!doc) return;
      setRetryBusy(true);
      try {
        const { cloudOcrPdfPages, extractFailedPages, mergeRetriedPages } = await import(
          "@/lib/modules/doc-tool/cloud-ocr"
        );
        const failed = extractFailedPages(doc.rawText);
        if (!failed.length) { setStatus("لا صفحات متعذرة في هذه الوثيقة."); return; }
        const result = await cloudOcrPdfPages(
          await file.arrayBuffer(),
          (label) => setStatus(label),
          { onlyPages: failed, model: cloudHiQ ? "pro" : "flash" }
        );
        if (!result) { setError("تعذّرت إعادة القراءة — تحقق من المفتاح أو أعد المحاولة لاحقاً"); return; }
        const mergedText = cleanText(mergeRetriedPages(doc.rawText, result.text));
        const stillFailed = result.failed.length;
        setDocs((prev) => {
          const next = prev.map((d, i) => (i === selected ? { ...d, rawText: mergedText } : d));
          persist(next);
          return next;
        });
        setStatus(
          stillFailed
            ? `أُعيدت قراءة ${failed.length - stillFailed} صفحة — بقيت ${stillFailed} متعذرة`
            : `✓ اكتملت إعادة قراءة ${failed.length} صفحة`
        );
      } finally {
        setRetryBusy(false);
      }
    },
    [selected, docs, persist, cloudHiQ]
  );

  const current = selected !== null ? docs[selected] : undefined;
  const currentRanges = useMemo(() => {
    if (!current || !tokens.length) return [] as HighlightRange[];
    return findRanges(normMap(current.rawText), tokens);
  }, [current, tokens]);

  const counter = tokens.length
    ? `${visible.length.toLocaleString(AR)} نتيجة من ${docs.length.toLocaleString(AR)} وثيقة`
    : `${docs.length.toLocaleString(AR)} وثيقة`;

  return (
    <div className={styles.root} dir="rtl">
      <header className={styles.header}>
        <div className={styles.brand}>
          <b>
            <DocScaleIcon size={17} /> <a className={styles.brandHome} href="/documents">منصة الوثائق</a> · البحث السريع
          </b>
          <nav className={styles.tabs} aria-label="أقسام منصة الوثائق">
            <a className={styles.tab} href="/documents">البوابة</a>
            <span className={styles.tabOn} aria-current="page">البحث السريع</span>
            <a className={styles.tab} href="/documents/app">محطة العمل (فحص متقدم)</a>
          </nav>
        </div>
        <input
          className={styles.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في وثائقك — يتجاهل التشكيل وفروق الهمزات…"
          aria-label="بحث في الوثائق"
        />
        <label className={styles.btn}>
          إرفاق ملفات
          <input
            ref={fileRef}
            className={styles.hiddenInput}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff"
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className={styles.btnAlt} onClick={clearAll}>
          مسح الكل
        </button>
        {cloudAvailable && cloudOcr ? (
          <span className={styles.range} title="نطاق صفحات القراءة السحابية للـ PDF — اتركه فارغاً للكل">
            <input
              className={styles.rangeIn}
              type="number"
              min={1}
              placeholder="من"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              aria-label="من صفحة"
            />
            <span>–</span>
            <input
              className={styles.rangeIn}
              type="number"
              min={1}
              placeholder="إلى"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              aria-label="إلى صفحة"
            />
          </span>
        ) : null}
        {cloudAvailable ? (
          <label
            className={styles.cloudToggle}
            title="يرسل الصور وPDF لخدمة Gemini لقراءة أدق (خصوصاً الخط اليدوي والمسح الرديء). بدونه تبقى المعالجة كلها داخل متصفحك."
          >
            <input
              type="checkbox"
              checked={cloudOcr}
              onChange={(e) => toggleCloud(e.target.checked)}
            />
            OCR سحابي فائق الدقة
          </label>
        ) : null}
        {cloudAvailable && cloudOcr ? (
          <label
            className={styles.cloudToggle}
            title="gemini-2.5-pro للخطّ اليدوي والأختام والوثائق الصعبة (أدقّ، أبطأ وأعلى تكلفة). بدونه flash الأسرع الاقتصادي — يكفي غالب الوثائق المطبوعة."
          >
            <input
              type="checkbox"
              checked={cloudHiQ}
              onChange={(e) => setCloudHiQ(e.target.checked)}
            />
            دقّة أعلى — نموذج pro
          </label>
        ) : null}
        <button
          type="button"
          className={styles.keyBtn}
          onClick={() => { setKeyPanel((v) => !v); setKeyMsg(""); }}
          title={cloudAvailable ? "إدارة مفتاح Gemini للقراءة السحابية" : "فعّل القراءة السحابية بإضافة مفتاح Gemini"}
        >
          {cloudAvailable ? "⚙ مفتاح Gemini" : "تفعيل OCR السحابي"}
        </button>
        {stage > 0 ? (
          <span className={styles.stages} aria-label="مراحل المعالجة">
            {STAGES.map((label, i) => (
              <span
                key={label}
                className={i + 1 === stage ? styles.stageOn : i + 1 < stage ? styles.stageDone : styles.stage}
              >
                {label}
              </span>
            ))}
          </span>
        ) : null}
        <span className={styles.cnt} role="status">
          {status || counter}
        </span>
      </header>

      {keyPanel ? (
        <div className={styles.keyPanel} dir="rtl">
          <div className={styles.keyPanelHead}>
            <strong>القراءة السحابية (Gemini OCR)</strong>
            <span className={styles.keyStatus}>
              {cloudAvailable
                ? keySource === "db"
                  ? "مفعّلة — المفتاح محفوظ مشفّراً في المنصة"
                  : "مفعّلة — المفتاح من بيئة الخادم"
                : "غير مفعّلة"}
            </span>
          </div>
          <p className={styles.keyHint}>
            ألصق مفتاح Google AI Studio (يبدأ بـ AIza). يُحفظ مشفّراً في خادم المنصة ولا يصل المتصفح أبداً —
            هذه الخطوة لمدير المنصة فقط.
          </p>
          <div className={styles.keyRow}>
            <input
              type="password"
              className={styles.keyInput}
              placeholder="AIza…"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
            />
            <button type="button" className={styles.keySave} onClick={saveOcrKey} disabled={keyBusy}>
              {keyBusy ? "جارٍ…" : "اختبار وحفظ"}
            </button>
            {keySource === "db" ? (
              <button type="button" className={styles.keyRemove} onClick={removeOcrKey} disabled={keyBusy}>
                إزالة المفتاح
              </button>
            ) : null}
          </div>
          {keyMsg ? <p className={styles.keyMsg} role="status">{keyMsg}</p> : null}
        </div>
      ) : null}
      <div className={styles.wrap}>
        <main className={styles.main}>
          {current ? (
            <div className={styles.docView}>
              <h2 className={styles.docTitle}>
                {current.title} <span className={styles.kind}>{current.kind}</span>{" "}
                {!current.kind.includes("Gemini") && current.rawText ? (
                  <span className={styles.sealBadge}>
                    <CheckSealIcon size={13} /> معالجة محلية
                  </span>
                ) : null}
              </h2>
              <div className={styles.docBar}>
                <button
                  type="button"
                  className={styles.btnAlt}
                  onClick={() => {
                    navigator.clipboard.writeText(current.rawText).then(
                      () => setStatus("نُسخ ✓"),
                      () => setStatus("تعذّر النسخ")
                    );
                  }}
                >
                  نسخ النص
                </button>
                <button
                  type="button"
                  className={styles.btnAlt}
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(
                      new Blob([current.rawText], { type: "text/plain;charset=utf-8" })
                    );
                    a.download = current.title.replace(/\.[^.]+$/, "") + ".txt";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
                  }}
                >
                  تنزيل .txt
                </button>
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={() => {
                    if (selected !== null && window.confirm(`حذف «${current.title}» نهائياً؟`)) {
                      removeDoc(selected);
                    }
                  }}
                >
                  حذف الوثيقة
                </button>
                <span className={styles.chars}>
                  {current.rawText.length.toLocaleString(AR)} حرف
                </span>
                {cloudAvailable && current.rawText.includes("(تعذّرت قراءة هذه الصفحة سحابياً)") ? (
                  <>
                    <button
                      type="button"
                      className={styles.btnAlt}
                      disabled={retryBusy}
                      onClick={() => retryRef.current?.click()}
                      title="اختر نفس ملف الـ PDF — تُعاد قراءة الصفحات المتعذرة فقط وتُدمج في مكانها"
                    >
                      {retryBusy ? "يعيد القراءة…" : "أعد قراءة المتعذر"}
                    </button>
                    <input
                      ref={retryRef}
                      className={styles.hiddenInput}
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void retryFailedPages(f);
                        e.target.value = "";
                      }}
                    />
                  </>
                ) : null}
                <button type="button" className={styles.btnAlt} onClick={() => setSelected(null)}>
                  ← رجوع
                </button>
              </div>
              {current.kind.includes("Gemini") ? (
                <div className={styles.aiWarn}>
                  <AlertIcon size={18} />
                  <span>قراءة ذكاء اصطناعي (Gemini) — راجع المبالغ والأرقام والتواريخ بشرياً قبل الاعتماد.</span>
                </div>
              ) : null}
              {current.running ? (
                <details className={styles.running}>
                  <summary>ترويسة/تذييل متكرران فُصلا كبيانات وصفية — اعرضهما</summary>
                  <pre>{current.running}</pre>
                </details>
              ) : null}
              <hr className={styles.rule} />
              <div className={styles.txt}>
                {current.rawText
                  ? highlightNodes(current.rawText, currentRanges)
                  : `(لا نص مستخرَج — ${current.kind})`}
              </div>
            </div>
          ) : (
            <>
              <div
                className={dragging ? styles.dropHl : styles.drop}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void upload(e.dataTransfer.files);
                }}
              >
                <PaperclipIcon size={22} /> اسحب ملفاتك هنا أو اضغط «إرفاق ملفات»
                <br />
                <small>
                  كل الصيغ: نص (txt / md / csv / json) و‏Word (docx) و‏PDF (نصّي أو ممسوح) والصور —
                  الممسوح يُقرأ بـ OCR عربي داخل متصفحك، ولا يغادر الملف جهازك؛ النص المستخرَج
                  يُحفَظ في حسابك (كوكي المتصفح).
                </small>
              </div>
              <div className={styles.note}>
                <b>تريد فحصاً أعمق؟</b> انتقل إلى <a href="/documents/app">محطة العمل</a> —
                تصنيف وكيانات مظلَّلة وجداول مشتقة ومقتطفات وتصدير، بنفس المحرّكات ونفس الخصوصية.
              </div>
              {cloudOcr ? (
                <div className={styles.aiWarn}>
                  <AlertIcon size={18} />
                  <span>
                    القراءة السحابية مخرَج ذكاء اصطناعي: قد «يصحّح» الأرقامَ والمبالغ إلى قيم
                    متوقعة — راجعها بشرياً قبل الاعتماد في أي وثيقة قانونية أو صك.
                  </span>
                </div>
              ) : null}
              {error ? <div className={styles.empty}>⚠ {error}</div> : null}
              <div className={styles.hint}>
                {loaded ? "اختر وثيقة من القائمة أو ارفع ملفات ثم ابحث." : "جارٍ التحميل…"}
              </div>
            </>
          )}
        </main>

        <aside className={styles.side} aria-label="قائمة الوثائق">
          {visible.length ? (
            visible.map(({ d, i }) => {
              const snip = tokens.length ? snippetNodes(d, tokens) : null;
              return (
                <button
                  type="button"
                  key={`${i}-${d.title}`}
                  className={i === selected ? `${styles.item} ${styles.itemSel}` : styles.item}
                  onClick={() => setSelected(i)}
                >
                  <span className={styles.itemTitle}>
                    {d.title} <span className={styles.kind}>{d.kind}</span>
                  </span>
                  {snip ? (
                    <span className={styles.itemSnip}>{snip}</span>
                  ) : (
                    <span className={styles.chars}>
                      {d.rawText.length.toLocaleString(AR)} حرف
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className={styles.empty}>
              {tokens.length ? "لا نتائج مطابقة." : "لا وثائق بعد — ارفع ملفاتك."}
            </div>
          )}
        </aside>
      </div>

      <footer className={styles.footer}>
        الاستخراج والتطبيع في متصفحك؛ النص المستخرَج يُحفَظ في قاعدة حكيم مربوطاً بمتصفحك (بلا
        حساب). التطبيع: إسقاط التشكيل والتطويل، توحيد الهمزات والتاء المربوطة والحروف الفارسية
        الشبيهة، وتحويل الأرقام الفارسية.
      </footer>
    </div>
  );
}
