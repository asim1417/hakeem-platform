import type { ReactNode } from "react";
import { stageLabel } from "@/lib/modules/simulations/simulation-labels";

export function LegalCard({ title, eyebrow, children, className = "" }: { title?: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[#C09B5A]/25 bg-[#FBF8F1] p-5 shadow-[0_12px_30px_rgba(11,31,58,0.08)] ${className}`}>
      {eyebrow ? <p className="font-display-ar text-xs font-semibold text-[#C09B5A]">{eyebrow}</p> : null}
      {title ? <h2 className="font-display-ar mt-2 text-xl font-bold text-[#0B1F3A]">{title}</h2> : null}
      <div className={title || eyebrow ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function GoldButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`focus-ring rounded-md bg-gradient-to-b from-[#D4AF6E] to-[#C09B5A] px-5 py-3 font-display-ar font-semibold text-[#0B1F3A] shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ""}`}
    />
  );
}

export function NavyButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`focus-ring rounded-md bg-[#0B1F3A] px-5 py-3 font-display-ar font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ""}`}
    />
  );
}

const badgeClasses: Record<string, string> = {
  نشطة: "border-[#1A5C41]/30 bg-[#1A5C41]/10 text-[#1A5C41]",
  "قيد المرافعة": "border-[#C09B5A]/40 bg-[#E8D5A8]/40 text-[#0B1F3A]",
  "صدر الحكم": "border-[#0B1F3A]/20 bg-[#0B1F3A]/10 text-[#0B1F3A]",
  اعتراض: "border-[#8C2233]/25 bg-[#8C2233]/10 text-[#8C2233]",
  مغلقة: "border-gray-300 bg-gray-100 text-gray-700",
  تدريبية: "border-[#B8721A]/25 bg-[#B8721A]/10 text-[#B8721A]"
};

