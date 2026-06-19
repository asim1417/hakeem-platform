/**
 * body-concepts.ts — استخراج المفاهيم من **كامل متن النظام** (لا مواد التعريفات فقط).
 *
 * المبدأ الحاكم: كل مفهوم هنا مُركّز على **العبارات القانونية المركّبة** أو المصطلحات
 * الفنية الدقيقة، ولا يُسجَّل أي مفهوم إلا إذا وُجد فعلاً في نصّ المادة (سند + اقتباس).
 * هذا الملف **معجم مُنسَّق مرتكز على الأنظمة السعودية** — ليس قائمة كلمات عامة،
 * وليس مصدراً خارجياً يولّد مفاهيم بلا سند. كل مدخل يُطابَق على متن المواد الحقيقي،
 * فإن لم يَرِد في المتن لم يُنشأ منه مفهوم.
 *
 * الأزواج الدقيقة (البطلان/الفسخ/الانفساخ، الدعوى/الطلب/الدفع، …) تبقى **مفاهيم منفصلة**
 * عبر carefulGroup — يُمنع دمجها لمجرد التشابه اللفظي.
 *
 * المطابقة على searchableText (يطوي ى→ي و ة→ه) مع حدود حروف عربية + توسعة السوابق
 * المقطعية (و/ف/ب/ك/ل + لام التعريف) دون علم لاحق بالنص. لا استخدام لراية u في regex.
 */
import { searchableText, splitSentences } from "@/lib/modules/legal-thesaurus/normalize";

/** أنواع المفاهيم (تشمل أنماط المتن: شروط/آثار/إجراءات/اختصاص/إثبات/تنفيذ/جزاء/حقوق). */
export type BodyConceptType =
  | "contractual_concept" // العقد والالتزام
  | "obligation_concept" // الالتزامات وآثارها
  | "validity_condition_concept" // شروط الصحة
  | "effect_concept" // الآثار القانونية
  | "remedy_concept" // الجزاءات المدنية (بطلان/فسخ/تعويض)
  | "property_concept" // الحقوق العينية والملكية
  | "right_concept" // الحقوق الشخصية
  | "liability_concept" // المسؤولية والضمان
  | "procedural_concept" // الدعوى والإجراءات
  | "jurisdictional_concept" // الاختصاص والولاية
  | "evidentiary_concept" // الإثبات والبينة
  | "enforcement_concept" // التنفيذ والسند التنفيذي
  | "legal_penalty" // العقوبة والغرامة
  | "person_status" // صفة الأطراف
  | "administrative_concept" // القرار والجهة الإدارية
  | "commercial_concept" // الشركات والتجارة
  | "general_legal_concept";

export interface BodyConceptEntry {
  /** التسمية المفضّلة للمفهوم. */
  label: string;
  type: BodyConceptType;
  /** اسم المجال (name_ar) كما في legal_thesaurus_domains. */
  domain: string;
  /** الصيغ السطحية للمطابقة (الأولى canonical، البقية مرادفات/صيغ). */
  variants: string[];
  /** مجموعة الأزواج الدقيقة — أعضاؤها لا يُدمجون أبداً. */
  carefulGroup?: string;
  /** هل المفهوم عبارة مركّبة (وليس كلمة مفردة)؟ */
  isCompound: boolean;
}

/**
 * المعجم المُنسَّق — مرتكز على متون الأنظمة السعودية (مدني/مرافعات/تنفيذ/شركات/إفلاس…).
 * يشمل الأزواج الدقيقة المطلوبة (منفصلة) + العبارات المركّبة الأساسية في المتن.
 */
