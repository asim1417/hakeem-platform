import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getAiStatus } from "@/lib/modules/ai/ai-config";
import { AiSettingsManager } from "@/components/admin/AiSettingsManager";

export const dynamic = "force-dynamic";

export default async function AdminAiSettingsPage() {
  await requirePagePermission("USERS_MANAGE");
  const status = await getAiStatus();

  return (
    <AdminPageShell currentPath="/admin/ai">
      <p className="text-sm font-semibold text-[var(--gold-dark)]">إعدادات الموقع</p>
      <h1 className="t-head mt-2 text-3xl font-bold text-[var(--navy)]">إعدادات الذكاء الاصطناعي</h1>
      <p className="mt-2 max-w-3xl leading-8 text-[var(--ink-60)]">
        مصدر إعداد واحد للذكاء الاصطناعي عبر المنصّة — يرثه «اسأل حكيم» والقاضي التفاعلي. المفتاح يُخزّن مشفّراً ولا يظهر إلا عند كشفٍ صريح من المدير (يُسجَّل في سجلّ التدقيق).
      </p>
      <div className="mt-6 max-w-3xl">
        <AiSettingsManager initialStatus={status} />
      </div>
    </AdminPageShell>
  );
}
