import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { RasdAgentsClient } from "./AgentsClient";

export const dynamic = "force-dynamic";

export default async function RasdAgentsPage() {
  await requirePagePermission("RASD_ADMIN");
  return (
    <AdminPageShell currentPath="/admin/rasd/agents">
      <section dir="rtl">
        <p className="text-sm font-semibold text-[#8B6914]">جسر رصد حكيم المحلي</p>
        <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">أجهزة الرصد</h1>
        <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
          يدير الوكلاء داخل السعودية. طلبات BOE وNCAR تصدر من الجهاز المحلي عبر long-poll — بلا فتح منافذ واردة وبلا Remote Shell.
        </p>
        <div className="mt-6">
          <RasdAgentsClient />
        </div>
      </section>
    </AdminPageShell>
  );
}
