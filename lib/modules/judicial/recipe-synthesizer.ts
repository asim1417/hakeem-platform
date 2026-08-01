// ─────────────────────────────────────────────────────────────────────────────
// §16 — محرّك توليف وصفة المستند القضائيّ (Judicial Document Recipe Synthesis Engine)
//
// لا قالبٌ جامد: يبني الوصفة ديناميكيًّا من الدور/المجال/المرحلة/وظيفة المستند + خريطة
// الإجراءات + الأنماط المسموحة/المحظورة (بحسب الصوت) + بوّابات الجودة لكلّ قسم. نقيّ
// وحتميّ — قابل للاختبار. لا يولّد نصًّا؛ يصف «كيف يُصاغ» ليُنفَّذ في مرورات §23 لاحقًا.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  DocumentFunction,
  JudicialDocumentRecipe,
  JudicialProcedureGraph,
  JudicialRecipeSection,
  JudicialTaskCharacterization,
  JudicialVoiceProfile,
  RecipeValidationStatus,
} from "./contracts";
import { getDomainPack } from "./domain-packs";
import { JUDICIAL_PATTERNS } from "./patterns";
import { blockingGatesFor } from "./quality-gates";
import { voiceProfileFor } from "./task-characterization";

interface SectionTemplate {
  key: string;
  titleAr: string;
  judicialFunction: string;
  inclusionReason: string;
  requiredFacts: string[];
  requiredEvidence: string[];
  requiredAuthorities: string[];
  completionCriteria: string[];
}

