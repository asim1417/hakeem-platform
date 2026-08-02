import "server-only";

// محفظة مساحة العمل المشتركة (مقاعد OFFICE/ENTERPRISE) — HKM-BILLING-UX-001 (§4).
// رصيد الفريق يُدار على محفظة مالك المساحة؛ الأعضاء يستهلكون منها.

/** يعيد معرّف صاحب المحفظة الفعلية: مالك مساحة العمل إن كان المستخدم عضوًا، وإلا نفسه. */
export async function resolveWalletOwner(userId: string): Promise<string> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });
    if (membership?.workspace?.ownerId) return membership.workspace.ownerId;
  } catch {
    /* لا مساحة عمل — المستخدم محفظته */
  }
  return userId;
}

export interface WorkspaceMemberView {
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  joinedAt: Date;
}

/** ينشئ مساحة عمل للمالك إن لم توجد (لباقات المقاعد). */
export async function ensureWorkspaceForOwner(ownerId: string, name = "مساحة عملي"): Promise<string> {
  const { prisma } = await import("@/lib/prisma");
  const existing = await prisma.tenantWorkspace.findFirst({ where: { ownerId } });
  if (existing) return existing.id;
  const ws = await prisma.tenantWorkspace.create({ data: { ownerId, name } });
  return ws.id;
}

/** حدّ المقاعد المتاح من اشتراك المالك الفعّال (0 = بلا مقاعد). */
async function ownerSeatLimit(ownerId: string): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const sub = await prisma.subscription.findFirst({
    where: { userId: ownerId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  return sub?.plan?.includedSeats ?? 0;
}

/** إضافة عضو بالبريد ضمن حدّ المقاعد. */
export async function addWorkspaceMember(input: {
  ownerId: string;
  email: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const limit = await ownerSeatLimit(input.ownerId);
  if (limit <= 1) return { ok: false, message: "باقتك لا تشمل مقاعد فريق." };

  const wsId = await ensureWorkspaceForOwner(input.ownerId);
  const count = await prisma.workspaceMember.count({ where: { workspaceId: wsId } });
  // المالك يشغل مقعدًا ضمنيًا.
  if (count + 1 >= limit) return { ok: false, message: "استُنفدت المقاعد المتاحة في باقتك." };

  const member = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (!member) return { ok: false, message: "لا يوجد مستخدم بهذا البريد." };
  if (member.id === input.ownerId) return { ok: false, message: "أنت مالك المساحة أصلًا." };

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: wsId, userId: member.id } },
    create: { workspaceId: wsId, userId: member.id, role: "member" },
    update: {},
  });
  const { recordBillingAudit } = await import("@/lib/modules/billing/billing-audit");
  await recordBillingAudit({
    action: "WORKSPACE_MEMBER_ADDED",
    actorUserId: input.ownerId,
    targetType: "workspace",
    targetId: wsId,
    metadata: { memberId: member.id },
  });
  return { ok: true };
}

/** إزالة عضو من مساحة عمل المالك. */
export async function removeWorkspaceMember(input: {
  ownerId: string;
  memberUserId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const ws = await prisma.tenantWorkspace.findFirst({ where: { ownerId: input.ownerId } });
  if (!ws) return { ok: false, message: "لا مساحة عمل." };
  await prisma.workspaceMember.deleteMany({ where: { workspaceId: ws.id, userId: input.memberUserId } });
  const { recordBillingAudit } = await import("@/lib/modules/billing/billing-audit");
  await recordBillingAudit({
    action: "WORKSPACE_MEMBER_REMOVED",
    actorUserId: input.ownerId,
    targetType: "workspace",
    targetId: ws.id,
    metadata: { memberId: input.memberUserId },
  });
  return { ok: true };
}

/** أعضاء مساحة العمل التي يملكها المستخدم (لإدارة المقاعد). */
export async function getOwnedWorkspaceMembers(ownerId: string): Promise<{
  workspaceId: string | null;
  seatsUsed: number;
  members: WorkspaceMemberView[];
}> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const ws = await prisma.tenantWorkspace.findFirst({
      where: { ownerId },
      include: { members: { include: { user: { select: { name: true, email: true } } } } },
    });
    if (!ws) return { workspaceId: null, seatsUsed: 0, members: [] };
    return {
      workspaceId: ws.id,
      seatsUsed: ws.members.length,
      members: ws.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        name: m.user?.name ?? null,
        email: m.user?.email ?? null,
        joinedAt: m.createdAt,
      })),
    };
  } catch {
    return { workspaceId: null, seatsUsed: 0, members: [] };
  }
}
