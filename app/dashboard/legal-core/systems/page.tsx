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
          title="ط§ظ„ط£ظ†ط¸ظ…ط© ط§ظ„ظ‚ط§ظ†ظˆظ†ظٹط©"
          description="ط¨ط·ط§ظ‚ط§طھ ظ…ط¹ط±ظپظٹط© ظ…ط±طھط¨ط© ظ„ظƒظ„ ظ†ط¸ط§ظ… ط¯ط§ط®ظ„ ط§ظ„ظ†ظˆط§ط© ط§ظ„ظ‚ط§ظ†ظˆظ†ظٹط©طŒ ظ…ط¹ ط¹ط¯ط¯ ط§ظ„ظ…ظˆط§ط¯ ظˆط§ظ„ط­ط§ظ„ط© ظˆط§ظ„طھطµظ†ظٹظپ ظˆط±ظˆط§ط¨ط· ط§ظ„ظˆطµظˆظ„ ط§ظ„ط³ط±ظٹط¹ ظ„ظ„ظ…ظˆط§ط¯."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.laws.map((system) => <LegalSystemCard key={system.lawName} system={system} />)}
        </section>
      </div>
    </LegalCoreShell>
  );
}

