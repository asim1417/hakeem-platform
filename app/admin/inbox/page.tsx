import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminSupportInbox } from "@/components/admin/AdminSupportInbox";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { countUnreadForAdmin } from "@/lib/modules/support/support-store";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  await requireSuperAdminPage();
  const unread = await countUnreadForAdmin();

  return (
    <AdminPageShell currentPath="/admin/inbox">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">صندوق التواصل</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        محادثات خفيفة مع العملاء — محفوظة في المنصة.{" "}
        {unread > 0 ? (
          <span className="font-semibold text-[#8B6914]">
            {unread.toLocaleString("ar-SA")} غير مقروءة
          </span>
        ) : (
          "لا رسائل معلّقة."
        )}
      </p>
      <AdminSupportInbox />
    </AdminPageShell>
  );
}
