// عرضٌ بصريّ لكتالوج خدمات المعاون القضائي، مجموعةً في فئات — يُبرز قوّة المنتج (٢٤ خدمة).
import { SERVICE_GROUPS, SERVICE_BY_ID, SERVICES } from "@/lib/modules/judicial-assistant/catalog";
import { JaIcon } from "./icons";

export function ServiceShowcase() {
  const total = SERVICES.filter((s) => s.available).length;
  return (
    <section className="ja-showcase" aria-labelledby="ja-showcase-t">
      <div className="ja-showcase__head">
        <h2 id="ja-showcase-t" className="ja-panel__title"><JaIcon name="assistant" size={18} /> ماذا يقدّم المعاون؟</h2>
        <span className="ja-showcase__count">{total} خدمة قضائيّة</span>
      </div>
      <div className="ja-showcase__grid">
        {SERVICE_GROUPS.map((g) => (
          <div key={g.title} className="ja-catcard">
            <div className="ja-catcard__head">
              <span className="ja-catcard__ic"><JaIcon name={g.iconKey} size={18} /></span>
              <div>
                <h3>{g.title}</h3>
                <p>{g.hint}</p>
              </div>
            </div>
            <div className="ja-catcard__chips">
              {g.ids.map((id) => {
                const s = SERVICE_BY_ID[id];
                if (!s) return null;
                return (
                  <span key={id} className="ja-svcchip" title={`${s.title} (${id})`}>
                    <JaIcon name={s.iconKey} size={13} />
                    {s.title}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
