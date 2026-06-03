"use client";

import { useRef, useState } from "react";
import { formatFileSize } from "@/lib/modules/attachments/attachment-metadata";

type AttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size?: number;
  relationType?: string;
  relationId?: string;
  storageMode?: string;
  createdAt: string;
  caseFile?: { id: string; title: string } | null;
};

type CaseOption = {
  id: string;
  title: string;
};

const relationTypes = ["عام", "قضية", "استشارة", "محاكاة"];

export function AttachmentsManager({ initialAttachments, cases }: { initialAttachments: AttachmentItem[]; cases: CaseOption[] }) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [relationType, setRelationType] = useState(relationTypes[0]);
  const [relationId, setRelationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function uploadAttachment() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("اختر ملفًا قبل الحفظ.");
      return;
    }

    setLoading(true);
    setStatus("");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("relationType", relationType);
      form.append("relationId", relationId);
      const response = await fetch("/api/attachments", {
        method: "POST",
        body: form
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر تسجيل المرفق.");
      setAttachments((current) => [payload.attachment as AttachmentItem, ...current]);
      setStatus("تم تسجيل بيانات المرفق بنجاح.");
      if (fileRef.current) fileRef.current.value = "";
      setRelationId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل المرفق.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAttachment(id: string) {
    setDeletingId(id);
    setStatus("");
    setError("");
    try {
      const response = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر حذف المرفق.");
      setAttachments((current) => current.filter((item) => item.id !== id));
      setStatus(payload.message ?? "تم حذف المرفق.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف المرفق.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-gold bg-sand p-5">
        <h2 className="text-xl font-bold text-olive">تنبيه التخزين</h2>
        <p className="mt-2 leading-8 text-gray-700">
          إدارة المرفقات الحالية مخصصة للتجربة، وسيتم ربط التخزين الدائم لاحقًا. لا يتم حفظ محتوى الملف على Vercel في هذه المرحلة.
        </p>
      </section>

      <section className="rounded-md border border-black/10 bg-white p-5">
        <h2 className="text-xl font-bold text-olive">إضافة مرفق</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_160px_1fr_auto]">
          <label>
            <span className="text-sm font-semibold text-olive">الملف</span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg"
              className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-olive">نوع الارتباط</span>
            <select
              value={relationType}
              onChange={(event) => {
                setRelationType(event.target.value);
                setRelationId("");
              }}
              className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
            >
              {relationTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-sm font-semibold text-olive">المعرف المرتبط</span>
            {relationType === "قضية" ? (
              <select
                value={relationId}
                onChange={(event) => setRelationId(event.target.value)}
                className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
              >
                <option value="">بدون ربط</option>
                {cases.map((caseItem) => (
                  <option key={caseItem.id} value={caseItem.id}>
                    {caseItem.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={relationId}
                onChange={(event) => setRelationId(event.target.value)}
                className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
                placeholder="اختياري"
              />
            )}
          </label>

          <button
            type="button"
            onClick={() => void uploadAttachment()}
            disabled={loading}
            className="focus-ring self-end rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "جار التسجيل..." : "تسجيل المرفق"}
          </button>
        </div>
        {status ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{status}</p> : null}
        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : null}
      </section>

      <section className="rounded-md border border-black/10 bg-white p-5">
        <h2 className="text-xl font-bold text-olive">قائمة المرفقات</h2>
        {attachments.length === 0 ? (
          <p className="mt-4 rounded-md bg-sand p-4 text-gray-700">لا توجد مرفقات حتى الآن.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-sand text-olive">
                <tr>
                  <th className="px-4 py-3">اسم الملف</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">الحجم</th>
                  <th className="px-4 py-3">الارتباط</th>
                  <th className="px-4 py-3">تاريخ الرفع</th>
                  <th className="px-4 py-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((item) => (
                  <tr key={item.id} className="border-t border-black/10">
                    <td className="px-4 py-3 font-semibold text-olive">{item.fileName}</td>
                    <td className="px-4 py-3">{item.mimeType}</td>
                    <td className="px-4 py-3">{formatFileSize(item.size)}</td>
                    <td className="px-4 py-3">{item.caseFile?.title ?? item.relationType ?? "عام"}</td>
                    <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString("ar-SA")}</td>
                    <td className="px-4 py-3">
                      {item.storageMode === "azure-blob" ? (
                        <a href={`/api/attachments/${item.id}/download`} className="focus-ring ml-2 rounded-md border border-[#C09B5A]/30 px-3 py-2 text-[#0B1F3A]">
                          تنزيل
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deleteAttachment(item.id)}
                        disabled={deletingId === item.id}
                        className="focus-ring rounded-md border border-red-200 px-3 py-2 text-red-700 disabled:opacity-60"
                      >
                        {deletingId === item.id ? "جار الحذف..." : "حذف"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs leading-6 text-gray-500">
          TODO: التخزين في Azure Blob أو SharePoint، استخراج النص من PDF/DOCX، وربط المرفقات بتحليل الاستشارة والمحاكاة.
        </p>
      </section>
    </div>
  );
}
