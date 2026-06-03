import { LibraryExplorer } from "@/components/LibraryExplorer";
import { getLibraryStats, searchLegalArticles } from "@/lib/modules/library/library-service";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  await requirePagePermission("LIBRARY_READ");
  const [stats, articles] = await Promise.all([
    getLibraryStats().catch(() => ({ total: 0, systemCount: 0, laws: [] })),
    searchLegalArticles("", 30).catch(() => [])
  ]);

  return (
    <LibraryExplorer
      total={stats.total}
      systemCount={stats.systemCount}
      laws={stats.laws}
      initialArticles={articles}
    />
  );
}
