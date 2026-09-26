/**
 * الدخول من الصفحة الرئيسية دون مغادرتها (HOME_INLINE_AUTH_ENABLED).
 * npx tsx scripts/test-home-inline-auth.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeHero } from "../components/home/HomeHero";
import { HomeAuthLauncher, type HomeAuthConfig } from "../components/home/HomeAuthLauncher";
import { HomeAuthDialog } from "../components/home/HomeAuthDialog";
import { DEFAULT_HOME } from "../lib/modules/site/defaults";
import { HOME_AUTH_RETURN_PATH, safeDashboardNext, signUpWithNext } from "../lib/modules/auth/safe-next";
import {
  HOME_AUTH_INTENT_TTL_MS,
  isHomeInlineAuthEnabled,
  lastAuthMethodCookie,
  parseHomeAuthIntent,
  parseLastAuthMethod,
  serializeHomeAuthIntent,
} from "../lib/modules/config/home-inline-auth";

// tsconfig يستخدم jsx: preserve فيحوّل tsx المكوّنات بالنمط الكلاسيكي (React.createElement)
(globalThis as { React?: typeof React }).React = React;

const root = process.cwd();
const ENV_KEYS = [
  "HOME_INLINE_AUTH_ENABLED",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_EMAIL_CODE_ENABLED",
  "AUTH_PHONE_ENABLED",
  "AUTH_IDENTIFIER_FORM_ENABLED",
  "AUTH_MICROSOFT_ENABLED",
  "AUTH_APPLE_ENABLED",
  "NEXT_PUBLIC_ASK_FIRST_HOME",
];
function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

/** إعداد يشبه الإنتاج: Google أصلي + بريد/جوال برمز، وMicrosoft/Apple مطفآن. */
const PROD_LIKE = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_c2FmZS1lbGstNTAuY2xlcmsuYWNjb3VudHMuZGV2JA",
  CLERK_SECRET_KEY: "sk_test_dummy",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  AUTH_EMAIL_CODE_ENABLED: "1",
  AUTH_PHONE_ENABLED: "1",
  AUTH_IDENTIFIER_FORM_ENABLED: "1",
  AUTH_MICROSOFT_ENABLED: "0",
  AUTH_APPLE_ENABLED: "0",
};

function findElements(node: ReactNode, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const n of node) findElements(n, type, out);
  } else if (isValidElement(node)) {
    if (node.type === type) out.push(node);
    const props = node.props as Record<string, unknown>;
    for (const v of Object.values(props)) {
      if (isValidElement(v) || Array.isArray(v)) findElements(v as ReactNode, type, out);
    }
  }
  return out;
}

function anchors(html: string): Array<{ href: string; attrs: string; text: string }> {
  return [...html.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: /href="([^"]*)"/.exec(m[1])?.[1] ?? "",
    attrs: m[1],
    text: m[2].replace(/<[^>]+>/g, "").trim(),
  }));
}

const decode = (s: string) => s.replace(/&amp;/g, "&");

// ── الراية ──
withEnv({}, () => assert.equal(isHomeInlineAuthEnabled(), true, "on by default"));
for (const off of ["0", "false", "off", " OFF "]) {
  withEnv({ HOME_INLINE_AUTH_ENABLED: off }, () => assert.equal(isHomeInlineAuthEnabled(), false, off));
}
const settings = fs.readFileSync(path.join(root, "lib/modules/settings/settings-service.ts"), "utf8");
assert.ok(settings.includes('key: "HOME_INLINE_AUTH_ENABLED"'), "kill switch in managed settings");
const homePage = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
assert.ok(homePage.includes("hydrateEnvFromSettingsThrottled"), "home reads the managed kill switch");

