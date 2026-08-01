// ─────────────────────────────────────────────────────────────────────────────
// §12 + §17 — محرّك خريطة الإجراءات القضائيّة (Saudi Judicial Procedure Engine)
//
// يبني مسارًا إجرائيًّا ديناميكيًّا للقضية الحالية من قالبٍ قانونيّ مؤصَّل في تسلسل §17
// (تحرير الدعوى → الجواب → الإثبات → الخبرة → اليمين → الحكم → الاعتراض → التنفيذ)،
// مواءمًا بحزمة المجال (§8): يُسقط ما لا ينطبق، ويحسب المتطلّبات غير المحلولة.
//
// نقيّ وحتميّ (بلا نموذج، بلا قاعدة) — قابلٌ للاختبار. لا يُصدر حكمًا؛ يهيّئ المسار فقط،
// وكلّ عقدة انتقالٍ نظاميّ (اختصاص/مدد/اعتراض) تتطلّب سلطةً ساريةً (requiredAuthorities).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  JudicialProcedureGraph,
  JudicialProcedureNode,
  JudicialProcedureEdge,
  LitigationStage,
  ProcedureNodeType,
  ProcedureNodeStatus,
} from "./contracts";
import { getDomainPack } from "./domain-packs";

interface NodeTemplate {
  id: string;
  type: ProcedureNodeType;
  titleAr: string;
  stage: LitigationStage; // للمواءمة مع مراحل حزمة المجال
  requiredFacts: string[];
  requiredDocuments: string[];
  requiredAuthorities: string[]; // أنواع السلطة اللازمة (تُثبت من النواة في PR3)
  completionCriteria: string[];
  optional?: boolean; // عقدةٌ مشروطة (خبرة/يمين) — NOT_APPLICABLE إن لم تنطبق
}

