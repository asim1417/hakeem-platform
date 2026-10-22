"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Lock, LockOpen, ShieldCheck, ShieldAlert } from "lucide-react";
import { postEditorial } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";
import { deskSwitchConfirmCopy } from "./logic";
import { Badge, btnClass, Message, MFA_SETUP_HREF } from "./ui";

const MIN_REASON = 5;

export interface DeskSwitchProps {
  version: number;
  writeEnabled: boolean;
  requireMfa: boolean;
  /** kill = مفتاح الطوارئ في إعدادات النشر؛ force_on = مفتوح من إعدادات النشر؛ panel = يتبع هذا المفتاح. */
  env: "kill" | "force_on" | "panel";
  /** سبب القفل من البيئة حين env = kill: مفتاح الطوارئ أو نسخة معاينة. */
  lock?: "env_zero" | "preview" | null;
  ownerMfa: { enabled: boolean; linked: boolean; error?: boolean };
  /** رابط إعداد التحقق الثنائي ظاهر (AUTH_MFA_ENABLED). */
  mfaSetupAvailable?: boolean;
}

/**
 * مفتاح الكتابة في المكتب وشرط التحقق الثنائي (قرار المالك 17/10/2026 22:13): بضغطة وبسبب مكتوب، بلا إعادة نشر.
 * كل تغيير نسخة إعدادات جديدة ويُسجَّل في سجل التدقيق.
 */
