// ─────────────────────────────────────────────────────────────────────────────
// الإفصاح الصادق (المرحلة ٤) — كل إجابة استقصائية تذكر **الأنظمة التي شملها البحث بالاسم
// والعدد**، وتُنبّه «قد توجد [بُعد] أخرى في أنظمة لم يشملها هذا العرض» إن كان جزئيًّا.
// لا ادّعاء شمول موهِم. نقيّ وحتميّ — يُختبَر بلا نموذج ولا قاعدة.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يبني ذيل إفصاح عن نطاق البحث.
 * @param systems أسماء الأنظمة التي شملها البحث فعلًا.
 * @param dimension البُعد (مدد/عقوبات…) للتنبيه على احتمال وجود غيره.
 * @param complete هل الفحص كامل لهذا النطاق (نظام واحد مُسِح كاملًا) أم عيّنة عبر أنظمة؟
 */
export function buildScopeDisclosure(opts: { systems: string[]; dimension?: string; complete?: boolean }): string {
  const systems = Array.from(new Set((opts.systems ?? []).map((s) => (s ?? "").trim()).filter(Boolean)));
  if (!systems.length) return "";
  const n = systems.length;
  const noun = n === 1 ? "نظامًا واحدًا" : n === 2 ? "نظامين" : `${n.toLocaleString("ar-SA")} أنظمة`;
  const list = systems.slice(0, 12).join("، ");
  const more = systems.length > 12 ? "…" : "";
  const dim = (opts.dimension ?? "أحكام").trim();
  const caveat = opts.complete
    ? ""
    : ` قد توجد ${dim} أخرى في أنظمة لم يشملها هذا العرض — للاستقصاء الأوسع حدّد نظامًا أو اطلب «استقصاء شامل».`;
  return `\n\n---\n**نطاق البحث (إفصاح):** شمل هذا العرض ${noun}: ${list}${more}.${caveat}`;
}

/** يستخرج أسماء الأنظمة الفريدة من مجموعة مواد (بترتيب أول ظهور). */
export function systemsFromArticles(articles: Array<{ systemName?: string | null }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of articles) {
    const name = (a.systemName ?? "").trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
