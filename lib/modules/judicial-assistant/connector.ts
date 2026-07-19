// ─────────────────────────────────────────────────────────────────────────────
// موصل نظام القضايا — Interface ثابت + Mock Adapter ببياناتٍ صناعيّة فقط.
// المرجع: المواصفة النهائية v2.0 (§36 مبادئ الموصلات، §37 العقد، §75 اعتماديّة مفتوحة).
// محظور: تكاملٌ وهميّ مع «تقاضي» أو أيّ نظامٍ رسميّ، أو بياناتٌ حقيقيّة. القراءة فقط.
// عند توفّر API الرسميّ يُنفَّذ Adapter جديد خلف نفس الـ Interface دون تغيير الواجهة.
// ─────────────────────────────────────────────────────────────────────────────
import type { JudicialCase } from "./types";

/** عقد موصل نظام القضايا (§37). القراءة فقط؛ الكتابة معطّلة حتى اعتمادٍ وAPI رسميّ. */
export interface CaseManagementConnector {
  readonly id: string;
  readonly label: string;
  readonly readOnly: true;
  /** صحّة الموصل — يُعرض للمستخدم (§20 شاشة الموصلات). */
  health(): Promise<{ ok: boolean; lastSync: string | null; note: string }>;
  listCases(): Promise<JudicialCase[]>;
  getCase(caseId: string): Promise<JudicialCase | null>;
}

