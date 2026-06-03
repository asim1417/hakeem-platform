import type { ReactNode } from "react";
import { stageLabel } from "@/lib/modules/simulations/simulation-labels";

export function LegalCard({ title, eyebrow, children, className = "" }: { title?: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {eyebrow ? <p className="t-display text-xs font-semibold text-[var(--gold)]">{eyebrow}</p> : null}
      {title ? <h2 className="card-title">{title}</h2> : null}
      <div className={title || eyebrow ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function GoldButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`btn btn-gold disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ""}`} />;
}

export function NavyButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`btn btn-primary disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ""}`} />;
}

export function LegalAlert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  const cls = {
    info: "border-[var(--gold-border)] bg-[var(--gold-ghost)] text-[var(--navy)]",
    success: "border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] text-[var(--emerald)]",
    warning: "border-[rgba(184,114,26,.25)] bg-[var(--amber-soft)] text-[var(--amber)]",
    danger: "border-[rgba(140,34,51,.25)] bg-[var(--ruby-soft)] text-[var(--ruby)]"
  }[tone];
  return <p className={`rounded-[var(--r-md)] border p-4 leading-7 ${cls}`}>{children}</p>;
}

export function LegalPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="hero">
      {eyebrow ? <p className="t-display text-sm text-[var(--gold-pale)]">{eyebrow}</p> : null}
      <h1 className="t-head mt-2 text-5xl font-bold">{title}</h1>
      {description ? <p className="mt-4 max-w-3xl leading-8 text-white/80">{description}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function LegalEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-6 text-center">
      <p className="t-display font-bold text-[var(--navy)]">{title}</p>
      {description ? <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">{description}</p> : null}
    </div>
  );
}

export function LegalStatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-card">
      <p className="stat-lbl">{label}</p>
      <p className="stat-val">{value}</p>
      {hint ? <p className="stat-sub mt-2">{hint}</p> : null}
    </div>
  );
}

export function LegalFormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white/80 p-5">
      <h2 className="t-display text-lg font-bold text-[var(--navy)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function LegalBadge({ status }: { status: string }) {
  return <span className="inline-flex items-center rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-1 text-xs font-semibold text-[var(--navy)]">{status}</span>;
}

export function StageTracker({ currentStage }: { currentStage: string }) {
  const stages = ["CLAIM_FILING", "INITIAL_ADMISSIBILITY", "HEARING_RECORD", "PLEADING", "PLAINTIFF_STATEMENT", "DEFENDANT_RESPONSE", "PROCEDURAL_DECISION", "SETTLEMENT", "CLOSE_PLEADING", "TRAINING_JUDGMENT"];
  const currentIndex = Math.max(0, stages.indexOf(currentStage));
  return (
    <div className="workflow-wrap">
      <div className="wf-track">
        {stages.map((stage, index) => (
          <div className="contents" key={stage}>
            <div className={`wf-step ${index < currentIndex ? "done" : index === currentIndex ? "cur" : ""}`}>
              <div className="wf-circle">{index < currentIndex ? "✓" : (index + 1).toLocaleString("ar-SA")}</div>
              <div className="wf-label">{stageLabel(stage)}</div>
            </div>
            {index < stages.length - 1 ? <div className={`wf-conn ${index < currentIndex ? "done" : ""}`} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HearingMessage({ role, content, createdAt, stage }: { role: string; content: string; createdAt: string; stage: string }) {
  const cls = role.includes("قاضي") ? "judge" : role.includes("مدعي") && !role.includes("مدعى عليه") ? "plaintiff" : role.includes("مدعى عليه") ? "defendant" : "system";
  return (
    <article className={`msg ${cls}`}>
      <div className="msg-avatar">{role.slice(0, 2)}</div>
      <div className="msg-body">
        <div className="msg-sender">{role} · {stageLabel(stage)}</div>
        <div className="msg-bubble">{content}</div>
        <div className="msg-time">{new Date(createdAt).toLocaleString("ar-SA")}</div>
      </div>
    </article>
  );
}

export function JudgmentDocument({ content, disclaimer }: { content: string; disclaimer: string }) {
  return (
    <article className="verdict-doc">
      <div className="vd-court">
        <h2>مسودة حكم قضائي مسبب</h2>
        <p>مولدة داخل بيئة القاضي حكيم وفق بنية قضائية تدريبية</p>
      </div>
      <div className="vd-meta">
        <span><strong>المنصة:</strong> حكيم</span>
        <span><strong>تاريخ العرض:</strong> {new Date().toLocaleString("ar-SA")}</span>
      </div>
      <div className="vd-basmala">بسم الله الرحمن الرحيم</div>
      <div className="vd-section">
        <pre>{content}</pre>
      </div>
      <div className="vd-disclaimer">{disclaimer}</div>
      <div className="vd-sign">القاضي حكيم - قاض افتراضي تدريبي</div>
    </article>
  );
}

export function HearingRecordDocument({ content }: { content: string }) {
  return (
    <article className="hearing-doc">
      <div className="vd-basmala">بسم الله الرحمن الرحيم</div>
      <div className="vd-court">
        <h2>ضبط جلسة</h2>
        <p>منصة حكيم - محضر محاكاة قضائية</p>
      </div>
      <div className="vd-section">
        <pre>{content}</pre>
      </div>
      <div className="vd-disclaimer">هذا الضبط مولد لأغراض المحاكاة والتدريب، ولا يعد ضبطًا صادرًا من جهة قضائية.</div>
    </article>
  );
}

export function ClaimSheetCard({ claim }: { claim?: Record<string, string> }) {
  if (!claim) return <LegalEmptyState title="لم يتم تقييد صحيفة دعوى بعد." />;
  const rows = [
    ["نوع الدعوى", claim.caseType],
    ["المدعي", `${claim.plaintiffName || ""} - ${claim.plaintiffCapacity || ""}`],
    ["المدعى عليه", `${claim.defendantName || ""} - ${claim.defendantCapacity || ""}`],
    ["موضوع الدعوى", claim.subject],
    ["الوقائع", claim.facts],
    ["الطلبات", claim.requests],
    ["مبلغ المطالبة", claim.claimAmount],
    ["الأسانيد", claim.legalGrounds],
    ["الدفوع", claim.defenses],
    ["الحضور والوكالة", claim.attendance]
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-white/70 p-3">
          <p className="t-display text-sm font-bold text-[var(--navy)]">{label}</p>
          <p className="mt-1 whitespace-pre-wrap leading-7 text-[var(--ink-80)]">{value || "غير محدد"}</p>
        </div>
      ))}
    </div>
  );
}

export function StrengthScoreCard({ score, notes }: { score?: number; notes?: string[] }) {
  const safeScore = Math.min(100, Math.max(0, score ?? 0));
  return (
    <div className="strength-layout">
      <div className="criteria-list space-y-2">
        {(notes?.length ? notes : ["وضوح الوقائع", "تحديد الطلبات", "وجود بينة", "وجود سند نظامي", "اتساق الدفوع", "اكتمال بيانات الأطراف"]).map((note) => (
          <div key={note} className="criterion-card">{note}</div>
        ))}
      </div>
      <div className="strength-panel">
        <div className="gauge relative" style={{ "--score-deg": `${safeScore * 3.6}deg` } as React.CSSProperties}>
          <div className="score">{safeScore.toLocaleString("ar-SA")}</div>
        </div>
        <p className="recommendation mt-4 text-sm text-[var(--gold-pale)]">مقياس تقديري للتدريب ولا يمثل توقعًا قضائيًا.</p>
      </div>
    </div>
  );
}
