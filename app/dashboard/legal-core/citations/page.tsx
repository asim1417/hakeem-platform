import Link from "next/link";
import { BarChart3, BookOpenCheck } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";
import { JudgmentCitationCapture } from "@/components/JudgmentCitationCapture";
import { LegalCorePageHeader, LegalCoreShell } from "@/components/legal-core";

export const dynamic = "force-dynamic";

export default async function LegalCoreCitationsPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title="التقاط الاستشهاد في الأحكام"
          description="طبقة بحث واستشهاد فوق النواة القانونية: تحلل نص الحكم، وتلتقط إشاراته إلى مواد الأنظمة، وتحاول حلها إلى legal_articles دون اختلاق."
          actions={
            <>
              <Link className="btn btn-gold" href="/dashboard/legal-core/citations/dashboard">
                <BarChart3 size={16} />
                لوحة الاستشهادات
              </Link>
              {TRADITIONAL_SEARCH_ENABLED ? (
                <Link className="btn ho-hero-outline" href="/dashboard/legal-core/search">
                  <BookOpenCheck size={16} />
                  البحث القانوني
                </Link>
              ) : null}
            </>
          }
        />

        <JudgmentCitationCapture />
      </div>
    </LegalCoreShell>
  );
}