export const BODY_CONCEPT_LEXICON: BodyConceptEntry[] = [
  // ── الأزواج الدقيقة: البطلان / الفسخ / الانفساخ (منفصلة) ──
  { label: "البطلان", type: "remedy_concept", domain: "مدني", carefulGroup: "termination_invalidity", isCompound: false, variants: ["البطلان", "بطلان"] },
  { label: "الفسخ", type: "remedy_concept", domain: "مدني", carefulGroup: "termination_invalidity", isCompound: false, variants: ["الفسخ", "فسخ"] },
  { label: "الانفساخ", type: "remedy_concept", domain: "مدني", carefulGroup: "termination_invalidity", isCompound: false, variants: ["الانفساخ", "انفساخ"] },
  { label: "الإبطال", type: "remedy_concept", domain: "مدني", carefulGroup: "termination_invalidity", isCompound: false, variants: ["الابطال", "ابطال"] },

  // ── الدعوى / الطلب / الدفع (منفصلة) ──
  { label: "الدعوى", type: "procedural_concept", domain: "مرافعات", carefulGroup: "claim_request_plea", isCompound: false, variants: ["الدعوى", "دعوى"] },
  { label: "الطلب", type: "procedural_concept", domain: "مرافعات", carefulGroup: "claim_request_plea", isCompound: false, variants: ["الطلب", "الطلبات"] },
  { label: "الدفع", type: "procedural_concept", domain: "مرافعات", carefulGroup: "claim_request_plea", isCompound: false, variants: ["الدفع", "الدفوع"] },

  // ── الحكم / القرار / الأمر (منفصلة) ──
  { label: "الحكم", type: "procedural_concept", domain: "مرافعات", carefulGroup: "judgment_decision_order", isCompound: false, variants: ["الحكم", "الاحكام"] },
  { label: "القرار", type: "administrative_concept", domain: "إداري", carefulGroup: "judgment_decision_order", isCompound: false, variants: ["القرار", "القرارات"] },
  { label: "الأمر", type: "procedural_concept", domain: "مرافعات", carefulGroup: "judgment_decision_order", isCompound: false, variants: ["الامر القضائي", "اوامر الاداء", "امر الاداء"] },

  // ── الدائن / طالب التنفيذ / المحكوم له (منفصلة) ──
  { label: "الدائن", type: "person_status", domain: "مدني", carefulGroup: "creditor_side", isCompound: false, variants: ["الدائن", "الدائنين", "الدائنون"] },
  { label: "طالب التنفيذ", type: "person_status", domain: "تنفيذ", carefulGroup: "creditor_side", isCompound: true, variants: ["طالب التنفيذ"] },
  { label: "المحكوم له", type: "person_status", domain: "تنفيذ", carefulGroup: "creditor_side", isCompound: true, variants: ["المحكوم له"] },

  // ── المدين / المنفذ ضده / المحكوم عليه (منفصلة) ──
  { label: "المدين", type: "person_status", domain: "مدني", carefulGroup: "debtor_side", isCompound: false, variants: ["المدين", "المدينين", "المدينون"] },
  { label: "المنفذ ضده", type: "person_status", domain: "تنفيذ", carefulGroup: "debtor_side", isCompound: true, variants: ["المنفذ ضده"] },
  { label: "المحكوم عليه", type: "person_status", domain: "تنفيذ", carefulGroup: "debtor_side", isCompound: true, variants: ["المحكوم عليه"] },

  // ── التعويض / الغرامة / الجزاء (منفصلة) ──
  { label: "التعويض", type: "remedy_concept", domain: "مدني", carefulGroup: "compensation_penalty", isCompound: false, variants: ["التعويض", "تعويض"] },
  { label: "الغرامة", type: "legal_penalty", domain: "عقوبات", carefulGroup: "compensation_penalty", isCompound: false, variants: ["الغرامة", "الغرامات", "غرامة"] },
  { label: "الجزاء", type: "legal_penalty", domain: "عقوبات", carefulGroup: "compensation_penalty", isCompound: false, variants: ["الجزاء", "الجزاءات"] },

  // ── العقد / الاتفاق / الالتزام (منفصلة) ──
  { label: "العقد", type: "contractual_concept", domain: "مدني", carefulGroup: "contract_obligation", isCompound: false, variants: ["العقد", "العقود", "عقد"] },
  { label: "الاتفاق", type: "contractual_concept", domain: "مدني", carefulGroup: "contract_obligation", isCompound: false, variants: ["الاتفاق", "الاتفاقات", "اتفاق"] },
  { label: "الالتزام", type: "obligation_concept", domain: "مدني", carefulGroup: "contract_obligation", isCompound: false, variants: ["الالتزام", "الالتزامات", "التزام"] },

  // ── الملكية / الحيازة / الانتفاع (منفصلة) ──
  { label: "الملكية", type: "property_concept", domain: "عقاري", carefulGroup: "ownership_possession", isCompound: false, variants: ["الملكية", "ملكية", "التملك"] },
  { label: "الحيازة", type: "property_concept", domain: "عقاري", carefulGroup: "ownership_possession", isCompound: false, variants: ["الحيازة", "حيازة"] },
  { label: "الانتفاع", type: "property_concept", domain: "عقاري", carefulGroup: "ownership_possession", isCompound: false, variants: ["الانتفاع", "حق الانتفاع"] },

  // ── الاختصاص / الولاية / الصلاحية (منفصلة) ──
  { label: "الاختصاص", type: "jurisdictional_concept", domain: "مرافعات", carefulGroup: "jurisdiction_authority", isCompound: false, variants: ["الاختصاص", "اختصاص"] },
  { label: "الولاية", type: "jurisdictional_concept", domain: "مرافعات", carefulGroup: "jurisdiction_authority", isCompound: false, variants: ["الولاية القضائية", "ولاية"] },
  { label: "الصلاحية", type: "jurisdictional_concept", domain: "إداري", carefulGroup: "jurisdiction_authority", isCompound: false, variants: ["الصلاحية", "الصلاحيات"] },

  // ── الإخطار / التبليغ / الإعلان (منفصلة) ──
  { label: "الإخطار", type: "procedural_concept", domain: "إجراءات", carefulGroup: "notification", isCompound: false, variants: ["الاخطار", "اخطار"] },
  { label: "التبليغ", type: "procedural_concept", domain: "إجراءات", carefulGroup: "notification", isCompound: false, variants: ["التبليغ", "تبليغ", "التبليغات"] },
  { label: "الإعلان", type: "procedural_concept", domain: "إجراءات", carefulGroup: "notification", isCompound: false, variants: ["الاعلان القضائي", "اعلان"] },

  // ── الإلغاء / السحب / الشطب (منفصلة) ──
  { label: "الإلغاء", type: "administrative_concept", domain: "إداري", carefulGroup: "cancellation", isCompound: false, variants: ["الالغاء", "الغاء"] },
  { label: "السحب", type: "administrative_concept", domain: "إداري", carefulGroup: "cancellation", isCompound: false, variants: ["سحب القرار", "السحب"] },
  { label: "الشطب", type: "administrative_concept", domain: "إداري", carefulGroup: "cancellation", isCompound: false, variants: ["الشطب", "شطب"] },

  // ── المسؤولية / الضمان / الكفالة (منفصلة) ──
  { label: "المسؤولية", type: "liability_concept", domain: "مدني", carefulGroup: "liability_guarantee", isCompound: false, variants: ["المسؤولية", "مسؤولية"] },
  { label: "الضمان", type: "liability_concept", domain: "مدني", carefulGroup: "liability_guarantee", isCompound: false, variants: ["الضمان", "ضمان"] },
  { label: "الكفالة", type: "liability_concept", domain: "مدني", carefulGroup: "liability_guarantee", isCompound: false, variants: ["الكفالة", "كفالة", "الكفيل"] },

  // ── الإثبات / البينة / الدليل / القرينة (منفصلة) ──
  { label: "الإثبات", type: "evidentiary_concept", domain: "إثبات", carefulGroup: "evidence", isCompound: false, variants: ["الاثبات", "اثبات"] },
  { label: "البينة", type: "evidentiary_concept", domain: "إثبات", carefulGroup: "evidence", isCompound: false, variants: ["البينة", "البينات"] },
  { label: "الدليل", type: "evidentiary_concept", domain: "إثبات", carefulGroup: "evidence", isCompound: false, variants: ["الدليل", "الادلة"] },
  { label: "القرينة", type: "evidentiary_concept", domain: "إثبات", carefulGroup: "evidence", isCompound: false, variants: ["القرينة", "القرائن"] },

  // ── عبارات مركّبة أساسية في المتن (شروط/آثار/جزاءات/حقوق/تنفيذ/شركات) ──
  { label: "شروط صحة العقد", type: "validity_condition_concept", domain: "مدني", isCompound: true, variants: ["شروط صحة العقد", "شروط انعقاد العقد", "اركان العقد"] },
  { label: "آثار العقد", type: "effect_concept", domain: "مدني", isCompound: true, variants: ["اثار العقد"] },
  { label: "بطلان العقد", type: "remedy_concept", domain: "مدني", isCompound: true, variants: ["بطلان العقد", "العقد الباطل"] },
  { label: "فسخ العقد", type: "remedy_concept", domain: "مدني", isCompound: true, variants: ["فسخ العقد"] },
  { label: "انفساخ العقد", type: "remedy_concept", domain: "مدني", isCompound: true, variants: ["انفساخ العقد"] },
  { label: "المسؤولية العقدية", type: "liability_concept", domain: "مدني", isCompound: true, variants: ["المسؤولية العقدية"] },
  { label: "المسؤولية التقصيرية", type: "liability_concept", domain: "مدني", isCompound: true, variants: ["المسؤولية التقصيرية", "العمل غير المشروع"] },
  { label: "القوة القاهرة", type: "effect_concept", domain: "مدني", isCompound: true, variants: ["القوة القاهرة", "الظرف الطارئ"] },
  { label: "الإثراء بلا سبب", type: "obligation_concept", domain: "مدني", isCompound: true, variants: ["الاثراء بلا سبب", "الكسب غير المشروع"] },
  { label: "الحق العيني", type: "property_concept", domain: "عقاري", isCompound: true, variants: ["الحق العيني", "الحقوق العينية"] },
  { label: "الحق الشخصي", type: "right_concept", domain: "مدني", isCompound: true, variants: ["الحق الشخصي", "الحقوق الشخصية"] },
  { label: "الدفع بعدم الاختصاص", type: "procedural_concept", domain: "مرافعات", isCompound: true, variants: ["الدفع بعدم الاختصاص", "عدم الاختصاص"] },
  { label: "عبء الإثبات", type: "evidentiary_concept", domain: "إثبات", isCompound: true, variants: ["عبء الاثبات", "عبء الاثبات على"] },
  { label: "السند التنفيذي", type: "enforcement_concept", domain: "تنفيذ", isCompound: true, variants: ["السند التنفيذي", "السندات التنفيذية"] },
  { label: "منازعة التنفيذ", type: "enforcement_concept", domain: "تنفيذ", isCompound: true, variants: ["منازعة التنفيذ", "منازعات التنفيذ"] },
  { label: "الحكم النهائي", type: "procedural_concept", domain: "مرافعات", isCompound: true, variants: ["الحكم النهائي", "الاحكام النهائية", "الحكم القطعي"] },
  { label: "القرار الإداري", type: "administrative_concept", domain: "إداري", isCompound: true, variants: ["القرار الاداري", "القرارات الادارية"] },
  { label: "دعوى البطلان", type: "procedural_concept", domain: "مرافعات", isCompound: true, variants: ["دعوى البطلان", "دعوى بطلان"] },
  { label: "تصفية الشركة", type: "commercial_concept", domain: "شركات", isCompound: true, variants: ["تصفية الشركة", "تصفية الشركات", "التصفية"] },
  { label: "إعادة التنظيم المالي", type: "commercial_concept", domain: "إفلاس", isCompound: true, variants: ["اعادة التنظيم المالي", "اعادة التنظيم"] },
  { label: "التسوية الوقائية", type: "commercial_concept", domain: "إفلاس", isCompound: true, variants: ["التسوية الوقائية"] },
  { label: "الجهة المختصة", type: "jurisdictional_concept", domain: "إداري", isCompound: true, variants: ["الجهة المختصة", "الجهات المختصة"] },
  { label: "المحكمة المختصة", type: "jurisdictional_concept", domain: "مرافعات", isCompound: true, variants: ["المحكمة المختصة"] },
  { label: "الحالة المستعجلة", type: "procedural_concept", domain: "مرافعات", isCompound: true, variants: ["الحالة المستعجلة", "الامور المستعجلة", "القضاء المستعجل"] },
];

