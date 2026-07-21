import Link from "next/link";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalStatCard } from "@/components/ui/legal";
import { getJudgeDashboard } from "@/lib/modules/judicial-assistant/store";
import {
  CONFIDENTIALITY_LABEL, DEADLINE_STATUS_LABEL, DEADLINE_STATUS_TONE,
  JURISDICTION_LABEL, formatDate,
} from "@/lib/modules/judicial-assistant/labels";
import { JaIcon } from "@/components/judicial-assistant/icons";
import { CreateCaseForm } from "@/components/judicial-assistant/CreateCaseForm";
import { ServiceShowcase } from "@/components/judicial-assistant/ServiceShowcase";
import { AssistantPrompt } from "@/components/judicial-assistant/AssistantPrompt";

export const dynamic = "force-dynamic";
export const metadata = { title: "المعاون القضائيّ — لوحة القاضي" };

const STEPS = [
  { icon: "case", title: "أنشئ قضية", desc: "مشروعٌ تملكه: العنوان والمحكمة ونوع القضاء." },
  { icon: "documents", title: "ارفع مرفقاتك", desc: "اللائحة والمذكّرات والمحاضر — تُقرأ بمحرّك «منصّة الوثائق» نفسه، محليًّا في متصفّحك." },
  { icon: "map", title: "استخلِص الخريطة", desc: "أطرافٌ ووقائع ومسائل تُثبّتها أنت قبل التحليل." },
  { icon: "assistant", title: "شغّل الأعمال", desc: "ملخّص، مدد، إثبات، دراسة، مشروع حكم — مؤصَّلة بالنواة." },
];

export default async function JudicialAssistantDashboard() {
  const user = await requirePagePermission("JUDICIAL_ASSISTANT_USE");
  const dash = await getJudgeDashboard(user.id);
  const empty = dash.totalCases === 0;

  return (
    <div className="ja">
      {/* بطلٌ قويّ */}
      <header className="ja-hero2">
        <div aria-hidden className="ja-hero2__pattern" />
        <div className="ja-hero2__in">
          <p className="ja-hero2__eyebrow">المعاون القضائيّ السعوديّ</p>
          <h1>لوحة القاضي</h1>
          <p className="ja-hero2__lede">مساحةُ عملٍ قضائيّة تبدأ من قضاياك ومرفقاتك — تقود العمل بحسب المرحلة، والمصدر قبل الإجابة، والقاضي صاحب القرار.</p>
          <div className="ja-hero2__chips">
            <span className="ja-hchip"><JaIcon name="assistant" size={14} /> ٢٤ خدمة قضائيّة</span>
            <span className="ja-hchip"><JaIcon name="sources" size={14} /> مؤصَّلة بأحكام النواة</span>
            <span className="ja-hchip"><JaIcon name="security" size={14} /> بلا نظامٍ خارجيّ</span>
          </div>
          <div className="ja-hero2__cta">
            <CreateCaseForm />
            <Link href="/dashboard/judicial-assistant/cases" className="btn btn-outline ja-hero2__ghost"><JaIcon name="case" size={16} /> قضاياي</Link>
          </div>
        </div>
      </header>

      {/* موجّه المعاون — عقلٌ حرّ مؤصَّل لأيّ سؤالٍ عامّ لا يتطلّب قضيةً بعينها */}
      <section className="card ja-panel">
        <AssistantPrompt />
      </section>

      {empty ? (
        <>
          <section className="ja-steps2" aria-label="كيف تبدأ">
            {STEPS.map((s, i) => (
              <div key={s.title} className="ja-step2">
                <span className="ja-step2__n">{i + 1}</span>
                <span className="ja-step2__ic"><JaIcon name={s.icon} size={20} /></span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </section>
          <ServiceShowcase />
        </>
      ) : (
        <>
          <div className="ja-stats">
            <LegalStatCard label="قضاياك" value={String(dash.totalCases)} hint="مشاريع تملكها" />
            <LegalStatCard label="المرفقات" value={String(dash.totalAttachments)} hint="وثائق مُحمّلة" />
            <LegalStatCard label="جلساتٌ ومدد" value={String(dash.upcomingHearings.length + dash.deadlines.length)} hint="قيد المتابعة" />
          </div>

          <section className="card ja-panel" aria-labelledby="ja-ready">
            <div className="ja-panel__row">
              <h2 id="ja-ready" className="ja-panel__title"><JaIcon name="case" size={18} /> قضاياك</h2>
              <CreateCaseForm />
            </div>
            <ul className="ja-list">
              {dash.cases.map((c) => (
                <li key={c.id} className="ja-list__row">
                  <div>
                    <Link href={`/dashboard/judicial-assistant/cases/${c.id}`} className="ja-list__title">{c.caseNumber || c.subject}</Link>
                    <div className="ja-list__sub">{c.court ?? "—"} — {c.subject}</div>
                  </div>
                  <div className="ja-tags">
                    <span className="ja-chip">{JURISDICTION_LABEL[c.jurisdiction]}</span>
                    <span className="ja-chip">{CONFIDENTIALITY_LABEL[c.confidentiality]}</span>
                    <span className="ja-chip">{c.attachmentCount} مرفق</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {dash.deadlines.length > 0 ? (
            <section className="card ja-panel" aria-labelledby="ja-deadlines">
              <h2 id="ja-deadlines" className="ja-panel__title"><JaIcon name="deadline" size={18} /> المدد</h2>
              <ul className="ja-list">
                {dash.deadlines.map(({ caseId, deadline }) => (
                  <li key={deadline.id} className="ja-list__row">
                    <div>
                      <Link href={`/dashboard/judicial-assistant/cases/${caseId}`} className="ja-list__title">{deadline.label}</Link>
                      <div className="ja-list__sub">{deadline.basis}</div>
                    </div>
                    <span className={`ja-badge ja-badge--${DEADLINE_STATUS_TONE[deadline.status]}`}>
                      {DEADLINE_STATUS_LABEL[deadline.status]} · {formatDate(deadline.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <ServiceShowcase />
        </>
      )}
    </div>
  );
}
