// لوحة عدّادات النواة القانونية (HKM-023-A، ل٠-١ / ل٠-٢ / ل٠-٤).
// مكوّن خادم مستقل يقرأ legalMetricsService وحده، ليُضمّ إلى مركز القيادة /admin/legal بعد الدمج.
// كل عدّاد رابطٌ إلى طابوره المصفّى إن وُجد، و«لا ينطبق» و«غير متاح» لا يُعرضان صفرًا.
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { getLegalMetrics } from "@/lib/modules/legal-core/metrics-server";
import {
  formatMetricValue,
  METRIC_DEFINITIONS,
  metric as readMetric,
  type LegalMetricsSnapshot,
  type Metric,
  type MetricGroup,
  type MetricId,
} from "@/lib/modules/legal-core/metrics";

type Tone = "navy" | "emerald" | "amber" | "muted";

function toneOf(m: Metric): Tone {
  if (m.value.kind !== "count") return "muted";
  if (m.tone === "neutral") return "navy";
  if (m.tone === "attention") return m.value.value > 0 ? "amber" : "emerald";
  return m.value.value > 0 ? "emerald" : "amber";
}

const TONE_TEXT: Record<Tone, string> = {
  navy: "text-[var(--navy)]",
  emerald: "text-[var(--emerald)]",
  amber: "text-[var(--amber)]",
  muted: "text-[var(--ink-60)]",
};

function stateLine(m: Metric): string {
  if (m.value.kind !== "count") return m.value.reason;
  if (m.queue) return m.queue.label;
  return "لا طابور بعد";
}

function ariaLabel(m: Metric): string {
  const value = formatMetricValue(m.value);
  return m.queue ? `${m.label}: ${value}. افتح ${m.queue.label}` : `${m.label}: ${value}`;
}

/** بطاقة عدّاد واحد. رابط إلى الطابور إن وُجد. */
export function MetricTile({ metric: m }: { metric: Metric }) {
  const tone = toneOf(m);
  const body = (
    <>
      <p className="font-display-ar text-xs font-semibold leading-5 text-[var(--ink-60)]">{m.label}</p>
      <p className={`mt-2 font-judicial font-bold leading-none ${m.value.kind === "count" ? "text-3xl" : "text-xl"} ${TONE_TEXT[tone]}`}>
        {m.value.kind === "count" ? formatMetricValue(m.value) : <span>{m.value.kind === "unavailable" ? "— " : ""}{formatMetricValue(m.value)}</span>}
      </p>
      <p className="mt-2 flex items-center gap-1 text-xs leading-5 text-[var(--ink-60)]">
        {m.queue && m.value.kind === "count" ? <ArrowUpLeft size={13} aria-hidden className="shrink-0 text-[var(--gold)]" /> : null}
        <span>{stateLine(m)}</span>
      </p>
    </>
  );
  const base = "block h-full rounded-[var(--r-lg)] border bg-[var(--paper)] p-4 shadow-[var(--sh-xs)]";
  return m.queue ? (
    <Link
      href={m.queue.href}
      aria-label={ariaLabel(m)}
      title={m.definition}
      className={`${base} border-[var(--ink-08)] transition hover:border-[var(--gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]`}
    >
      {body}
    </Link>
  ) : (
    <div className={`${base} border-[var(--ink-08)]`} title={m.definition}>
      {body}
    </div>
  );
}

/** صف عدّاد مضغوط (لقوائم الجودة). */
export function MetricRow({ metric: m }: { metric: Metric }) {
  const tone = toneOf(m);
  const inner = (
    <>
      <span className="font-display-ar text-sm font-semibold text-[var(--navy)]">{m.label}</span>
      <span className="flex items-center gap-2">
        <span className={`${m.value.kind === "count" ? "font-mono-legal" : "font-display-ar"} text-sm ${TONE_TEXT[tone]}`}>{formatMetricValue(m.value)}</span>
        {m.queue && m.value.kind === "count" ? <ArrowUpLeft size={14} aria-hidden className="text-[var(--gold)]" /> : null}
      </span>
    </>
  );
  const base = "flex min-h-[48px] items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)] p-4";
  return m.queue ? (
    <Link href={m.queue.href} aria-label={ariaLabel(m)} title={m.definition} className={`${base} transition hover:border-[var(--gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]`}>
      {inner}
    </Link>
  ) : (
    <div className={base} title={m.definition}>
      {inner}
    </div>
  );
}

