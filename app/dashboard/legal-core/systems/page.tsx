import { requirePagePermission } from "@/lib/modules/auth/session";
import { getLibraryStats } from "@/lib/modules/library/library-service";
import { LegalCorePageHeader, LegalCoreShell, LegalSystemCard } from "@/components/legal-core";

export const dynamic = "force-dynamic";

export default async function LegalCoreSystemsPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const stats = await getLibraryStats().catch(() => ({ total: 0, systemCount: 0, laws: [] }));

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="الأنظمة القانونية"
          description="بطاقات معرفية مرتبة لكل نظام داخل النواة القانونية، مع عدد المواد والحالة والتصنيف وروابط الوصول السريع للمواد."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.laws.map((system) => <LegalSystemCard key={system.lawName} system={system} />)}
        </section>
      </div>
    </LegalCoreShell>
  );
}