const AR = "ء-ي"; // مدى الحروف العربية بعد التطبيع

/** يهرّب رموز regex الخاصة من صيغة نصّية. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * توسعة السوابق المقطعية لصيغة: حروف الجرّ/العطف المباشرة (ب/ك) ولام الجرّ المُدغمة
 * مع لام التعريف («العقد»→«للعقد»)، ثم العطف (و/ف) فوقها («وللعقد»، «وبالعقد»).
 * بلا راية u في regex.
 */
function expandClitics(form: string): string[] {
  const out = new Set<string>([form]);
  // الجرّ المباشر الملصق
  const direct = [form, "ب" + form, "ك" + form];
  // لام الجرّ: مع «ال» التعريف تُدغم، وإلا «لـ»+الكلمة
  direct.push(form.startsWith("ال") ? "ل" + form.slice(1) : "ل" + form);
  for (const d of direct) {
    out.add(d);
    // العطف/الاستئناف فوق الصيغة (و/ف): «وللعقد»، «وبالعقد»، «فالعقد»…
    out.add("و" + d);
    out.add("ف" + d);
  }
  return [...out];
}

interface CompiledForm {
  re: RegExp;
  matchType: "exact_label_match" | "synonym_match" | "variant_match";
}

interface CompiledEntry {
  entry: BodyConceptEntry;
  forms: CompiledForm[];
}

