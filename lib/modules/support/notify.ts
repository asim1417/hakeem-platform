/**
 * إشعارات بريد خفيفة للتواصل — أفضل جهد، لا تكسر الإرسال عند فشل Resend.
 */
import { sendEmail } from "@/lib/modules/email/send";
import { PLATFORM_OWNER_EMAILS } from "@/lib/modules/auth/oauth-shared";

const APP_URL = (process.env.NEXTAUTH_URL || "https://hakeem-platform.vercel.app").replace(/\/$/, "");

export async function notifyAdminNewSupportMessage(opts: {
  userName: string;
  userEmail: string;
  preview: string;
}): Promise<void> {
  const to = PLATFORM_OWNER_EMAILS[0];
  if (!to) return;
  const subject = `رسالة دعم جديدة من ${opts.userName || opts.userEmail}`;
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#0E3435">
      <p><strong>${opts.userName}</strong> (${opts.userEmail})</p>
      <p style="white-space:pre-wrap;background:#F7F2EA;padding:12px;border-radius:8px">${escapeHtml(opts.preview)}</p>
      <p><a href="${APP_URL}/admin/inbox">فتح صندوق التواصل</a></p>
    </div>`;
  await sendEmail({
    to,
    subject,
    html,
    text: `${opts.userName}: ${opts.preview}`,
  }).catch(() => undefined);
}

export async function notifyUserSupportReply(opts: {
  to: string;
  preview: string;
}): Promise<void> {
  if (!opts.to || opts.to.endsWith("@hakeem.local")) return;
  const subject = "رد جديد من دعم حكيم";
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#0E3435">
      <p>وصلك رد من دعم حكيم:</p>
      <p style="white-space:pre-wrap;background:#F7F2EA;padding:12px;border-radius:8px">${escapeHtml(opts.preview)}</p>
      <p><a href="${APP_URL}/dashboard">افتح المنصة ثم زر «الدعم» أسفل الصفحة لقراءة الرد</a></p>
    </div>`;
  await sendEmail({
    to: opts.to,
    subject,
    html,
    text: opts.preview,
  }).catch(() => undefined);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
