"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postEditorial } from "./api";
import { btn, Notice } from "./ui";

const STATUSES = ["ساري", "صادر لم يسرِ بعد", "ملغى", "مستبدل", "ملغى مع بقاء أحكام محددة مؤقتًا", "إلغاء جزئي معلّق على شرط"];

/** الفعل التجريبي: تغيير حالة نظام بسند إلزامي، مسودةً ثم إرسالًا للفحص. */
export function WorkStatusForm({ writeEnabled }: { writeEnabled: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ targetId: "", status: "ملغى", instrument: "", url: "", quote: "", note: "", title: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!writeEnabled) return;
    setBusy(true);
    setMessage(null);
    const created = await postEditorial<{ changeSetId: string }>("/api/admin/legal/change-sets", {
      title: form.title.trim() || `حالة النظام ${form.targetId.trim()}: ${form.status}`,
      changes: [
        {
          op: "set_work_status",
          targetId: form.targetId.trim(),
          status: form.status,
          evidence: { instrument: form.instrument, url: form.url, quote: form.quote },
          note: form.note.trim() || undefined,
        },
      ],
    });
    if (!created.ok || !created.data) {
      setBusy(false);
      setMessage({ tone: "error", text: created.message ?? "تعذّر إنشاء المسودة." });
      return;
    }
    const submitted = await postEditorial<{ status: string }>(`/api/admin/legal/change-sets/${created.data.changeSetId}/submit`);
    setBusy(false);
    if (!submitted.ok) {
      setMessage({ tone: "error", text: `أُنشئت المسودة ولم تُرسل: ${submitted.message ?? ""}` });
      return;
    }
    setMessage({
      tone: submitted.data?.status === "pending" ? "success" : "error",
      text: submitted.data?.status === "pending" ? "أُرسل التغيير إلى طابور الاعتماد. يعتمده معتمِد غير المُعِدّ." : "فشلت فحوص التغيير؛ راجعه في قائمة الدفعات.",
    });
    router.push("/admin/legal/queue?tab=changes");
    router.refresh();
  };

  const field = "min-h-[44px] w-full rounded-md border border-[rgba(14,52,53,0.18)] bg-white px-3";
  return (
    <form onSubmit={submit} className="space-y-4">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <fieldset disabled={!writeEnabled || busy} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-[rgba(18,33,31,0.7)]">معرّف النظام في حكيم</span>
          <input dir="ltr" required value={form.targetId} onChange={set("targetId")} className={field} placeholder="cm..." />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[rgba(18,33,31,0.7)]">الحالة الجديدة</span>
          <select value={form.status} onChange={set("status")} className={field}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-[rgba(18,33,31,0.7)]">الأداة (مثل: المرسوم الملكي رقم م/237 بتاريخ …)</span>
          <input required value={form.instrument} onChange={set("instrument")} className={field} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-[rgba(18,33,31,0.7)]">رابط السند (أم القرى أولًا، ثم هيئة الخبراء، ثم الجهة)</span>
          <input dir="ltr" required type="url" value={form.url} onChange={set("url")} className={field} placeholder="https://uqn.gov.sa/..." />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-[rgba(18,33,31,0.7)]">الاقتباس الحرفي من الأداة</span>
          <textarea required rows={3} value={form.quote} onChange={set("quote")} className="w-full rounded-md border border-[rgba(14,52,53,0.18)] bg-white p-3" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-[rgba(18,33,31,0.7)]">ملاحظة (اختيارية)</span>
          <input value={form.note} onChange={set("note")} className={field} />
        </label>
      </fieldset>
      <button type="submit" disabled={!writeEnabled || busy} className={`${btn.base} ${btn.primary}`}>
        إنشاء التغيير وإرساله للفحص
      </button>
    </form>
  );
}
