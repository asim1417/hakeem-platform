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

export function DueDiligenceSourceMatrix() {
  const configured = new Set(buildPhase3Connectors().map((connector) => connector.source.key));
  const sources = phase3SourceCatalog();

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4" dir="rtl" aria-labelledby="dd-sources-title">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-emerald-700">تغطية المصادر</p>
          <h2 id="dd-sources-title" className="mt-1 text-xl font-bold text-slate-950">جميع مصادر العناية الواجبة</h2>
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
    </section>
  );
}
