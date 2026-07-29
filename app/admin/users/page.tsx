import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getUsersUsageSnapshots } from "@/lib/modules/billing/users-usage-snapshot";
import { PRICING } from "@/config/pricing";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requirePagePermission("USERS_MANAGE");
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
    const usage = usageMap.get(item.id) ?? {
      freeQuotaUsed: 0,
      freeQuotaTotal: PRICING.freeQuota,
      creditsBalance: 0,
      subscriptionStatus: "free",
      exhausted: false,
      consultations: 0,
      simulations: 0,
      askConversations: 0,
      legalChatConversations: 0,
      jaConversations: 0,
      claudeCalls: 0,
      claudeInputTokens: 0,
      claudeOutputTokens: 0,
      claudeTokenEstimate: 0,
      claudeMetered: false,
    };
    return {
      ...item,
      role: item.role,
      status: item.isActive ? "ACTIVE" : "INACTIVE",
      createdAt: item.createdAt.toISOString(),
      freeQuotaUsed: usage.freeQuotaUsed,
      freeQuotaTotal: usage.freeQuotaTotal,
      creditsBalance: usage.creditsBalance,
      subscriptionStatus: usage.subscriptionStatus,
      exhausted: usage.exhausted,
      consultations: usage.consultations,
      simulations: usage.simulations,
      askConversations: usage.askConversations,
      legalChatConversations: usage.legalChatConversations,
      jaConversations: usage.jaConversations,
      claudeCalls: usage.claudeCalls,
      claudeInputTokens: usage.claudeInputTokens,
      claudeOutputTokens: usage.claudeOutputTokens,
      claudeTokenEstimate: usage.claudeTokenEstimate,
      claudeMetered: usage.claudeMetered,
    };
  });

  return (
    <AdminPageShell currentPath="/admin/users">
      <p className="text-sm font-semibold text-gold">إدارة المستخدمين</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">المستخدمون</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        لكل مستخدم: الحصّة والنقاط، والخدمات التي نفّذها (استشارات، محاكاة، اسأل حكيم، محادثة
        قانونية، معاون)، واستهلاك مفتاح Claude (نداءات ورموز). الرموز الفعلية تُسجَّل من الآن؛
        السابق يُعرض من سجل التدقيق كتقدير. التقرير الكامل:{" "}
        <Link href="/admin/usage" className="font-semibold text-[var(--gold-dark)] underline underline-offset-4">
          لوحة الاستهلاك
        </Link>
        . لحساب المالك:{" "}
        <Link href="/admin/owner" className="font-semibold text-[var(--gold-dark)] underline underline-offset-4">
          صفحة المالك
        </Link>
        .
      </p>
      <div className="mt-6">
        <AdminUsersManager initialUsers={users} />
      </div>
    </AdminPageShell>
  );
}
