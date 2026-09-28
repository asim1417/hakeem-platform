/**
 * إشعارات بريد خفيفة للتواصل — أفضل جهد، لا تكسر الإرسال عند فشل Resend.
 */
import { sendEmail, isEmailConfigured } from "@/lib/modules/email/send";
import { PLATFORM_OWNER_EMAILS } from "@/lib/modules/auth/oauth-shared";
import { getSiteUrl } from "@/lib/modules/config/site-url";

export type SupportNotifyResult = {
  attempted: boolean;
  sent: boolean;
  skipped: boolean;
  reason?: string;
};

export async function notifyAdminNewSupportMessage(opts: {
  userName: string;
  userEmail: string;
  preview: string;
}): Promise<SupportNotifyResult> {
  const recipients = [...PLATFORM_OWNER_EMAILS].filter(Boolean);
  if (recipients.length === 0) {
    return { attempted: false, sent: false, skipped: true, reason: "no_owner_email" };
  }
  if (!isEmailConfigured()) {
    console.warn("[support:notify] RESEND_API_KEY غير مضبوط — الرسالة محفوظة في الصندوق بلا بريد.");
    return { attempted: false, sent: false, skipped: true, reason: "email_not_configured" };
  }

  const subject = `رسالة دعم جديدة من ${opts.userName || opts.userEmail}`;
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#0E3435">
      <p><strong>${opts.userName}</strong> (${opts.userEmail})</p>
      <p style="white-space:pre-wrap;background:#F7F2EA;padding:12px;border-radius:8px">${escapeHtml(opts.preview)}</p>
      <p><a href="${getSiteUrl()}/admin/inbox">فتح صندوق التواصل</a></p>
    </div>`;

  let anySent = false;
  for (const to of recipients) {
    const result = await sendEmail({
      to,
      subject,
      html,
      text: `${opts.userName}: ${opts.preview}`,
    }).catch(() => ({ ok: false as const }));
    if (result.ok && !result.skipped) anySent = true;
  }

  return {
    attempted: true,
    sent: anySent,
    skipped: !anySent,
    reason: anySent ? undefined : "send_failed",
  };
}

export async function notifyUserSupportReply(opts: {
  to: string;
  preview: string;
}): Promise<SupportNotifyResult> {
  if (!opts.to || opts.to.endsWith("@hakeem.local")) {
    return { attempted: false, sent: false, skipped: true, reason: "invalid_recipient" };
  }
  if (!isEmailConfigured()) {
    return { attempted: false, sent: false, skipped: true, reason: "email_not_configured" };
  }
  const subject = "رد جديد من دعم حكيم";
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#0E3435">
      <p>وصلك رد من دعم حكيم:</p>
      <p style="white-space:pre-wrap;background:#F7F2EA;padding:12px;border-radius:8px">${escapeHtml(opts.preview)}</p>
      <p><a href="${getSiteUrl()}/dashboard">افتح المنصة ثم زر «الدعم» أسفل الصفحة لقراءة الرد</a></p>
    </div>`;
  const result = await sendEmail({
    to: opts.to,
    subject,
    html,
    text: opts.preview,
  }).catch(() => ({ ok: false as const }));
  return {
    attempted: true,
    sent: Boolean(result.ok && !("skipped" in result && result.skipped)),
    skipped: Boolean("skipped" in result && result.skipped) || !result.ok,
    reason: result.ok ? undefined : "send_failed",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
