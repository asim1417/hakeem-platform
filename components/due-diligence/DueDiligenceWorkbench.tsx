"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  FileDown,
  Loader2,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

type Mode = "LIVE" | "DEMO";

type SourceReadiness = {
  key: string;
  nameAr: string;
  authority: string;
  accessType: string;
  configured: boolean;
};

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
  mode?: Mode;
  demo?: boolean;
  demoNotice?: string;
  report?: Report;
  message?: string;
  setupRequired?: boolean;
};

const categoryLabels: Record<string, string> = {
  corporate_identity: "هوية المنشأة",
  bankruptcy: "الإفلاس",
  trademark: "الملكية الفكرية",
  regulatory_action: "إجراء تنظيمي",
  license_issue: "ترخيص",
  adverse_judgment: "حكم منشور",
  media_adverse: "إشارة إعلامية",
};

const statusLabels: Record<Evidence["status"], string> = {
  VERIFIED: "متحقق",
  MATCHED: "مطابق",
  REJECTED: "مستبعد",
  NEEDS_REVIEW: "يحتاج مراجعة",
};

const sourceStatusLabels = {
  OK: "متصل",
  WARNING: "متصل بتحفظ",
  FAILED: "تعذر الاتصال",
  SKIPPED: "غير مفعل",
};

function riskLabel(level: Report["risk"]["level"]) {
  return { LOW: "منخفض", MODERATE: "متوسط", HIGH: "مرتفع", CRITICAL: "حرج" }[level];
}

function fmtDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA");
}

