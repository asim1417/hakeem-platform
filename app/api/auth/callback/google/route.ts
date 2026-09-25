import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleCodeForProfile,
  getGoogleOAuthConfig,
  googleCallbackUrl,
  GOOGLE_POPUP_COOKIE,
  GOOGLE_STATE_COOKIE,
  OAUTH_NEXT_COOKIE,
} from "@/lib/modules/auth/google-oauth";
import { OAUTH_REF_COOKIE, safeNextPath } from "@/lib/modules/auth/oauth-shared";
import { establishFirstPartySession } from "@/lib/modules/auth/establish-session";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";
import { continueUrl } from "@/lib/modules/auth/safe-next";
import {
  attachLoginSessionCookie,
  mirrorLoginSessionCookie,
} from "@/lib/modules/auth/session";
import { recordAuthTelemetry } from "@/lib/modules/auth/auth-telemetry";

export const dynamic = "force-dynamic";

function buildPopupHtml(scriptBody: string, title: string, subtitle: string) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F7F4EE; color: #0E3435; }
    .card { background: #FFFcf7; border: 1px solid rgba(14,52,53,0.1); border-radius: 12px; padding: 24px; text-align: center; max-width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .spinner { width: 28px; height: 28px; border: 3px solid rgba(14,52,53,0.15); border-top-color: #0E3435; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <p style="font-weight: 600; font-size: 15px; margin: 0 0 6px;">${title}</p>
    <p style="font-size: 13px; color: rgba(14,52,53,0.7); margin: 0;">${subtitle}</p>
  </div>
  <script>${scriptBody}</script>
</body>
</html>`;
}

/**
 * GET /api/auth/callback/google
 * بعد Google: تثبيت hakeem_session وإشعار النافذة الأصلية (إن كانت منبثقة) أو توجيه المتصفح.
 */
export async function GET(request: NextRequest) {
  await hydrateEnvFromSettings().catch(() => 0);

  const isPopup =
    request.cookies.get(GOOGLE_POPUP_COOKIE)?.value === "1" ||
    request.nextUrl.searchParams.get("popup") === "1";

  const cfg = getGoogleOAuthConfig();
  const fail = (reason: string) => {
    recordAuthTelemetry({
      provider: "google",
      outcome: reason.includes("not_configured") || reason.includes("misconfigured") ? "blocked" : "failure",
      reason:
        reason.includes("not_configured") ? "misconfigured"
        : reason.includes("state") ? "exchange_failed"
        : reason.includes("profile") ? "exchange_failed"
        : reason.includes("session") ? "session_failed"
        : "unknown",
      surface: "callback",
    });
    if (isPopup) {
      const script = `
        (function() {
          var payload = {
            type: "hakeem_oauth_error",
            provider: "google",
            error: ${JSON.stringify(reason)}
          };
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage(payload, window.location.origin);
              window.close();
              return;
            } catch (e) {}
          }
          window.location.replace("/sign-in?login_error=" + encodeURIComponent(${JSON.stringify(reason)}));
        })();
      `;
      const res = new NextResponse(
        buildPopupHtml(script, "تعذّر إكمال تسجيل الدخول", "يُرجى إغلاق النافذة والمحاولة مجددًا"),
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
      res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
      res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
      res.cookies.set(OAUTH_REF_COOKIE, "", { path: "/", maxAge: 0 });
      res.cookies.set(GOOGLE_POPUP_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
    return NextResponse.redirect(
      new URL(`/sign-in?login_error=${encodeURIComponent(reason)}`, request.url)
    );
  };

  if (!cfg) return fail("google_not_configured");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const nextRaw = request.cookies.get(OAUTH_NEXT_COOKIE)?.value;
  const ref = request.cookies.get(OAUTH_REF_COOKIE)?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return fail("invalid_oauth_state");
  }

  const profile = await exchangeGoogleCodeForProfile(
    cfg,
    code,
    googleCallbackUrl(request.nextUrl.origin)
  );
  if (!profile?.email) return fail("google_profile_failed");

  let user;
  try {
    user = await establishFirstPartySession({
      email: profile.email,
      name: profile.name,
      referralCode: ref,
      provider: "google",
    });
  } catch {
    return fail("session_establish_failed");
  }

  const next = safeNextPath(nextRaw, "/dashboard");
  recordAuthTelemetry({
    provider: "google",
    outcome: "success",
    reason: "ok",
    surface: "callback",
  });
  const secure = request.nextUrl.protocol === "https:";

  if (isPopup) {
    const script = `
      (function() {
        var payload = {
          type: "hakeem_oauth_success",
          provider: "google",
          next: ${JSON.stringify(next)}
        };
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(payload, window.location.origin);
            window.close();
            return;
          } catch (e) {}
        }
        window.location.replace(${JSON.stringify(continueUrl(next))});
      })();
    `;
    const res = new NextResponse(
      buildPopupHtml(script, "تم تسجيل الدخول بنجاح", "جارٍ تحويلك إلى المنصة..."),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
    if (!mirrorLoginSessionCookie(res, { secure })) {
      attachLoginSessionCookie(res, user, { secure });
    }
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(OAUTH_REF_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(GOOGLE_POPUP_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const res = NextResponse.redirect(new URL(continueUrl(next), request.url));

  // ثبت نفس قيمة الجلسة على استجابة التحويل (أو أنشئ واحدة إن غابت من المخزن)
  if (!mirrorLoginSessionCookie(res, { secure })) {
    attachLoginSessionCookie(res, user, { secure });
  }

  res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(OAUTH_REF_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(GOOGLE_POPUP_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
