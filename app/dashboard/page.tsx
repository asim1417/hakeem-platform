import { redirect } from "next/navigation";
import { PlatformWindowBanner } from "@/components/admin/PlatformWindowBanner";
import { DashboardWorkbench, type WorkItem } from "@/components/dashboard/DashboardWorkbench";
import { awardDailyVisit } from "@/lib/modules/credits/engagement";
import { getCurrentUser, type SafeUser } from "@/lib/modules/auth/session";
import {
  isSuperAdmin,
  isSuperAdminPanelEnabled,
} from "@/lib/modules/auth/super-admin";
import {
  caseListWhere,
  consultationListWhere,
  simulationListWhere,
} from "@/lib/modules/auth/ownership";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/activity-labels";

export const dynamic = "force-dynamic";

async function getDashboardStats(user: SafeUser | null) {
  const caseWhere = user ? caseListWhere(user) : { ownerId: "__none__" };
  const consultationWhere = user
    ? { ...consultationListWhere(user), status: "GENERATED" as const }
    : { userId: "__none__", status: "GENERATED" as const };
  const simulationWhere = user ? simulationListWhere(user) : { userId: "__none__" };
  const [
    legalArticles,
    consultations,
    simulations,
    cases,
    recentConsultations,
    recentCases,
    recentSimulations,
  ] = await Promise.all([
    prisma.legalArticle.count().catch(() => 0),
    prisma.consultation.count({ where: consultationWhere }).catch(() => 0),
    prisma.simulation.count({ where: simulationWhere }).catch(() => 0),
    prisma.caseFile.count({ where: caseWhere }).catch(() => 0),
    prisma.consultation
      .findMany({
        where: consultationWhere,
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, facts: true, createdAt: true },
      })
      .catch(() => []),
    prisma.caseFile
      .findMany({
        where: caseWhere,
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: { id: true, title: true, status: true, updatedAt: true },
      })
      .catch(() => []),
    prisma.simulation
      .findMany({
        where: simulationWhere,
        orderBy: { updatedAt: "desc" },
        take: 4,
        select: { id: true, title: true, stage: true, updatedAt: true },
      })
      .catch(() => []),
  ]);

  return {
    legalArticles,
    consultations,
    simulations,
    cases,
    recentConsultations,
    recentCases,
    recentSimulations,
  };
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    CLAIM_FILING: "تقييد الدعوى",
    INITIAL_ADMISSIBILITY: "فحص القبول",
    HEARING_RECORD: "ضبط الجلسة",
    PLAINTIFF_STATEMENT: "مداخلة المدعي",
    DEFENDANT_RESPONSE: "جواب المدعى عليه",
    PROCEDURAL_DECISION: "قرار إجرائي",
    PLEADING: "المرافعة",
    SETTLEMENT: "الصلح",
    CLOSE_PLEADING: "قفل باب المرافعة",
    TRAINING_JUDGMENT: "الحكم التدريبي",
    OBJECTION: "الاعتراض",
  };
  return labels[stage] ?? stage;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { welcome?: string; platform?: string };
}) {
  const me = await getCurrentUser().catch(() => null);
  const platformWindow =
    searchParams?.platform === "1" || searchParams?.platform === "true";

  if (me && isSuperAdmin(me) && isSuperAdminPanelEnabled() && !platformWindow) {
    redirect("/admin");
  }

  const stats = await getDashboardStats(me).catch(() => null);
  const showWelcome = searchParams?.welcome === "1";
  if (me) void awardDailyVisit(me.id).catch(() => undefined);

  const firstName = me?.name?.split(/\s+/).filter(Boolean)[0] || "بك";
  const hasRecentWork = Boolean(
    stats &&
      (stats.recentConsultations.length > 0 ||
        stats.recentCases.length > 0 ||
        stats.recentSimulations.length > 0)
  );
  const isNewUser = Boolean(
    stats &&
      !hasRecentWork &&
      stats.cases === 0 &&
      stats.consultations === 0 &&
      stats.simulations === 0
  );
  const showPlatformBanner = Boolean(
    me && isSuperAdmin(me) && isSuperAdminPanelEnabled() && platformWindow
  );

  const continueItems: WorkItem[] = [];
  if (stats) {
    for (const item of stats.recentCases) {
      continueItems.push({
        id: `case-${item.id}`,
        title: item.title,
        meta: `قضية · ${statusLabel(item.status)} · ${item.updatedAt.toLocaleString("ar-SA")}`,
        href: "/dashboard/cases",
      });
    }
    for (const item of stats.recentConsultations) {
      continueItems.push({
        id: `con-${item.id}`,
        title: item.facts.slice(0, 100),
        meta: `استشارة · ${item.createdAt.toLocaleString("ar-SA")}`,
        href: "/dashboard/consultations",
      });
    }
    for (const item of stats.recentSimulations) {
      continueItems.push({
        id: `sim-${item.id}`,
        title: item.title,
        meta: `قاضي تفاعلي · ${stageLabel(item.stage)} · ${item.updatedAt.toLocaleString("ar-SA")}`,
        href: "/dashboard/simulations",
      });
    }
  }

  return (
    <div className="wb-page">
      {showPlatformBanner ? <PlatformWindowBanner /> : null}
      {!stats ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          تعذر تحميل بيانات الرئيسية.
        </div>
      ) : (
        <DashboardWorkbench
          firstName={firstName}
          isNewUser={isNewUser}
          showWelcome={showWelcome}
          legalArticles={stats.legalArticles}
          continueItems={continueItems.slice(0, 6)}
        />
      )}
    </div>
  );
}