// ── الراية مطفأة: الروابط كما كانت حرفيًا، ولا حوار ──
for (const askFirst of ["1", "0"]) {
  withEnv({ ...PROD_LIKE, HOME_INLINE_AUTH_ENABLED: "0", NEXT_PUBLIC_ASK_FIRST_HOME: askFirst }, () => {
    const tree = HomeHero({ content: DEFAULT_HOME });
    assert.equal(findElements(tree, HomeAuthLauncher).length, 0, "no launcher when the flag is off");
    const html = renderToStaticMarkup(tree);
    assert.equal(html.includes("data-home-auth"), false, "no interception attributes when off");
    assert.equal(html.includes(">دخول<"), false, "no inline-auth header when off");
    const hrefs = anchors(html).map((a) => decode(a.href));
    assert.ok(hrefs.includes("/sign-in") && hrefs.includes("/sign-up"));
    for (const f of (askFirst === "1" ? DEFAULT_HOME.features.slice(0, 4) : DEFAULT_HOME.features)) {
      assert.ok(hrefs.includes(signUpWithNext(f.next)), `card link unchanged: ${f.title}`);
    }
    const authLinks = anchors(html).filter((a) => a.href === "/sign-in" || a.href === "/sign-up");
    assert.deepEqual(
      authLinks.map((a) => `${a.href} ${a.text}`),
      askFirst === "1"
        ? [`/sign-in ${DEFAULT_HOME.ctaSecondary}`, "/sign-up ابدأ الآن"]
        : [
            `/sign-in ${DEFAULT_HOME.ctaSecondary}`,
            "/sign-up سجّل مجانًا",
            `/sign-up ${DEFAULT_HOME.ctaPrimary}`,
            `/sign-in ${DEFAULT_HOME.ctaSecondary}`,
          ],
      "auth links and labels unchanged"
    );
  });
}

// ── الراية مفعّلة: حوار مركّب بالوسائل المفعّلة فقط ──
withEnv({ ...PROD_LIKE, NEXT_PUBLIC_ASK_FIRST_HOME: "1" }, () => {
  const tree = HomeHero({ content: DEFAULT_HOME });
  const launchers = findElements(tree, HomeAuthLauncher);
  assert.equal(launchers.length, 1, "one launcher");
  const config = (launchers[0].props as { config: HomeAuthConfig }).config;
  assert.deepEqual(config.providers, ["google", "email", "phone"], "enabled providers only");
  assert.equal(config.identifierForm, true);
  assert.ok(config.publishableKey.startsWith("pk_"), "publishable key only");
  assert.equal(JSON.stringify(config).includes("sk_"), false, "no secret reaches the client");
  assert.equal(JSON.stringify(config).includes("test-secret"), false);

  const html = renderToStaticMarkup(tree);
  const list = anchors(html);
  // الروابط تبقى <a href> حقيقية (بلا JavaScript) مع سمات الاعتراض
  const login = list.find((a) => a.text === "دخول");
  assert.ok(login && login.href === "/sign-in" && /data-home-auth="login"/.test(login.attrs));
  assert.ok(/aria-label="تسجيل الدخول"/.test(login.attrs));
  const start = list.find((a) => a.text === "ابدأ مجانًا");
  assert.ok(start && start.href === "/sign-up" && /data-home-auth-mode="sign-up"/.test(start.attrs));
  for (const f of DEFAULT_HOME.features.slice(0, 4)) {
    const card = list.find((a) => decode(a.href) === signUpWithNext(f.next));
    assert.ok(card, `card keeps its href: ${f.title}`);
    assert.ok(/data-home-auth="navigate"/.test(card.attrs));
    assert.ok(card.attrs.includes(`data-home-auth-next="${f.next}"`));
  }
});

withEnv({ ...PROD_LIKE, AUTH_MICROSOFT_ENABLED: "1", AUTH_APPLE_ENABLED: "1", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", AUTH_PHONE_ENABLED: "0" }, () => {
  const [l] = findElements(HomeHero({ content: DEFAULT_HOME }), HomeAuthLauncher);
  assert.deepEqual((l.props as { config: HomeAuthConfig }).config.providers, ["google", "microsoft", "apple", "email"]);
});

// لا وسيلة دخول ← لا حوار
withEnv({ HOME_INLINE_AUTH_ENABLED: "1" }, () => {
  assert.equal(findElements(HomeHero({ content: DEFAULT_HOME }), HomeAuthLauncher).length, 0);
});