/** تعريفات المقاييس المعروضة (مكتوبة، قابلة للطيّ). */
export function MetricDefinitions({ ids, snapshot }: { ids: readonly MetricId[]; snapshot: LegalMetricsSnapshot }) {
  return (
    <details className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4 text-sm">
      <summary className="cursor-pointer font-display-ar font-semibold text-[var(--navy)]">تعريفات العدّادات ومصدرها</summary>
      <dl className="mt-3 space-y-3">
        {ids.map((id) => {
          const m = snapshot.metrics[id];
          const def = METRIC_DEFINITIONS[id];
          return (
            <div key={id}>
              <dt className="font-semibold text-[var(--navy)]">{def.label}</dt>
              <dd className="leading-7 text-[var(--ink-70)]">
                {def.definition}
                {m && m.value.kind !== "count" ? <span className="block text-[var(--ink-60)]">الحالة: {formatMetricValue(m.value)} — {m.value.reason}</span> : null}
                {!def.queue && "queueNote" in def && def.queueNote ? <span className="block text-[var(--ink-60)]">{def.queueNote}</span> : null}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-xs text-[var(--ink-60)]">
        قُرئت في {new Date(snapshot.generatedAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} — خدمة العدّ الموحدة (legalMetricsService).
      </p>
    </details>
  );
}

const PANEL_SECTIONS: Array<{ group: MetricGroup; title: string; ids: MetricId[] }> = [
  { group: "systems", title: "الأنظمة", ids: ["systems.total", "systems.unclassified", "systems.noIssuanceDate", "systems.unverifiedStatus"] },
  {
    group: "articles",
    title: "المواد",
    ids: ["articles.total", "articles.needsReview", "articles.noClassification", "articles.noKeywords", "articles.noChapter", "articles.noRelations", "articles.decreeFilled"],
  },
  { group: "judgments", title: "الأحكام", ids: ["judgments.total", "judgments.linked", "judgments.unlinked"] },
  { group: "citations", title: "الاستشهادات", ids: ["citations.total", "citations.pending", "citations.verified", "citations.rejected"] },
  { group: "principles", title: "المبادئ", ids: ["principles.total", "principles.reviewed", "principles.pending", "principles.rejected"] },
  { group: "issues", title: "المسائل القانونية", ids: ["issues.total", "issues.linked", "issues.needsReview", "issues.uncodified"] },
  { group: "explanations", title: "الشروح", ids: ["explanations.total", "explanations.withoutSource"] },
  { group: "fiqh", title: "الطبقة الفقهية", ids: ["fiqh.sources", "fiqh.texts", "fiqh.alignmentsPending"] },
];

/**
 * لوحة العدّادات كاملة أو لمجموعات بعينها. تقرأ اللقطة بنفسها إن لم تُمرَّر.
 * الاستعمال المقترح في /admin/legal بعد الدمج: `<LegalMetricsPanel />`.
 */
export async function LegalMetricsPanel({
  snapshot,
  groups,
  title = "عدّادات المحتوى القانوني",
}: {
  snapshot?: LegalMetricsSnapshot;
  groups?: readonly MetricGroup[];
  title?: string;
}) {
  const sections = PANEL_SECTIONS.filter((s) => !groups || groups.includes(s.group));
  const data = snapshot ?? (await getLegalMetrics(sections.map((s) => s.group)));
  const shown = sections.filter((s) => data.groups.includes(s.group));
  return (
    <section aria-labelledby="legal-metrics-title" className="space-y-5">
      <h2 id="legal-metrics-title" className="font-display-ar text-lg font-bold text-[var(--navy)]">
        {title}
      </h2>
      {shown.map((s) => (
        <div key={s.group}>
          <h3 className="mb-2 flex items-center gap-2 font-display-ar text-sm font-bold text-[var(--navy)]">
            <span className="h-4 w-1 rounded bg-[var(--gold)]" aria-hidden />
            {s.title}
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {s.ids.map((id) => (
              <MetricTile key={id} metric={readMetric(data, id)} />
            ))}
          </div>
        </div>
      ))}
      <MetricDefinitions ids={shown.flatMap((s) => s.ids)} snapshot={data} />
    </section>
  );
}
