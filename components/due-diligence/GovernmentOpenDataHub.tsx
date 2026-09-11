"use client";

import { useState } from "react";
import { Database, ExternalLink, Loader2, RefreshCw } from "lucide-react";

type BaladyItem = {
  id?: string;
  title?: string;
  year?: string;
  category?: string;
  files?: string[];
  created?: string;
  changed?: string;
};

type BaladyResponse = {
  source?: string;
  authority?: string;
  fetchedAt?: string;
  officialUrl?: string;
  items?: BaladyItem[];
  caveatAr?: string;
  message?: string;
};

export function GovernmentOpenDataHub() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BaladyResponse | null>(null);
  const [error, setError] = useState("");

  async function loadBalady() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/due-diligence/open-data?source=balady_open_data_api&limit=25", {
        cache: "no-store",
      });
      const payload = (await response.json()) as BaladyResponse;
      if (!response.ok) throw new Error(payload.message || "تعذر جلب البيانات المفتوحة.");
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر جلب البيانات المفتوحة.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4" dir="rtl" aria-labelledby="gov-open-data-hub-title">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-sky-700">Open Data Hub</p>
            <h2 id="gov-open-data-hub-title" className="mt-1 text-xl font-bold text-slate-950">
              مركز البيانات الحكومية المفتوحة
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              اتصال منفصل للبيانات المفتوحة السياقية والكتالوجات الحكومية. هذه البيانات تساعد في البحث والتحليل، لكنها لا تتحول إلى واقعة عن منشأة ولا ترفع درجة المخاطر دون معرف كيان موثق.
            </p>
          </div>
          <button
            type="button"
            onClick={loadBalady}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : data ? <RefreshCw className="h-4 w-4" /> : <Database className="h-4 w-4" />}
            {loading ? "يجري الاتصال ببلدي..." : data ? "تحديث بيانات بلدي" : "تحميل كتالوج بلدي"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error} — لا يُفسر تعذر المصدر على أنه عدم وجود بيانات.
          </div>
        ) : null}

        {data ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">متصل حيًا</span>
              <span>{data.authority}</span>
              <span>المجموعات المسترجعة: {data.items?.length ?? 0}</span>
              {data.fetchedAt ? <span>{new Date(data.fetchedAt).toLocaleString("ar-SA")}</span> : null}
            </div>

            {data.caveatAr ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">{data.caveatAr}</p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              {(data.items ?? []).map((item, index) => (
                <article key={item.id ?? `${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-bold text-slate-950">{item.title || `مجموعة بيانات ${item.id ?? index + 1}`}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    {item.year ? <span>السنة: {item.year}</span> : null}
                    {item.category ? <span>التصنيف: {item.category}</span> : null}
                    {item.changed ? <span>آخر تحديث: {item.changed}</span> : null}
                  </div>
                  {item.files?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.files.slice(0, 5).map((file, fileIndex) => (
                        <a
                          key={`${file}-${fileIndex}`}
                          href={file}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800 shadow-sm"
                        >
                          ملف {fileIndex + 1} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
            أول موصل كتالوجي حي هو «بلدي». المصادر الأخرى تظهر في سجل المصادر أدناه بحسب حالتها: LIVE أو ADAPTER أو DISCOVERY أو DEGRADED.
          </div>
        )}
      </div>
    </section>
  );
}