// ── عرض الحوار: الوسائل الممرّرة فقط، وسمات الحوار ──
function renderDialog(config: HomeAuthConfig, mode: "sign-in" | "sign-up" = "sign-in") {
  return renderToStaticMarkup(
    createElement(HomeAuthDialog, { config, request: { intent: { kind: "login" }, mode }, onClose: () => {} })
  );
}
const baseConfig: HomeAuthConfig = { providers: ["google", "email", "phone"], identifierForm: true, publishableKey: "pk_test_x", hideDevelopmentMode: true };
{
  const html = renderDialog(baseConfig);
  assert.ok(/role="dialog"/.test(html) && /aria-modal="true"/.test(html) && /aria-labelledby="/.test(html));
  assert.ok(html.includes("أهلًا بعودتك"));
  assert.ok(html.includes("المتابعة باستخدام Google"));
  assert.equal(html.includes("Microsoft"), false);
  assert.equal(html.includes("Apple"), false);
  assert.ok(html.includes("البريد أو رقم الجوال"), "single identifier field");
  assert.ok(html.includes('id="hakeem-identifier"'));
  assert.ok(html.includes("شروط الاستخدام") && html.includes("سياسة الخصوصية"), "terms notice");
  assert.ok(html.includes('aria-label="إغلاق نافذة الدخول"'));
  // رابط Google الحقيقي يعود إلى الرئيسية عند حجب النافذة
  assert.ok(decode(html).includes(`/api/auth/google?next=${encodeURIComponent(HOME_AUTH_RETURN_PATH)}`));
  // أول رسم للحوار بلا Clerk: الحقل الخفيف فقط
  assert.equal(html.includes("clerk-captcha"), false);
}
assert.ok(renderDialog(baseConfig, "sign-up").includes("ابدأ مع حكيم"));
{
  const html = renderDialog({ ...baseConfig, providers: ["email"] });
  assert.equal(html.includes("Google"), false);
  assert.ok(html.includes('id="hakeem-identifier"'));
}
{
  // نموذج البريد/الجوال مطفأ ← رابط البوابة بدل الحقل
  const html = renderDialog({ ...baseConfig, identifierForm: false });
  assert.equal(html.includes('id="hakeem-identifier"'), false);
  assert.ok(decode(html).includes("/api/auth/oauth/start?provider=email"));
}

// ── النيّة: 30 دقيقة، ووجهة آمنة، ولا نص سؤال ──
const t0 = 1_000_000;
assert.deepEqual(parseHomeAuthIntent(serializeHomeAuthIntent({ kind: "ask" }, t0), t0 + 1000), { kind: "ask" });
assert.equal(parseHomeAuthIntent(serializeHomeAuthIntent({ kind: "ask" }, t0), t0 + HOME_AUTH_INTENT_TTL_MS + 1), null);
assert.equal(HOME_AUTH_INTENT_TTL_MS, 30 * 60 * 1000);
assert.deepEqual(
  parseHomeAuthIntent(JSON.stringify({ intent: { kind: "navigate", next: "https://evil.example" }, exp: t0 + 10 }), t0),
  { kind: "navigate", next: "/dashboard" }
);
assert.deepEqual(parseHomeAuthIntent(serializeHomeAuthIntent({ kind: "navigate", next: "/dashboard/research" }, t0), t0), {
  kind: "navigate",
  next: "/dashboard/research",
});
assert.equal(parseHomeAuthIntent("{bad", t0), null);
assert.equal(parseHomeAuthIntent(JSON.stringify({ intent: { kind: "hack" }, exp: t0 + 10 }), t0), null);
assert.equal(serializeHomeAuthIntent({ kind: "ask" }).includes("question"), false);

// ── العودة للرئيسية: قيمة ثابتة واحدة، و«/» ما زالت تعود لـ fallback ──
assert.equal(safeDashboardNext(HOME_AUTH_RETURN_PATH), HOME_AUTH_RETURN_PATH);
assert.equal(safeDashboardNext("/"), "/dashboard");
assert.equal(safeDashboardNext("/?home_auth=1&x=//evil"), "/dashboard");

// ── آخر وسيلة: كوكي غير حسّاس ──
assert.equal(parseLastAuthMethod("a=1; hakeem_last_auth=google; b=2"), "google");
assert.equal(parseLastAuthMethod("hakeem_last_auth=someone@example.com"), null);
assert.ok(/^hakeem_last_auth=identifier; Path=\/; Max-Age=\d+; SameSite=Lax; Secure$/.test(lastAuthMethodCookie("identifier", true)));

// ── لا Clerk ثابت تحت components/home، والحوار يُحمَّل ديناميكيًا ──
const homeDir = path.join(root, "components/home");
for (const f of fs.readdirSync(homeDir)) {
  const src = fs.readFileSync(path.join(homeDir, f), "utf8");
  assert.equal(/from\s+["']@clerk\//.test(src), false, `static @clerk import in components/home/${f}`);
  assert.equal(/import\s+["']@clerk\//.test(src), false, `side-effect @clerk import in components/home/${f}`);
}
const launcher = fs.readFileSync(path.join(homeDir, "HomeAuthLauncher.tsx"), "utf8");
assert.ok(launcher.includes('import("@/components/home/HomeAuthDialog")'), "dialog loaded on demand");
assert.equal(/from\s+["']@\/components\/home\/HomeAuth(Dialog|Identifier)["']/.test(launcher), false);
assert.equal(launcher.includes("ClerkAppProvider"), false);
assert.ok(launcher.includes('closest?.("a[data-home-auth]")'));
assert.ok(launcher.includes("event.metaKey || event.ctrlKey"), "modified clicks keep native link behaviour");
const hero = fs.readFileSync(path.join(homeDir, "HomeHero.tsx"), "utf8");
assert.equal(/HomeAuthDialog|HomeAuthIdentifier|ClerkAppProvider|ClerkRoot/.test(hero), false);
const identifier = fs.readFileSync(path.join(homeDir, "HomeAuthIdentifier.tsx"), "utf8");
assert.ok(/\{activated \? \(\s*<ClerkAppProvider/.test(identifier), "Clerk mounts only after focus/typing");
assert.ok(identifier.includes('import("@/components/auth/AuthIdentifierFlowInner")'));
assert.ok(/embedded\s/.test(identifier) && identifier.includes("onComplete={onComplete}"));

// ── الحوار: الوصول والأمان ──
const dialog = fs.readFileSync(path.join(homeDir, "HomeAuthDialog.tsx"), "utf8");
assert.ok(dialog.includes('e.key === "Escape"') && dialog.includes('e.key !== "Tab"'), "Esc + focus trap");
assert.ok(dialog.includes("STICKY_STEPS") && dialog.includes('"code"'), "no outside-click close during code entry");
assert.ok(dialog.includes("hk-scroll-locked"), "scroll lock");
assert.ok(dialog.includes("returnFocusRef"), "focus returns to the trigger");
assert.ok(dialog.includes('aria-live="polite"'));
const popup = fs.readFileSync(path.join(root, "lib/modules/auth/oauth-popup.ts"), "utf8");
assert.ok(popup.includes("event.origin !== window.location.origin") && popup.includes("event.source !== popup"));
const popupPage = fs.readFileSync(path.join(root, "lib/modules/auth/oauth-popup-response.ts"), "utf8");
assert.ok(popupPage.includes("postMessage(p,window.location.origin)"), "popup posts to same origin only");
const claimReturn = fs.readFileSync(path.join(root, "app/api/auth/claim-clerk-return/route.ts"), "utf8");
assert.ok(claimReturn.includes("oauthPopupResponse"), "Clerk OAuth return supports popup completion");

// ── الزائر: نص السؤال لا يدخل أي رابط، والتشغيل المعلّق يُضبط عند النجاح فقط ──
const composer = fs.readFileSync(path.join(homeDir, "GuestAskComposer.tsx"), "utf8");
assert.ok(composer.includes('openHomeAuth({ intent: { kind: "ask" }'));
assert.ok(
  composer.indexOf("openHomeAuth({ intent") < composer.indexOf("sessionStorage.setItem(HOME_ASK_PENDING_RUN_KEY"),
  "pending run is not armed when the dialog opens"
);
const bus = fs.readFileSync(path.join(homeDir, "home-auth-bus.ts"), "utf8");
assert.equal(/HOME_ASK_DRAFT_KEY|encodeURIComponent/.test(bus), false, "no question text in intents or URLs");

console.log("test-home-inline-auth: OK");
