import { governmentOpenDataRegistry } from "@/lib/modules/due-diligence/government-open-data";
import {
  buildPhase3Connectors,
  phase3SourceCatalog,
} from "@/lib/modules/due-diligence/phase3";

const accessLabels: Record<string, string> = {
  OFFICIAL_API: "واجهة رسمية",
  OPEN_DATA: "بيانات مفتوحة",
  PUBLIC_WEB: "نشر عام رسمي",
  AUTHORIZED: "يتطلب ربطًا مصرحًا",
  MANUAL: "تحقق يدوي",
};

const integrationLabels: Record<string, string> = {
  LIVE: "متصل حيًا",
  ADAPTER: "موصل جاهز",
  DISCOVERY: "استكشاف/سياق",
  DEGRADED: "متدهور/بانتظار مسار ثابت",
};

const scopeLabels: Record<string, string> = {
  ENTITY: "على مستوى الكيان",
  CONTEXT: "بيانات سياقية",
  CATALOG: "فهرس/منصة مفتوحة",
};

export function DueDiligenceSourceMatrix() {
  const configured = new Set(buildPhase3Connectors().map((connector) => connector.source.key));
  const sources = phase3SourceCatalog();
  const openData = governmentOpenDataRegistry();

  return (
    <section className="mx-auto mt-6 max-w-6xl space-y-5 px-4" dir="rtl" aria-labelledby="dd-sources-title">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-emerald-700">تغطية المصادر</p>
          <h2 id="dd-sources-title" className="mt-1 text-xl font-bold text-slate-950">مصادر العناية الواجبة المباشرة</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            «مهيأ» تعني أن موصل حكيم جاهز للتشغيل. نتيجة «لم يُعثر» من أي مصدر لا تُحوَّل تلقائيًا إلى نفي قانوني أو إثبات عدم وجود واقعة.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => {
            const ready = configured.has(source.key);
            return (
              <article key={source.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{source.nameAr}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{source.authority}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      ready ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {ready ? "مهيأ" : "بانتظار الربط"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>{accessLabels[source.accessType] ?? source.accessType}</span>
                  <code className="max-w-[48%] truncate rounded bg-white px-2 py-1 text-[10px]" dir="ltr">
                    {source.key}
                  </code>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-sky-700">Government Open Data Registry</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">سجل منصات البيانات الحكومية المفتوحة</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            يفصل حكيم بين بيانات «على مستوى الكيان» والبيانات السياقية والفهارس المفتوحة. البيانات السياقية لا تتحول إلى واقعة سلبية ولا تدخل Risk Score لمجرد وجودها في منصة حكومية.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {openData.map((item) => (
            <article key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-950">{item.nameAr}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.authority}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    item.integration === "LIVE"
                      ? "bg-emerald-100 text-emerald-800"
                      : item.integration === "DEGRADED"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {integrationLabels[item.integration] ?? item.integration}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">{item.notesAr}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>{scopeLabels[item.scope] ?? item.scope}</span>
                <a
                  href={item.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-800 underline underline-offset-4"
                >
                  المصدر الرسمي
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
