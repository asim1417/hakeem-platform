// بطاقات الشات القضائي — عرض فقط (presentational). تُستهلك داخل واجهة العميل.
import type {
  ArbitrationView,
  ArgumentMapRow,
  ChatCard,
  ContractReview,
  DocAnalysis,
  EvidencePlanRow,
  ExplainView,
  JudgeView,
  LegalConfidenceScore,
  LegalIssue,
  LegalOutput,
  OpponentRow,
  SimulationCaseFile,
  StrategyRow,
  TimelineEvent,
  UnderstandingCard,
  WorkflowRunView,
} from "@/lib/modules/legal-chat/types";

const PROVENANCE_LABELS: Record<string, string> = {
  USER_MESSAGE: "من رسالتك",
  UPLOADED_FILE: "من ملف مرفوع",
  LEGAL_CORE: "من النواة القانونية",
  SYSTEM_ASSUMPTION: "افتراض النظام",
  NEEDS_CONFIRMATION: "يحتاج تأكيداً",
};

function CardShell({ tone, title, children }: { tone?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-white p-4 shadow-[var(--sh-xs)]">
      <div className="mb-2 flex items-center gap-2">
        <span className="t-head text-sm font-bold" style={{ color: tone ?? "var(--navy)" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

export function UnderstandingCardView({
  card,
  onOption,
  disabled,
}: {
  card: UnderstandingCard;
  onOption: (key: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-[var(--r-xl)] border-2 border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="t-head text-sm font-bold text-[var(--navy)]">🧭 فهم الطلب</span>
        <span className="rounded-full bg-[var(--navy)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
          {card.understandingLabel}
        </span>
        <span className="rounded-full border border-[var(--gold-border)] bg-white px-2.5 py-0.5 text-[11px] tabular-nums text-[var(--navy)]">
          الثقة {Math.round(card.confidence * 100)}%
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        <Row label="صفتك" value={card.userRoleLabel} />
        <Row label="نوع النزاع" value={card.disputeTypeLabel} />
        <Row label="المسار" value={card.trackLabel} />
        <Row label="المرحلة" value={card.stageLabel} />
        <Row label="المطلوب" value={card.requestedOutputLabel} />
        <Row label="المستندات" value={card.documentsNote} />
      </dl>

      {card.missingInfo.length > 0 && (
        <div className="mt-3 rounded-[var(--r-lg)] border border-[rgba(184,114,26,.25)] bg-[var(--amber-soft)] p-3">
          <p className="text-xs font-semibold text-[var(--amber)]">النواقص المؤثّرة:</p>
          <ul className="mt-1 list-disc space-y-0.5 pe-5 text-xs leading-6 text-[var(--ink-80)]">
            {card.missingInfo.map((m, i) => (
              <li key={i}>
                {m.label}
                {m.critical ? <span className="text-[var(--ruby)]"> (مؤثّر)</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-semibold text-[var(--navy)]">المسار المقترح:</p>
        <ol className="mt-1 list-decimal space-y-0.5 pe-5 text-xs leading-6 text-[var(--ink-60)]">
          {card.proposedPath.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      {card.blockReason && (
        <p className="mt-3 rounded-[var(--r-md)] bg-white p-2 text-xs leading-6 text-[var(--ruby)]">{card.blockReason}</p>
      )}

      <p className="mt-3 text-sm font-semibold text-[var(--navy)]">{card.question}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {card.options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={() => onOption(opt.key)}
            className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              opt.key === "CONFIRM"
                ? "border-[var(--emerald)] bg-[var(--emerald)] text-white hover:opacity-90"
                : opt.key === "DRAFT_WITH_ASSUMPTIONS"
                  ? "border-[var(--gold)] bg-white text-[var(--navy)] hover:bg-[var(--gold-ghost)]"
                  : "border-[var(--ink-15)] bg-white text-[var(--ink-80)] hover:border-[var(--navy)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CaseFileCardView({ file }: { file: SimulationCaseFile }) {
  const statusLabel = file.status === "READY" ? "جاهز للمحاكاة" : file.status === "INCOMPLETE" ? "ناقص" : "مسودة";
  return (
    <CardShell title="🗂️ ملف القضية">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full bg-[var(--navy)] px-2 py-0.5 font-semibold text-white">{statusLabel}</span>
        {file.claimValue && (
          <span className="rounded-full border border-[var(--ink-15)] px-2 py-0.5 tabular-nums text-[var(--ink-60)]">
            قيمة المطالبة: {file.claimValue}
          </span>
        )}
        {file.hasArbitrationClause !== null && (
          <span className="rounded-full border border-[var(--ink-15)] px-2 py-0.5 text-[var(--ink-60)]">
            شرط تحكيم: {file.hasArbitrationClause ? "نعم" : "لا"}
          </span>
        )}
      </div>
      <p className="text-sm leading-7 text-[var(--ink-80)]">{file.summary}</p>
      {file.facts.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-[var(--navy)]">الوقائع:</p>
          <ul className="mt-1 space-y-0.5 text-xs leading-6 text-[var(--ink-80)]">
            {file.facts.slice(0, 8).map((f, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" />
                <span>
                  {f.text}{" "}
                  <span className="text-[10px] text-[var(--ink-40)]">— {PROVENANCE_LABELS[f.provenance] ?? ""}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {file.claims && <KeyVal label="الطلبات" value={file.claims} />}
      {file.defenses && <KeyVal label="الدفوع" value={file.defenses} />}
    </CardShell>
  );
}

export function OutputCardView({ output, onCopy }: { output: LegalOutput; onCopy: (text: string) => void }) {
  const reviewLabel: Record<string, string> = {
    AUTO_DRAFT: "مسودة آلية",
    NEEDS_REVIEW: "يحتاج مراجعة",
    REVIEWED: "تمت مراجعته",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    NEEDS_INFO: "يحتاج معلومات",
  };
  const fullText = output.sections.map((s) => `${s.heading}\n${s.body}`).join("\n\n");
  return (
    <CardShell tone="var(--gold-dark)" title={`📄 ${output.title}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full bg-[var(--amber-soft)] px-2 py-0.5 font-semibold text-[var(--amber)]">
          {reviewLabel[output.reviewState] ?? output.reviewState}
        </span>
        {output.isDraftWithAssumptions && (
          <span className="rounded-full bg-[var(--gold-ghost)] px-2 py-0.5 font-semibold text-[var(--navy)]">مسودة مع افتراضات</span>
        )}
      </div>

      {output.assumptions.length > 0 && (
        <div className="mb-3 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-2">
          <p className="text-xs font-semibold text-[var(--navy)]">الافتراضات الظاهرة:</p>
          <ul className="mt-1 list-disc space-y-0.5 pe-5 text-xs leading-6 text-[var(--ink-80)]">
            {output.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {output.sections.map((s, i) => (
          <div key={i} className="border-r-2 border-[var(--gold-border)] pe-3">
            <p className="text-sm font-bold text-[var(--navy)]">{i + 1}. {s.heading}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-80)]">{s.body}</p>
          </div>
        ))}
      </div>

      {output.sources.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--navy)]">الأساس النظامي (من النواة):</p>
          <ul className="mt-1 space-y-0.5 text-xs leading-6 text-[var(--ink-80)]">
            {output.sources.slice(0, 8).map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="rounded bg-[var(--gold-ghost)] px-1.5 py-0.5 text-[10px] text-[var(--gold-dark)]">مادة</span>
                <span>{s.reference}</span>
                {!s.explicit && <span className="text-[10px] text-[var(--amber)]">(يحتاج تحققاً)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {output.nextBestActions.length > 0 && (
        <div className="mt-3 rounded-[var(--r-lg)] bg-[var(--emerald-soft)] p-2">
          <p className="text-xs font-semibold text-[var(--emerald)]">الخطوة التالية الأفضل:</p>
          <ul className="mt-1 list-disc space-y-0.5 pe-5 text-xs leading-6 text-[var(--ink-80)]">
            {output.nextBestActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCopy(`${output.title}\n\n${fullText}`)}
          className="focus-ring rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--navy)]"
        >
          نسخ المخرج
        </button>
        <a
          href={`data:application/msword;charset=utf-8,${encodeURIComponent(`<html dir="rtl"><meta charset="utf-8"><body><h2>${output.title}</h2>${output.sections
            .map((s) => `<h3>${s.heading}</h3><p>${s.body.replace(/\n/g, "<br/>")}</p>`)
            .join("")}<hr/><p><em>${output.governanceNotes[0] ?? ""}</em></p></body></html>`)}`}
          download={`${output.title}.doc`}
          className="focus-ring rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--navy)]"
        >
          تصدير Word
        </a>
      </div>
    </CardShell>
  );
}

export function EvidencePlanCardView({ rows }: { rows: EvidencePlanRow[] }) {
  return (
    <CardShell title="🔎 خطة الإثبات">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--ink-15)] text-right text-[var(--ink-60)]">
              {["الواقعة", "المكلّف بالإثبات", "الدليل الحالي", "قوته", "النقص", "الإجراء المقترح", "الأثر"].map((h) => (
                <th key={h} className="p-1.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--ink-08)] align-top text-[var(--ink-80)]">
                <td className="p-1.5">{r.fact}</td>
                <td className="p-1.5">{r.burdenOn}</td>
                <td className="p-1.5">{r.currentEvidence}</td>
                <td className="p-1.5">{r.strength}</td>
                <td className="p-1.5">{r.gap}</td>
                <td className="p-1.5">{r.suggestedAction}</td>
                <td className="p-1.5">{r.impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

export function ArgumentMapCardView({ rows }: { rows: ArgumentMapRow[] }) {
  return (
    <CardShell title="⚖️ خريطة الحجج">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--ink-15)] text-right text-[var(--ink-60)]">
              {["المسألة", "حجتك", "دليلها", "دفع الخصم", "الرد", "التقييم"].map((h) => (
                <th key={h} className="p-1.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--ink-08)] align-top text-[var(--ink-80)]">
                <td className="p-1.5">{r.issue}</td>
                <td className="p-1.5">{r.userArgument}</td>
                <td className="p-1.5">{r.userEvidence}</td>
                <td className="p-1.5">{r.opponentArgument}</td>
                <td className="p-1.5">{r.response}</td>
                <td className="p-1.5">{r.assessment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

export function TimelineCardView({ events }: { events: TimelineEvent[] }) {
  return (
    <CardShell title="🕰️ الخط الزمني">
      <ul className="space-y-1.5 text-xs">
        {events.map((e, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="rounded bg-[var(--navy)] px-1.5 py-0.5 font-mono-legal text-[10px] text-white">{e.date}</span>
            <span className="text-[var(--ink-80)]">
              {e.event} <span className="text-[var(--ink-40)]">— {e.legalEffect}</span>
            </span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function IssuesCardView({ issues }: { issues: LegalIssue[] }) {
  return (
    <CardShell title="📌 قائمة المسائل محل النزاع">
      <ol className="list-decimal space-y-2 pe-5 text-xs leading-6 text-[var(--ink-80)]">
        {issues.map((it, i) => (
          <li key={i}>
            <span className="font-semibold text-[var(--navy)]">{it.issue}</span>
            <div className="text-[var(--ink-60)]">السند: {it.basisNote} · النتيجة المحتملة: {it.probableOutcome}</div>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

export function ConfidenceCardView({ score }: { score: LegalConfidenceScore }) {
  return (
    <CardShell title="📊 درجة الثقة القانونية">
      <div className="mb-2 flex items-center gap-2">
        <span className="t-display text-2xl font-bold text-[var(--navy)] tabular-nums">{score.overall}%</span>
        <span className="text-xs text-[var(--ink-60)]">{score.verdict}</span>
      </div>
      <div className="space-y-1">
        {score.factors.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 text-[var(--ink-60)]">{f.element}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ink-08)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${f.score}%`, background: f.score >= 70 ? "var(--emerald)" : f.score >= 50 ? "var(--gold)" : "var(--amber)" }}
              />
            </div>
            <span className="w-10 shrink-0 text-left tabular-nums text-[var(--ink-60)]">{f.score}%</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function GovernanceCardView({ notes }: { notes: string[] }) {
  return (
    <div className="rounded-[var(--r-lg)] border border-[rgba(184,114,26,.25)] bg-[var(--amber-soft)] p-3">
      <p className="text-xs font-semibold text-[var(--amber)]">⚠️ تنبيهات الحوكمة</p>
      <ul className="mt-1 list-disc space-y-0.5 pe-5 text-xs leading-6 text-[var(--ink-80)]">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

const STRENGTH_TONE: Record<string, string> = {
  STRONG: "var(--ruby)",
  MEDIUM: "var(--amber)",
  WEAK: "var(--emerald)",
};

export function OpponentCardView({ rows }: { rows: OpponentRow[] }) {
  return (
    <CardShell tone="var(--ruby)" title="🥊 الخصم الافتراضي — الدفوع المتوقّعة">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--ink-15)] text-right text-[var(--ink-60)]">
              {["الدفع المتوقّع", "قوته", "السبب", "الرد المقترح", "المستند المطلوب"].map((h) => (
                <th key={h} className="p-1.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--ink-08)] align-top text-[var(--ink-80)]">
                <td className="p-1.5">{r.expectedDefense}</td>
                <td className="p-1.5">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: STRENGTH_TONE[r.strength] }}>
                    {r.strength === "STRONG" ? "قوي" : r.strength === "MEDIUM" ? "متوسط" : "ضعيف"}
                  </span>
                </td>
                <td className="p-1.5">{r.reason}</td>
                <td className="p-1.5">{r.suggestedResponse}</td>
                <td className="p-1.5">{r.requiredDocument}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

export function JudgeCardView({ judge }: { judge: JudgeView }) {
  return (
    <CardShell tone="var(--navy)" title="👨‍⚖️ القاضي الافتراضي (تدريبي)">
      <KeyVal label="تحرير محل النزاع" value={judge.disputeSubject} />
      <KeyVal label="عبء الإثبات" value={judge.burdenOfProof} />
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <MiniList title="الوقائع المنتِجة" items={judge.materialFacts} />
        <MiniList title="أسئلة القاضي" items={judge.judgeQuestions} />
        <MiniList title="النواقص قبل القفل" items={judge.gapsBeforeClosing} tone="var(--amber)" />
        <MiniList title="مسودة الأسباب" items={judge.draftReasoning} ordered />
      </div>
      <div className="mt-2 rounded-[var(--r-md)] bg-[var(--gold-ghost)] p-2 text-xs">
        <b className="text-[var(--navy)]">صالحة للحكم؟</b>{" "}
        <span style={{ color: judge.readyForJudgment ? "var(--emerald)" : "var(--amber)" }}>
          {judge.readyForJudgment ? "نعم مبدئياً" : "لا"}
        </span>{" "}
        — {judge.readinessReason}
        <p className="mt-1 text-[var(--ink-80)]"><b>المنطوق المحتمل:</b> {judge.draftRuling}</p>
      </div>
      <p className="mt-2 text-[11px] text-[var(--amber)]">{judge.disclaimer}</p>
    </CardShell>
  );
}

export function ArbitrationCardView({ a }: { a: ArbitrationView }) {
  return (
    <CardShell tone="var(--navy)" title="⚖️ المحكّم الافتراضي">
      <KeyVal label="اتفاق التحكيم" value={a.agreementCheck} />
      <KeyVal label="نطاق الشرط" value={a.scope} />
      <KeyVal label="تشكيل الهيئة" value={a.tribunalFormation} />
      <KeyVal label="الاختصاص" value={a.jurisdiction} />
      <KeyVal label="النظام الواجب التطبيق" value={a.applicableLaw} />
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <MiniList title="الإجراءات" items={a.procedure} ordered />
        <MiniList title="الأمر الإجرائي / المواعيد" items={a.proceduralOrder} />
        <MiniList title="المسائل محل الفصل" items={a.issues} />
      </div>
      <KeyVal label="مسودة حكم التحكيم" value={a.draftAwardNote} />
      <p className="mt-2 text-[11px] text-[var(--amber)]">{a.disclaimer}</p>
    </CardShell>
  );
}

export function ContractReviewCardView({ c }: { c: ContractReview }) {
  if (!c.hasContent) {
    return (
      <CardShell tone="var(--gold-dark)" title="📑 مراجعة العقد">
        <p className="text-xs leading-6 text-[var(--ink-60)]">{c.summary}</p>
      </CardShell>
    );
  }
  return (
    <CardShell tone="var(--gold-dark)" title="📑 مراجعة العقد">
      <p className="text-sm leading-7 text-[var(--ink-80)]">{c.summary}</p>
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {c.term && <Row label="المدة" value={c.term} />}
        {c.consideration && <Row label="المقابل" value={c.consideration} />}
        {c.penaltyClause && <Row label="الشرط الجزائي" value={c.penaltyClause} />}
        {c.arbitrationClause && <Row label="شرط التحكيم" value={c.arbitrationClause} />}
        {c.termination && <Row label="الفسخ" value={c.termination} />}
        {c.jurisdiction && <Row label="الاختصاص" value={c.jurisdiction} />}
      </div>
      {c.parties.length > 0 && <MiniList title="الأطراف" items={c.parties} />}
      {c.obligations.length > 0 && <MiniList title="الالتزامات" items={c.obligations} />}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--ink-15)] text-right text-[var(--ink-60)]">
              {["البند", "النص", "الخطر", "الأثر", "التوصية"].map((h) => (
                <th key={h} className="p-1.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--ink-08)] align-top text-[var(--ink-80)]">
                <td className="p-1.5 font-semibold text-[var(--navy)]">{r.clause}</td>
                <td className="p-1.5">{r.text}</td>
                <td className="p-1.5 text-[var(--ruby)]">{r.risk}</td>
                <td className="p-1.5">{r.impact}</td>
                <td className="p-1.5 text-[var(--emerald)]">{r.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {c.risks.length > 0 && <MiniList title="المخاطر" items={c.risks} tone="var(--ruby)" />}
    </CardShell>
  );
}

export function DocAnalysisCardView({ d }: { d: DocAnalysis }) {
  return (
    <CardShell title="🗃️ تحليل المستندات">
      <div className="space-y-2">
        {d.items.map((it, i) => (
          <div key={i} className="rounded-[var(--r-md)] border border-[var(--ink-08)] p-2 text-xs">
            <p className="font-semibold text-[var(--navy)]">📎 {it.name} <span className="text-[10px] text-[var(--ink-40)]">({it.kind})</span></p>
            <p className="mt-1 text-[var(--ink-80)]">{it.summary}</p>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
              {it.parties.map((p, k) => <Tag key={`p${k}`}>{p}</Tag>)}
              {it.dates.map((p, k) => <Tag key={`d${k}`} tone="var(--navy)">{p}</Tag>)}
              {it.amounts.map((p, k) => <Tag key={`a${k}`} tone="var(--emerald)">{p}</Tag>)}
            </div>
          </div>
        ))}
      </div>
      {d.conflicts.length > 0 && <MiniList title="تعارضات" items={d.conflicts} tone="var(--ruby)" />}
      {d.missing.length > 0 && <MiniList title="نواقص" items={d.missing} tone="var(--amber)" />}
    </CardShell>
  );
}

export function StrategiesCardView({ rows }: { rows: StrategyRow[] }) {
  return (
    <CardShell title="🧭 مقارنة الاستراتيجيات">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--ink-15)] text-right text-[var(--ink-60)]">
              {["الاستراتيجية", "المزايا", "المخاطر", "المتطلبات", "التقييم"].map((h) => (
                <th key={h} className="p-1.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--ink-08)] align-top text-[var(--ink-80)]">
                <td className="p-1.5 font-semibold text-[var(--navy)]">{r.strategy}</td>
                <td className="p-1.5 text-[var(--emerald)]">{r.advantages}</td>
                <td className="p-1.5 text-[var(--ruby)]">{r.risks}</td>
                <td className="p-1.5">{r.requirements}</td>
                <td className="p-1.5">{r.assessment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

export function ExplainCardView({ e }: { e: ExplainView }) {
  return (
    <CardShell title="💡 لماذا وصلتُ لهذه النتيجة">
      <div className="grid gap-3 md:grid-cols-2">
        <MiniList title="الوقائع المعتمدة" items={e.facts} />
        <MiniList title="المصادر" items={e.sources} />
        <MiniList title="الافتراضات" items={e.assumptions} tone="var(--amber)" />
        <MiniList title="أسباب الترجيح" items={e.reasons} ordered />
      </div>
      <MiniList title="ما قد يغيّر النتيجة" items={e.whatWouldChange} tone="var(--navy)" />
      <p className="mt-1 text-[11px] text-[var(--ink-60)]">درجة الثقة في الفهم: {Math.round(e.confidence * 100)}%</p>
    </CardShell>
  );
}

export function WorkflowCardView({ w }: { w: WorkflowRunView }) {
  return (
    <CardShell tone="var(--emerald)" title={`🔁 ${w.name}`}>
      <p className="text-xs leading-6 text-[var(--ink-60)]">{w.purpose}</p>
      <ol className="mt-2 space-y-1 text-xs">
        {w.steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={s.done ? "text-[var(--emerald)]" : "text-[var(--ink-40)]"}>{s.done ? "✓" : "○"}</span>
            <span className="text-[var(--ink-80)]">{s.title} <span className="text-[10px] text-[var(--ink-40)]">— {s.detail}</span></span>
          </li>
        ))}
      </ol>
      {w.missingInputs.length > 0 && <MiniList title="مدخلات ناقصة" items={w.missingInputs} tone="var(--amber)" />}
      <p className="mt-2 rounded-[var(--r-md)] bg-[var(--emerald-soft)] p-2 text-xs text-[var(--emerald)]">
        الخطوة التالية: {w.nextStep}{w.reviewRequired ? " · يتطلب مراجعة بشرية قبل الاعتماد" : ""}
      </p>
    </CardShell>
  );
}

function MiniList({ title, items, ordered, tone }: { title: string; items: string[]; ordered?: boolean; tone?: string }) {
  if (!items.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold" style={{ color: tone ?? "var(--navy)" }}>{title}:</p>
      <Tag className={`mt-1 ${ordered ? "list-decimal" : "list-disc"} space-y-0.5 pe-5 text-xs leading-6 text-[var(--ink-80)]`}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </Tag>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-white" style={{ background: tone ?? "var(--gold-dark)" }}>
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="shrink-0 font-semibold text-[var(--navy)]">{label}:</span>
      <span className="text-[var(--ink-80)]">{value}</span>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-[var(--navy)]">{label}:</p>
      <p className="text-xs leading-6 text-[var(--ink-80)]">{value}</p>
    </div>
  );
}

/** يوزّع البطاقة على العارض المناسب. */
export function ChatCardRenderer({
  card,
  onOption,
  onCopy,
  optionsDisabled,
}: {
  card: ChatCard;
  onOption: (key: string) => void;
  onCopy: (text: string) => void;
  optionsDisabled: boolean;
}) {
  switch (card.type) {
    case "UNDERSTANDING":
      return card.understanding ? <UnderstandingCardView card={card.understanding} onOption={onOption} disabled={optionsDisabled} /> : null;
    case "CASE_FILE":
      return card.caseFile ? <CaseFileCardView file={card.caseFile} /> : null;
    case "OUTPUT":
      return card.output ? <OutputCardView output={card.output} onCopy={onCopy} /> : null;
    case "EVIDENCE_PLAN":
      return card.evidencePlan ? <EvidencePlanCardView rows={card.evidencePlan} /> : null;
    case "ARGUMENT_MAP":
      return card.argumentMap ? <ArgumentMapCardView rows={card.argumentMap} /> : null;
    case "TIMELINE":
      return card.timeline ? <TimelineCardView events={card.timeline} /> : null;
    case "ISSUES":
      return card.issues ? <IssuesCardView issues={card.issues} /> : null;
    case "CONFIDENCE":
      return card.confidence ? <ConfidenceCardView score={card.confidence} /> : null;
    case "OPPONENT":
      return card.opponent ? <OpponentCardView rows={card.opponent} /> : null;
    case "JUDGE_VIEW":
      return card.judge ? <JudgeCardView judge={card.judge} /> : null;
    case "ARBITRATION_VIEW":
      return card.arbitration ? <ArbitrationCardView a={card.arbitration} /> : null;
    case "CONTRACT_REVIEW":
      return card.contractReview ? <ContractReviewCardView c={card.contractReview} /> : null;
    case "DOC_ANALYSIS":
      return card.docAnalysis ? <DocAnalysisCardView d={card.docAnalysis} /> : null;
    case "COMPARE_STRATEGIES":
      return card.strategies ? <StrategiesCardView rows={card.strategies} /> : null;
    case "EXPLAIN":
      return card.explain ? <ExplainCardView e={card.explain} /> : null;
    case "WORKFLOW":
      return card.workflow ? <WorkflowCardView w={card.workflow} /> : null;
    case "GOVERNANCE":
      return card.governance ? <GovernanceCardView notes={card.governance} /> : null;
    default:
      return null;
  }
}