// قالب المسار المدنيّ العامّ (§17) — الأساس الذي تُواءمه الحزم.
const CANONICAL_NODES: readonly NodeTemplate[] = [
  {
    id: "precondition",
    type: "PRECONDITION",
    titleAr: "المتطلّبات القبليّة: الاختصاص والصفة والأهليّة والتمثيل",
    stage: "PRE_FILING",
    requiredFacts: ["أطراف الدعوى", "صفة كلّ طرف"],
    requiredDocuments: ["وكالة/تمثيل عند اللزوم"],
    requiredAuthorities: ["قواعد الاختصاص السارية"],
    completionCriteria: ["تحدّد الاختصاص", "ثبتت الصفة والأهليّة"],
  },
  {
    id: "filing",
    type: "FILING",
    titleAr: "تحرير الدعوى وقيدها",
    stage: "FILING",
    requiredFacts: ["الواقعة المنشئة", "المدّعى به", "الطلبات"],
    requiredDocuments: ["صحيفة الدعوى"],
    requiredAuthorities: ["متطلّبات قبول الدعوى السارية"],
    completionCriteria: ["اكتملت عناصر تحرير الدعوى", "قابلة للجواب"],
  },
  {
    id: "service",
    type: "SERVICE",
    titleAr: "تبليغ الخصم",
    stage: "SERVICE",
    requiredFacts: ["بيانات الخصم"],
    requiredDocuments: ["محضر التبليغ"],
    requiredAuthorities: ["قواعد التبليغ السارية"],
    completionCriteria: ["تمّ التبليغ نظامًا"],
  },
  {
    id: "claim",
    type: "CLAIM",
    titleAr: "عرض الدعوى المحرّرة",
    stage: "PLEADING",
    requiredFacts: ["الوقائع المؤثّرة"],
    requiredDocuments: [],
    requiredAuthorities: [],
    completionCriteria: ["عُرضت الدعوى على الخصم"],
  },
  {
    id: "answer",
    type: "ANSWER",
    titleAr: "جواب الخصم: إقرار/إنكار/دفع/عدم علم",
    stage: "PLEADING",
    requiredFacts: ["موقف الخصم من كلّ ادّعاء"],
    requiredDocuments: ["المذكّرة الجوابيّة"],
    requiredAuthorities: [],
    completionCriteria: ["حُدّد أثر الجواب", "حُدّد عبء الإثبات"],
  },
  {
    id: "evidence",
    type: "EVIDENCE",
    titleAr: "الإثبات: الواقعة → العبء → الوسيلة → القبول → الاعتراض → النتيجة",
    stage: "EVIDENCE",
    requiredFacts: ["الوقائع المتنازع عليها"],
    requiredDocuments: ["الأدلّة"],
    requiredAuthorities: ["قواعد الإثبات وحجّية الأدلّة السارية"],
    completionCriteria: ["ثبتت الواقعة أو تعذّر إثباتها"],
  },
  {
    id: "expertise",
    type: "EXPERTISE",
    titleAr: "الخبرة (عند مسألةٍ فنيّة)",
    stage: "EXPERTISE",
    requiredFacts: ["المسألة الفنيّة"],
    requiredDocuments: ["تقرير الخبير"],
    requiredAuthorities: ["قواعد الخبرة السارية"],
    completionCriteria: ["قُيّم التقرير: أخذًا أو استبعادًا مع التسبيب"],
    optional: true,
  },
  {
    id: "oath",
    type: "OATH",
    titleAr: "اليمين (عند انطباقها)",
    stage: "EVIDENCE",
    requiredFacts: ["محلّ اليمين"],
    requiredDocuments: [],
    requiredAuthorities: ["قواعد اليمين السارية"],
    completionCriteria: ["حصل الحلف أو النكول وترتّب أثره النظاميّ"],
    optional: true,
  },
  {
    id: "procedural_decision",
    type: "PROCEDURAL_DECISION",
    titleAr: "قرارٌ إجرائيّ (عند الاقتضاء)",
    stage: "PLEADING",
    requiredFacts: [],
    requiredDocuments: [],
    requiredAuthorities: ["سلطة المحكمة الإجرائيّة السارية"],
    completionCriteria: ["صدر القرار الإجرائيّ مسبَّبًا"],
    optional: true,
  },
  {
    id: "merits_decision",
    type: "MERITS_DECISION",
    titleAr: "الحكم: الطلبات → الوقائع الثابتة → القواعد → التطبيق → المنطوق",
    stage: "JUDGMENT",
    requiredFacts: ["الوقائع الثابتة", "المسائل"],
    requiredDocuments: [],
    requiredAuthorities: ["القواعد الموضوعيّة السارية"],
    completionCriteria: ["لكلّ طلبٍ نتيجة", "اتّسق المنطوق مع الأسباب"],
  },
  {
    id: "objection",
    type: "OBJECTION",
    titleAr: "الاعتراض: استئناف/نقض/التماس (بحسب المسار)",
    stage: "APPEAL",
    requiredFacts: ["تاريخ التبليغ", "أوجه الاعتراض"],
    requiredDocuments: ["لائحة الاعتراض"],
    requiredAuthorities: ["طرق الاعتراض والمدد السارية"],
    completionCriteria: ["حُدّد الطريق الصحيح دون خلط"],
    optional: true,
  },
  {
    id: "execution",
    type: "EXECUTION",
    titleAr: "التنفيذ (عند وجود سندٍ تنفيذيّ)",
    stage: "EXECUTION",
    requiredFacts: ["السند التنفيذيّ", "محلّ التنفيذ"],
    requiredDocuments: ["طلب التنفيذ"],
    requiredAuthorities: ["قواعد التنفيذ السارية"],
    completionCriteria: ["بوشر التنفيذ نظامًا"],
    optional: true,
  },
];

// الحواف القانونيّة بين العقد — بشروط §17 (فإن أقر… وإن أنكر… فإن عجز عن البينة…).
const CANONICAL_EDGES: ReadonlyArray<Omit<JudicialProcedureEdge, "authoritySnapshotIds">> = [
  { from: "precondition", to: "filing", condition: "تحقّق الاختصاص والصفة" },
  { from: "filing", to: "service", condition: "اكتمل تحرير الدعوى" },
  { from: "service", to: "claim", condition: "تمّ التبليغ" },
  { from: "claim", to: "answer", condition: "عُرضت الدعوى" },
  { from: "answer", to: "merits_decision", condition: "أقرّ الخصم بالوقائع المؤسِّسة" },
  { from: "answer", to: "evidence", condition: "أنكر الخصم أو نازع" },
  { from: "evidence", to: "expertise", condition: "برزت مسألةٌ فنيّة" },
  { from: "evidence", to: "oath", condition: "عجز عن البينة وانطبقت اليمين" },
  { from: "evidence", to: "merits_decision", condition: "حُسمت الواقعة إثباتًا" },
  { from: "expertise", to: "merits_decision", condition: "قُيّم تقرير الخبير" },
  { from: "oath", to: "merits_decision", condition: "ترتّب أثر اليمين" },
  { from: "merits_decision", to: "objection", condition: "طُعن في الحكم ضمن المدّة" },
  { from: "merits_decision", to: "execution", condition: "اكتسب الحكم القطعيّة" },
];

