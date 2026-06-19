/**
 * definitions.ts — كشف مواد التعريفات الصريحة واستخراج المصطلحات المُعرَّفة (نقيّة).
 *
 * المبدأ: أعلى ثقة للمكنز هي المصطلحات التي عرّفها النظام صراحةً («يقصد بـ X: …»).
 * نستخرج هذه أولاً مع تعريفها ودليلها النصّي. لا نخمّن، ولا نعتمد ما لا تعريف له هنا.
 */

/** أنماط ترويسة مواد التعريفات السعودية. */
export const DEFINITION_TRIGGERS: RegExp[] = [
  /يقصد\s+بالكلمات\s+والعبارات/,
  /يقصد\s+بـ?ال?/,
  /يقصد\s+به/,
  /لأغراض\s+(هذا\s+النظام|تطبيق)/,
  /المعاني\s+المبينة\s+أمام\s+كل\s+منها/,
  /المعاني\s+الموضحة/,
  /ما\s+لم\s+يقتضِ?\s+السياق/,
  /يدل\s+اللفظ/,
  /يكون\s+للكلمات\s+الآتية/,
];

/** هل المادة مادة تعريفات صريحة؟ */
export function isDefinitionArticle(text: string, title?: string): boolean {
  const t = `${title ?? ""}\n${text ?? ""}`;
  if (/^\s*التعريفات\s*$/.test((title ?? "").trim())) return true;
  return DEFINITION_TRIGGERS.some((re) => re.test(t));
}

/** الأنماط المتطابقة (لتسجيلها كدليل). */
export function matchedTriggers(text: string, title?: string): string[] {
  const t = `${title ?? ""}\n${text ?? ""}`;
  return DEFINITION_TRIGGERS.filter((re) => re.test(t)).map((re) => re.source);
}

export interface DefinedTerm {
  term: string;
  definition: string;
}

/** كلمات/روابط لا تصلح مصطلحاً قانونياً (تُرفض حتى لو سبقها «:»). */
export const TERM_STOPWORDS = new Set<string>([
  "مثل", "وتشمل", "تشمل", "وتعني", "تعني", "ويقصد", "أي", "منها", "ومنها",
  "الترتيبات", "كما", "أيضا", "أيضاً", "وكذلك", "كذلك", "ذلك", "وهي", "وهو",
  "حيث", "بحيث", "وعليه", "عليه", "ويكون", "يكون", "وغيرها", "غيرها", "إلخ",
]);

/**
 * ترويسات تقسيم النظام (قسم/باب/فصل/فرع/كتاب/مبحث/جزء) — ليست مصطلحات.
 * تُرفض إذا بدأ بها المصطلح، لمنع التقاط «القسم الأول: الالتزامات…» تعريفاً.
 */
const STRUCTURAL_HEADER = /^(ال)?(قسم|باب|فصل|فرع|كتاب|مبحث|جزء|مادة|بند|فقرة)(\s|$)/;

/** يجرّد السوابق المقطعية (لـ/و/ف/ب/ك) من بداية المصطلح إن أنتجت كلمة سليمة. */
export function stripLeadingClitics(term: string): string {
  let t = term.trim();
  // «و» العطف و«ف» في بداية المصطلح الملتقَط خطأً
  t = t.replace(/^[وف]\s*/u, "");
  // لام الجرّ الملتصقة: «لتنظيم»→«تنظيم»، «لوزارة»→«وزارة»، «لمركز»→«مركز»
  // (نجرّدها فقط إن لم تكن جزءاً من «ال» التعريف، وإن بقي ≥3 أحرف)
  const mLam = t.match(/^ل([^ا].{2,})$/u);
  if (mLam && !/^لل/.test(t)) t = mLam[1];
  return t.trim();
}


/**
 * يستخرج أزواج (مصطلح: تعريف) من مادة تعريفات.
 * يتعامل مع الصيغتين: أسطر منفصلة («المصطلح: التعريف») أو نصّ متّصل.
 * محافظ: طول المصطلح 2..60، التعريف ≥ 5 أحرف، ويُسقط ما يشبه الجُمل لا المصطلحات.
 */