/** يبني صيغ المطابقة لكل مدخل مرة واحدة (canonical=exact، البقية=synonym، السوابق=variant). */
const COMPILED: CompiledEntry[] = BODY_CONCEPT_LEXICON.map((entry) => {
  const forms: CompiledForm[] = [];
  const seen = new Set<string>();
  entry.variants.forEach((variant, idx) => {
    const base = searchableText(variant);
    if (!base) return;
    const baseType = idx === 0 ? "exact_label_match" : "synonym_match";
    for (const f of expandClitics(base)) {
      if (seen.has(f)) continue;
      seen.add(f);
      const isClitic = f !== base;
      const re = new RegExp(`(?<![${AR}])${escapeRe(f)}(?![${AR}])`, "g");
      forms.push({ re, matchType: isClitic ? "variant_match" : baseType });
    }
  });
  return { entry, forms };
});

export interface ConceptHit {
  entry: BodyConceptEntry;
  /** عدد مرّات الورود في هذه المادة. */
  count: number;
  /** أقوى نوع مطابقة وُجد (exact > synonym > variant). */
  matchType: "exact_label_match" | "synonym_match" | "variant_match";
  /** الجملة الحاوية لأول ورود (اقتباس السند). */
  evidence: string;
}

const MATCH_RANK = { exact_label_match: 3, synonym_match: 2, variant_match: 1 } as const;

