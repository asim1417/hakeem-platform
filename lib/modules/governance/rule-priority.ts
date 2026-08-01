// حلّ أولوية القواعد — المخطط السيادي §16. نواة نقيّة.
// الأولوية: القرار الرسميّ الأحدث > سياسة المؤسسة > القسم/الوحدة > حزمة المجال > الافتراضي.
// يسجّل «لماذا طُبِّقت كل قاعدة» (شفافية §16).

export type RuleLayer = "official" | "institution" | "department" | "domain" | "default";

const LAYER_RANK: Record<RuleLayer, number> = {
  official: 0,
  institution: 1,
  department: 2,
  domain: 3,
  default: 4,
};

export interface LayeredRule<T = unknown> {
  key: string; // مفتاح منطقيّ (قواعد بنفس المفتاح تتنافس)
  layer: RuleLayer;
  effectiveFrom?: string | null; // ISO — للأحدثيّة داخل نفس الطبقة
  value: T;
}

export interface ResolvedRule<T> {
  key: string;
  layer: RuleLayer;
  value: T;
  reason: string;
  overrode: Array<{ layer: RuleLayer; reason: string }>;
}

/**
 * يحلّ التعارضات: لكل مفتاح تُختار الطبقة الأعلى أولويّة، وداخلها الأحدث سريانًا.
 * يعيد القاعدة المطبَّقة لكل مفتاح مع سجلّ ما تجاوزته.
 */
export function resolveRules<T>(rules: LayeredRule<T>[]): ResolvedRule<T>[] {
  const byKey = new Map<string, LayeredRule<T>[]>();
  for (const r of rules) {
    const arr = byKey.get(r.key) ?? [];
    arr.push(r);
    byKey.set(r.key, arr);
  }

  const out: ResolvedRule<T>[] = [];
  for (const [key, group] of byKey) {
    const sorted = [...group].sort((a, b) => {
      const byLayer = LAYER_RANK[a.layer] - LAYER_RANK[b.layer];
      if (byLayer !== 0) return byLayer;
      // نفس الطبقة → الأحدث سريانًا أولًا.
      const ta = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
      const tb = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
      return tb - ta;
    });
    const winner = sorted[0];
    const overrode = sorted.slice(1).map((r) => ({
      layer: r.layer,
      reason: `تجاوزته الطبقة الأعلى «${winner.layer}»`,
    }));
    out.push({
      key,
      layer: winner.layer,
      value: winner.value,
      reason: `طُبِّقت من طبقة «${winner.layer}» (الأعلى أولويّة${winner.effectiveFrom ? " والأحدث سريانًا" : ""}).`,
      overrode,
    });
  }
  return out;
}
