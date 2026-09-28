/**
 * إشعارات بريد خفيفة للتواصل — أفضل جهد، لا تكسر الإرسال عند فشل Resend.
 */
import { sendEmail, ensureEmailConfigured } from "@/lib/modules/email/send";
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
  messageId?: string;
}): Promise<SupportNotifyResult> {
  const recipients = [...PLATFORM_OWNER_EMAILS].filter(Boolean);
  if (recipients.length === 0) {
    return { attempted: false, sent: false, skipped: true, reason: "no_owner_email" };
  }
  if (!(await ensureEmailConfigured())) {
    console.warn("[support:notify] RESEND_API_KEY غير مضبوط — الرسالة محفوظة في الصندوق بلا بريد.");
    return { attempted: false, sent: false, skipped: true, reason: "email_not_configured" };
  }

  // موضوع فريد لكل رسالة حتى لا يدمج Gmail الإشعارات أو يتجاهل المتشابهة.
  const stamp = new Date().toLocaleString("ar-SA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const who = opts.userName || opts.userEmail || "عميل";
  const subject = `دعم حكيم · ${who} · ${stamp}`;
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#0E3435">
      <p><strong>${escapeHtml(opts.userName)}</strong> (${escapeHtml(opts.userEmail)})</p>
      <p style="white-space:pre-wrap;background:#F7F2EA;padding:12px;border-radius:8px">${escapeHtml(opts.preview)}</p>
      <p><a href="${getSiteUrl()}/admin/inbox">فتح صندوق التواصل</a></p>
      ${opts.messageId ? `<p style="color:#888;font-size:12px">#${escapeHtml(opts.messageId.slice(0, 8))}</p>` : ""}
    </div>`;

  let anySent = false;
  let lastError: string | undefined;
  for (const to of recipients) {
    const result = await sendEmail({
      to,
      subject,
      html,
      text: `${opts.userName}: ${opts.preview}`,
    }).catch(() => ({ ok: false as const, skipped: false as const, error: "throw" }));
    if (result.ok && !result.skipped) anySent = true;
    else if (result.error) lastError = result.error;
    else if (result.skipped) lastError = "email_not_configured";
  }

  if (!anySent) {
    console.warn("[support:notify] لم يُرسل الإشعار", { lastError, recipients });
  }

  return {
    attempted: true,
    sent: anySent,
    skipped: !anySent,
    reason: anySent ? undefined : lastError || "send_failed",
  };
}

export async function notifyUserSupportReply(opts: {
  to: string;
  preview: string;
}): Promise<SupportNotifyResult> {
  if (!opts.to || opts.to.endsWith("@hakeem.local")) {
    return { attempted: false, sent: false, skipped: true, reason: "invalid_recipient" };
  }
  if (!(await ensureEmailConfigured())) {
    return { attempted: false, sent: false, skipped: true, reason: "email_not_configured" };
  }
  const stamp = new Date().toLocaleString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const subject = `رد من دعم حكيم · ${stamp}`;
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
  }).catch(() => ({ ok: false as const, skipped: false, error: "throw" }));
  return {
    attempted: true,
    sent: Boolean(result.ok && !result.skipped),
    skipped: Boolean(result.skipped) || !result.ok,
    reason: result.ok && !result.skipped ? undefined : result.error || "send_failed",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
