import { NextResponse } from "next/server";

/**
 * صفحة ختام النافذة المنبثقة — النمط نفسه في callback/google:
 * postMessage إلى النافذة الأم على الأصل نفسه فقط، ثم window.close.
 * إن لم توجد نافذة أم (فُتح الرابط في تبويب عادي) نكمل بتحويل عادي.
 */
export function oauthPopupResponse(opts: {
  ok: boolean;
  provider: string;
  /** الوجهة عند النجاح، وعند غياب النافذة الأم */
  next: string;
  error?: string;
}): NextResponse {
  const payload = opts.ok
    ? { type: "hakeem_oauth_success", provider: opts.provider, next: opts.next }
    : { type: "hakeem_oauth_error", provider: opts.provider, error: opts.error || "oauth_failed" };
  const fallback = opts.ok
    ? opts.next
    : `/sign-in?login_error=${encodeURIComponent(opts.error || "oauth_failed")}`;
  // JSON.stringify + استبدال "<" يمنع كسر وسم script بقيم غير متوقعة.
  const safe = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  const script = `(function(){var p=${safe(payload)};if(window.opener&&!window.opener.closed){try{window.opener.postMessage(p,window.location.origin);window.close();return;}catch(e){}}window.location.replace(${safe(fallback)});})();`;
  const title = opts.ok ? "تم تسجيل الدخول بنجاح" : "تعذّر إكمال تسجيل الدخول";
  const subtitle = opts.ok ? "جارٍ العودة إلى حكيم…" : "يُرجى إغلاق النافذة والمحاولة مجددًا";
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F7F4EE; color: #0E3435; }
    .card { background: #FFFcf7; border: 1px solid rgba(14,52,53,0.1); border-radius: 12px; padding: 24px; text-align: center; max-width: 320px; }
  </style>
</head>
<body>
  <main class="card">
    <h1 style="font-size: 15px; margin: 0 0 6px;">${title}</h1>
    <p style="font-size: 13px; color: #5B7473; margin: 0;">${subtitle}</p>
  </main>
  <script>${script}</script>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