// قوالب الأقسام بحسب وظيفة المستند (§17/§19). كلّ قالبٍ يصف الوظيفة لا النصّ.
const SECTION_TEMPLATES: Partial<Record<DocumentFunction, SectionTemplate[]>> = {
  CLAIM_FORMULATION: [
    { key: "parties", titleAr: "الأطراف والصفات والتمثيل", judicialFunction: "تأسيس الخصومة", inclusionReason: "لا تُقبل دعوى بلا صفةٍ وأهليّة", requiredFacts: ["أطراف الدعوى", "صفة كلّ طرف"], requiredEvidence: [], requiredAuthorities: ["قواعد الصفة والاختصاص السارية"], completionCriteria: ["حُدّدت الصفة والتمثيل"] },
    { key: "founding_relation", titleAr: "العلاقة المنشئة والواقعة", judicialFunction: "بيان سبب الدعوى", inclusionReason: "الدعوى تقوم على واقعةٍ منشئة", requiredFacts: ["الواقعة المنشئة"], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["بُيّنت العلاقة والواقعة"] },
    { key: "material_facts", titleAr: "الوقائع المؤثّرة", judicialFunction: "ترتيب الوقائع", inclusionReason: "انتقاء المؤثّر دون حشو", requiredFacts: ["الوقائع المؤثّرة"], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["رُتّبت الوقائع المؤثّرة"] },
    { key: "requests", titleAr: "الطلبات", judicialFunction: "تحديد المطلوب", inclusionReason: "لا حكم بلا طلب", requiredFacts: ["الطلبات"], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["حُدّدت الطلبات بدقّة"] },
  ],
  ANSWER_FORMULATION: [
    { key: "position", titleAr: "الموقف من الوقائع: إقرار/إنكار/عدم علم", judicialFunction: "تحديد أثر الجواب", inclusionReason: "الجواب يحدّد عبء الإثبات", requiredFacts: ["موقف الخصم من كلّ ادّعاء"], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["حُدّد الموقف من كلّ ادّعاء"] },
    { key: "defenses", titleAr: "الدفوع الشكليّة والموضوعيّة", judicialFunction: "إبداء الدفوع", inclusionReason: "لا يُسقط دفعٌ جوهريّ", requiredFacts: [], requiredEvidence: [], requiredAuthorities: ["أساس كلّ دفعٍ نظاميّ ساري"], completionCriteria: ["أُبديت الدفوع الجوهريّة"] },
    { key: "counter_requests", titleAr: "الطلبات العارضة (إن وُجدت)", judicialFunction: "طلبات المدعى عليه", inclusionReason: "قد يقابل الطلبَ طلبٌ عارض", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["حُدّدت الطلبات العارضة إن وُجدت"] },
  ],
  REASONING: [
    { key: "established_facts", titleAr: "الوقائع الثابتة", judicialFunction: "تمييز الثابت من المتنازع", inclusionReason: "التسبيب يقوم على الثابت", requiredFacts: ["الوقائع الثابتة"], requiredEvidence: ["الأدلّة"], requiredAuthorities: [], completionCriteria: ["مُيّز الثابت عن الادّعاء"] },
    { key: "issues", titleAr: "المسائل", judicialFunction: "حصر المسائل", inclusionReason: "لكلّ طلبٍ مسائله", requiredFacts: ["المسائل"], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["حُصرت المسائل"] },
    { key: "rules_application", titleAr: "القاعدة النظاميّة والتطبيق", judicialFunction: "الانتقال من الواقعة إلى القاعدة فالتطبيق", inclusionReason: "التسبيب يربط الواقعة بالقاعدة السارية", requiredFacts: [], requiredEvidence: [], requiredAuthorities: ["القواعد الموضوعيّة والإجرائيّة السارية"], completionCriteria: ["طُبّقت القاعدة على الواقعة"] },
    { key: "defense_response", titleAr: "الردّ على الدفوع الجوهريّة", judicialFunction: "معالجة الدفوع", inclusionReason: "لا يُهمل دفعٌ جوهريّ", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["عولجت الدفوع الجوهريّة"] },
  ],
  DISPOSITION: [
    { key: "per_request_result", titleAr: "النتيجة لكلّ طلب", judicialFunction: "الإجابة عن كلّ طلب", inclusionReason: "لكلّ طلبٍ نتيجة", requiredFacts: ["الطلبات", "الوقائع الثابتة"], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["أُجيب عن كلّ طلب"] },
    { key: "operative", titleAr: "المنطوق", judicialFunction: "صياغة المنطوق المنفَّذ", inclusionReason: "قابلٌ للتنفيذ ومتّسقٌ مع الأسباب", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["منطوقٌ محدّدٌ قابلٌ للتنفيذ", "لا تجاوز للطلبات", "متّسقٌ مع الأسباب"] },
  ],
  OBJECTION: [
    { key: "impugned_judgment", titleAr: "الحكم المعترض عليه وتاريخ التبليغ", judicialFunction: "تحديد محلّ الاعتراض", inclusionReason: "الاعتراض ضمن المدّة على حكمٍ معيّن", requiredFacts: ["تاريخ التبليغ"], requiredEvidence: [], requiredAuthorities: ["مدد وطرق الاعتراض السارية"], completionCriteria: ["حُدّد الحكم والمدّة"] },
    { key: "grounds", titleAr: "أوجه الاعتراض وأثر كلّ خطأ", judicialFunction: "بيان النعي", inclusionReason: "لا اعتراض بلا وجه", requiredFacts: ["أوجه الاعتراض"], requiredEvidence: [], requiredAuthorities: ["حدود الطريق (استئناف/نقض/التماس)"], completionCriteria: ["رُبط كلّ وجهٍ بأثره", "لا خلط بين الطرق"] },
    { key: "relief", titleAr: "الطلب من محكمة الاعتراض", judicialFunction: "تحديد المطلوب", inclusionReason: "لكلّ اعتراضٍ طلب", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["حُدّد الطلب المناسب للطريق"] },
  ],
  RECORD: [
    { key: "session_header", titleAr: "بيانات القضية والجلسة والحضور", judicialFunction: "توثيق الجلسة", inclusionReason: "الضبط يوثّق لا يعيد الصياغة", requiredFacts: ["بيانات القضية", "الحضور والصفات"], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["وُثّق الحضور والصفات"] },
    { key: "proceedings", titleAr: "سير الجلسة والأقوال والطلبات", judicialFunction: "سرد متّصل بلا تغيير أقوال", inclusionReason: "لا يُحوّل الادّعاء إلى واقعة", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["سردٌ متّصلٌ أمينٌ للأقوال"] },
    { key: "decisions", titleAr: "القرارات الإجرائيّة والمطلوب للجلسة التالية", judicialFunction: "توثيق القرار", inclusionReason: "إغلاق الجلسة بقرارٍ واضح", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["دُوّن القرار والمطلوب"] },
  ],
  EVIDENCE_ANALYSIS: [
    { key: "fact_to_prove", titleAr: "الواقعة وعبء الإثبات", judicialFunction: "تحديد محلّ الإثبات", inclusionReason: "البيّنة على من ادّعى", requiredFacts: ["الوقائع المتنازع عليها"], requiredEvidence: [], requiredAuthorities: ["قواعد عبء الإثبات السارية"], completionCriteria: ["حُدّد العبء"] },
    { key: "means_admissibility", titleAr: "وسيلة الإثبات وشروط القبول والحجّية", judicialFunction: "تقويم الدليل", inclusionReason: "لكلّ وسيلةٍ شروطها", requiredFacts: [], requiredEvidence: ["الأدلّة"], requiredAuthorities: ["قواعد حجّية الأدلّة السارية"], completionCriteria: ["قُوّم القبول والحجّية"] },
    { key: "result", titleAr: "النتيجة الإثباتيّة", judicialFunction: "خلاصة الإثبات", inclusionReason: "ثبوتٌ أو تعذّر", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["بُيّنت النتيجة الإثباتيّة"] },
  ],
};

function genericSections(fn: DocumentFunction): SectionTemplate[] {
  return [
    { key: "context", titleAr: "السياق والوقائع", judicialFunction: `تمهيد ${fn}`, inclusionReason: "تأطير المهمّة", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["أُطّر السياق"] },
    { key: "analysis", titleAr: "التحليل", judicialFunction: `تحليل ${fn}`, inclusionReason: "جوهر المخرج", requiredFacts: [], requiredEvidence: [], requiredAuthorities: ["السلطة السارية عند اللزوم"], completionCriteria: ["اكتمل التحليل"] },
    { key: "conclusion", titleAr: "الخلاصة", judicialFunction: "خلاصة مسبَّبة", inclusionReason: "نتيجةٌ واضحة", requiredFacts: [], requiredEvidence: [], requiredAuthorities: [], completionCriteria: ["نتيجةٌ واضحة"] },
  ];
}