function downloadJson(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `hakeem-due-diligence-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DueDiligenceWorkbench() {
  const [mode, setMode] = useState<Mode>("DEMO");
  const [name, setName] = useState("شركة المثال للتقنية المحدودة");
  const [unifiedNumber, setUnifiedNumber] = useState("7001234567");
  const [commercialRegistration, setCommercialRegistration] = useState("1010123456");
  const [city, setCity] = useState("الرياض");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [sources, setSources] = useState<SourceReadiness[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/due-diligence/analyze", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.sources) setSources(payload.sources);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const report = result?.report;
  const acceptedCount = report?.evidence.length ?? 0;
  const sourceConnected = sources.filter((source) => source.configured).length;

  const categories = useMemo(() => {
    if (!report) return [] as Array<[string, number]>;
    const counts = new Map<string, number>();
    for (const evidence of report.evidence) {
      counts.set(evidence.category, (counts.get(evidence.category) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [report]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/due-diligence/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          unifiedNumber: unifiedNumber || undefined,
          commercialRegistration: commercialRegistration || undefined,
          city: city || undefined,
          mode,
        }),
      });
      const payload = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(payload.message || "تعذر تنفيذ الفحص.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تنفيذ الفحص.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12" dir="rtl">
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-[var(--border)] bg-gradient-to-l from-emerald-950 via-emerald-900 to-emerald-950 px-6 py-7 text-white md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-100">
                <ShieldCheck className="h-5 w-5" />
                حكيم للأعمال · Legal & Commercial Due Diligence
              </div>
              <h1 className="text-2xl font-bold md:text-3xl">العناية الواجبة الذكية بالكيانات</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-50/85 md:text-base">
                اجمع المصادر المصرح بها، طابق هوية المنشأة، استبعد النتائج المتعارضة، واعرض المخاطر مع أثر كل دليل ومصدره.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                <div className="text-xl font-bold">{sources.length || "—"}</div><div>مصادر معرفة</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                <div className="text-xl font-bold">{sourceConnected}</div><div>مهيأة حيًا</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                <div className="text-xl font-bold">SHA-256</div><div>بصمة الأدلة</div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6 md:p-8">
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--muted)] p-1">
            <button
              type="button"
              onClick={() => setMode("DEMO")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === "DEMO" ? "bg-[var(--surface)] shadow-sm" : "opacity-70"}`}
            >
              <Sparkles className="ml-1 inline h-4 w-4" /> عرض تجريبي قوي
            </button>
            <button
              type="button"
              onClick={() => setMode("LIVE")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === "LIVE" ? "bg-[var(--surface)] shadow-sm" : "opacity-70"}`}
            >
              <Database className="ml-1 inline h-4 w-4" /> مصادر حية
            </button>
          </div>

          {mode === "DEMO" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <strong>وضع تجريبي:</strong> الوقائع التي ستظهر صناعية بالكامل ولا تخص أي شركة حقيقية. الهدف اختبار تجربة المستخدم ومحرك المطابقة والمخاطر.
            </div>
          ) : (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
              الوضع الحي لا يختلق بيانات. سيعرض فقط ما تعيده الموصلات المهيأة على خادم حكيم، مع إظهار فشل أو نقص التغطية بدل التخمين.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm font-semibold">اسم الشركة / المنشأة</span>
              <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:ring-2 focus-within:ring-emerald-700/30">
                <Building2 className="h-4 w-4 opacity-50" />
                <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-transparent px-3 py-3 outline-none" placeholder="اسم الكيان" />
              </div>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">السجل التجاري</span>
              <input value={commercialRegistration} onChange={(e) => setCommercialRegistration(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-700/30" inputMode="numeric" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">الرقم الموحد</span>
              <input value={unifiedNumber} onChange={(e) => setUnifiedNumber(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-700/30" inputMode="numeric" />
            </label>
            <label className="space-y-2 md:col-span-2 xl:col-span-1">
              <span className="text-sm font-semibold">المدينة</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-700/30" />
            </label>
            <div className="flex items-end md:col-span-2 xl:col-span-3">
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60 xl:max-w-sm">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                {loading ? "يجري فحص المصادر والمطابقة..." : mode === "DEMO" ? "شغّل العرض التجريبي" : "ابدأ الفحص الحي"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><strong>تعذر إكمال الفحص.</strong><div className="mt-1 text-sm">{error}</div></div>
        </div>
      ) : null}

      {!report ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {sources.slice(0, 6).map((source) => (
            <div key={source.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-bold">{source.nameAr}</div><div className="mt-1 text-xs opacity-65">{source.authority}</div></div>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${source.configured ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{source.configured ? "مهيأ" : "بانتظار الربط"}</span>
              </div>
              <div className="mt-3 text-xs opacity-60">{source.accessType}</div>
            </div>
          ))}
        </section>
      ) : null}

      {report ? (
        <div className="space-y-6">
          {result?.demoNotice ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{result.demoNotice}</div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 xl:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold opacity-60">Risk Score</div>
                  <div className="mt-1 flex items-end gap-2"><span className="text-5xl font-black">{report.risk.score}</span><span className="pb-1 text-lg opacity-50">/100</span></div>
                  <div className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">{riskLabel(report.risk.level)}</div>
                </div>
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[12px] border-emerald-900/15">
                  <ShieldCheck className="h-12 w-12 text-emerald-900" />
                </div>
              </div>
              <p className="mt-4 text-xs leading-6 opacity-60">{report.risk.caveatAr}</p>
            </div>

            <Metric title="أدلة مقبولة" value={acceptedCount} icon={<BadgeCheck className="h-5 w-5" />} />
            <Metric title="متحقق منها" value={report.coverage.verifiedEvidence} icon={<CheckCircle2 className="h-5 w-5" />} />
            <Metric title="نتائج مستبعدة" value={report.rejected.length} icon={<XCircle className="h-5 w-5" />} />
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">ملخص الكيان</h2><p className="mt-1 text-sm opacity-60">{report.query.name}</p></div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"><Printer className="h-4 w-4" /> طباعة</button>
                <button onClick={() => downloadJson(result)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"><FileDown className="h-4 w-4" /> JSON</button>
              </div>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Info label="السجل التجاري" value={report.query.commercialRegistration || "غير مدخل"} />
              <Info label="الرقم الموحد" value={report.query.unifiedNumber || "غير مدخل"} />
              <Info label="المدينة" value={report.query.city || "غير محددة"} />
              <Info label="وقت التقرير" value={new Date(report.generatedAt).toLocaleString("ar-SA")} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {report.sources.map((source) => (
              <div key={source.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-bold">{source.nameAr}</div><div className="mt-1 text-xs opacity-60">{source.authority}</div></div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${source.status === "FAILED" ? "bg-red-100 text-red-800" : source.status === "WARNING" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{sourceStatusLabels[source.status]}</span>
                </div>
                <div className="mt-3 flex justify-between text-xs opacity-60"><span>{source.observations} نتيجة</span><span>{source.durationMs}ms</span></div>
                {source.warnings[0] ? <p className="mt-3 text-xs leading-5 opacity-70">{source.warnings[0]}</p> : null}
              </div>
            ))}
          </section>

          {report.risk.factors.length ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
              <h2 className="mb-4 text-lg font-bold">عوامل المخاطر</h2>
              <div className="space-y-3">
                {report.risk.factors.map((factor) => (
                  <div key={factor.key} className="flex items-start justify-between gap-4 rounded-xl bg-[var(--muted)] p-4">
                    <div><div className="font-bold">{factor.labelAr}</div><div className="mt-1 text-xs leading-5 opacity-60">{factor.explanationAr}</div></div>
                    <div className="shrink-0 text-lg font-black">+{factor.points}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">الأدلة والوقائع</h2><p className="mt-1 text-sm opacity-60">كل نتيجة تحمل درجة تطابق وبصمة دليل مستقلة.</p></div>
              <div className="flex flex-wrap gap-2 text-xs">
                {categories.map(([category, count]) => <span key={category} className="rounded-full bg-[var(--muted)] px-3 py-1 font-semibold">{categoryLabels[category] || category}: {count}</span>)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-right text-sm">
                <thead><tr className="border-b border-[var(--border)] text-xs opacity-60"><th className="p-3">الواقعة</th><th className="p-3">الفئة</th><th className="p-3">التطابق</th><th className="p-3">التاريخ</th><th className="p-3">البصمة</th><th className="p-3">المصدر</th></tr></thead>
                <tbody>
                  {report.evidence.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--border)]/70 align-top">
                      <td className="p-3"><div className="font-bold">{item.title}</div><div className="mt-1 max-w-xl text-xs leading-5 opacity-60">{item.summary}</div></td>
                      <td className="p-3">{categoryLabels[item.category] || item.category}</td>
                      <td className="p-3"><div className="font-bold">{item.confidence}%</div><div className="text-xs opacity-60">{statusLabels[item.status]}</div></td>
                      <td className="p-3">{fmtDate(item.occurredAt)}</td>
                      <td className="p-3 font-mono text-[11px]" dir="ltr">{item.sha256.slice(0, 12)}…</td>
                      <td className="p-3">{result.demo ? <span className="text-xs font-semibold text-amber-700">تجريبي</span> : <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline">فتح <ExternalLink className="h-3 w-3" /></a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {report.rejected.length || report.needsReview.length ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <ReviewPanel title="نتائج مستبعدة" items={report.rejected} tone="red" />
              <ReviewPanel title="تحتاج مراجعة بشرية" items={report.needsReview} tone="amber" />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center gap-2 text-sm font-semibold opacity-60">{icon}{title}</div><div className="mt-4 text-4xl font-black">{value}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[var(--muted)] p-3"><div className="text-xs opacity-55">{label}</div><div className="mt-1 font-bold">{value}</div></div>;
}

function ReviewPanel({ title, items, tone }: { title: string; items: Evidence[]; tone: "red" | "amber" }) {
  const classes = tone === "red" ? "border-red-200 bg-red-50 text-red-950" : "border-amber-200 bg-amber-50 text-amber-950";
  return <div className={`rounded-2xl border p-5 ${classes}`}><h3 className="font-bold">{title} ({items.length})</h3><div className="mt-3 space-y-2">{items.map((item) => <div key={item.id} className="rounded-lg bg-white/60 p-3 text-sm"><div className="font-semibold">{item.title}</div><div className="mt-1 text-xs opacity-70">{[...item.rejectionReasons, ...item.matchReasons].join(" · ") || "يحتاج تحقق إضافي"}</div></div>)}</div></div>;
}
