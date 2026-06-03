"use client";

import type { ReactNode } from "react";
import { stageLabel } from "@/lib/modules/simulations/simulation-labels";

export type OriginalStage = {
  key: string;
  label: string;
};

export type OriginalClaim = Record<string, string>;

export function OriginalHero({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <section className="hero ho-hero">
      <div className="hero-body">
        <div className="hero-tag"><span className="dot" /> القاضي حكيم - تجربة أصلية</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {actions ? <div className="hero-cta">{actions}</div> : null}
      </div>
    </section>
  );
}

export function OriginalWorkflowTrack({ stages, currentStage }: { stages: OriginalStage[]; currentStage: string }) {
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.key === currentStage));
  return (
    <div className="workflow-wrap">
      <div className="card-header" style={{ marginBottom: 0 }}>
        <div className="card-title">مسار الدعوى الإجرائي</div>
        <div className="ho-muted">المرحلة الحالية: <span className="ho-gold">{stageLabel(currentStage)}</span></div>
      </div>
      <div className="wf-track">
        {stages.map((stage, index) => (
          <div className="contents" key={stage.key}>
            <div className={`wf-step ${index < currentIndex ? "done" : index === currentIndex ? "cur" : ""}`}>
              <div className="wf-circle">{index < currentIndex ? "✓" : (index + 1).toLocaleString("ar-SA")}</div>
              <div className="wf-label">{stage.label}</div>
            </div>
            {index < stages.length - 1 ? <div className={`wf-conn ${index < currentIndex ? "done" : ""}`} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OriginalCaseHub({
  title,
  sessionId,
  claim,
  currentStage,
  lastDecision,
  onNavigate
}: {
  title: string;
  sessionId?: string;
  claim?: OriginalClaim;
  currentStage: string;
  lastDecision?: string;
  onNavigate: (view: string) => void;
}) {
  return (
    <div className="case-detail-head">
      <div className="cd-id">{sessionId || "جلسة غير مقيدة بعد"}</div>
      <div className="cd-title">{title || "جلسة محاكاة قضائية"}</div>
      <div className="cd-meta">
        <span><strong>نوع الدعوى:</strong> {claim?.caseType || "غير محدد"}</span>
        <span className="cd-sep">•</span>
        <span><strong>الأطراف:</strong> {claim?.plaintiffName || "المدعي"} ضد {claim?.defendantName || "المدعى عليه"}</span>
        <span className="cd-sep">•</span>
        <span><strong>المرحلة:</strong> {stageLabel(currentStage)}</span>
      </div>
      <div className="grid-main ho-case-hub-grid">
        <div className="disputed-box">
          <div className="db-section">
            <div className="db-label navy">حالة الجلسة</div>
            <ul className="db-list">
              <li>الموضوع: {claim?.subject || "لم يحدد بعد"}</li>
              <li>الطلبات: {claim?.requests || "لم تحدد بعد"}</li>
              <li>آخر قرار: {lastDecision || "لا يوجد قرار إجرائي مسجل بعد"}</li>
            </ul>
          </div>
        </div>
        <div className="card ho-actions-card">
          <div className="card-title">إدارة الجلسة</div>
          <div className="qa-stack">
            {[
              ["enter", "دخول الجلسة", "إثبات الدور والصفة"],
              ["claim", "عرض الصحيفة", "مراجعة بيانات الدعوى"],
              ["record", "ضبط الجلسة", "وثيقة افتتاح الجلسة"],
              ["pleading", "المرافعة", "محضر تفاعلي"],
              ["strength", "مقياس القوة", "تقدير تدريبي"],
              ["judgment", "الحكم", "مسودة مسببة"],
              ["appeal", "الاعتراض", "استئناف ونقض والتماس"]
            ].map(([view, label, sub]) => (
              <button className="qa-item" key={view} type="button" onClick={() => onNavigate(view)}>
                <span className="qa-ico">ح</span>
                <span className="qa-txt"><span className="qa-title">{label}</span><span className="qa-sub">{sub}</span></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OriginalWizard({
  steps,
  currentStep,
  children,
  onStep
}: {
  steps: Array<{ title: string; subtitle: string }>;
  currentStep: number;
  children: ReactNode;
  onStep: (step: number) => void;
}) {
  return (
    <div className="wizard-wrap ho-wizard-wrap">
      <div className="wizard-nav">
        {steps.map((step, index) => (
          <button key={step.title} type="button" className={`wz-step ${currentStep === index ? "active" : ""}`} onClick={() => onStep(index)}>
            <div className="wz-num">{(index + 1).toLocaleString("ar-SA")}</div>
            <div className="wz-info">
              <div className="wz-label">{step.title}</div>
              <div className="wz-sub">{step.subtitle}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="wizard-body">{children}</div>
    </div>
  );
}

export function OriginalWizardStep({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="wz-page">
      <h3>{title}</h3>
      <p className="sub">{subtitle}</p>
      {children}
    </div>
  );
}

export function OriginalHearingRecord({ claim, sessionId, content }: { claim?: OriginalClaim; sessionId?: string; content?: string }) {
  return (
    <article className="verdict-doc ho-hearing-record">
      <div className="vd-court">
        <h2>ضبط جلسة</h2>
        <p>محضر محاكاة قضائية - منصة حكيم</p>
      </div>
      <div className="vd-meta">
        <span><strong>رقم الجلسة:</strong> {sessionId || "غير مقيدة"}</span>
        <span><strong>التاريخ:</strong> {new Date().toLocaleString("ar-SA")}</span>
      </div>
      <div className="vd-basmala">بسم الله الرحمن الرحيم</div>
      <div className="vd-parties">
        <div><div className="vd-party-lbl">المدعي</div><div className="vd-party-name">{claim?.plaintiffName || "غير محدد"}</div></div>
        <div><div className="vd-party-lbl">المدعى عليه</div><div className="vd-party-name">{claim?.defendantName || "غير محدد"}</div></div>
      </div>
      <div className="vd-section">
        <h4>موضوع الدعوى</h4>
        <p>{claim?.subject || "لم يحدد موضوع الدعوى."}</p>
      </div>
      <div className="vd-section">
        <h4>إثبات الحضور والصفة</h4>
        <p>{claim?.attendance || "لم تسجل بيانات حضور تفصيلية."}</p>
      </div>
      <div className="vd-section">
        <h4>قرار افتتاح الجلسة</h4>
        <p>{content || "قررت الدائرة الافتراضية فتح باب المرافعة وتمكين الأطراف من عرض الدعوى والجواب."}</p>
      </div>
      <div className="vd-sign">القاضي حكيم - قاض افتراضي تدريبي</div>
      <div className="vd-disclaimer"><p>هذا الضبط صادر في بيئة محاكاة تدريبية، ولا يعد ضبطًا قضائيًا صادرًا من محكمة مختصة.</p></div>
    </article>
  );
}

export function OriginalHearingTranscript({ children, side }: { children: ReactNode; side: ReactNode }) {
  return (
    <div className="hearing-layout">
      <section className="hearing-chat">
        {children}
      </section>
      <aside className="hearing-side">{side}</aside>
    </div>
  );
}

export function OriginalJudgeMessage({ role, content, createdAt, stage }: { role: string; content: string; createdAt?: string; stage?: string }) {
  const kind = role.includes("قاضي") ? "judge" : role.includes("مدعي") && !role.includes("مدعى عليه") ? "plaintiff" : role.includes("مدعى عليه") ? "defendant" : "system";
  return (
    <article className={`msg ${kind}`}>
      <div className="msg-avatar">{role.slice(0, 2)}</div>
      <div className="msg-body">
        <div className="msg-sender">{role} · {stage ? stageLabel(stage) : "محضر الجلسة"}</div>
        <div className="msg-bubble">{content}</div>
        <div className="msg-time">{createdAt ? new Date(createdAt).toLocaleString("ar-SA") : new Date().toLocaleString("ar-SA")}</div>
      </div>
    </article>
  );
}

export function OriginalProceduralDecision({ title, content }: { title: string; content: string }) {
  return (
    <div className="decision-box">
      <strong>قرار إجرائي: {title}</strong>
      <p>{content}</p>
    </div>
  );
}

export function OriginalStrengthMeter({ score, notes }: { score: number; notes: string[] }) {
  const safeScore = Math.min(100, Math.max(0, score));
  return (
    <div className="strength-layout">
      <div className="criteria-list">
        {notes.map((note, index) => (
          <div className="criterion-card" key={note}>
            <div className="criterion-head">
              <div><div className="criterion-title">{note.split(":").at(-1) || note}</div><div className="criterion-sub">معيار رقم {(index + 1).toLocaleString("ar-SA")}</div></div>
              <div className="slider-val">{note.startsWith("مكتمل") ? "٨٥" : "٤٥"}</div>
            </div>
            <input type="range" min="0" max="100" value={note.startsWith("مكتمل") ? 85 : 45} readOnly />
          </div>
        ))}
      </div>
      <aside className="strength-panel">
        <div className="sp-title">المؤشر العام لقوة الدعوى</div>
        <div className="gauge-container">
          <svg viewBox="0 0 220 120">
            <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="18" strokeLinecap="round" />
            <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="var(--gold)" strokeWidth="18" strokeLinecap="round" strokeDasharray={`${safeScore * 2.8} 280`} />
          </svg>
          <div className="gauge-reading">
            <div className="g-score">{safeScore.toLocaleString("ar-SA")}</div>
            <div className="g-sub">من ١٠٠</div>
          </div>
        </div>
        <div className="sp-divider" />
        <div className="sp-level">{safeScore >= 75 ? "قوة مرتفعة" : safeScore >= 50 ? "قوة متوسطة" : "تحتاج تدعيم"}</div>
        <p className="sp-rec">يوصى باستكمال البينات وربط الوقائع بالطلبات قبل قفل باب المرافعة.</p>
        <p className="sp-note">هذا المؤشر تدريبي ولا يمثل توقعًا قضائيًا.</p>
      </aside>
    </div>
  );
}

export function OriginalVerdictDocument({ claim, content, disclaimer }: { claim?: OriginalClaim; content?: string; disclaimer?: string }) {
  return (
    <article className="verdict-doc">
      <div className="vd-court">
        <h2>مسودة حكم قضائي مسبب</h2>
        <p>مولدة بالذكاء الاصطناعي وفق البنية القضائية السعودية</p>
      </div>
      <div className="vd-meta">
        <span><strong>المنصة:</strong> حكيم</span>
        <span><strong>التاريخ:</strong> {new Date().toLocaleString("ar-SA")}</span>
      </div>
      <div className="vd-basmala">بسم الله الرحمن الرحيم</div>
      <div className="vd-hamd">الحمد لله وحده، وبعد الاطلاع على ملف المحاكاة وما قدمه الأطراف من مداخلات ودفوع.</div>
      <div className="vd-parties">
        <div><div className="vd-party-lbl">المدعي</div><div className="vd-party-name">{claim?.plaintiffName || "غير محدد"}</div></div>
        <div><div className="vd-party-lbl">المدعى عليه</div><div className="vd-party-name">{claim?.defendantName || "غير محدد"}</div></div>
      </div>
      {["الديباجة", "الوقائع", "الطلبات", "الدفوع", "الأسباب", "المنطوق", "التنبيه"].map((section) => (
        <div className="vd-section" key={section}>
          <h4>{section}</h4>
          <p>{sectionContent(section, claim, content, disclaimer)}</p>
        </div>
      ))}
      <div className="vd-final">وعليه جرى إعداد هذه المسودة القضائية المسببة لأغراض التدريب.</div>
      <div className="vd-sign">القاضي حكيم - قاض افتراضي تدريبي</div>
      <div className="vd-disclaimer"><p>{disclaimer || judgmentDisclaimer}</p></div>
    </article>
  );
}

export function OriginalAppealCards({ selected, onSelect }: { selected: string; onSelect: (value: string) => void }) {
  return (
    <div className="appeal-main">
      <div className="appeal-form-card">
        <div className="card-title">مسارات الاعتراض على مسودة الحكم</div>
        <p className="ho-muted">اختر المسار المناسب بعد صدور مسودة حكم قضائي مسبب.</p>
        <div className="reasons-list">
          {["خطأ في تطبيق النظام", "قصور في التسبيب", "خطأ في تقدير الأدلة", "مخالفة مبدأ المواجهة"].map((reason) => (
            <div className="reason-item" key={reason}>
              <div className="ri-check" />
              <div className="ri-text"><div className="ri-title">{reason}</div><div className="ri-sub">سبب تدريبي قابل للتحرير لاحقًا.</div></div>
            </div>
          ))}
        </div>
      </div>
      <aside className="appeal-side-card">
        {["استئناف", "نقض", "التماس إعادة نظر"].map((kind) => (
          <button key={kind} type="button" className={`appeal-card ${selected === kind ? "active" : ""}`} onClick={() => onSelect(kind)}>
            <strong>{kind}</strong>
            <span>مسار اعتراض رسمي تدريبي</span>
          </button>
        ))}
      </aside>
    </div>
  );
}

export function OriginalUploadZone({ files }: { files: Array<{ id: string; fileName: string; mimeType: string; createdAt: string }> }) {
  return (
    <div className="upload-zone">
      <div className="upload-ico">+</div>
      <div className="upload-title">المرفقات والبينات</div>
      <div className="upload-sub">اسحب الملفات هنا أو استخدم وحدة المرفقات. لا يتم حفظ الملفات في Vercel filesystem.</div>
      <div className="file-list">
        {files.length ? files.map((file) => (
          <div className="file-item" key={file.id}>
            <div className="fn">{file.fileName}</div>
            <div className="fs">{file.mimeType} · {new Date(file.createdAt).toLocaleDateString("ar-SA")}</div>
          </div>
        )) : <div className="file-item"><div className="fn">لا توجد مرفقات بعد</div><div className="fs">TODO: استخراج نص PDF/DOCX لاحقًا</div></div>}
      </div>
    </div>
  );
}

export function OriginalAuditRows({ rows }: { rows: Array<{ action: string; detail: string; confidence?: string }> }) {
  return (
    <div className="audit-table">
      <div className="audit-head"><div>الوقت</div><div>العملية</div><div>التفاصيل</div><div>الثقة</div></div>
      {rows.map((row, index) => (
        <div className="audit-row" key={`${row.action}-${index}`}>
          <div className="audit-time">{new Date().toLocaleTimeString("ar-SA")}</div>
          <div className="audit-act">{row.action}</div>
          <div className="audit-detail">{row.detail}</div>
          <div className="audit-conf">{row.confidence || "منضبط"}</div>
        </div>
      ))}
    </div>
  );
}

const judgmentDisclaimer = "هذه المسودة مولدة بالذكاء الاصطناعي لأغراض المراجعة والتحليل والتدريب، ولا تعد حكمًا قضائيًا صادرًا من محكمة مختصة، ولا تكتسب حجية قضائية أو أثرًا نظاميًا.";

function sectionContent(section: string, claim?: OriginalClaim, content?: string, disclaimer?: string) {
  if (section === "الوقائع") return claim?.facts || "لم تسجل وقائع تفصيلية كافية.";
  if (section === "الطلبات") return claim?.requests || "لم تحدد الطلبات.";
  if (section === "الدفوع") return claim?.defenses || "لم تسجل دفوع تفصيلية.";
  if (section === "الأسباب") return content || "استندت هذه المسودة إلى ملف المحاكاة والمرافعات والمواد النظامية المسترجعة من قاعدة بيانات حكيم فقط.";
  if (section === "المنطوق") return "لأغراض التدريب، جرى إعداد منطوق افتراضي قابل للمراجعة ولا يمثل فصلًا قضائيًا فعليًا.";
  if (section === "التنبيه") return disclaimer || judgmentDisclaimer;
  return "هذه مسودة صادرة داخل بيئة القاضي حكيم للمحاكاة القضائية.";
}
