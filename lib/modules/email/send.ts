// ─────────────────────────────────────────────────────────────────────────────
// بريد حكيم — Resend عند توفر المفتاح، وإلا تسجيل خفيف (لا يكسر التدفق).
// ─────────────────────────────────────────────────────────────────────────────

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export function isEmailConfigured(): boolean {
  return Boolean((process.env.RESEND_API_KEY || "").trim());
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string; skipped?: boolean }> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.RESEND_FROM || "حكيم <onboarding@hakeem.sa>").trim();
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[email:dev]", input.to, input.subject);
    }
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[email] Resend failed", res.status, body.slice(0, 200));
      return { ok: false };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.warn("[email] send error", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string;
  credits: number;
}): Promise<void> {
  if (!opts.to || opts.to.endsWith("@hakeem.local")) return;
  const subject = `مرحبًا بك في حكيم — ${opts.credits} نقطة جاهزة`;
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#0E3435">
      <h1 style="color:#0E3435">حكيم</h1>
      <p>مرحبًا ${opts.name}،</p>
      <p>تم إنشاء حسابك. رصيدك الافتتاحي <strong>${opts.credits.toLocaleString("ar-SA")}</strong> نقطة.</p>
      <p>أكمل ملفك من <a href="${process.env.NEXTAUTH_URL || "https://hakeem-platform.vercel.app"}/onboarding">هنا</a> لزيادة رصيدك.</p>
      <p style="color:#C69763">رفيقك في القاعة.</p>
    </div>
  `;
  await sendEmail({ to: opts.to, subject, html, text: `مرحبًا ${opts.name} — رصيدك ${opts.credits} نقطة.` });
}
