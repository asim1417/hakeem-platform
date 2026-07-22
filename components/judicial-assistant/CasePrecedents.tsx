// لوحة السوابق — مكوّن خادمٍ مؤجَّل (Suspense): يجري استعلامه بعد ظهور هيكل الصفحة،
// فلا يؤخّر التحميل الأوّل. أحكامٌ حقيقيّة من النواة مطابقةٌ لموضوع القضية.
import Link from "next/link";
import { JaIcon } from "./icons";
import { findPrecedents } from "@/lib/modules/judicial-assistant/rulings";
import type { JudicialCase } from "@/lib/modules/judicial-assistant/types";

export async function CasePrecedents({ kase }: { kase: JudicialCase }) {
  const precedents = await findPrecedents(kase).catch(() => []);
  if (!precedents.length) return null;
  return (
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
  );
}
