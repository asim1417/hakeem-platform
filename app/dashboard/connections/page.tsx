import { Hero } from "@/components/ui/design-system";
import { LegalAlert } from "@/components/ui/legal";
import { ConnectionsManager } from "@/components/connections/ConnectionsManager";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { accountLinkingEnabled } from "@/lib/mcp/config";
import { listPersonalKeys, listUserConnections } from "@/lib/mcp/grants/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "التطبيقات المرتبطة — حكيم",
};

export default async function ConnectionsPage() {
  const user = await requirePagePermission("LEGAL_CORE_VIEW");
  const enabled = accountLinkingEnabled();
  const [connections, keys] = enabled
    ? await Promise.all([listUserConnections(user.id).catch(() => []), listPersonalKeys(user.id).catch(() => [])])
    : [[], []];

  return (
    <div>
      <Hero
        eyebrow="حسابك"
        title="التطبيقات المرتبطة"
        lede="اربط Claude أو ChatGPT بحسابك في حكيم ليبحثا في الأنظمة والأحكام باسمك، وألغِ أي ربط متى شئت."
      />
      <div className="mt-6">
        {enabled ? (
          <ConnectionsManager initialConnections={connections} initialKeys={keys} mcpUrl={`${getSiteUrl()}/mcp`} />
        ) : (
          <LegalAlert>الربط بالحساب قيد التفعيل، وسيظهر هنا قريبًا.</LegalAlert>
        )}
      </div>
    </div>
  );
}