export interface BuildProcedureGraphInput {
  caseId: string;
  domainPackId: string;
  litigationStage: LitigationStage;
  lawAsOfDate?: string;
  /** معرّفات العقد المكتملة فعلًا في القضية (اختياريّة). */
  completedNodeIds?: string[];
  /** الوقائع/المستندات المتوافرة (بأسمائها) لحساب الجاهزيّة. */
  knownFacts?: string[];
  availableDocuments?: string[];
}

function statusFor(
  tpl: NodeTemplate,
  applicable: boolean,
  completed: Set<string>,
  facts: Set<string>,
  docs: Set<string>,
): ProcedureNodeStatus {
  if (!applicable) return "NOT_APPLICABLE";
  if (completed.has(tpl.id)) return "COMPLETED";
  const factsReady = tpl.requiredFacts.every((f) => facts.has(f));
  const docsReady = tpl.requiredDocuments.every((d) => docs.has(d));
  if (factsReady && docsReady) return "READY";
  return tpl.requiredFacts.length || tpl.requiredDocuments.length ? "BLOCKED" : "NOT_STARTED";
}

/**
 * يبني خريطة إجراءاتٍ للقضية مواءمةً بحزمة المجال. العقد المشروطة (خبرة/يمين/اعتراض/تنفيذ)
 * تُعلَّم NOT_APPLICABLE إن لم تكن مرحلتها ضمن الحزمة. يحسب المتطلّبات غير المحلولة.
 */
export function buildProcedureGraph(input: BuildProcedureGraphInput): JudicialProcedureGraph {
  const pack = getDomainPack(input.domainPackId);
  const packStages = new Set<LitigationStage>(pack?.stages ?? []);
  const completed = new Set(input.completedNodeIds ?? []);
  const facts = new Set(input.knownFacts ?? []);
  const docs = new Set(input.availableDocuments ?? []);

  // عقدةٌ منطبقة إذا كانت أساسيّة، أو كانت مرحلتها ضمن الحزمة (أو لا حزمة معروفة).
  const isApplicable = (tpl: NodeTemplate): boolean => {
    if (!tpl.optional) return true;
    if (!pack) return true;
    return packStages.has(tpl.stage);
  };

  const nodes: JudicialProcedureNode[] = CANONICAL_NODES.map((tpl) => {
    const applicable = isApplicable(tpl);
    return {
      id: tpl.id,
      type: tpl.type,
      titleAr: tpl.titleAr,
      status: statusFor(tpl, applicable, completed, facts, docs),
      requiredFacts: [...tpl.requiredFacts],
      requiredDocuments: [...tpl.requiredDocuments],
      requiredAuthorities: [...tpl.requiredAuthorities],
      completionCriteria: [...tpl.completionCriteria],
    };
  });

  const applicableIds = new Set(nodes.filter((n) => n.status !== "NOT_APPLICABLE").map((n) => n.id));
  const edges: JudicialProcedureEdge[] = CANONICAL_EDGES.filter(
    (e) => applicableIds.has(e.from) && applicableIds.has(e.to),
  ).map((e) => ({ ...e, authoritySnapshotIds: [] })); // تُملأ من jds_authority_snapshots في PR3

  // متطلّبات غير محلولة: العقد **الأساسيّة** (غير المشروطة) المحجوزة فقط — أمّا الفروع
  // المشروطة (خبرة/يمين/اعتراض/تنفيذ) فعدم جاهزيّتها مرهونٌ بالمسار لا نقصٌ في المدخلات.
  const optionalIds = new Set(CANONICAL_NODES.filter((t) => t.optional).map((t) => t.id));
  const unresolved: string[] = [];
  for (const n of nodes) {
    if (n.status !== "BLOCKED" || optionalIds.has(n.id)) continue;
    const missingFacts = n.requiredFacts.filter((f) => !facts.has(f));
    const missingDocs = n.requiredDocuments.filter((d) => !docs.has(d));
    for (const m of [...missingFacts, ...missingDocs]) unresolved.push(`${n.titleAr}: ينقص «${m}»`);
  }

  const hasAuthorityGap = nodes.some((n) => n.status !== "NOT_APPLICABLE" && n.requiredAuthorities.length > 0);
  const validationStatus = unresolved.length
    ? "NEEDS_INPUT"
    : hasAuthorityGap && (!input.lawAsOfDate || input.lawAsOfDate === "PENDING")
      ? "NEEDS_AUTHORITY"
      : "VALIDATED";

  return {
    id: `pg:${input.caseId}`,
    caseId: input.caseId,
    domainPack: input.domainPackId,
    litigationStage: input.litigationStage,
    lawAsOfDate: input.lawAsOfDate ?? "PENDING",
    nodes,
    edges,
    unresolvedRequirements: unresolved,
    validationStatus,
  };
}
