"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  FileDown,
  Fingerprint,
  Loader2,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

type Evidence = {
  id: string;
  sourceKey: string;
  entityName: string;
  commercialRegistration?: string;
  unifiedNumber?: string;
  category: string;
  title: string;
  summary?: string;
  sourceUrl: string;
  occurredAt?: string;
  fetchedAt: string;
  confidence: number;
  status: "VERIFIED" | "MATCHED" | "REJECTED" | "NEEDS_REVIEW";
  matchReasons: string[];
  rejectionReasons: string[];
  sha256: string;
};

type Report = {
  query: { name: string; unifiedNumber?: string; commercialRegistration?: string; city?: string };
  generatedAt: string;
  evidence: Evidence[];
  rejected: Evidence[];
  needsReview: Evidence[];
  sources: Array<{
    key: string;
    nameAr: string;
    authority: string;
    status: "OK" | "WARNING" | "FAILED" | "SKIPPED";
    observations: number;
    warnings: string[];
    durationMs: number;
  }>;
  risk: {
    score: number;
    level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    factors: Array<{
      key: string;
      labelAr: string;
      points: number;
      evidenceIds: string[];
      explanationAr: string;
    }>;
    caveatAr: string;
  };
  coverage: { configuredSources: number; successfulSources: number; verifiedEvidence: number };
};

type ApiResult = {
  mode?: "DEMO";
  demo?: boolean;
  demoNotice?: string;
  report?: Report;
  message?: string;
};

const categoryLabels: Record<string, string> = {
  corporate_identity: "هوية المنشأة",
  bankruptcy: "الإفلاس",
  trademark: "الملكية الفكرية",
  regulatory_action: "إجراء تنظيمي",
  license_issue: "الترخيص",
  adverse_judgment: "حكم منشور",
  media_adverse: "إشارة إعلامية",
};

const statusLabels: Record<Evidence["status"], string> = {
  VERIFIED: "متحقق",
  MATCHED: "مطابق",
  REJECTED: "مستبعد",
  NEEDS_REVIEW: "يحتاج مراجعة",
};

function riskLabel(level: Report["risk"]["level"]) {
  return { LOW: "منخفض", MODERATE: "متوسط", HIGH: "مرتفع", CRITICAL: "حرج" }[level];
}

function riskClass(level: Report["risk"]["level"]) {
  if (level === "LOW") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (level === "MODERATE") return "border-amber-200 bg-amber-50 text-amber-950";
  if (level === "HIGH") return "border-orange-200 bg-orange-50 text-orange-950";
  return "border-red-200 bg-red-50 text-red-950";
}

