import { AppShell } from "@/components/AppShell";
import { AdminApiKeysManager } from "@/components/AdminApiKeysManager";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { API_SCOPES } from "@/lib/modules/api-gateway/api-keys";

export const dynamic = "force-dynamic";

export default async function AdminApiKeysPage() {
  await requirePagePermission("USERS_MANAGE");

  const keys = await prisma.apiKey
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, name: true, keyPrefix: true, scopes: true, rateLimit: true, active: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    })
    .then((items) =>
      items.map((k) => ({
        ...k,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
      }))
    )
    .catch(() => []);

  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">البوابة الخارجية</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">مفاتيح API</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        أنشئ مفاتيح للأطراف الخارجية وأنظمة الذكاء للوصول إلى واجهات <code className="font-mono-legal">/api/legal/*</code> بنطاق
        <code className="font-mono-legal"> legal:read</code>، مع حدّ معدّل لكل مفتاح. المفتاح يظهر مرة واحدة فقط عند الإنشاء.
      </p>
      <div className="mt-6">
        <AdminApiKeysManager initialKeys={keys} scopes={[...API_SCOPES]} />
      </div>
    </AppShell>
  );
}
