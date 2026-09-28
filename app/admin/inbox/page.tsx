import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminSupportInbox } from "@/components/admin/AdminSupportInbox";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { isEmailConfigured } from "@/lib/modules/email/send";
import {
  countUnreadForAdmin,
  isSupportStoreReady,
  listThreadsForAdmin,
} from "@/lib/modules/support/support-store";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  await requireSuperAdminPage();
  const [unread, threads, storeReady] = await Promise.all([
    countUnreadForAdmin(),
    listThreadsForAdmin(60),
    isSupportStoreReady(),
  ]);
  const emailReady = isEmailConfigured();

  return (
    <AdminPageShell currentPath="/admin/inbox">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">صندوق المراسلات</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        هنا تصل رسائل العملاء من زر «الدعم» داخل المنصة — مع اسم المرسل وبريده في كل محادثة.{" "}
        {unread > 0 ? (
          <span className="font-semibold text-[#8B6914]">
            {unread.toLocaleString("ar-SA")} غير مقروءة
          </span>
        ) : (
          "لا رسائل معلّقة حالياً."
        )}
      </p>

      {!storeReady || !emailReady ? (
        <div
          className="mt-4 max-w-3xl rounded-[0.75rem] border border-[rgba(139,105,20,0.25)] bg-[#FFF8E8] px-4 py-3 text-sm leading-7 text-[#0E3435]"
          role="status"
        >
          <p className="font-semibold text-[#8B6914]">حالة تفعيل الدعم</p>
          <ul className="mt-1 list-disc pr-5">
            <li>
              قاعدة الرسائل:{" "}
              {storeReady ? "جاهزة" : "غير جاهزة — تحقق من DATABASE_URL وصلاحيات الجداول"}
            </li>
            <li>
              إشعار البريد للإدارة:{" "}
              {emailReady
                ? "مفعّل (Resend)"
                : "غير مفعّل — الرسائل تُحفظ هنا فقط. اضبط RESEND_API_KEY لاستلام تنبيه فوري"}
            </li>
          </ul>
        </div>
      ) : null}

      <AdminSupportInbox initialThreads={threads} />
    </AdminPageShell>
  );
}
