import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalAlert, LegalEmptyState } from "@/components/ui/legal";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { suggestedActionsFor, STAGE_META } from "@/lib/modules/judicial-assistant/catalog";
import {
  CONFIDENTIALITY_LABEL, FACT_STATUS_LABEL, FACT_STATUS_TONE,
  JURISDICTION_LABEL, formatDate, formatDateTime,
} from "@/lib/modules/judicial-assistant/labels";
import { StageBar } from "@/components/judicial-assistant/StageBar";
import { CaseActions } from "@/components/judicial-assistant/CaseActions";
import { AttachmentUploader } from "@/components/judicial-assistant/AttachmentUploader";
import { AttachmentList } from "@/components/judicial-assistant/AttachmentList";
import { MapExtractor } from "@/components/judicial-assistant/MapExtractor";
import { CaseManageBar } from "@/components/judicial-assistant/CaseManageBar";
import { JaIcon } from "@/components/judicial-assistant/icons";
import { caseVisibleTo } from "@/lib/modules/judicial-assistant/abac";
import { listAnalyses } from "@/lib/modules/judicial-assistant/persistence";
import { SERVICE_BY_ID } from "@/lib/modules/judicial-assistant/catalog";
import { findPrecedents } from "@/lib/modules/judicial-assistant/rulings";

export const dynamic = "force-dynamic";

