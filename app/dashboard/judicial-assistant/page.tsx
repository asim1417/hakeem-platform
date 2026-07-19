import Link from "next/link";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalPageHeader, LegalAlert, LegalStatCard, LegalEmptyState } from "@/components/ui/legal";
import { getJudgeDashboard } from "@/lib/modules/judicial-assistant/store";
import {
  CONFIDENTIALITY_LABEL, DEADLINE_STATUS_LABEL, DEADLINE_STATUS_TONE,
  JURISDICTION_LABEL, formatDate,
} from "@/lib/modules/judicial-assistant/labels";
import { JaIcon } from "@/components/judicial-assistant/icons";
import { CreateCaseForm } from "@/components/judicial-assistant/CreateCaseForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "المعاون القضائيّ — لوحة القاضي" };

export default async function JudicialAssistantDashboard() {
  const user = await requirePagePermission("JUDICIAL_ASSISTANT_USE");
  const dash = await getJudgeDashboard(user.id);
  const empty = dash.totalCases === 0;

  return (
    <div className="ja">
      <LegalPageHeader
        eyebrow="المعاون القضائيّ السعوديّ"
        title="لوحة القاضي"
        description="مساحةُ عملٍ قضائيّة تبدأ من قضاياك ومرفقاتك — تقود العمل بحسب المرحلة، والمصدر قبل الإجابة، والقاضي صاحب القرار."
        actions={<Link href="/dashboard/judicial-assistant/cases" className="btn btn-gold"><JaIcon name="case" size={16} /> قضاياي</Link>}
      />

      {empty ? (
        <div className="card ja-panel">
          <LegalEmptyState title="ابدأ بإنشاء قضيتك الأولى" description="القضية مشروعٌ تملكه: أنشئه، ثم أضِف مرفقاتك (اللائحة، المذكّرات، المحاضر) ليحلّلها المعاون مؤصَّلًا بالنواة." />
          <div className="ja-formactions"><CreateCaseForm /></div>
        </div>
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
        </>
      )}

      <LegalAlert tone="info">
        المدخل مرفقاتك أنت — لا يعتمد المعاون على ربطٍ بنظامٍ خارجيّ. أعمالٌ حيّة: الملخّص (JS-001)، الخطّ الزمنيّ (JS-004)،
        المدد (JS-009)، مصفوفة الإثبات (JS-010)، ومشروع الحكم (JS-018) مؤصَّلًا على أحكام النواة وموادها.
      </LegalAlert>
    </div>
  );
}
