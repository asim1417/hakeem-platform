import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const EXPECTED_SYSTEMS = 9;
const EXPECTED_ARTICLES = 1981;

const roleLabels = {
  SYSTEM_ADMIN: "مدير النظام",
  LAWYER: "محامٍ",
  TRAINER: "مدرب / مشرف",
  TRAINEE: "متدرب"
} as const;

const permissions = [
  ["CONSULTATIONS_FULL", "استشارات قانونية كاملة"],
  ["CONSULTATIONS_LIMITED", "استشارات تعليمية محدودة"],
  ["SIMULATIONS_USE", "استخدام المحاكاة القضائية"],
  ["TRAINING_USE", "استخدام التدريب والتعلم"],
  ["TRAINING_MANAGE", "إدارة التدريب والتقييم"],
  ["LIBRARY_READ", "قراءة المكتبة النظامية"],
  ["ATTACHMENTS_FULL", "إدارة المرفقات كاملة"],
  ["ATTACHMENTS_LIMITED", "إدارة مرفقات محدودة"],
  ["USERS_MANAGE", "إدارة المستخدمين"],
  ["ADMIN_REPORTS_VIEW", "عرض الإدارة والتقارير"],
  ["GOVERNANCE_AUDIT_VIEW", "عرض الحوكمة والتدقيق"]
] as const;

const rolePermissionMap = {
  SYSTEM_ADMIN: permissions.map(([key]) => key),
  LAWYER: ["CONSULTATIONS_FULL", "SIMULATIONS_USE", "TRAINING_USE", "LIBRARY_READ", "ATTACHMENTS_FULL"],
  TRAINER: ["SIMULATIONS_USE", "TRAINING_USE", "TRAINING_MANAGE", "LIBRARY_READ", "ATTACHMENTS_FULL", "ADMIN_REPORTS_VIEW"],
  TRAINEE: ["CONSULTATIONS_LIMITED", "SIMULATIONS_USE", "TRAINING_USE", "LIBRARY_READ", "ATTACHMENTS_LIMITED"]
} as const;

const classifications: Record<string, string> = {
  "نظام المعاملات المدنية": "مدني",
  "نظام الشركات": "تجاري",
  "نظام الأحوال الشخصية": "أحوال شخصية",
  "نظام المرافعات الشرعية": "إجرائي",
  "نظام الإجراءات الجزائية": "جزائي",
  "نظام التنفيذ": "إجرائي",
  "نظام المحاكم التجارية": "تجاري",
  "نظام التوثيق": "توثيق",
  "نظام المرافعات أمام ديوان المظالم": "إداري"
};

type ExportedArticle = {
  article_number: number;
  law_name: string;
  title: string;
  content: string;
  keywords?: string[];
};

async function main() {
  const file = path.join(process.cwd(), "data", "legal_articles_export.json");
  const articles = JSON.parse(await fs.readFile(file, "utf8")) as ExportedArticle[];
  const systemCounts = new Map<string, number>();

  for (const article of articles) {
    systemCounts.set(article.law_name, (systemCounts.get(article.law_name) ?? 0) + 1);
  }

  if (systemCounts.size !== EXPECTED_SYSTEMS || articles.length !== EXPECTED_ARTICLES) {
    throw new Error(
      `ملف المكتبة غير مطابق للوثيقة: الأنظمة=${systemCounts.size}/${EXPECTED_SYSTEMS}, المواد=${articles.length}/${EXPECTED_ARTICLES}`
    );
  }

  for (const [key, name] of Object.entries(roleLabels)) {
    await prisma.roleRecord.upsert({
      where: { key: key as keyof typeof roleLabels },
      update: { name },
      create: { key: key as keyof typeof roleLabels, name }
    });
  }

  for (const [key, name] of permissions) {
    await prisma.permissionRecord.upsert({
      where: { key },
      update: { name },
      create: { key, name }
    });
  }

  for (const [roleKey, permissionKeys] of Object.entries(rolePermissionMap)) {
    const role = await prisma.roleRecord.findUniqueOrThrow({ where: { key: roleKey as keyof typeof rolePermissionMap } });
    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permissionRecord.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id }
      });
    }
  }

  const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || "admin@hakeem.local").toLowerCase();
  const existingAdmin = await prisma.user.findUnique({ where: { email: initialAdminEmail } });
  let initialAdminPassword: string | undefined;
  if (!existingAdmin) {
    initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || `Hakeem-${crypto.randomBytes(6).toString("hex")}!`;
    await prisma.user.create({
      data: {
        name: "مدير منصة حكيم",
        email: initialAdminEmail,
        passwordHash: await bcrypt.hash(initialAdminPassword, 12),
        role: "SYSTEM_ADMIN",
        isActive: true
      }
    });
  }

  const systems = Array.from(systemCounts.keys());
  for (const lawName of systems) {
    const articleCount = systemCounts.get(lawName) ?? 0;
    await prisma.legalSystem.upsert({
      where: { name: lawName },
      update: {
        classification: classifications[lawName],
        articleCount
      },
      create: {
        name: lawName,
        classification: classifications[lawName],
        articleCount
      }
    });
  }

  for (const article of articles) {
    const legalSystem = await prisma.legalSystem.findUniqueOrThrow({ where: { name: article.law_name } });
    await prisma.legalArticle.upsert({
      where: {
        lawName_articleNumber: {
          lawName: article.law_name,
          articleNumber: article.article_number
        }
      },
      update: {
        legalSystemId: legalSystem.id,
        classification: classifications[article.law_name],
        title: article.title,
        content: article.content,
        keywords: article.keywords ?? []
      },
      create: {
        legalSystemId: legalSystem.id,
        lawName: article.law_name,
        classification: classifications[article.law_name],
        articleNumber: article.article_number,
        title: article.title,
        content: article.content,
        keywords: article.keywords ?? []
      }
    });
  }

  const dbSystemCount = await prisma.legalSystem.count();
  const dbArticleCount = await prisma.legalArticle.count();
  const dbRoleCount = await prisma.roleRecord.count();
  const dbPermissionCount = await prisma.permissionRecord.count();

  const report = await prisma.legalSystem.findMany({
    select: { name: true, articleCount: true },
    orderBy: { name: "asc" }
  });

  console.log("تم استيراد مكتبة حكيم النظامية بنجاح.");
  console.table(report);
  console.log(
    JSON.stringify(
      {
        roles: dbRoleCount,
        permissions: dbPermissionCount,
        legal_systems: dbSystemCount,
        legal_articles: dbArticleCount,
        expected: {
          legal_systems: EXPECTED_SYSTEMS,
          legal_articles: EXPECTED_ARTICLES
        }
      },
      null,
      2
    )
  );
  if (initialAdminPassword) {
    console.log(`Initial admin: ${initialAdminEmail}`);
    console.log(`Temporary password: ${initialAdminPassword}`);
    console.log("غيّر كلمة المرور المؤقتة بعد أول دخول أو أنشئ مستخدمًا إداريًا جديدًا من /admin/users.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
