import { prisma } from "@/lib/prisma";

export async function getSystemUser() {
  return prisma.user.upsert({
    where: { email: "system@hakeem.local" },
    update: {},
    create: {
      name: "مستخدم النظام",
      email: "system@hakeem.local",
      passwordHash: "not-for-login",
      role: "SYSTEM_ADMIN"
    }
  });
}
