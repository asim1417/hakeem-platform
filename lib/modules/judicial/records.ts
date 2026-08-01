// ─────────────────────────────────────────────────────────────────────────────
// §18 — محرّك محاضر الضبط (Judicial Session-Record Engine)
//
// محضر الضبط مستندٌ شكليٌّ صارم: له عناصرُ لازمةٌ لصحّته (ديباجة/محكمة/دائرة/تاريخ
// هجريّ/حضور الأطراف/الموضوع/سير الجلسة/ما تقرّر/التوقيعات). هذا المحرّك يبني الهيكل
// الشكليّ ويتحقّق من اكتمال عناصره — نقيّ وحتميّ، لا يكتب سردًا ولا يختلق حضورًا.
// العنصر غير المتوفّر يُعلَّم «ناقص»؛ ولا يُزعَم اكتمال محضرٍ ناقص (RECORD_FORMALISM).
// ─────────────────────────────────────────────────────────────────────────────

export type RecordElementKey =
  | "PREAMBLE"
  | "COURT"
  | "CIRCUIT"
  | "HIJRI_DATE"
  | "SESSION_NO"
  | "PARTIES_PRESENT"
  | "SUBJECT"
  | "PROCEEDINGS"
  | "DECISIONS"
  | "NEXT_SESSION"
  | "SIGNATURES";

export interface RecordElementSpec {
  key: RecordElementKey;
  titleAr: string;
  /** لازمٌ لصحّة المحضر (النقص يمنع الاعتماد الشكليّ). */
  mandatory: boolean;
  /** كلماتٌ مفتاحيّةٌ للكشف عن وجود العنصر في مدخلٍ حرّ. */
  cuesAr: string[];
}

const RECORD_ELEMENTS: RecordElementSpec[] = [
  { key: "PREAMBLE", titleAr: "الديباجة (بسم الله + افتتاح الجلسة)", mandatory: true, cuesAr: ["بسم الله", "افتتحت الجلسة", "الحمد لله"] },
  { key: "COURT", titleAr: "المحكمة", mandatory: true, cuesAr: ["المحكمة", "محكمة"] },
  { key: "CIRCUIT", titleAr: "الدائرة", mandatory: true, cuesAr: ["الدائرة", "دائرة"] },
  { key: "HIJRI_DATE", titleAr: "تاريخ الجلسة الهجريّ", mandatory: true, cuesAr: ["هـ", "بتاريخ", "الموافق"] },
  { key: "SESSION_NO", titleAr: "رقم الجلسة/القضية", mandatory: true, cuesAr: ["رقم", "القضية", "الجلسة"] },
  { key: "PARTIES_PRESENT", titleAr: "حضور الأطراف وصفاتهم", mandatory: true, cuesAr: ["حضر", "المدعي", "المدعى عليه", "وكيل", "غاب"] },
  { key: "SUBJECT", titleAr: "موضوع الجلسة", mandatory: true, cuesAr: ["الموضوع", "موضوع الدعوى", "بشأن"] },
  { key: "PROCEEDINGS", titleAr: "سير الجلسة والإفادات", mandatory: true, cuesAr: ["أفاد", "قرّر", "بيّن", "سُئل", "أجاب", "اطّلعت الدائرة"] },
  { key: "DECISIONS", titleAr: "ما تقرّر في الجلسة", mandatory: true, cuesAr: ["قرّرت الدائرة", "تقرّر", "قرّرت المحكمة", "أمرت"] },
  { key: "NEXT_SESSION", titleAr: "تحديد الجلسة القادمة (إن وُجدت)", mandatory: false, cuesAr: ["الجلسة القادمة", "رُفعت الجلسة إلى", "التأجيل"] },
  { key: "SIGNATURES", titleAr: "توقيعات القاضي وأمين السرّ", mandatory: true, cuesAr: ["القاضي", "أمين السرّ", "التوقيع", "وبالله التوفيق"] },
];

export interface BuildRecordInput {
  /** نصّ محضرٍ قائمٍ لفحصه (اختياريّ) — يُطابَق بالكلمات المفتاحيّة. */
  recordText?: string;
  /** عناصرُ متوفّرةٌ صراحةً (مفاتيح) — تُضاف لِما يُكشَف من النصّ. */
  presentKeys?: RecordElementKey[];
}

export interface RecordElementCheck {
  key: RecordElementKey;
  titleAr: string;
  mandatory: boolean;
  present: boolean;
}

export interface JudicialRecordScaffold {
  elements: RecordElementCheck[];
  /** العناصر اللازمة الناقصة (تمنع صحّة المحضر شكليًّا). */
  missingMandatory: string[];
  /** جاهزٌ شكليًّا؟ لا عنصرَ لازمًا ناقصًا. */
  formallyComplete: boolean;
}

function norm(s: string): string {
  return s.replace(/[ًٌٍَُِّْ]/g, "").replace(/[إأآ]/g, "ا").replace(/\s+/g, " ").trim();
}

/** يعيد مواصفة عناصر المحضر (للعرض/القالب). */
export function recordElementSpecs(): RecordElementSpec[] {
  return RECORD_ELEMENTS;
}

/**
 * §18 — يبني قائمةَ التحقّق الشكليّة لمحضر الضبط: يكشف العناصر من النصّ (أو المفاتيح
 * الصريحة)، ويرصد اللازم الناقص. لا يكتب المحضر ولا يفترض حضورًا لم يَرِد.
 */
export function buildRecordScaffold(input: BuildRecordInput): JudicialRecordScaffold {
  const text = norm(input.recordText ?? "");
  const explicit = new Set(input.presentKeys ?? []);
  const elements: RecordElementCheck[] = RECORD_ELEMENTS.map((spec) => {
    const detected = spec.cuesAr.some((c) => text.includes(norm(c)));
    const present = explicit.has(spec.key) || detected;
    return { key: spec.key, titleAr: spec.titleAr, mandatory: spec.mandatory, present };
  });
  const missingMandatory = elements.filter((e) => e.mandatory && !e.present).map((e) => e.titleAr);
  return {
    elements,
    missingMandatory,
    formallyComplete: missingMandatory.length === 0,
  };
}
