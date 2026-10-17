import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { LegalAlert } from "@/components/ui/legal";
import { ConnectionsManager } from "@/components/connections/ConnectionsManager";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { accountLinkingEnabled, mcpSharedKey } from "@/lib/mcp/config";
import { listAllActiveConnections } from "@/lib/mcp/grants/queries";

export const dynamic = "force-dynamic";

export default async function AdminMcpConnectionsPage() {
  await requirePagePermission("USERS_MANAGE");
  const enabled = accountLinkingEnabled();
  const connections = enabled ? await listAllActiveConnections().catch(() => []) : [];

  return (
    <AdminPageShell currentPath="/admin/mcp-connections">
      <p className="text-sm font-semibold text-gold">موصل حكيم (MCP)</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">روابط الموصل</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        كل تطبيق (Claude أو ChatGPT) ربطه مستخدم بحسابه. إلغاء أي ربط يسري في الاستدعاء التالي مباشرة.
      </p>
      <div className="mt-6 space-y-4">
        {!enabled ? <LegalAlert tone="warning">الربط بالحساب غير مفعّل (MCP_ACCOUNT_LINKING وMCP_TOKEN_SECRET).</LegalAlert> : null}
        {mcpSharedKey() ? (
          <LegalAlert>المفتاح المشترك القديم ما زال مقبولًا. أوقفه بـ HAKEEM_MCP_SHARED_KEY_DISABLED=1 بعد انتقال الفريق.</LegalAlert>
        ) : null}
        {enabled ? <ConnectionsManager initialConnections={connections} mcpUrl={`${getSiteUrl()}/mcp`} admin /> : null}
      </div>
    </AdminPageShell>
  );
}
