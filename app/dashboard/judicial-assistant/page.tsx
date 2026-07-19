import Link from "next/link";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalPageHeader, LegalAlert, LegalStatCard, LegalEmptyState } from "@/components/ui/legal";
import { getJudgeDashboard } from "@/lib/modules/judicial-assistant/store";
import {
  CONFIDENTIALITY_LABEL, DEADLINE_STATUS_LABEL, DEADLINE_STATUS_TONE,
  JURISDICTION_LABEL, formatDate, formatDateTime,
} from "@/lib/modules/judicial-assistant/labels";
import { JaIcon } from "@/components/judicial-assistant/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "المعاون القضائيّ — لوحة القاضي" };

export default async function JudicialAssistantDashboard() {
  await requirePagePermission("CONSULTATIONS_FULL");
  const dash = await getJudgeDashboard();

  return (
    <div className="ja">
      <LegalPageHeader
        eyebrow="المعاون القضائيّ السعوديّ"
        title="لوحة القاضي"
        description="مساحةُ عملٍ قضائيّة تقود العمل بحسب مرحلة القضية — لا محادثة. المصدر قبل الإجابة، والقاضي صاحب القرار."
        actions={
          <Link href="/dashboard/judicial-assistant/cases" className="btn btn-gold">
            <JaIcon name="case" size={16} /> قائمة القضايا
          </Link>
        }
      />

      <div className="ja-syntbanner" role="status">
        <JaIcon name="security" size={16} />
        <span>
          بيانات صناعيّة عبر موصلٍ تجريبيّ (<b>{dash.connector.note}</b>). لا اتّصال بنظامٍ رسميّ، ولا قضايا حقيقيّة.
          {dash.connector.lastSync ? ` آخر مزامنة: ${formatDateTime(dash.connector.lastSync)}.` : ""}
        </span>
      </div>

      <div className="ja-stats">
        <LegalStatCard label="القضايا" value={String(dash.totalCases)} hint="في مساحة العمل" />
        <LegalStatCard label="جلساتٌ قادمة" value={String(dash.upcomingHearings.length)} hint="مرتّبة زمنيًّا" />
        <LegalStatCard label="مددٌ قيد المتابعة" value={String(dash.deadlines.length)} hint="مع حالة كلٍّ منها" />
      </div>

      <div className="ja-cols">
        <section className="card ja-panel" aria-labelledby="ja-hearings">
          <h2 id="ja-hearings" className="ja-panel__title"><JaIcon name="hearing" size={18} /> الجلسات القادمة</h2>
          {dash.upcomingHearings.length === 0 ? (
            <LegalEmptyState title="لا جلسات" description="لا توجد جلساتٌ مجدولة في البيانات الحاليّة." />
          ) : (
            <ul className="ja-list">
              {dash.upcomingHearings.map(({ caseId, caseNumber, court, hearing }) => (
                <li key={hearing.id} className="ja-list__row">
                  <div>
                    <Link href={`/dashboard/judicial-assistant/cases/${caseId}`} className="ja-list__title">{caseNumber}</Link>
                    <div className="ja-list__sub">{court} — {hearing.purpose}</div>
                  </div>
                  <span className="ja-when">{formatDate(hearing.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card ja-panel" aria-labelledby="ja-deadlines">
          <h2 id="ja-deadlines" className="ja-panel__title"><JaIcon name="deadline" size={18} /> المدد</h2>
          {dash.deadlines.length === 0 ? (
            <LegalEmptyState title="لا مدد" description="لا مدداً قيد المتابعة." />
          ) : (
            <ul className="ja-list">
              {dash.deadlines.map(({ caseId, caseNumber, deadline }) => (
                <li key={deadline.id} className="ja-list__row">
                  <div>
                    <Link href={`/dashboard/judicial-assistant/cases/${caseId}`} className="ja-list__title">{deadline.label}</Link>
                    <div className="ja-list__sub">{caseNumber} — {deadline.basis}</div>
                  </div>
                  <span className={`ja-badge ja-badge--${DEADLINE_STATUS_TONE[deadline.status]}`}>
                    {DEADLINE_STATUS_LABEL[deadline.status]} · {formatDate(deadline.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card ja-panel" aria-labelledby="ja-ready">
        <h2 id="ja-ready" className="ja-panel__title"><JaIcon name="case" size={18} /> القضايا</h2>
        <ul className="ja-list">
          {dash.readyCases.map((c) => (
            <li key={c.id} className="ja-list__row">
              <div>
                <Link href={`/dashboard/judicial-assistant/cases/${c.id}`} className="ja-list__title">{c.caseNumber}</Link>
                <div className="ja-list__sub">{c.court} — {c.subject}</div>
              </div>
              <div className="ja-tags">
                <span className="ja-chip">{JURISDICTION_LABEL[c.jurisdiction]}</span>
                <span className="ja-chip">{CONFIDENTIALITY_LABEL[c.confidentiality]}</span>
                {c.openIssues > 0 ? <span className="ja-chip ja-chip--warn">{c.openIssues} مسألة مفتوحة</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <LegalAlert tone="info">
        الأعمال المتاحة حيًّا: الملخّص التنفيذيّ المؤصَّل (JS-001)، وحساب المدد (JS-009) ومصفوفة الإثبات (JS-010) بمحرّكٍ
        حتميّ مستقلٍّ عن النموذج. بقيّة الأعمال (الاختصاص، التسبيب، مشروع الحكم، الاعتراض…) معروضةٌ كمقترحاتٍ وتُفعَّل تِباعًا.
      </LegalAlert>
    </div>
  );
}
