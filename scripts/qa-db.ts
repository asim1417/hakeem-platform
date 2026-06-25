import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const counts = {
      roles: await prisma.roleRecord.count(),
      permissions: await prisma.permissionRecord.count(),
      legal_systems: await prisma.legalSystem.count(),
      legal_articles: await prisma.legalArticle.count(),
      users: await prisma.user.count(),
      cases: await prisma.caseFile.count(),
      consultations: await prisma.consultation.count(),
      simulation_sessions: await prisma.simulation.count(),
      audit_logs: await prisma.auditEvent.count()
    };

    console.log("تم الاتصال بقاعدة البيانات الخارجية بنجاح.");
    console.table(counts);
    console.log(JSON.stringify(counts, null, 2));

    // تحقّق النواة الكاملة: يجب أن تكون القاعدة هي الكاملة (≈489/15,902) لا بذرة الـ9/1981.
    const MIN_SYSTEMS = Number(process.env.QA_MIN_SYSTEMS || 400);
    const MIN_ARTICLES = Number(process.env.QA_MIN_ARTICLES || 15000);
    const problems: string[] = [];
    if (counts.legal_systems < MIN_SYSTEMS) problems.push(`legal_systems=${counts.legal_systems} < ${MIN_SYSTEMS} (نواة مختصرة؟)`);
    if (counts.legal_articles < MIN_ARTICLES) problems.push(`legal_articles=${counts.legal_articles} < ${MIN_ARTICLES} (نواة مختصرة؟)`);
    if (problems.length) {
      console.error("\n🔴 فحص النواة الكاملة فشل — القاعدة ليست الكاملة:");
      problems.forEach((p) => console.error(`   • ${p}`));
      console.error("متوقّع ≈489 نظامًا و≈15,902 مادة. إن كانت هذه قاعدة تطوير مختصرة عمدًا اضبط QA_MIN_SYSTEMS/QA_MIN_ARTICLES.");
      process.exit(1);
    }
    console.log(`\n✓ فحص النواة الكاملة ناجح: ${counts.legal_systems} نظامًا / ${counts.legal_articles} مادة.`);
  } catch (error) {
    console.error("تعذر الاتصال بقاعدة البيانات الخارجية. تحقق من DATABASE_URL في Supabase/Vercel ثم أعد المحاولة.");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