/** الأنماط المسموحة لصوتٍ معيّن، والمحظورة (أنماط الصوت المقابل). */
function patternIdsForVoice(voice: JudicialVoiceProfile): { allowed: string[]; prohibited: string[] } {
  const bench = JUDICIAL_PATTERNS.filter((p) => p.patternClass === "JUDICIAL_VERB").map((p) => p.id);
  const party = JUDICIAL_PATTERNS.filter((p) => p.appliesToRoles.includes("LAWYER") || p.appliesToRoles.includes("PARTY")).map((p) => p.id);
  if (voice === "JUDICIAL_BENCH_RESTRICTED") return { allowed: bench, prohibited: party };
  if (voice === "JUDICIAL_PARTY") return { allowed: party, prohibited: bench };
  return { allowed: [], prohibited: bench }; // الباحث: لا يستعمل صوت الحسم
}

export interface SynthesizeRecipeInput {
  taskId: string;
  characterization: JudicialTaskCharacterization;
  procedureGraph?: JudicialProcedureGraph;
  lawAsOfDate?: string;
  sourceStyleSignatures?: string[];
}

/** يبني وصفة المستند من التوصيف + خريطة الإجراءات + الأنماط + بوّابات الجودة. */
export function synthesizeDocumentRecipe(input: SynthesizeRecipeInput): JudicialDocumentRecipe {
  const { characterization: tc } = input;
  const voice = voiceProfileFor(tc.role, tc.documentFunction);
  const pack = getDomainPack(`${tc.courtTrack}_PACK`) ?? getDomainPack("GENERAL_CIVIL_PACK");
  const templates = SECTION_TEMPLATES[tc.documentFunction] ?? genericSections(tc.documentFunction);
  const { allowed, prohibited } = patternIdsForVoice(voice);
  const gateIds = blockingGatesFor(tc.documentFunction).map((g) => g.id);

  const sections: JudicialRecipeSection[] = templates.map((t) => ({
    key: t.key,
    titleAr: t.titleAr,
    judicialFunction: t.judicialFunction,
    inclusionReason: t.inclusionReason,
    requiredFacts: [...t.requiredFacts],
    requiredEvidence: [...t.requiredEvidence],
    requiredAuthorities: [...t.requiredAuthorities],
    allowedPatternIds: allowed,
    prohibitedPatternIds: prohibited,
    completionCriteria: [...t.completionCriteria],
    // بوّابات القسم: العامّة + ما يخصّ القسم (المنطوق يأخذ عدم التجاوز/الاتّساق).
    qualityGateIds: sectionGates(t.key, gateIds),
  }));

  // الفحوص الإجرائيّة الإلزاميّة: من متطلّبات خريطة الإجراءات غير المحلولة + فجوات السلطة.
  const mandatoryProceduralChecks = [
    ...(input.procedureGraph?.unresolvedRequirements ?? []),
    ...(sections.some((s) => s.requiredAuthorities.length) ? ["التحقّق من سريان كلّ سلطةٍ مستند إليها (JG8)"] : []),
  ];

  const lawAsOfDate = input.lawAsOfDate ?? input.procedureGraph?.lawAsOfDate ?? "PENDING";
  const needsAuthority = sections.some((s) => s.requiredAuthorities.length) && (lawAsOfDate === "PENDING");
  const validationStatus: RecipeValidationStatus = needsAuthority || mandatoryProceduralChecks.length ? "NEEDS_REVIEW" : "VALIDATED";

  return {
    id: `recipe:${input.taskId}`,
    taskId: input.taskId,
    version: "0.1.0",
    outputType: tc.documentFunction,
    roleProfile: voice,
    courtTrack: tc.courtTrack,
    litigationStage: tc.litigationStage,
    lawAsOfDate,
    procedureGraphId: input.procedureGraph?.id,
    sourceStyleSignatures: input.sourceStyleSignatures ?? [],
    domainPackVersion: pack ? `${pack.id}@${pack.version}` : "none",
    sections,
    mandatoryProceduralChecks,
    appliedPatternIds: allowed,
    appliedAuthoritySnapshotIds: [],
    validationStatus,
  };
}

function sectionGates(key: string, generalGateIds: string[]): string[] {
  const general = generalGateIds.filter((g) => ["JG6", "JG8", "JG9", "JG13", "JG18"].includes(g));
  const perSection: Record<string, string[]> = {
    operative: ["JG15", "JG16"],
    per_request_result: ["JG16"],
    grounds: ["JG14"],
    proceedings: ["JG17"],
    session_header: ["JG17", "JG19"],
    defense_response: ["JG12"],
    defenses: ["JG12"],
  };
  return Array.from(new Set([...general, ...(perSection[key] ?? [])]));
}
