// سجلّ التحليلات — مكوّن خادمٍ مؤجَّل (Suspense): استعلامه بعد هيكل الصفحة، فلا يؤخّر التحميل.
import { JaIcon } from "./icons";
import { listAnalyses } from "@/lib/modules/judicial-assistant/persistence";
import { SERVICE_BY_ID } from "@/lib/modules/judicial-assistant/catalog";
import { formatDateTime } from "@/lib/modules/judicial-assistant/labels";

export async function CaseHistory({ caseId }: { caseId: string }) {
  const history = await listAnalyses(caseId).catch(() => []);
  if (!history.length) return null;
  return (
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
  );
}
