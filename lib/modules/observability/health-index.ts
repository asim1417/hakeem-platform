import "server-only";

// مؤشّر الصحّة متعدّد الأبعاد — المخطط السيادي §13/§23.
// خمسة أبعاد مستقلّة (لا رقم واحد) محسوبة من إشارات قائمة فعلًا في المنصّة.
// كل قراءة دفاعيّة (catch → إشارة محايدة) فلا يتعطّل المؤشّر إن غاب جدول.

import { prisma } from "@/lib/prisma";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";

export type HealthLevel = "healthy" | "degraded" | "unknown";

export interface HealthDimension {
  key: "structure" | "evidence" | "compliance" | "security" | "delivery";
  labelAr: string;
  score: number; // 0..100
  level: HealthLevel;
  detail: string;
}

export interface HealthIndex {
  dimensions: HealthDimension[];
  generatedAt: string;
  note: string;
}

const EXPECTED_SYSTEMS = 9;
const EXPECTED_ARTICLES = 1981;

function level(score: number): HealthLevel {
  if (score >= 80) return "healthy";
  if (score >= 40) return "degraded";
  return "unknown";
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** يبني مؤشّر الصحّة. now يُمرَّر من المستدعي (المسار) لتفادي Date.now في النواة. */
export async function buildHealthIndex(now: string): Promise<HealthIndex> {
  const [systems, articles, relationsTotal, relationsVerified, guardTotal, guardPass, auditCount] =
    await Promise.all([
      prisma.legalSystem.count().catch(() => 0),
      prisma.legalArticle.count().catch(() => 0),
      prisma.legalRelation.count().catch(() => 0),
      prisma.legalRelation.count({ where: { status: "VERIFIED" } }).catch(() => 0),
      prisma.guardrailDecision.count().catch(() => 0),
      prisma.guardrailDecision.count({ where: { result: "pass" } }).catch(() => 0),
      prisma.auditEvent.count().catch(() => 0),
    ]);

  let database = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = false;
  }

  // 1) البنية — اكتمال المكتبة النظامية مقابل المتوقّع.
  const structureScore = Math.round(
    (pct(systems, EXPECTED_SYSTEMS) + pct(articles, EXPECTED_ARTICLES)) / 2
  );

  // 2) الدليل — نسبة نجاح حراس التأصيل (Evidence-First). لا قرارات = محايد.
  const evidenceScore = guardTotal > 0 ? pct(guardPass, guardTotal) : 60;

  // 3) الامتثال — نسبة العلاقات المؤكَّدة (VERIFIED) من الإجمالي؛ حتى ينشأ محرك امتثال مُصدَّق.
  const complianceScore = relationsTotal > 0 ? pct(relationsVerified, relationsTotal) : 50;

  // 4) الأمن — تهيئة المصادقة + وجود سجلّ تدقيق فعّال.
  const authOk = isClerkConfigured() || Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
  const securityScore = (authOk ? 60 : 20) + (auditCount > 0 ? 40 : 0);

  // 5) التسليم — جاهزية قاعدة البيانات.
  const deliveryScore = database ? 100 : 0;

  const dims: Array<Omit<HealthDimension, "level">> = [
    {
      key: "structure",
      labelAr: "البنية",
      score: structureScore,
      detail: `الأنظمة ${systems}/${EXPECTED_SYSTEMS} · المواد ${articles}/${EXPECTED_ARTICLES}`,
    },
    {
      key: "evidence",
      labelAr: "الدليل",
      score: evidenceScore,
      detail: guardTotal > 0 ? `حراس ناجحة ${guardPass}/${guardTotal}` : "لا قرارات حُرّاس بعد",
    },
    {
      key: "compliance",
      labelAr: "الامتثال",
      score: complianceScore,
      detail:
        relationsTotal > 0
          ? `علاقات مؤكَّدة ${relationsVerified}/${relationsTotal}`
          : "لا علاقات مسجّلة بعد",
    },
    {
      key: "security",
      labelAr: "الأمن",
      score: securityScore,
      detail: `${authOk ? "مصادقة مهيّأة" : "مصادقة ناقصة"} · تدقيق ${auditCount}`,
    },
    {
      key: "delivery",
      labelAr: "التسليم",
      score: deliveryScore,
      detail: database ? "قاعدة البيانات متّصلة" : "تعذّر الاتصال بقاعدة البيانات",
    },
  ];

  return {
    dimensions: dims.map((d) => ({ ...d, level: level(d.score) })),
    generatedAt: now,
    note: "مؤشّرات مستقلّة (§13) — لا يُختزَل في رقم واحد. الامتثال والدليل تقديريّان حتى تفعيل محرّكيهما.",
  };
}
