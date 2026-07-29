import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";
import {
  getUsersUsageSnapshots,
  pastWeekWindow,
} from "@/lib/modules/billing/users-usage-snapshot";
import { PRICING } from "@/config/pricing";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requirePagePermission("USERS_MANAGE");
  const { from, to } = pastWeekWindow();
  const baseUsers = await prisma.user
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })
    .catch(() => []);

  const usageMap = await getUsersUsageSnapshots(baseUsers.map((u) => u.id));

  const users = baseUsers.map((item) => {
    const usage = usageMap.get(item.id);
    const week = usage?.week;
    return {
      ...item,
      role: item.role,
      status: item.isActive ? "ACTIVE" : "INACTIVE",
      createdAt: item.createdAt.toISOString(),
      freeQuotaUsed: usage?.freeQuotaUsed ?? 0,
      freeQuotaTotal: usage?.freeQuotaTotal ?? PRICING.freeQuota,
      creditsBalance: usage?.creditsBalance ?? 0,
      subscriptionStatus: usage?.subscriptionStatus ?? "free",
      exhausted: usage?.exhausted ?? false,
      weekFrom: week?.from ?? from.toISOString(),
      weekTo: week?.to ?? to.toISOString(),
      weekCreditsSpent: week?.creditsSpent ?? 0,
      weekConsultations: week?.consultations ?? 0,
      weekSimulations: week?.simulations ?? 0,
      weekAskConversations: week?.askConversations ?? 0,
      weekLegalChatConversations: week?.legalChatConversations ?? 0,
      weekJaConversations: week?.jaConversations ?? 0,
      weekServicesVisited: week?.servicesVisited ?? [],
      weekClaudeCalls: week?.claudeCalls ?? 0,
      weekClaudeInputTokens: week?.claudeInputTokens ?? 0,
      weekClaudeOutputTokens: week?.claudeOutputTokens ?? 0,
      weekClaudeTokenEstimate: week?.claudeTokenEstimate ?? 0,
      weekClaudeMetered: week?.claudeMetered ?? false,
    };
  });

  const weekLabel = `آخر 7 أيام: من ${from.toLocaleString("ar-SA")} إلى ${to.toLocaleString("ar-SA")} — مخصوم النقاط، والخدمات التي زارها كل مستخدم، واستهلاك Claude خلال الأسبوع.`;

  return (
    <AdminPageShell currentPath="/admin/users">
      <p className="text-sm font-semibold text-gold">إدارة المستخدمين</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">المستخدمون</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        تحديث الأسبوع الماضي كامل لكل مستخدم: كم خُصم من رصيد النقاط، وأي خدمات زارها
        (استشارات، محاكاة، اسأل حكيم، محادثة قانونية، معاون)، واستهلاك Claude. الحصّة ورصيد
        النقاط الحاليان يظهران كمرجع كلي. التقرير التفصيلي:{" "}
        <Link href="/admin/usage" className="font-semibold text-[var(--gold-dark)] underline underline-offset-4">
          لوحة الاستهلاك
        </Link>
        .
      </p>
      <div className="mt-6">
        <AdminUsersManager initialUsers={users} weekLabel={weekLabel} />
      </div>
    </AdminPageShell>
  );
}
