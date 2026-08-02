import { requirePagePermission } from "@/lib/modules/auth/session";
import { Hero } from "@/components/ui/design-system";
import { UsageLedgerClient } from "./UsageLedgerClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "سجل الاستخدام — حكيم",
};

export default async function UsagePage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  return (
    <div dir="rtl">
      <Hero
        eyebrow="حسابك"
        title="سجل الاستخدام"
        lede="كل حركات الخصم والإضافة على رصيدك — مع التصفية بالمصدر والتصدير إلى CSV."
      />
      <UsageLedgerClient />
    </div>
  );
}
