import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalAlert } from "@/components/ui/legal";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { suggestedActionsFor, STAGE_META } from "@/lib/modules/judicial-assistant/catalog";
import {
  CONFIDENTIALITY_LABEL, FACT_STATUS_LABEL, FACT_STATUS_TONE,
  JURISDICTION_LABEL, formatDate, formatDateTime,
} from "@/lib/modules/judicial-assistant/labels";
import { StageBar } from "@/components/judicial-assistant/StageBar";
import { CaseActions } from "@/components/judicial-assistant/CaseActions";
import { JaIcon } from "@/components/judicial-assistant/icons";
import { caseVisibleTo } from "@/lib/modules/judicial-assistant/abac";
import { listAnalyses } from "@/lib/modules/judicial-assistant/persistence";
import { SERVICE_BY_ID } from "@/lib/modules/judicial-assistant/catalog";

export const dynamic = "force-dynamic";

export default async function CaseOverviewPage({ params }: { params: { caseId: string } }) {
  const user = await requirePagePermission("JUDICIAL_ASSISTANT_USE");
  const kase = await getCase(params.caseId);
  if (!kase) notFound();

  // ABAC (§12): لا يكفي الدور — تُفحَص رؤية هذه القضية بعينها.
  if (!caseVisibleTo({ userId: user.id, role: user.role }, kase)) notFound();

  const actions = suggestedActionsFor(kase);
  const history = await listAnalyses(kase.id);
  const nextHearing = [...kase.hearings].sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <div className="ja ja-case">
      {/* رأسٌ ثابت (§21) */}
      <header className="ja-casehead">
        <div className="ja-casehead__top">
          <Link href="/dashboard/judicial-assistant/cases" className="ja-back"><JaIcon name="case" size={15} /> القضايا</Link>
          <div className="ja-casehead__actions">
            <Link href={`/dashboard/judicial-assistant/cases/${kase.id}/audit`} className="ja-back"><JaIcon name="audit" size={15} /> سجلّ النشاط</Link>
            <span className="ja-stagepill ja-stagepill--lg">{STAGE_META[kase.stage].label}</span>
          </div>
        </div>
        <h1 className="ja-casehead__num">{kase.caseNumber}</h1>
        <p className="ja-casehead__subject">{kase.subject}</p>
        <div className="ja-casehead__meta">
          <span>{kase.court}</span><span aria-hidden>·</span>
          <span>{kase.circuit}</span><span aria-hidden>·</span>
          <span>قضاء {JURISDICTION_LABEL[kase.jurisdiction]}</span><span aria-hidden>·</span>
          <span>سرّيّة {CONFIDENTIALITY_LABEL[kase.confidentiality]}</span><span aria-hidden>·</span>
          <span>آخر مزامنة {formatDateTime(kase.lastSync)}</span>
        </div>
        <StageBar current={kase.stage} />
      </header>

      <div className="ja-syntbanner" role="status">
        <JaIcon name="security" size={15} />
        <span>قضيّةٌ صناعيّة للعرض والاختبار — لا بيانات حقيقيّة.</span>
      </div>

      {/* لوحة الأعمال المقترحة (المنتج الأساسيّ: يقود بحسب المرحلة) */}
      <section className="card ja-panel" aria-labelledby="ja-suggested">
        <h2 id="ja-suggested" className="ja-panel__title"><JaIcon name="assistant" size={18} /> الأعمال المقترحة لهذه المرحلة</h2>
        <p className="ja-panel__hint">تُقترح بحسب مرحلة القضية، وتُشغَّل باختيارك — لا تلقائيًّا.</p>
        <CaseActions caseId={kase.id} actions={actions} />
      </section>

      {/* خريطة القضية */}
      <div className="ja-cols">
        <section className="card ja-panel" aria-labelledby="ja-parties">
          <h2 id="ja-parties" className="ja-panel__title"><JaIcon name="map" size={18} /> الأطراف</h2>
          <ul className="ja-plain">
            {kase.parties.map((p) => (
              <li key={p.id}><b>{p.role}:</b> {p.name}{p.representative ? ` (${p.representative})` : ""}</li>
            ))}
          </ul>
        </section>

        <section className="card ja-panel" aria-labelledby="ja-requests">
          <h2 id="ja-requests" className="ja-panel__title"><JaIcon name="brief" size={18} /> الطلبات</h2>
          <ul className="ja-plain">
            {kase.requests.map((r) => <li key={r.id}>{r.text}</li>)}
          </ul>
        </section>
      </div>

      <section className="card ja-panel" aria-labelledby="ja-facts">
        <h2 id="ja-facts" className="ja-panel__title"><JaIcon name="evidence" size={18} /> الوقائع</h2>
        <p className="ja-panel__hint">تُميَّز الواقعة الثابتة عن المُدّعاة وغير المحسومة؛ ولكلٍّ مصدرها.</p>
        <ul className="ja-facts">
          {kase.facts.map((f) => (
            <li key={f.id} className="ja-fact">
              <span className={`ja-badge ja-badge--${FACT_STATUS_TONE[f.status]}`}>{FACT_STATUS_LABEL[f.status]}</span>
              <div className="ja-fact__body">
                <div className="ja-fact__text">{f.text}</div>
                <div className="ja-fact__src">المصدر: {f.sourceLabel}{f.hasEvidence ? "" : " — بلا دليلٍ مرتبط"}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="ja-cols">
        <section className="card ja-panel" aria-labelledby="ja-issues">
          <h2 id="ja-issues" className="ja-panel__title"><JaIcon name="issue" size={18} /> المسائل محلّ الفصل</h2>
          <ul className="ja-plain">
            {kase.issues.map((i) => (
              <li key={i.id}>{i.statement} {i.resolved ? <span className="ja-badge ja-badge--success">محسومة</span> : <span className="ja-badge ja-badge--warning">مفتوحة</span>}</li>
            ))}
          </ul>
        </section>

        <section className="card ja-panel" aria-labelledby="ja-hearing">
          <h2 id="ja-hearing" className="ja-panel__title"><JaIcon name="hearing" size={18} /> الجلسة القادمة</h2>
          {nextHearing ? (
            <p className="ja-plain">{formatDate(nextHearing.date)} — {nextHearing.purpose}{nextHearing.hasMinutes ? " (يوجد محضر)" : ""}</p>
          ) : <p className="ja-panel__hint">لا جلسةً مجدولة.</p>}
        </section>
      </div>

      <div className="ja-cols">
        <section className="card ja-panel" aria-labelledby="ja-docs">
          <h2 id="ja-docs" className="ja-panel__title"><JaIcon name="documents" size={18} /> المستندات</h2>
          <ul className="ja-plain">
            {kase.documents.map((d) => (
              <li key={d.id}>{d.title} <span className="ja-muted">({d.kind}، {d.pages} صفحة{d.quality !== "good" ? "، جودة منخفضة" : ""})</span></li>
            ))}
          </ul>
        </section>

        <section className="card ja-panel" aria-labelledby="ja-gaps">
          <h2 id="ja-gaps" className="ja-panel__title"><JaIcon name="quality" size={18} /> النواقص</h2>
          {kase.gaps.length === 0 ? <p className="ja-panel__hint">لا نواقص مرصودة.</p> : (
            <ul className="ja-plain">
              {kase.gaps.map((g) => (
                <li key={g.id}><span className={`ja-badge ja-badge--${g.severity === "critical" ? "danger" : g.severity === "warning" ? "warning" : "info"}`}>{g.severity === "critical" ? "حرِج" : g.severity === "warning" ? "تنبيه" : "معلومة"}</span> {g.text}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {history.length > 0 ? (
        <section className="card ja-panel" aria-labelledby="ja-history">
          <h2 id="ja-history" className="ja-panel__title"><JaIcon name="audit" size={18} /> سجلّ التحليلات المحفوظة</h2>
          <p className="ja-panel__hint">كلّ عملٍ شُغّل على هذه القضية محفوظٌ كمسودّة تحتاج تثبيتًا بشريًّا.</p>
          <ul className="ja-list">
            {history.map((h) => (
              <li key={h.id} className="ja-list__row">
                <div>
                  <div className="ja-list__title">{SERVICE_BY_ID[h.serviceId]?.title ?? h.serviceId} <span className="ja-action__id">{h.serviceId}</span></div>
                  <div className="ja-list__sub">{formatDateTime(h.createdAt)}</div>
                </div>
                <span className={`ja-badge ja-badge--${h.blocked ? "warning" : "info"}`}>{h.blocked ? "محجوب" : "مسودّة"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <LegalAlert tone="info">
        كلّ عملٍ حسّاس يمرّ بمراجعتك واعتمادك. المصادر قابلة للفتح، والنظام لا يعتمد حكمًا ولا يولّد نصًّا نظاميًّا من ذاكرته.
      </LegalAlert>
    </div>
  );
}
