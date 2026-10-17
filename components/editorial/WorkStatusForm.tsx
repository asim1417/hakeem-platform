"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { callEditorial, postEditorial } from "./api";
import { btnClass, Message } from "./ui";

const STATUSES = ["ساري", "صادر لم يسرِ بعد", "ملغى", "مستبدل", "ملغى مع بقاء أحكام محددة مؤقتًا", "إلغاء جزئي معلّق على شرط"];

type Field = "targetId" | "status" | "instrument" | "url" | "quote";
type Lookup = { state: "idle" } | { state: "loading" } | { state: "found"; name: string; domain: string | null } | { state: "missing" } | { state: "error"; message: string };

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `ws-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** الفعل التجريبي: تغيير حالة نظام بسند إلزامي، مسودةً ثم إرسالًا للفحص (ح١١، ق١١). */
export function WorkStatusForm({ writeEnabled }: { writeEnabled: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ targetId: "", status: "", instrument: "", url: "", quote: "", note: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const idempotencyKey = useRef(newKey());
  const lookupSeq = useRef(0);

  // اسم النظام المحلول قبل الإرسال، بعد توقف الكتابة 400ms (ق١١-٢).
  useEffect(() => {
    const id = form.targetId.trim();
    if (!id) {
      setLookup({ state: "idle" });
      return;
    }
    const seq = ++lookupSeq.current;
    setLookup({ state: "loading" });
    const t = setTimeout(async () => {
      const res = await callEditorial<{ id: string; name: string; domain: string | null }>("GET", `/api/admin/legal/systems/${encodeURIComponent(id)}`);
      if (seq !== lookupSeq.current) return;
      if (res.ok && res.data) setLookup({ state: "found", name: res.data.name, domain: res.data.domain });
      else if (res.status === 404 || res.status === 400) setLookup({ state: "missing" });
      else setLookup({ state: "error", message: res.message ?? "تعذّر البحث عن النظام." });
    }, 400);
    return () => clearTimeout(t);
  }, [form.targetId]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): Partial<Record<Field, string>> => {
    const out: Partial<Record<Field, string>> = {};
    if (!form.targetId.trim()) out.targetId = "اكتب معرّف النظام في حكيم.";
    else if (lookup.state === "missing") out.targetId = "لا نظام بهذا المعرّف في حكيم.";
    if (!form.status) out.status = "اختر الحالة الجديدة.";
    if (!form.instrument.trim()) out.instrument = "اكتب الأداة (رقمها وتاريخها).";
    const url = form.url.trim();
    if (!url) out.url = "رابط السند مطلوب.";
    else {
      try {
        if (new URL(url).protocol !== "https:") out.url = "رابط السند يجب أن يبدأ بـ https.";
      } catch {
        out.url = "رابط السند غير صالح.";
      }
    }
    if (form.quote.trim().length < 10) out.quote = "انقل نص الأداة حرفيًّا (عشرة أحرف على الأقل).";
    return out;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!writeEnabled || busy) return;
    const found = validate();
    setErrors(found);
    const order: Field[] = ["targetId", "status", "instrument", "url", "quote"];
    const first = order.find((k) => found[k]);
    if (first) {
      document.getElementById(`ws-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    const name = lookup.state === "found" ? lookup.name : form.targetId.trim();
    const created = await postEditorial<{ changeSetId: string }>("/api/admin/legal/change-sets", {
      title: `حالة «${name}»: ${form.status}`.slice(0, 200),
      idempotencyKey: idempotencyKey.current,
      changes: [
        {
          op: "set_work_status",
          targetId: form.targetId.trim(),
          status: form.status,
          evidence: { instrument: form.instrument.trim(), url: form.url.trim(), quote: form.quote.trim() },
          note: form.note.trim() || undefined,
        },
      ],
    });
    if (!created.ok || !created.data) {
      setBusy(false);
      setServerError(created.message ?? "تعذّر إنشاء المسودة، ولم يُسجَّل شيء.");
      return;
    }
    const id = created.data.changeSetId;
    const submitted = await postEditorial<{ status: string }>(`/api/admin/legal/change-sets/${encodeURIComponent(id)}/submit`);
    if (!submitted.ok) {
      setBusy(false);
      setServerError(`أُنشئت المسودة ولم تُرسل إلى الفحص: ${submitted.message ?? "خطأ غير معروف"}. تجدها في «دفعات المحررين».`);
      return;
    }
    idempotencyKey.current = newKey();
    router.push(`/admin/legal/queue?tab=changes&created=${encodeURIComponent(id)}`);
    router.refresh();
  };

  const err = (key: Field) =>
    errors[key] ? (
      <span id={`ws-${key}-err`} className="dk-field-error">
        <CircleAlert size={16} aria-hidden />
        <span>{errors[key]}</span>
      </span>
    ) : null;
  const a11y = (key: Field, extra?: string) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": [errors[key] ? `ws-${key}-err` : null, extra].filter(Boolean).join(" ") || undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {serverError ? (
        <Message tone="error" role="alert" title="لم يُنشأ التغيير.">
          {serverError}
        </Message>
      ) : null}
      <fieldset disabled={!writeEnabled || busy} className="dk-fields" aria-busy={busy || undefined}>
        <div className="dk-field">
          <label htmlFor="ws-targetId" className="dk-field__label">
            معرّف النظام في حكيم
          </label>
          <input id="ws-targetId" dir="ltr" lang="en" className="dk-input" value={form.targetId} onChange={set("targetId")} autoComplete="off" {...a11y("targetId", "ws-target-name")} />
          <span id="ws-target-name" aria-live="polite" className="dk-meta">
            {lookup.state === "loading" ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle size={16} aria-hidden className="dk-spin" /> جارٍ البحث عن النظام…
              </span>
            ) : lookup.state === "found" ? (
              <span className="inline-flex items-center gap-2 text-[var(--desk-text-primary)]">
                <Check size={16} aria-hidden className="text-[var(--desk-success)]" />
                <strong>{lookup.name}</strong>
              </span>
            ) : lookup.state === "error" ? (
              lookup.message
            ) : null}
          </span>
          {lookup.state === "missing" && !errors.targetId ? (
            <span className="dk-field-error">
              <CircleAlert size={16} aria-hidden />
              <span>لا نظام بهذا المعرّف في حكيم.</span>
            </span>
          ) : null}
          {err("targetId")}
        </div>
        <div className="dk-field">
          <label htmlFor="ws-status" className="dk-field__label">
            الحالة الجديدة
          </label>
          <select id="ws-status" className="dk-input" value={form.status} onChange={set("status")} {...a11y("status")}>
            <option value="" disabled>
              اختر الحالة
            </option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {err("status")}
        </div>
        <div className="dk-field dk-field--wide">
          <label htmlFor="ws-instrument" className="dk-field__label">
            الأداة (مثل: المرسوم الملكي رقم م/237 بتاريخ …)
          </label>
          <input id="ws-instrument" className="dk-input" value={form.instrument} onChange={set("instrument")} {...a11y("instrument")} />
          {err("instrument")}
        </div>
        <div className="dk-field dk-field--wide">
          <label htmlFor="ws-url" className="dk-field__label">
            رابط السند (أم القرى أولًا، ثم هيئة الخبراء، ثم الجهة)
          </label>
          <input id="ws-url" dir="ltr" lang="en" type="url" inputMode="url" className="dk-input" value={form.url} onChange={set("url")} {...a11y("url")} />
          {err("url")}
        </div>
        <div className="dk-field dk-field--wide">
          <label htmlFor="ws-quote" className="dk-field__label">
            الاقتباس الحرفي من الأداة
          </label>
          <textarea id="ws-quote" rows={3} className="dk-input dk-input--legal" value={form.quote} onChange={set("quote")} {...a11y("quote")} />
          {err("quote")}
        </div>
        <div className="dk-field dk-field--wide">
          <label htmlFor="ws-note" className="dk-field__label">
            ملاحظة (اختيارية)
          </label>
          <input id="ws-note" className="dk-input" value={form.note} onChange={set("note")} />
        </div>
      </fieldset>
      <button type="submit" disabled={!writeEnabled || busy} className={`${btnClass("primary", { lg: true })} w-full sm:w-auto`}>
        {busy ? <LoaderCircle size={18} aria-hidden className="dk-spin" /> : null}
        <span>{busy ? "جارٍ الإنشاء…" : "إنشاء التغيير وإرساله للفحص"}</span>
      </button>
    </form>
  );
}
