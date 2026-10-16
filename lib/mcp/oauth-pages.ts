/** صفحة ربط الموصل. HTML مستقل حتى لا تمرّ بتخطيط التطبيق أو Clerk. */

export type AuthorizeForm = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  resource: string;
  error?: string;
};

export function renderAuthorizePage(form: AuthorizeForm): string {
  const error = form.error
    ? `<p class="error" role="alert">${escapeHtml(form.error)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>ربط موصل حكيم</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f1ea; color: #1c1915; font-family: "Segoe UI", Tahoma, sans-serif; }
    main { width: min(440px, calc(100% - 32px)); background: #fff; border: 1px solid #e4dccb; border-radius: 16px; padding: 28px 24px; }
    h1 { margin: 0 0 8px; font-size: 1.4rem; }
    p { margin: 0 0 16px; line-height: 1.7; color: #4a433a; }
    label { display: block; font-weight: 600; margin-bottom: 8px; }
    input { width: 100%; box-sizing: border-box; font-size: 1rem; padding: 12px 14px; border-radius: 10px; border: 1px solid #cfc4b0; }
    button { width: 100%; margin-top: 16px; border: 0; border-radius: 10px; padding: 12px 16px; background: #1f4d3a; color: #fff; font-size: 1rem; font-weight: 700; }
    .error { background: #fde8e4; color: #8a2b1f; border-radius: 10px; padding: 10px 12px; }
  </style>
</head>
<body>
  <main>
    <h1>ربط موصل حكيم</h1>
    <p>Claude يطلب الوصول إلى مكنز حكيم. أدخل مفتاح الموصل الذي ضبطه مسؤول المنصة. هذا مفتاح حكيم وليس كلمة مرور Claude.</p>
    <p>بعد المتابعة تعود إلى: ${escapeHtml(redirectHost(form.redirectUri))}</p>
    ${error}
    <form method="post" action="/oauth/authorize">
      ${hidden("client_id", form.clientId)}
      ${hidden("redirect_uri", form.redirectUri)}
      ${hidden("state", form.state)}
      ${hidden("code_challenge", form.codeChallenge)}
      ${hidden("code_challenge_method", form.codeChallengeMethod)}
      ${hidden("scope", form.scope)}
      ${hidden("resource", form.resource)}
      <label for="connector_key">مفتاح الموصل</label>
      <p>الصق القيمة وحدها. لا تكتب اسم HAKEEM_MCP_KEY قبلها.</p>
      <input id="connector_key" name="connector_key" type="password" autocomplete="off" required />
      <button type="submit">متابعة الربط</button>
    </form>
  </main>
</body>
</html>`;
}

export function renderOauthMessage(title: string, message: string, status = 400): Response {
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: Tahoma, sans-serif; background:#f4f1ea; color:#1c1915; padding:32px;">
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
}

function redirectHost(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return "";
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
