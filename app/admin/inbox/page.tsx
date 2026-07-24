import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminSupportInbox } from "@/components/admin/AdminSupportInbox";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import {
  countUnreadForAdmin,
  listThreadsForAdmin,
} from "@/lib/modules/support/support-store";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  await requireSuperAdminPage();
  const [unread, threads] = await Promise.all([
    countUnreadForAdmin(),
    listThreadsForAdmin(60),
  ]);

  return (
    <AdminPageShell currentPath="/admin/inbox">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">صندوق المراسلات</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        هنا تصل رسائل العملاء من زر «تواصل معنا» — مع اسم المرسل وبريده في كل محادثة.{" "}
        {unread > 0 ? (
          <span className="font-semibold text-[#8B6914]">
            {unread.toLocaleString("ar-SA")} غير مقروءة
          </span>
        ) : (
          "لا رسائل معلّقة حالياً."
        )}
      </p>
      <AdminSupportInbox initialThreads={threads} />
    </AdminPageShell>
  );
}