function downloadJson(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hakeem-due-diligence-demo-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PublicDueDiligenceDemo() {
  const [name, setName] = useState("شركة المثال للتقنية المحدودة");
  const [commercialRegistration, setCommercialRegistration] = useState("1010123456");
  const [unifiedNumber, setUnifiedNumber] = useState("7001234567");
  const [city, setCity] = useState("الرياض");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);

  const report = result?.report;
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of report?.evidence ?? []) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return [...map.entries()];
  }, [report]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/due-diligence/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          commercialRegistration: commercialRegistration || undefined,
          unifiedNumber: unifiedNumber || undefined,
          city: city || undefined,
        }),
      });
      const payload = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(payload.message || "تعذر تشغيل التجربة.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تشغيل التجربة.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#f6f4ef] text-slate-900">
      <header className="border-b border-white/10 bg-[#0e3435] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
              <ShieldCheck className="h-5 w-5" /> حكيم للأعمال
            </div>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">العناية الواجبة القانونية والتجارية</h1>
          </div>
          <span className="rounded-full border border-amber-300/40 bg-amber-200/10 px-3 py-1.5 text-xs font-bold text-amber-100">
            DEMO عام · بيانات صناعية فقط
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-[#0e3435] via-[#16494a] to-[#0e3435] px-5 py-6 text-white md:px-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                  <Sparkles className="h-4 w-4" /> تجربة المنتج من البحث حتى التقرير
                </div>
                <h2 className="mt-2 text-2xl font-bold">اختبر محرك Due Diligence قبل ربط جميع المصادر الحية</h2>
                <p className="mt-2 text-sm leading-7 text-emerald-50/85">
                  أدخل اسمًا تجريبيًا وسجلًا ورقمًا موحدًا. سيبني حكيم ملف كيان، يطابق الأدلة، يستبعد التعارضات، ويحسب المخاطر مع بصمة لكل دليل.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3"><div className="text-xl font-bold">4</div><div>مصادر تجريبية</div></div>
                <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3"><div className="text-xl font-bold">6</div><div>وقائع اختبار</div></div>
                <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3"><div className="text-xl font-bold">SHA-256</div><div>بصمة الأدلة</div></div>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5 p-5 md:p-7">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
              <strong>مهم:</strong> كل النتائج في هذه الصفحة صناعية بالكامل، ولا تمثل شركة أو علامة أو واقعة إفلاس أو ترخيصًا حقيقيًا. الوضع الحي يبقى داخل حكيم بعد تسجيل الدخول.
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 xl:col-span-2">
                <span className="text-sm font-bold">اسم الشركة / المنشأة</span>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-emerald-800/20">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <input className="w-full bg-transparent px-3 py-3 outline-none" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </label>
              <label className="space-y-2"><span className="text-sm font-bold">السجل التجاري</span><input className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-800/20" value={commercialRegistration} onChange={(e) => setCommercialRegistration(e.target.value)} inputMode="numeric" /></label>
              <label className="space-y-2"><span className="text-sm font-bold">الرقم الموحد</span><input className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-800/20" value={unifiedNumber} onChange={(e) => setUnifiedNumber(e.target.value)} inputMode="numeric" /></label>
              <label className="space-y-2"><span className="text-sm font-bold">المدينة</span><input className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-800/20" value={city} onChange={(e) => setCity(e.target.value)} /></label>
              <div className="flex items-end md:col-span-2 xl:col-span-3">
                <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e3435] px-5 py-3 font-bold text-white transition hover:bg-[#175052] disabled:opacity-60 xl:max-w-sm">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  {loading ? "يجري بناء التقرير..." : "شغّل العرض التجريبي"}
                </button>
              </div>
            </div>
          </form>
        </section>

        {error ? <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><AlertTriangle className="h-5 w-5 shrink-0" /><div>{error}</div></div> : null}

        {!report ? (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {["هوية المنشأة", "الملكية الفكرية", "الإفلاس", "التراخيص والتنظيم"].map((label) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5 text-emerald-700" />{label}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">مصدر تجريبي مهيأ لعرض المطابقة، الأدلة، والاستبعاد.</p>
              </div>
            ))}
          </section>
        ) : null}

        {report ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div><strong>نتيجة تجريبية فقط.</strong> {result?.demoNotice}</div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold"><Printer className="h-4 w-4" />طباعة</button>
                <button onClick={() => downloadJson(result)} className="inline-flex items-center gap-2 rounded-lg bg-[#0e3435] px-3 py-2 font-semibold text-white"><FileDown className="h-4 w-4" />JSON</button>
              </div>
            </div>

            <section className="grid gap-4 lg:grid-cols-4">
              <div className={`rounded-2xl border p-5 lg:col-span-1 ${riskClass(report.risk.level)}`}>
                <div className="text-sm font-bold opacity-70">Risk Score</div>
                <div className="mt-2 text-5xl font-black">{report.risk.score}<span className="text-lg font-semibold">/100</span></div>
                <div className="mt-2 text-lg font-bold">{riskLabel(report.risk.level)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
                <div className="flex items-center gap-2 font-bold"><BadgeCheck className="h-5 w-5 text-emerald-700" />هوية الكيان محل الفحص</div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div><div className="text-slate-500">الاسم</div><div className="mt-1 font-bold">{report.query.name}</div></div>
                  <div><div className="text-slate-500">السجل</div><div className="mt-1 font-bold">{report.query.commercialRegistration || "—"}</div></div>
                  <div><div className="text-slate-500">الرقم الموحد</div><div className="mt-1 font-bold">{report.query.unifiedNumber || "—"}</div></div>
                  <div><div className="text-slate-500">المدينة</div><div className="mt-1 font-bold">{report.query.city || "—"}</div></div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-black">{report.evidence.length}</div><div className="text-slate-500">أدلة مقبولة</div></div>
                  <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-black">{report.rejected.length}</div><div className="text-slate-500">نتائج مستبعدة</div></div>
                  <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-black">{report.coverage.successfulSources}</div><div className="text-slate-500">مصادر ناجحة</div></div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {categoryCounts.map(([category, count]) => (
                <div key={category} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-bold text-slate-500">{categoryLabels[category] ?? category}</div>
                  <div className="mt-1 text-3xl font-black text-[#0e3435]">{count}</div>
                </div>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-5 w-5 text-emerald-700" />الأدلة المقبولة</div>
                {report.evidence.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-emerald-700">{categoryLabels[item.category] ?? item.category}</div>
                        <h3 className="mt-1 font-bold">{item.title}</h3>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{statusLabels[item.status]} · {item.confidence}%</span>
                    </div>
                    {item.summary ? <p className="mt-3 text-sm leading-7 text-slate-600">{item.summary}</p> : null}
                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      <Fingerprint className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="break-all font-mono">{item.sha256}</span>
                    </div>
                    {item.matchReasons.length ? <div className="mt-3 text-xs text-slate-500">أسباب المطابقة: {item.matchReasons.join(" · ")}</div> : null}
                  </article>
                ))}
              </div>

              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-bold">عوامل المخاطر</h3>
                  <div className="mt-4 space-y-3">
                    {report.risk.factors.map((factor) => (
                      <div key={factor.key} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3"><span className="font-bold">{factor.labelAr}</span><span className="font-black">+{factor.points}</span></div>
                        <p className="mt-1 text-xs leading-6 text-slate-600">{factor.explanationAr}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-6 text-slate-500">{report.risk.caveatAr}</p>
                </section>

                <section className="rounded-xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-center gap-2 font-bold text-red-900"><XCircle className="h-5 w-5" />النتائج المستبعدة</div>
                  <div className="mt-3 space-y-3">
                    {report.rejected.length ? report.rejected.map((item) => (
                      <div key={item.id} className="rounded-lg border border-red-200 bg-white p-3">
                        <div className="text-sm font-bold">{item.title}</div>
                        <div className="mt-1 text-xs leading-6 text-red-700">{item.rejectionReasons.join(" · ")}</div>
                        <div className="mt-1 text-xs text-slate-500">هذه النتيجة لا تدخل في Risk Score.</div>
                      </div>
                    )) : <div className="text-sm text-slate-600">لا توجد نتائج مستبعدة.</div>}
                  </div>
                </section>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