export function DeskSwitch({ version, writeEnabled, requireMfa, env, lock = null, ownerMfa, mfaSetupAvailable = true }: DeskSwitchProps) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { writeEnabled: boolean; requireMfa: boolean }>(null);

  const killed = env === "kill";
  const effective = killed ? false : env === "force_on" ? true : writeEnabled;
  const mfaBlocks = requireMfa && !ownerMfa.enabled;
  const reasonOk = reason.trim().length >= MIN_REASON;
  const copy = confirm ? deskSwitchConfirmCopy({ next: confirm, writeEnabled, env, lock }) : null;

  async function send(next: { writeEnabled: boolean; requireMfa: boolean }) {
    setBusy(true);
    setError(null);
    const res = await postEditorial("/api/admin/legal/settings/switch", { baseVersion: version, reason: reason.trim(), ...next });
    if (res.ok) {
      // نسخة جديدة للإعدادات: إعادة تحميل كاملة لتأخذ صفحة الإعدادات والتكليفات رقم النسخة الجديد.
      window.location.reload();
      return;
    }
    setBusy(false);
    setConfirm(null);
    setError(res.message ?? "تعذّر تغيير المفتاح، ولم يُسجَّل شيء.");
  }

  return (
    <section id="desk-switch" className="dk-card mt-4 grid gap-4" aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-h`} className="dk-card__op text-[var(--desk-text-heading)]">
          الكتابة في المكتب
        </h2>
        {effective ? (
          <Badge tone="success" icon={LockOpen}>
            مفتوحة
          </Badge>
        ) : (
          <Badge tone="neutral" icon={Lock}>
            مقفلة
          </Badge>
        )}
      </div>

      {killed && lock === "preview" ? (
        <Message tone="lock" title="نسخة معاينة.">
          نسخ المعاينة تشارك قاعدة الإنتاج، فالكتابة فيها مقفلة ولا يُشغَّل المفتاح منها. شغّله من الموقع الأساسي.
          {writeEnabled ? " الإيقاف وحده مسموح من هنا، ويُقفل الموقع الأساسي أيضًا." : ""}
        </Message>
      ) : killed ? (
        <Message tone="lock" title="مقفلة بمفتاح الطوارئ.">
          إعدادات النشر تضبط EDITORIAL_DESK_WRITE=0، فلا تُشغَّل الكتابة من هنا حتى يُزال.
          {writeEnabled ? " مفتاح اللوحة ما زال مفتوحًا، فزر اعتماد المبادئ القديم موقوف أيضًا؛ أوقف المفتاح من هنا ليعود إلى عمله." : ""}
        </Message>
      ) : env === "force_on" ? (
        <Message tone="info" title="مفتوحة من إعدادات النشر.">
          EDITORIAL_DESK_WRITE=1 يفتح الكتابة مهما كان هذا المفتاح. شرط التحقق الثنائي أدناه يسري مع ذلك.
        </Message>
      ) : null}

      <div className="grid gap-2">
        <p className="m-0 flex items-center gap-2">
          {ownerMfa.enabled ? <ShieldCheck size={18} aria-hidden /> : <ShieldAlert size={18} aria-hidden />}
          <span>
            التحقق الثنائي لحسابك: <strong>{ownerMfa.error ? "تعذّر التحقق الآن" : ownerMfa.enabled ? "مفعّل" : "غير مفعّل"}</strong>
            {ownerMfa.error ? " (أعد تحميل الصفحة بعد قليل)" : !ownerMfa.linked ? " (حسابك غير مرتبط بخدمة الدخول التي تدير التحقق الثنائي)" : ""}
          </span>
        </p>
        {!ownerMfa.enabled && !ownerMfa.error ? (
          mfaSetupAvailable ? (
            <p className="m-0">
              <a href={MFA_SETUP_HREF} className={btnClass("correct")}>
                فعّل التحقق الثنائي لحسابك
              </a>
            </p>
          ) : (
            <p className="m-0">
              إعداد التحقق الثنائي غير ظاهر بعد: شغّل «إظهار إعداد التحقق الثنائي» من <Link href="/admin/settings">إعدادات النظام</Link>، ثم ارجع إلى هنا.
            </p>
          )
        ) : null}
        <p className="m-0 text-[var(--desk-text-secondary)]">
          شرط التحقق الثنائي للكتابة: <strong>{requireMfa ? "مشروط" : "غير مشروط"}</strong>. حين يُشترط، لا يكتب في المكتب إلا حساب بشري سجّل التحقق الثنائي في خدمة الدخول، والوكيل يقترح فقط. الشرط على الحساب لا على الجلسة: الدخول بـ Google وغيره لا يطلب الرمز الثاني.
        </p>
      </div>

      {/* تحت قفل البيئة يظهر الإيقاف وحده حين يكون مفتاح اللوحة مفتوحًا (خ٣)، ولا يُغيَّر الشرط (خ٢). */}
      {!killed || writeEnabled ? (
        <div className="grid gap-3">
          <label className="dk-field" htmlFor={`${id}-reason`}>
            <span className="dk-field__label">السبب (إلزامي، ويُحفظ في سجل التدقيق)</span>
            <textarea id={`${id}-reason`} rows={2} className="dk-input" value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
          </label>
          <div className="flex flex-wrap gap-2">
            {writeEnabled ? (
              <button type="button" className={btnClass("destructive", { lg: true })} disabled={busy || !reasonOk} onClick={() => setConfirm({ writeEnabled: false, requireMfa })}>
                إيقاف الكتابة
              </button>
            ) : (
              <button
                type="button"
                className={btnClass("approve", { lg: true })}
                disabled={busy || !reasonOk || mfaBlocks}
                onClick={() => setConfirm({ writeEnabled: true, requireMfa })}
              >
                تشغيل الكتابة
              </button>
            )}
            {!killed ? (
              <button type="button" className={btnClass("text")} disabled={busy || !reasonOk} onClick={() => setConfirm({ writeEnabled, requireMfa: !requireMfa })}>
                {requireMfa ? "إلغاء شرط التحقق الثنائي" : "اشتراط التحقق الثنائي"}
              </button>
            ) : null}
          </div>
          {!reasonOk ? <p className="m-0 text-[var(--desk-text-secondary)]">اكتب السبب ({MIN_REASON} أحرف على الأقل) لتفعيل الأزرار.</p> : null}
          {!writeEnabled && mfaBlocks ? (
            <p className="m-0 text-[var(--desk-text-secondary)]">التشغيل يتطلب تفعيل التحقق الثنائي لحسابك، أو إلغاء شرطه بسبب مكتوب.</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <Message tone="error" role="alert" title="لم يتغير المفتاح.">
          {error}
        </Message>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={copy?.title ?? ""}
        consequence={copy?.consequence ?? null}
        confirmLabel="تأكيد"
        busyLabel="جارٍ الحفظ…"
        confirmVariant={copy?.variant ?? "destructive"}
        busy={busy}
        onConfirm={() => (confirm ? void send(confirm) : undefined)}
        onClose={() => (busy ? undefined : setConfirm(null))}
      />
    </section>
  );
}