export function extractDefinedTerms(text: string): DefinedTerm[] {
  if (!text) return [];
  // نبدأ بعد ترويسة التعريف (أول نقطتين بعد الترويسة) إن وُجدت — وإلا النصّ كاملاً.
  let body = text.replace(/\r/g, "");
  const headIdx = body.search(/(المعاني\s+المبينة\s+أمام\s+كل\s+منها|المعاني\s+الموضحة|الآتية)\s*[:：]/);
  if (headIdx >= 0) {
    const after = body.slice(headIdx);
    const colon = after.indexOf(":");
    if (colon >= 0) body = after.slice(colon + 1);
  }

  const out: DefinedTerm[] = [];
  const seen = new Set<string>();
  const push = (termRaw: string, defRaw: string) => {
    let term = termRaw.replace(/^[\s\-–•0-9.)؛،"«»]+/, "").replace(/\s+/g, " ").trim();
    term = stripLeadingClitics(term); // تجريد سوابق «لـ/و/ف»
    const definition = defRaw.replace(/\s+/g, " ").trim().replace(/[.،؛]\s*$/, "");
    if (term.length < 3 || term.length > 60) return; // ≥3 أحرف بعد التجريد
    if (definition.length < 5) return;
    if (/[.!?؟]/.test(term)) return; // علامات جملة ⇒ ليست مصطلحاً
    if (STRUCTURAL_HEADER.test(term)) return; // ترويسة قسم/باب/فصل ⇒ ليست مصطلحاً
    // كلمة واحدة من قائمة الإيقاف (روابط) ⇒ ترفض
    const words = term.split(/\s+/);
    if (words.length === 1 && TERM_STOPWORDS.has(term.replace(/^ال/, ""))) return;
    if (TERM_STOPWORDS.has(term)) return;
    // المصطلح يجب أن يبدأ بحرف عربي (لا رقم/رمز)
    if (!/^[ء-ي]/.test(term)) return;
    const key = term.replace(/\s+/g, " ");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ term, definition });
  };

  // المسار ١: أسطر «مصطلح: تعريف»
  const lines = body.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    for (const line of lines) {
      const m = line.match(/^([^:：]{2,60})\s*[:：]\s*(.+)$/);
      if (m) push(m[1], m[2]);
    }
  }

  // المسار ٢ (نصّ متّصل): يلتقط «مصطلح:» ثم التعريف حتى المصطلح التالي أو النهاية
  if (out.length === 0) {
    const re = /([^:：،؛\n.]{2,50})\s*[:：]\s*([^:：]+?)(?=(?:[^:：،؛\n.]{2,50}\s*[:：])|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) push(m[1], m[2]);
  }

  return out;
}

/** تصنيف أولي لنوع المفهوم من المصطلح/التعريف (يبقى needs_review). */
export function classifyConceptType(term: string, definition: string): string {
  const t = `${term} ${definition}`;
  if (/(الوزارة|الهيئة|اللجنة|المجلس|الجهة|الإدارة|المركز|الأمانة|الديوان|المؤسسة)/.test(term)) return "administrative_concept";
  if (/(الوزير|الرئيس|المحافظ|الموظف|المكلف|المرخص|صاحب|المستفيد|المعني|الطرف)/.test(term)) return "person_status";
  if (/(غرامة|عقوبة|جزاء|مصادرة|سجن|جلد)/.test(t)) return "legal_penalty";
  if (/(دعوى|طلب|مرافعة|جلسة|تبليغ|إخطار|إعلان|طعن|اعتراض|استئناف|تمييز)/.test(t)) return "procedural_concept";
  if (/(تنفيذ|حجز|سند تنفيذي|منفذ)/.test(t)) return "enforcement_concept";
  if (/(إثبات|بينة|دليل|قرينة|شهادة|يمين)/.test(t)) return "evidentiary_concept";
  if (/(عقد|اتفاق|التزام|تعهد)/.test(t)) return "contractual_concept";
  if (/(اختصاص|ولاية|صلاحية|محكمة)/.test(t)) return "jurisdictional_concept";
  if (/(ضريبة|زكاة|رسوم|مقابل مالي|غرم)/.test(t)) return "financial_concept";
  if (/(شركة|تاجر|تجاري|سجل تجاري)/.test(t)) return "commercial_concept";
  if (/(زواج|طلاق|حضانة|نفقة|نسب|إرث|وصية)/.test(t)) return "family_concept";
  if (/(جريمة|جناية|جنحة|مخالفة)/.test(t)) return "criminal_concept";
  return "general_legal_concept";
}
