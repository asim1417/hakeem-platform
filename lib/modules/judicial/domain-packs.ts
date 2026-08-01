// ─────────────────────────────────────────────────────────────────────────────
// §8 — حزم المواءمة بحسب المسار القضائيّ (Judicial Domain Packs)
//
// حزمٌ مستقلّة قابلة للإصدار. تربط كلّ مسارٍ بفئات playbooks القائمة في
// data/judicial-playbooks.json (لا تكرارها) وبقيود عدم النقل (§8.1). lawAsOfDate
// يبقى «PENDING» حتى تُثبته PR3 من Legal Core بتاريخ سريانٍ حقيقيّ — لا اختلاق.
// ─────────────────────────────────────────────────────────────────────────────
import type { JudicialDomainPack } from "./contracts";

const V = "0.1.0";
const PENDING = "PENDING"; // يُحقن تاريخ السريان الحقيقيّ في PR3 من النواة القانونيّة

export const JUDICIAL_DOMAIN_PACKS: readonly JudicialDomainPack[] = [
  {
    id: "GENERAL_CIVIL_PACK",
    titleAr: "الحزمة المدنيّة العامّة",
    courtTrack: "GENERAL",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["PRE_FILING", "FILING", "SERVICE", "PLEADING", "EVIDENCE", "JUDGMENT", "APPEAL"],
    playbookCategories: ["الاختصاص", "شروط قبول الدعوى", "الإثبات", "إدارة الجلسة والإجراءات", "الحكم القضائي", "طرق الاعتراض"],
    prohibitedTransferFrom: ["CRIMINAL", "PERSONAL_STATUS"],
    notesAr: "المسار العامّ الأساس؛ يُواءم منطق التحرير والإثبات دون نقل حكمٍ موضوعيّ خاصّ.",
  },
  {
    id: "COMMERCIAL_PACK",
    titleAr: "الحزمة التجاريّة",
    courtTrack: "COMMERCIAL",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["FILING", "SERVICE", "PLEADING", "EVIDENCE", "EXPERTISE", "JUDGMENT", "APPEAL", "CASSATION"],
    playbookCategories: ["الاختصاص", "شروط قبول الدعوى", "الإثبات", "الحكم القضائي", "طرق الاعتراض", "المسائل الموضوعية"],
    prohibitedTransferFrom: ["PERSONAL_STATUS", "CRIMINAL", "LABOR"],
    notesAr: "منازعات تجاريّة؛ خبرة محاسبيّة/فنيّة شائعة.",
  },
  {
    id: "LABOR_PACK",
    titleAr: "الحزمة العمّاليّة",
    courtTrack: "LABOR",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["FILING", "SERVICE", "PLEADING", "EVIDENCE", "JUDGMENT", "APPEAL"],
    playbookCategories: ["الاختصاص", "شروط قبول الدعوى", "الإثبات", "الحكم القضائي", "المسائل الموضوعية"],
    prohibitedTransferFrom: ["COMMERCIAL", "PERSONAL_STATUS", "CRIMINAL"],
    notesAr: "منازعات عمّاليّة؛ قواعد عبء إثباتٍ خاصّة.",
  },
  {
    id: "PERSONAL_STATUS_PACK",
    titleAr: "حزمة الأحوال الشخصيّة",
    courtTrack: "PERSONAL_STATUS",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["FILING", "SERVICE", "PLEADING", "EVIDENCE", "EXPERTISE", "JUDGMENT", "APPEAL"],
    playbookCategories: ["الاختصاص", "شروط قبول الدعوى", "الإثبات", "الحكم القضائي", "المسائل الموضوعية"],
    prohibitedTransferFrom: ["COMMERCIAL", "LABOR", "CRIMINAL", "EXECUTION"],
    notesAr: "لا يُعمّم إجراؤها أو نتيجتها على بقيّة المسارات (§8.1).",
  },
  {
    id: "CRIMINAL_PACK",
    titleAr: "الحزمة الجزائيّة",
    courtTrack: "CRIMINAL",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["FILING", "SERVICE", "PLEADING", "EVIDENCE", "JUDGMENT", "APPEAL", "CASSATION"],
    playbookCategories: ["الاختصاص", "شروط قبول الدعوى", "الإثبات", "الحكم القضائي", "طرق الاعتراض"],
    prohibitedTransferFrom: ["COMMERCIAL", "LABOR", "PERSONAL_STATUS", "EXECUTION"],
    notesAr: "قرينة البراءة وقواعد إثباتٍ خاصّة؛ عزلٌ صارم عن بقيّة المسارات.",
  },
  {
    id: "EXECUTION_PACK",
    titleAr: "حزمة التنفيذ",
    courtTrack: "EXECUTION",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["FILING", "SERVICE", "EXECUTION"],
    playbookCategories: ["الاختصاص", "إدارة الجلسة والإجراءات", "طرق الاعتراض"],
    prohibitedTransferFrom: ["PERSONAL_STATUS", "CRIMINAL"],
    notesAr: "السند التنفيذيّ ومنازعات التنفيذ؛ مصطلحاتٌ خاصّة بالمسار.",
  },
  {
    id: "ARBITRATION_PACK",
    titleAr: "حزمة التحكيم",
    courtTrack: "ARBITRATION",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["FILING", "PLEADING", "EVIDENCE", "EXPERTISE", "JUDGMENT"],
    playbookCategories: ["الاختصاص", "الإثبات", "الحكم القضائي"],
    prohibitedTransferFrom: ["CRIMINAL", "PERSONAL_STATUS"],
    notesAr: "اتّفاق التحكيم وحكم التحكيم؛ رقابةٌ قضائيّة محدودة.",
  },
  {
    id: "ADMINISTRATIVE_PACK",
    titleAr: "الحزمة الإداريّة",
    courtTrack: "ADMINISTRATIVE",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["FILING", "SERVICE", "PLEADING", "EVIDENCE", "JUDGMENT", "APPEAL"],
    playbookCategories: ["الاختصاص", "شروط قبول الدعوى", "الإثبات", "الحكم القضائي", "طرق الاعتراض"],
    prohibitedTransferFrom: ["COMMERCIAL", "PERSONAL_STATUS", "CRIMINAL"],
    notesAr: "دعاوى الإلغاء والتعويض ضدّ جهة الإدارة.",
  },
  {
    id: "CROSS_JURISDICTION_PACK",
    titleAr: "حزمة تداخل الاختصاص",
    courtTrack: "OTHER",
    version: V,
    lawAsOfDate: PENDING,
    stages: ["PRE_FILING", "FILING"],
    playbookCategories: ["الاختصاص"],
    prohibitedTransferFrom: [],
    notesAr: "لتحديد المسار الصحيح عند تنازع/تداخل الاختصاص قبل التحرير.",
  },
];

export function getDomainPack(id: string): JudicialDomainPack | undefined {
  return JUDICIAL_DOMAIN_PACKS.find((p) => p.id === id);
}

export function domainPackForTrack(track: string): JudicialDomainPack | undefined {
  return JUDICIAL_DOMAIN_PACKS.find((p) => p.courtTrack === track);
}
