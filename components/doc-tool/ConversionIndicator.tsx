"use client";

// مؤشر المعالجة العائم — يظهر على كل شاشات منصة الوثائق (البوابة/البحث السريع/محطة
// العمل) ما دامت مهمة قراءة سحابية جارية، فيبقى المستخدم على علم بالتقدّم حتى لو
// انتقل بين الشاشات. مرتبط بمدير المعالجة المستقل عن دورة حياة المكوّنات.

import { useEffect, useState } from "react";
import {
  subscribeConversion,
  cancelConversion,
  clearConversion,
  type ConversionState
} from "@/lib/modules/doc-tool/conversion-manager";
import styles from "./conversion-indicator.module.css";

export function ConversionIndicator() {
  const [st, setSt] = useState<ConversionState | null>(null);

  useEffect(() => subscribeConversion(setSt), []);

  if (!st || st.phase === "idle") return null;

  const pct = st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
  const running = st.phase === "running";
  const dur = st.startedAt ? Math.round((Date.now() - st.startedAt) / 1000) : 0;

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.head}>
        <span className={styles.dot} data-phase={st.phase} />
        <span className={styles.title}>{st.title || "قراءة سحابية"}</span>
        {running ? (
          <button className={styles.cancel} onClick={cancelConversion} title="إلغاء المعالجة">
            إلغاء
          </button>
        ) : (
          <button className={styles.cancel} onClick={clearConversion} title="إخفاء">
            ✕
          </button>
        )}
      </div>
      {running && st.total > 0 ? (
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className={styles.label}>
        {st.phase === "running" ? st.label || "جارٍ المعالجة…" : null}
        {st.phase === "done" ? `✓ ${st.label}` : null}
        {st.phase === "error" ? `⚠ ${st.error}` : null}
        {st.phase === "canceled" ? "أُلغيت" : null}
      </div>
      {running && st.total > 0 ? (
        <div className={styles.meta}>
          {st.done}/{st.total} صفحة · {dur}ث · يستمر أثناء تنقّلك بين الشاشات
        </div>
      ) : null}
    </div>
  );
}
