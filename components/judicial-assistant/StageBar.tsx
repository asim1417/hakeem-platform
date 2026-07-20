// شريط المراحل (§21) — يشرح حالة القضية ولا يوحي بنتيجةٍ لها. عرضٌ فقط.
import { STAGE_META, STAGE_ORDER } from "@/lib/modules/judicial-assistant/catalog";
import type { CaseStage } from "@/lib/modules/judicial-assistant/types";

export function StageBar({ current }: { current: CaseStage }) {
  const currentIndex = STAGE_META[current].index;
  return (
    <div className="ja-stagebar" role="list" aria-label="مرحلة القضية">
      {STAGE_ORDER.map((stage) => {
        const meta = STAGE_META[stage];
        const state = meta.index < currentIndex ? "done" : meta.index === currentIndex ? "current" : "todo";
        return (
          <div key={stage} role="listitem" className={`ja-stage ja-stage--${state}`} title={meta.hint}>
            <span className="ja-stage__dot" aria-hidden />
            <span className="ja-stage__label">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}
