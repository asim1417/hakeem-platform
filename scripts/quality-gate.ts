import { PrismaClient } from "@prisma/client";
import { createConsultationDraft } from "../lib/modules/ai/ai-gateway";
import { auditEvent } from "../lib/modules/audit/audit";

const prisma = new PrismaClient();
const EXPECTED_ARTICLES = 1981;
const EXPECTED_SYSTEMS = 9;

const testFacts =
  "تعاقدت شركة مقاولات مع مورد على توريد مواد بناء بمبلغ 250,000 ريال، ثم تبين أن بعض المواد غير مطابقة للمواصفات، ويدعي المورد أنه سلّم كامل الكمية، بينما تطلب الشركة خصم قيمة المواد المعيبة.";

async function tableCounts() {
  return {
    users: await prisma.user.count(),
    roles: await prisma.roleRecord.count(),
    permissions: await prisma.permissionRecord.count(),
    legal_systems: await prisma.legalSystem.count(),
    legal_articles: await prisma.legalArticle.count(),
    cases: await prisma.caseFile.count(),
    consultations: await prisma.consultation.count(),
    simulation_sessions: await prisma.simulation.count(),
    audit_logs: await prisma.auditEvent.count()
  };
}

async function libraryTests() {
  const searches = [
    "نظام المعاملات المدنية",
    "نظام الإثبات",
    "نظام المرافعات الشرعية",
    "نظام الشركات",
    "مصطلح غير موجود إطلاقا 123456"
  ];

  const results = [];
  for (const query of searches) {
    const articles = await prisma.legalArticle.findMany({
      where: {
        OR: [
          { lawName: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
          { keywords: { has: query } }
        ]
      },
      take: 5
    });

    results.push({
      query,
      count: articles.length,
      message: articles.length === 0 ? "لا توجد مادة نظامية مطابقة في قاعدة البيانات الحالية." : undefined,
      laws: Array.from(new Set(articles.map((article) => article.lawName)))
    });
  }
  return results;
}

async function consultationTest(userId: string) {
  await auditEvent({
    actorId: userId,
    subject: "CONSULTATION",
    action: "QA_CONSULTATION_TEST_STARTED",
    metadata: { source: "qa:gate" }
  });

  const draft = await createConsultationDraft({ facts: testFacts, actorId: userId });
  const consultation = await prisma.consultation.create({
    data: {
      userId,
      facts: testFacts,
      output: draft.output,
      status: draft.blocked ? "BLOCKED" : "GENERATED",
      qualityReport: draft.qualityReport,
      citations: {
        create: draft.citations
      }
    },
    include: { citations: true }
  });

  const citationKeys = consultation.citations.map((citation) => ({
    lawName: citation.lawName,
    articleNumber: citation.articleNumber
  }));

  const matchingArticles = await prisma.legalArticle.count({
    where: {
      OR: citationKeys.map((citation) => ({
        lawName: citation.lawName,
        articleNumber: citation.articleNumber
      }))
    }
  });

  await auditEvent({
    actorId: userId,
    subject: "CONSULTATION",
    action: "QA_CONSULTATION_TEST_COMPLETED",
    entityId: consultation.id,
    metadata: {
      blocked: draft.blocked,
      citations: consultation.citations.length,
      citationsAllExist: matchingArticles === consultation.citations.length
    }
  });

  return {
    consultationId: consultation.id,
    blocked: draft.blocked,
    citations: consultation.citations.length,
    citationsAllExist: matchingArticles === consultation.citations.length
  };
}

async function simulationTest(userId: string) {
  await auditEvent({
    actorId: userId,
    subject: "SIMULATION",
    action: "QA_SIMULATION_TEST_STARTED",
    metadata: { source: "qa:gate" }
  });

  const simulation = await prisma.simulation.create({
    data: {
      userId,
      title: "جلسة محاكاة تجريبية لقضية توريد مواد بناء",
      stage: "CLAIM_FILING"
    }
  });

  const messages = [
    ["CLAIM_FILING", "system", "تم تقييد الدعوى التدريبية."],
    ["INITIAL_ADMISSIBILITY", "judge", "فحص القبول المبدئي مكتمل لأغراض التدريب."],
    ["HEARING_RECORD", "clerk", "تم فتح ضبط الجلسة وتوثيق أطراف النزاع."],
    ["PLAINTIFF_STATEMENT", "plaintiff", "الشركة تطلب خصم قيمة المواد المعيبة."],
    ["DEFENDANT_RESPONSE", "defendant", "المورد يدفع بأنه سلّم كامل الكمية."],
    ["PROCEDURAL_DECISION", "judge", "قرار إجرائي: إلزام الطرفين بتقديم مستندات التسليم والفحص."],
    ["CLOSE_PLEADING", "judge", "تم قفل باب المرافعة لأغراض التدريب."]
  ] as const;

  await prisma.simulationMessage.createMany({
    data: messages.map(([stage, role, content]) => ({
      simulationId: simulation.id,
      stage,
      role,
      content
    }))
  });

  const decision = await prisma.simulationDecision.create({
    data: {
      simulationId: simulation.id,
      stage: "PROCEDURAL_DECISION",
      decisionType: "إجرائي",
      content: "إلزام الطرفين بتقديم بينات التسليم والفحص."
    }
  });

  const judgment = await prisma.simulationJudgment.create({
    data: {
      simulationId: simulation.id,
      content: "حكم تدريبي غير ملزم: لا يعتمد هذا النص كحكم فعلي، ويستخدم فقط لتقييم مهارات المرافعة والتحليل.",
      disclaimer: "حكم تدريبي غير ملزم، ولا يعد حكمًا فعليًا أو رأيًا قانونيًا نهائيًا."
    }
  });

  await prisma.simulation.update({
    where: { id: simulation.id },
    data: { stage: "TRAINING_JUDGMENT" }
  });

  const result = {
    simulationId: simulation.id,
    messages: await prisma.simulationMessage.count({ where: { simulationId: simulation.id } }),
    decisions: decision.id ? 1 : 0,
    judgments: judgment.id ? 1 : 0,
    disclaimer: judgment.disclaimer,
    judgmentHasRequiredPhrase: judgment.content.includes("حكم تدريبي غير ملزم") || judgment.disclaimer.includes("حكم تدريبي غير ملزم")
  };

  await auditEvent({
    actorId: userId,
    subject: "SIMULATION",
    action: "QA_SIMULATION_TEST_COMPLETED",
    entityId: simulation.id,
    metadata: result
  });

  return result;
}

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const legalSystemCount = await prisma.legalSystem.count();
  const legalArticleCount = await prisma.legalArticle.count();

  if (legalSystemCount !== EXPECTED_SYSTEMS || legalArticleCount !== EXPECTED_ARTICLES) {
    throw new Error(
      `فشل اختبار المكتبة: الأنظمة=${legalSystemCount}/${EXPECTED_SYSTEMS}, المواد=${legalArticleCount}/${EXPECTED_ARTICLES}. شغّل npm run db:seed أولًا.`
    );
  }

  const user = await prisma.user.upsert({
    where: { email: "qa@hakeem.local" },
    update: {},
    create: {
      name: "مستخدم اختبار الجودة",
      email: "qa@hakeem.local",
      passwordHash: "not-for-login",
      role: "LAWYER"
    }
  });

  const before = await tableCounts();
  const library = await libraryTests();

  const requiredSearchesPassed = library.every((item) => {
    if (item.query === "نظام الإثبات" || item.query.includes("غير موجود")) {
      return item.count === 0;
    }
    return item.count > 0;
  });

  if (!requiredSearchesPassed) {
    throw new Error("فشل اختبار البحث في المكتبة النظامية.");
  }

  const consultation = await consultationTest(user.id);
  if (!consultation.citationsAllExist) {
    throw new Error("فشل اختبار الاستشارة: يوجد استشهاد غير موجود في legal_articles.");
  }

  const simulation = await simulationTest(user.id);
  if (!simulation.judgmentHasRequiredPhrase) {
    throw new Error('فشل اختبار المحاكاة: الحكم لا يتضمن عبارة "حكم تدريبي غير ملزم".');
  }

  const after = await tableCounts();

  await auditEvent({
    actorId: user.id,
    subject: "ADMIN",
    action: "QA_GATE_COMPLETED",
    metadata: {
      legalSystemCount,
      legalArticleCount,
      consultation,
      simulation
    }
  });

  console.log(
    JSON.stringify(
      {
        before,
        library,
        consultation,
        simulation,
        after
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
