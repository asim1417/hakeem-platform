"use client";

import { useState } from "react";

type CaseItem = {
  id: string;
  title: string;
  caseType?: string;
  clientRole?: string;
  factsSummary?: string;
  requests?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const statusOptions = [
  { label: "مسودة", value: "DRAFT" },
  { label: "نشطة", value: "ACTIVE" },
  { label: "مغلقة", value: "CLOSED" }
];

const clientRoles = ["مدعي", "مدعى عليه", "مستأنف", "مستأنف ضده"];

export function CasesManager({ initialCases }: { initialCases: CaseItem[] }) {
  const [cases, setCases] = useState(initialCases);
  const [title, setTitle] = useState("");
  const [caseType, setCaseType] = useState("");
  const [clientRole, setClientRole] = useState(clientRoles[0]);
  const [factsSummary, setFactsSummary] = useState("");
  const [requests, setRequests] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createCase() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ title, caseType, clientRole, factsSummary, requests, status })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? "تعذر حفظ القضية.");
      }

      setCases((current) => [payload.case as CaseItem, ...current]);
      setTitle("");
      setCaseType("");
      setClientRole(clientRoles[0]);
      setFactsSummary("");
      setRequests("");
      setStatus("DRAFT");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ القضية.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-black/10 bg-white p-5">
        <h2 className="text-xl font-bold text-olive">إضافة قضية</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="عنوان القضية" value={title} onChange={setTitle} placeholder="مثال: مطالبة توريد مواد" />
          <Field label="نوع القضية" value={caseType} onChange={setCaseType} placeholder="مثال: تجارية" />

          <label className="block">
            <span className="text-sm font-semibold text-olive">صفة العميل</span>
            <select
              value={clientRole}
              onChange={(event) => setClientRole(event.target.value)}
              className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
            >
              {clientRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-olive">حالة القضية</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <TextArea label="ملخص الوقائع" value={factsSummary} onChange={setFactsSummary} />
        <TextArea label="الطلبات" value={requests} onChange={setRequests} />

        <button
          type="button"
          onClick={() => void createCase()}
          disabled={loading || title.trim().length < 3}
          className="focus-ring mt-5 rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جار حفظ القضية..." : "حفظ القضية"}
        </button>
        {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="rounded-md border border-black/10 bg-white p-5">
        <h2 className="text-xl font-bold text-olive">القضايا المسجلة</h2>
        {cases.length === 0 ? (
          <p className="mt-4 rounded-md bg-sand p-4 text-gray-700">لا توجد قضايا مسجلة حتى الآن.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {cases.map((caseItem) => (
              <article key={caseItem.id} className="rounded-md border border-black/10 p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-olive">{caseItem.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {[caseItem.caseType, caseItem.clientRole, statusLabel(caseItem.status)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(caseItem.createdAt).toLocaleString("ar-SA")}</p>
                </div>
                {caseItem.factsSummary ? <p className="mt-3 leading-8 text-gray-700">{caseItem.factsSummary}</p> : null}
                {caseItem.requests ? <p className="mt-2 text-sm text-gray-600">الطلبات: {caseItem.requests}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-olive">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
        placeholder={placeholder}
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold text-olive">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring mt-2 min-h-24 w-full rounded-md border border-black/10 px-4 py-3 leading-8"
      />
    </label>
  );
}

function statusLabel(status: string) {
  if (status === "OPEN") return "مسودة";
  if (status === "UNDER_REVIEW") return "نشطة";
  if (status === "CLOSED") return "مغلقة";
  return status;
}