/**
 * يمسح متن مادة واحدة عن مفاهيم المعجم. لا يُرجِع إلا ما وُرِد فعلاً في النص،
 * مع عدّ مرّات الورود واقتباس الجملة الحاوية لأول ورود (السند).
 */
export function scanArticleForConcepts(articleText: string): ConceptHit[] {
  const text = searchableText(articleText);
  if (!text) return [];
  const sentencesRaw = splitSentences(articleText);
  const sentencesNorm = sentencesRaw.map((s) => searchableText(s));

  const hits: ConceptHit[] = [];
  for (const { entry, forms } of COMPILED) {
    let count = 0;
    let best: ConceptHit["matchType"] | null = null;
    let firstForm = "";
    for (const { re, matchType } of forms) {
      re.lastIndex = 0;
      const m = text.match(re);
      if (m && m.length) {
        count += m.length;
        if (!best || MATCH_RANK[matchType] > MATCH_RANK[best]) { best = matchType; firstForm = m[0]; }
      }
    }
    if (count > 0 && best) {
      // اقتباس السند: أول جملة تحوي الصيغة المطابِقة، وإلا أول 160 حرفاً.
      let evidence = "";
      const idx = sentencesNorm.findIndex((s) => firstForm && s.includes(firstForm));
      evidence = (idx >= 0 ? sentencesRaw[idx] : (sentencesRaw[0] ?? articleText)).slice(0, 300);
      hits.push({ entry, count, matchType: best, evidence });
    }
  }
  return hits;
}

/**
 * كشف العبارات المركّبة المرشّحة من **كامل المتن** عبر مفاتيح بنيوية (شروط/آثار/دعوى/
 * الدفع بـ/سند/عبء/حق …). نتائجها **مرشّحات للمراجعة فقط** — لا تُعتمد مفاهيم آلياً،
 * إثباتاً لأن المسح يغطّي المتن كلّه ويلتقط العبارات خارج المعجم لإحالتها للمراجع.
 */
const COMPOUND_CUES: RegExp[] = [
  /شروط\s+[ء-ي]{3,}(?:\s+[ء-ي]{3,})?/g,
  /اثار\s+[ء-ي]{3,}/g,
  /دعوى\s+[ء-ي]{3,}/g,
  /الدفع\s+ب[ء-ي]{3,}/g,
  /سند\s+[ء-ي]{3,}/g,
  /عبء\s+[ء-ي]{3,}/g,
  /حق\s+[ء-ي]{3,}/g,
  /منازعة\s+[ء-ي]{3,}/g,
  /اعادة\s+[ء-ي]{3,}/g,
  /تصفية\s+[ء-ي]{3,}/g,
];

/** كلمات عامة تُستبعد من رؤوس العبارات المرشّحة (منع تحويل المكنز لقائمة كلمات). */
const GENERAL_HEADS = new Set<string>(["هذا", "ذلك", "التي", "الذي", "النظام", "المادة", "اللائحة", "احكام", "الاحكام"]);

export interface CompoundCandidate {
  phrase: string;
  count: number;
}

/** يلتقط عبارات مركّبة مرشّحة (للمراجعة) من متن مادة. */
export function scanCompoundCandidates(articleText: string): CompoundCandidate[] {
  const text = searchableText(articleText);
  const freq = new Map<string, number>();
  for (const cue of COMPOUND_CUES) {
    cue.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = cue.exec(text)) !== null) {
      const phrase = m[0].replace(/\s+/g, " ").trim();
      const words = phrase.split(" ");
      if (words.length < 2) continue;
      if (words.some((w) => GENERAL_HEADS.has(w))) continue;
      freq.set(phrase, (freq.get(phrase) ?? 0) + 1);
    }
  }
  return [...freq.entries()].map(([phrase, count]) => ({ phrase, count })).sort((a, b) => b.count - a.count);
}
