/** قراءات لوحة «التطبيقات المرتبطة» والمفاتيح الشخصية (Prisma). */
import { prisma } from "@/lib/prisma";
import { MCP_SCOPE } from "./service";

export const MAX_PERSONAL_KEYS = 5;

export type ConnectionView = {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  active: boolean;
};

export type PersonalKeyView = {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function listUserConnections(userId: string): Promise<ConnectionView[]> {
  const rows = await prisma.mcpGrant.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, clientName: true, createdAt: true, lastUsedAt: true, revokedAt: true, revokedReason: true },
  });
  return rows.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: iso(r.lastUsedAt),
    revokedAt: iso(r.revokedAt),
    revokedReason: r.revokedReason,
    active: !r.revokedAt,
  }));
}

export async function listPersonalKeys(userId: string): Promise<PersonalKeyView[]> {
  const rows = await prisma.apiKey.findMany({
    where: { userId, scopes: { has: MCP_SCOPE } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, keyPrefix: true, active: true, createdAt: true, lastUsedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.keyPrefix,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: iso(r.lastUsedAt),
  }));
}

export type AdminConnectionView = ConnectionView & { userEmail: string; userName: string };

export async function listAllActiveConnections(limit = 200): Promise<AdminConnectionView[]> {
  const rows = await prisma.mcpGrant.findMany({
    where: { revokedAt: null },
    orderBy: { lastUsedAt: "desc" },
    take: limit,
    select: {
      id: true,
      clientName: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      revokedReason: true,
      user: { select: { email: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: iso(r.lastUsedAt),
    revokedAt: iso(r.revokedAt),
    revokedReason: r.revokedReason,
    active: !r.revokedAt,
    userEmail: r.user.email,
    userName: r.user.name,
  }));
}