export default async function CaseOverviewPage({ params }: { params: { caseId: string } }) {
  const user = await requirePagePermission("JUDICIAL_ASSISTANT_USE");
  const kase = await getCase(params.caseId);
  if (!kase) notFound();
  if (!caseVisibleTo({ userId: user.id, role: user.role }, kase)) notFound();

  const actions = suggestedActionsFor(kase);
  const [history, precedents] = await Promise.all([listAnalyses(kase.id), findPrecedents(kase)]);
  const nextHearing = [...kase.hearings].sort((a, b) => a.date.localeCompare(b.date))[0];
  const hasMap = kase.parties.length + kase.requests.length + kase.facts.length + kase.issues.length + kase.hearings.length + kase.gaps.length > 0;

  return (
    <div className="ja ja-case">
      <header className="ja-casehead">
        <div className="ja-casehead__top">
          <Link href="/dashboard/judicial-assistant/cases" className="ja-back"><JaIcon name="case" size={15} /> قضاياي</Link>
          <div className="ja-casehead__actions">
            <Link href={`/dashboard/judicial-assistant/cases/${kase.id}/audit`} className="ja-back"><JaIcon name="audit" size={15} /> سجلّ النشاط</Link>
            <span className="ja-stagepill ja-stagepill--lg">{STAGE_META[kase.stage].label}</span>
          </div>
        </div>
        <h1 className="ja-casehead__num">{kase.caseNumber || kase.subject}</h1>
        <p className="ja-casehead__subject">{kase.subject}</p>
        <div className="ja-casehead__meta">
          {kase.court ? <><span>{kase.court}</span><span aria-hidden>·</span></> : null}
          {kase.circuit ? <><span>{kase.circuit}</span><span aria-hidden>·</span></> : null}
          <span>قضاء {JURISDICTION_LABEL[kase.jurisdiction]}</span><span aria-hidden>·</span>
          <span>سرّيّة {CONFIDENTIALITY_LABEL[kase.confidentiality]}</span><span aria-hidden>·</span>
          <span>أُنشئت {formatDate(kase.createdAt)}</span>
        </div>
        <StageBar current={kase.stage} />
      </header>

      {/* المرفقات — المدخل الأساسيّ للقضية */}
      <section className="card ja-panel" aria-labelledby="ja-attach">
        <div className="ja-panel__row">
          <h2 id="ja-attach" className="ja-panel__title"><JaIcon name="documents" size={18} /> مرفقات القضية</h2>
          <AttachmentUploader caseId={kase.id} />
        </div>
        {kase.attachments.length === 0 ? (
          <LegalEmptyState title="لا مرفقات بعد" description="أضِف اللائحة والمذكّرات والمحاضر — الاستخراج محليّ في متصفّحك، ويصير المرفق مادّةً للتحليل." />
        ) : (
          <AttachmentList caseId={kase.id} attachments={kase.attachments} />
        )}
      </section>

      {/* لوحة تحكّم القضية — تعديل وحذف */}
      <section className="card ja-panel" aria-labelledby="ja-manage">
        <h2 id="ja-manage" className="ja-panel__title"><JaIcon name="security" size={18} /> إدارة القضية</h2>
        <CaseManageBar
          caseId={kase.id}
          initial={{
            subject: kase.subject, caseNumber: kase.caseNumber ?? "", court: kase.court ?? "", circuit: kase.circuit ?? "",
            jurisdiction: kase.jurisdiction, confidentiality: kase.confidentiality, stage: kase.stage,
          }}
        />
      </section>

      {/* استخلاص الخريطة من المرفقات (JS-005) — يُثبّتها القاضي فتُفعّل الحتميّة */}
      {kase.attachments.length > 0 ? (
        <section className="card ja-panel">
          <MapExtractor caseId={kase.id} hasMap={hasMap} />
        </section>
      ) : null}

      {/* لوحة الأعمال المقترحة */}
      <section className="card ja-panel" aria-labelledby="ja-suggested">
        <h2 id="ja-suggested" className="ja-panel__title"><JaIcon name="assistant" size={18} /> الأعمال المقترحة لهذه المرحلة</h2>
        <p className="ja-panel__hint">تُقترح بحسب مرحلة القضية، وتُشغَّل باختيارك — لا تلقائيًّا. تعتمد على مرفقاتك والنواة.</p>
        {kase.attachments.length === 0 ? (
          <LegalAlert tone="warning">أضِف مرفقًا واحدًا على الأقلّ لتُصبح المخرجات مؤصَّلةً على مادّة القضية.</LegalAlert>
        ) : null}
        <CaseActions caseId={kase.id} actions={actions} />
      </section>

      {precedents.length > 0 ? (
        <section className="card ja-panel" aria-labelledby="ja-precedents">
          <h2 id="ja-precedents" className="ja-panel__title"><JaIcon name="appeal" size={18} /> سوابق من النواة</h2>
          <p className="ja-panel__hint">أحكامٌ حقيقيّة من النواة مطابقةٌ لموضوع القضية — للتخريج، تُفتح للتحقّق.</p>
          <ul className="ja-list">
            {precedents.map((p) => (
              <li key={p.id} className="ja-list__row">
                <div>
                  <Link href={`/dashboard/legal-core/judgments/${p.id}`} className="ja-list__title">{p.title}</Link>
                  <div className="ja-list__sub">{p.court ?? "—"}{p.decisionNo ? ` · ${p.decisionNo}` : ""} — {p.snippet}…</div>
                </div>
                {!p.reviewed ? <span className="ja-badge ja-badge--warning">غير مُراجَع</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* خريطة القضية — تُعرض عند وجود عناصر (تُبنى من المرفقات لاحقًا) */}
      {hasMap ? (
        <>
          {kase.parties.length > 0 || kase.requests.length > 0 ? (
            <div className="ja-cols">
              {kase.parties.length > 0 ? (
                <section className="card ja-panel"><h2 className="ja-panel__title"><JaIcon name="map" size={18} /> الأطراف</h2>
                  <ul className="ja-plain">{kase.parties.map((p) => <li key={p.id}><b>{p.role}:</b> {p.name}</li>)}</ul>
                </section>
              ) : null}
              {kase.requests.length > 0 ? (
                <section className="card ja-panel"><h2 className="ja-panel__title"><JaIcon name="brief" size={18} /> الطلبات</h2>
                  <ul className="ja-plain">{kase.requests.map((r) => <li key={r.id}>{r.text}</li>)}</ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {kase.facts.length > 0 ? (
            <section className="card ja-panel"><h2 className="ja-panel__title"><JaIcon name="evidence" size={18} /> الوقائع</h2>
              <ul className="ja-facts">
                {kase.facts.map((f) => (
                  <li key={f.id} className="ja-fact">
                    <span className={`ja-badge ja-badge--${FACT_STATUS_TONE[f.status]}`}>{FACT_STATUS_LABEL[f.status]}</span>
                    <div className="ja-fact__body"><div className="ja-fact__text">{f.text}</div><div className="ja-fact__src">المصدر: {f.sourceLabel}</div></div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {kase.issues.length > 0 || nextHearing ? (
            <div className="ja-cols">
              {kase.issues.length > 0 ? (
                <section className="card ja-panel"><h2 className="ja-panel__title"><JaIcon name="issue" size={18} /> المسائل محلّ الفصل</h2>
                  <ul className="ja-plain">{kase.issues.map((i) => <li key={i.id}>{i.statement}</li>)}</ul>
                </section>
              ) : null}
              {nextHearing ? (
                <section className="card ja-panel"><h2 className="ja-panel__title"><JaIcon name="hearing" size={18} /> الجلسة القادمة</h2>
                  <p className="ja-plain">{formatDate(nextHearing.date)} — {nextHearing.purpose}</p>
                </section>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {history.length > 0 ? (
        <section className="card ja-panel" aria-labelledby="ja-history">
          <h2 id="ja-history" className="ja-panel__title"><JaIcon name="audit" size={18} /> سجلّ التحليلات المحفوظة</h2>
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
