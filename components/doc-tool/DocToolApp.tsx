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
import styles from "./doc-tool.module.css";

interface ToolDoc {
  title: string;
  kind: string;
  rawText: string;
}

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
  const fileRef = useRef<HTMLInputElement>(null);

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
      const added: ToolDoc[] = [];
      for (const f of list) {
        const r = await extractFile(f, (label) => setStatus(`${f.name}: ${label}`));
        added.push({ title: f.name, kind: r.kind, rawText: cleanText(r.text) });
        if (r.warning) setError(`⚠ ${f.name}: ${r.warning}`);
      }
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
    [persist]
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
          <b>أداة معالجة الوثائق العربية</b>
          <small>
            حكيم — استخراج وتطبيع وبحث · <a className={styles.brandLink} href="/documents/app">منصة الوثائق ↗</a>
          </small>
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
        <span className={styles.cnt} role="status">
          {status || counter}
        </span>
      </header>

      <div className={styles.wrap}>
        <main className={styles.main}>
          {current ? (
            <div>
              <h2 className={styles.docTitle}>
                {current.title} <span className={styles.kind}>{current.kind}</span>
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
                <button type="button" className={styles.btnAlt} onClick={() => setSelected(null)}>
                  ← رجوع
                </button>
              </div>
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
                📎 اسحب ملفاتك هنا أو اضغط «إرفاق ملفات»
                <br />
                <small>
                  كل الصيغ: نص (txt / md / csv / json) و‏Word (docx) و‏PDF (نصّي أو ممسوح) والصور —
                  الممسوح يُقرأ بـ OCR عربي داخل متصفحك، ولا يغادر الملف جهازك؛ النص المستخرَج
                  يُحفَظ في حسابك (كوكي المتصفح).
                </small>
              </div>
              <div className={styles.note}>
                <b>تريد فحصاً أعمق؟</b> لمنصة الفحص المتقدمة (تصنيف، كيانات مظلَّلة، جداول مشتقة،
                مقتطفات وتصدير): <a href="/documents/app">منصة الوثائق</a> — نفس المحرّكات، نفس
                الخصوصية.
              </div>
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