// ── بياناتٌ صناعيّة ثابتة (تواريخ ISO ثابتة، بلا Date.now) — قضيّتان تغطّيان مرحلتين ──
const SYNTHETIC_CASES: JudicialCase[] = [
  {
    id: "syn-c-1001",
    externalRef: "MOCK-TJ-2026-1001",
    caseNumber: "١٤٤٧/ت/١٠٠١",
    court: "المحكمة التجاريّة بالرياض",
    circuit: "الدائرة التجاريّة الثالثة",
    jurisdiction: "commercial",
    subject: "مطالبة بقيمة بضاعةٍ وتعويضٍ عن تأخّر التسليم",
    stage: "hearing_preparation",
    confidentiality: "normal",
    lastSync: "2026-07-18T09:30:00.000Z",
    synthetic: true,
    parties: [
      { id: "p1", name: "شركة الوفاء التجاريّة (صناعيّة)", role: "المدّعية", representative: "وكيلٌ صناعيّ" },
      { id: "p2", name: "مؤسسة الأفق للتوريد (صناعيّة)", role: "المدّعى عليها" },
    ],
    requests: [
      { id: "r1", text: "إلزام المدّعى عليها بسداد قيمة البضاعة", byPartyId: "p1", status: "contested" },
      { id: "r2", text: "التعويض عن الضرر الناشئ عن التأخّر", byPartyId: "p1", status: "contested" },
    ],
    facts: [
      { id: "f1", text: "إبرام عقد توريدٍ بين الطرفين", status: "admitted", verification: "human_verified", sourceLabel: "لائحة الدعوى ص٢", hasEvidence: true },
      { id: "f2", text: "تسليم جزءٍ من البضاعة بعد الموعد المتّفق عليه", status: "alleged", verification: "machine", sourceLabel: "مذكّرة المدّعية ص٤", hasEvidence: true },
      { id: "f3", text: "مقدار الضرر المطالب به", status: "unresolved", verification: "machine", sourceLabel: "—", hasEvidence: false },
    ],
    hearings: [{ id: "h1", date: "2026-07-27T08:00:00.000Z", purpose: "المرافعة وتبادل المذكّرات", hasMinutes: false }],
    deadlines: [
      { id: "d1", label: "تقديم مذكّرة الردّ", dueDate: "2026-07-24T00:00:00.000Z", status: "due_soon", basis: "أجلٌ إجرائيّ محدَّد بقرار الدائرة" },
      { id: "d2", label: "إيداع أصول المستندات", dueDate: "2026-07-30T00:00:00.000Z", status: "upcoming", basis: "قاعدة إيداع البيّنات" },
    ],
    issues: [
      { id: "i1", statement: "ثبوت التأخّر ونسبته إلى المدّعى عليها", resolved: false },
      { id: "i2", statement: "تقدير التعويض ومداه", resolved: false },
    ],
    documents: [
      { id: "doc1", title: "لائحة الدعوى", kind: "لائحة دعوى", quality: "good", pages: 6 },
      { id: "doc2", title: "مذكّرة المدّعية الأولى", kind: "مذكرة", quality: "good", pages: 4 },
      { id: "doc3", title: "عقد التوريد", kind: "مرفق", quality: "low", pages: 3 },
    ],
    gaps: [
      { id: "g1", text: "مقدار الضرر غير مدعومٍ بدليلٍ حتى الآن", severity: "warning" },
      { id: "g2", text: "أصل عقد التوريد بجودةٍ منخفضة (يحتاج نسخةً أوضح)", severity: "info" },
    ],
  },
  {
    id: "syn-c-2002",
    externalRef: "MOCK-OM-2026-2002",
    caseNumber: "١٤٤٧/ع/٢٠٠٢",
    court: "المحكمة العمّاليّة بجدة",
    circuit: "الدائرة العمّاليّة الأولى",
    jurisdiction: "labor",
    subject: "دعوى فصلٍ من العمل والمطالبة بمستحقّاتٍ نهائيّة",
    stage: "deliberation",
    confidentiality: "restricted",
    lastSync: "2026-07-17T14:10:00.000Z",
    synthetic: true,
    parties: [
      { id: "p1", name: "عاملٌ (صناعيّ)", role: "المدّعي" },
      { id: "p2", name: "منشأةٌ (صناعيّة)", role: "المدّعى عليها", representative: "وكيلٌ صناعيّ" },
    ],
    requests: [
      { id: "r1", text: "الحكم بمستحقّات نهاية الخدمة", byPartyId: "p1", status: "contested" },
      { id: "r2", text: "التعويض عن الفصل", byPartyId: "p1", status: "contested" },
    ],
    facts: [
      { id: "f1", text: "قيام علاقة عملٍ بعقدٍ محدّد المدّة", status: "established", verification: "human_verified", sourceLabel: "عقد العمل ص١", hasEvidence: true },
      { id: "f2", text: "إنهاء العلاقة قبل انتهاء المدّة", status: "admitted", verification: "human_verified", sourceLabel: "محضر الجلسة الأولى", hasEvidence: true },
      { id: "f3", text: "سبب الإنهاء ومشروعيّته", status: "denied", verification: "machine", sourceLabel: "مذكّرة المنشأة ص٣", hasEvidence: true },
    ],
    hearings: [{ id: "h1", date: "2026-07-10T08:00:00.000Z", purpose: "سماع الأقوال", hasMinutes: true }],
    deadlines: [
      { id: "d1", label: "النطق بالحكم", dueDate: "2026-07-22T00:00:00.000Z", status: "due_soon", basis: "موعدٌ محدَّد للمداولة" },
    ],
    issues: [
      { id: "i1", statement: "مشروعيّة إنهاء العقد قبل مدّته", resolved: false },
      { id: "i2", statement: "استحقاق التعويض ومقداره", resolved: false },
    ],
    documents: [
      { id: "doc1", title: "لائحة الدعوى", kind: "لائحة دعوى", quality: "good", pages: 3 },
      { id: "doc2", title: "عقد العمل", kind: "مرفق", quality: "good", pages: 2 },
      { id: "doc3", title: "محضر الجلسة الأولى", kind: "محضر", quality: "good", pages: 2 },
    ],
    gaps: [{ id: "g1", text: "مشروعيّة سبب الإنهاء محلّ نزاعٍ ولم تُحسم", severity: "critical" }],
  },
];

/** Mock Adapter — بيانات صناعيّة ثابتة، قراءة فقط. لا يتّصل بأيّ نظامٍ خارجيّ. */
export class MockCaseConnector implements CaseManagementConnector {
  readonly id = "mock-synthetic";
  readonly label = "موصل تجريبيّ (بيانات صناعيّة)";
  readonly readOnly = true as const;

  async health() {
    return { ok: true, lastSync: "2026-07-18T09:30:00.000Z", note: "بيانات صناعيّة — لا اتّصال بنظامٍ رسميّ." };
  }
  async listCases() {
    return SYNTHETIC_CASES;
  }
  async getCase(caseId: string) {
    return SYNTHETIC_CASES.find((c) => c.id === caseId) ?? null;
  }
}

/** الموصل الفعّال في هذه المرحلة. يُستبدل لاحقًا بموصل النظام الرسميّ خلف نفس العقد. */
export const activeConnector: CaseManagementConnector = new MockCaseConnector();