export function LegalBadge({ status }: { status: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses[status] ?? badgeClasses["تدريبية"]}`}>{status}</span>;
}

export function StageTracker({ currentStage }: { currentStage: string }) {
  const stages = [
    "CLAIM_FILING",
    "INITIAL_ADMISSIBILITY",
    "CLAIM_SHEET",
    "HEARING_OPENING",
    "HEARING_RECORD",
    "ATTENDANCE_VERIFICATION",
    "PLAINTIFF_STATEMENT",
    "DEFENDANT_RESPONSE",
    "EVIDENCE_MANAGEMENT",
    "PROCEDURAL_DECISION",
    "SETTLEMENT",
    "CLOSE_PLEADING",
    "TRAINING_JUDGMENT",
    "POST_JUDGMENT"
  ];
  const currentIndex = Math.max(0, stages.indexOf(currentStage));
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {stages.map((stage, index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;
        const judgment = stage === "TRAINING_JUDGMENT";
        return (
          <div
            key={stage}
            className={`rounded-md border p-3 ${active ? "border-[#C09B5A] bg-[#E8D5A8]/45" : complete ? "border-[#1A5C41]/25 bg-[#1A5C41]/5" : "border-black/10 bg-white"} ${judgment ? "ring-1 ring-[#C09B5A]/30" : ""}`}
          >
            <p className="font-mono-legal text-xs text-[#C09B5A]">{(index + 1).toLocaleString("ar-SA")}</p>
            <p className="font-display-ar mt-1 font-semibold text-[#0B1F3A]">{stageLabel(stage)}</p>
          </div>
        );
      })}
    </div>
  );
}

export function HearingMessage({ role, content, createdAt, stage }: { role: string; content: string; createdAt: string; stage: string }) {
  const styles: Record<string, string> = {
    "القاضي الافتراضي": "border-[#C09B5A]/40 bg-[#FBF8F1]",
    المدعي: "border-[#1E3F6F]/20 bg-white",
    "المدعى عليه": "border-[#8C2233]/20 bg-white",
    "وكيل المدعي": "border-[#1E3F6F]/20 bg-[#F9F5EC]",
    "وكيل المدعى عليه": "border-[#8C2233]/20 bg-[#F9F5EC]",
    النظام: "border-gray-200 bg-gray-50"
  };
  return (
    <article className={`rounded-lg border p-4 ${styles[role] ?? styles["النظام"]}`}>
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-display-ar font-bold text-[#0B1F3A]">{role}</p>
        <p className="font-mono-legal text-xs text-gray-500">{new Date(createdAt).toLocaleString("ar-SA")}</p>
      </div>
      <p className="mt-1 text-xs text-[#C09B5A]">{stageLabel(stage)}</p>
      <p className="mt-2 whitespace-pre-wrap leading-8 text-gray-700">{content}</p>
    </article>
  );
}

export function JudgmentDocument({ content, disclaimer }: { content: string; disclaimer: string }) {
  return (
    <article className="rounded-lg border border-[#C09B5A]/45 bg-[#FBF8F1] p-6 shadow-[0_18px_45px_rgba(11,31,58,0.10)]">
      <p className="rounded-md border border-[#8C2233]/25 bg-[#8C2233]/10 p-3 text-center font-display-ar font-bold text-[#8C2233]">حكم تدريبي غير ملزم</p>
      <h3 className="font-judicial mt-5 text-3xl font-bold text-[#0B1F3A]">وثيقة الحكم التدريبي</h3>
      <pre className="font-judicial mt-4 whitespace-pre-wrap text-lg leading-10 text-[#0D1321]">{content}</pre>
      <p className="mt-5 border-t border-[#C09B5A]/30 pt-4 text-sm leading-7 text-gray-700">{disclaimer}</p>
    </article>
  );
}

export function HearingRecordDocument({ content }: { content: string }) {
  return (
    <article className="rounded-lg border border-[#C09B5A]/35 bg-[#FBF8F1] p-5">
      <p className="font-judicial text-center text-2xl font-bold text-[#0B1F3A]">بسم الله الرحمن الرحيم</p>
      <h3 className="font-display-ar mt-4 text-xl font-bold text-[#0B1F3A]">ضبط جلسة تدريبي</h3>
      <pre className="mt-3 whitespace-pre-wrap leading-9 text-gray-800">{content}</pre>
    </article>
  );
}

export function ClaimSheetCard({ claim }: { claim?: Record<string, string> }) {
  if (!claim) return <p className="rounded-md bg-[#F2EADB] p-4 text-gray-700">لم يتم تقييد صحيفة دعوى بعد.</p>;
  const rows = [
    ["نوع الدعوى", claim.caseType],
    ["المدعي", `${claim.plaintiffName || ""} - ${claim.plaintiffCapacity || ""}`],
    ["المدعى عليه", `${claim.defendantName || ""} - ${claim.defendantCapacity || ""}`],
    ["موضوع الدعوى", claim.subject],
    ["الوقائع", claim.facts],
    ["الطلبات", claim.requests],
    ["مبلغ المطالبة", claim.claimAmount],
    ["أسانيد المدعي", claim.legalGrounds],
    ["دفوع المدعى عليه", claim.defenses],
    ["الحضور والوكالة", claim.attendance]
  ];
  return (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border border-[#C09B5A]/15 bg-white/70 p-3">
          <p className="font-display-ar text-sm font-bold text-[#0B1F3A]">{label}</p>
          <p className="mt-1 whitespace-pre-wrap leading-7 text-gray-700">{value || "غير محدد"}</p>
        </div>
      ))}
    </div>
  );
}

export function StrengthScoreCard({ score, notes }: { score?: number; notes?: string[] }) {
  return (
    <div className="rounded-lg border border-[#C09B5A]/25 bg-white p-5">
      <p className="font-display-ar text-sm text-[#C09B5A]">مقياس تدريبي تقديري</p>
      <div className="mt-3 flex items-end gap-3">
        <p className="font-mono-legal text-5xl font-bold text-[#0B1F3A]">{(score ?? 0).toLocaleString("ar-SA")}</p>
        <p className="pb-2 text-gray-600">/ 100</p>
      </div>
      <div className="mt-4 h-3 rounded-full bg-[#F2EADB]">
        <div className="h-3 rounded-full bg-gradient-to-l from-[#C09B5A] to-[#1A5C41]" style={{ width: `${Math.min(100, Math.max(0, score ?? 0))}%` }} />
      </div>
      <p className="mt-3 text-sm text-[#B8721A]">هذا المقياس تقديري للتدريب ولا يمثل توقعًا قضائيًا.</p>
      {notes?.length ? (
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
