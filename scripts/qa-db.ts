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
  } catch (error) {
    console.error("تعذر الاتصال بقاعدة البيانات الخارجية. تحقق من DATABASE_URL في Supabase/Vercel ثم أعد المحاولة.");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
