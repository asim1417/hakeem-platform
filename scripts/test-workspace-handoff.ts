/**
 * فصل الواجهة التعريفية عن مساحة العمل، ووجهات الدخول، والعرض الحي.
 * npx tsx scripts/test-workspace-handoff.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  HOME_ABOUT_HREF,
  isHomeSignedInRedirectEnabled,
  LOGGED_OUT_MARK_COOKIE,
  shouldRedirectSignedInHome,
} from "../lib/modules/config/home-signed-in-redirect";
import { destinationFor } from "../components/home/home-auth-bus";
import { homeDemoVideoUrl, isHomeLiveDemoEnabled } from "../lib/modules/config/home-live-demo";
import {
  buildLiveDemoPayload,
  LIVE_DEMO_ARTICLE,
  LIVE_DEMO_CHIPS,
  LIVE_DEMO_SIMILAR_RULINGS,
} from "../lib/modules/home/live-demo-content";
import { LIVE_DEMO_TICK_MS, liveDemoFrame, liveDemoTimeline } from "../components/home/HomeLiveDemo";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

// ── الإحالة: قرار نقي ──
const base = { enabled: true, hasSession: true, view: undefined, justLoggedOut: false };
assert.equal(shouldRedirectSignedInHome(base), true, "session on / -> /dashboard");
assert.equal(shouldRedirectSignedInHome({ ...base, hasSession: false }), false, "guest stays on /");
assert.equal(shouldRedirectSignedInHome({ ...base, view: "home" }), false, "/?view=home shows the public page");
assert.equal(shouldRedirectSignedInHome({ ...base, view: ["home"] }), false);
assert.equal(shouldRedirectSignedInHome({ ...base, view: "other" }), true);
assert.equal(shouldRedirectSignedInHome({ ...base, enabled: false }), false, "kill switch");
assert.equal(shouldRedirectSignedInHome({ ...base, justLoggedOut: true }), false, "logout lands on /");
assert.equal(HOME_ABOUT_HREF, "/?view=home");
delete process.env.HOME_SIGNED_IN_REDIRECT_ENABLED;
assert.equal(isHomeSignedInRedirectEnabled(), true, "on by default");
for (const off of ["0", "false", "off"]) {
  process.env.HOME_SIGNED_IN_REDIRECT_ENABLED = off;
  assert.equal(isHomeSignedInRedirectEnabled(), false, off);
}
delete process.env.HOME_SIGNED_IN_REDIRECT_ENABLED;

// الإحالة في middleware قبل رسم الصفحة (307): وجود الكوكي فقط، بلا Clerk — قبل أي فرع لـ Clerk
const mw = read("middleware.ts");
const mwMain = mw.slice(mw.indexOf("export default function middleware"));
const homeRedirect = mwMain.indexOf('request.nextUrl.pathname === "/"');
assert.ok(homeRedirect > 0, "home redirect in middleware");
assert.ok(homeRedirect < mwMain.indexOf("isClerkConfigured()"), "before any Clerk branch");
assert.ok(/shouldRedirectSignedInHome\(\{[\s\S]*hasSession: hasOwnerSession\(request\)[\s\S]*\}\)\s*\)\s*\{\s*return NextResponse\.redirect\(new URL\("\/dashboard", request\.url\), 307\);/.test(mwMain));
assert.ok(mw.includes("LOGGED_OUT_MARK_COOKIE") && mw.includes("HOME_VIEW_PARAM"));
const page = read("app/page.tsx");
assert.equal(/@clerk/.test(page), false);
for (const rel of ["components/LogoutButton.tsx", "components/AccountMenu.tsx"]) {
  const src = read(rel);
  assert.ok(/async function clearOwnerSession\(\) \{\s*\/\/[^\n]*\n\s*markLoggedOut\(\);/.test(src), `${rel} marks logout before any await`);
}
assert.equal(LOGGED_OUT_MARK_COOKIE, "hakeem_logged_out");
const settings = read("lib/modules/settings/settings-service.ts");
for (const key of ["HOME_INLINE_AUTH_ENABLED", "HOME_LIVE_DEMO_ENABLED", "HOME_DEMO_VIDEO_URL"]) {
  assert.ok(settings.includes(`key: "${key}"`), `managed setting ${key}`);
}

// «عن حكيم» في رأس مساحة العمل
const shell = read("components/AppShell.tsx");
assert.ok(shell.includes("href={HOME_ABOUT_HREF}") && shell.includes("عن حكيم"));

// ── الوجهات ──
assert.equal(destinationFor({ kind: "login" }), "/dashboard");
assert.equal(destinationFor({ kind: "ask" }), "/dashboard");
assert.equal(destinationFor({ kind: "navigate", next: "/dashboard/judicial-assistant" }), "/dashboard/judicial-assistant");
const bus = read("components/home/home-auth-bus.ts");
assert.ok(/export function completeHomeAuth[\s\S]*armPendingAsk\(intent\);[\s\S]*return destinationFor\(intent\);/.test(bus));
// السؤال يُنفَّذ مرة واحدة في صندوق مساحة العمل ويُمسح
const workspace = read("components/ask/HakeemAskWorkspace.tsx");
assert.ok(/sessionStorage\.getItem\(HOME_ASK_PENDING_RUN_KEY\)[\s\S]{0,400}sessionStorage\.removeItem\(HOME_ASK_PENDING_RUN_KEY\)/.test(workspace));
assert.ok(workspace.includes("pendingRunHandledRef.current = true"));
const workbench = read("components/dashboard/DashboardWorkbench.tsx");
assert.ok(workbench.includes("AskWorkspaceWithSessions") && workbench.includes('variant="home"'));
assert.ok(workspace.includes("`مرحبًا، ${userName}`"), "greeting «مرحبًا، <الاسم>»");
assert.ok(workbench.includes("رصيد تجربتك جاهز"));
// الرئيسية لم تعد تستبدل صندوق الزائر بـ HomeInlineAsk
const hero = read("components/home/HomeHero.tsx");
assert.equal(/HomeInlineAsk/.test(hero), false);
assert.equal(fs.existsSync(path.join(root, "components/home/HomeInlineAskLazy.tsx")), false);

// ── الحوار: الشاشات ٥ و٧ والانتقال الواحد ──
const dialog = read("components/home/HomeAuthDialog.tsx");
assert.ok(dialog.includes("أكمل الدخول في نافذة") && dialog.includes("لم تظهر النافذة؟ افتحها مجددًا") && dialog.includes("اختيار وسيلة أخرى"));
assert.ok(dialog.includes("تم التحقق") && dialog.includes("جارٍ فتح مساحة عملك…") && dialog.includes('role="status"'));
assert.ok(/VERIFIED_HOLD_MS = 600;/.test(dialog));
assert.ok(dialog.includes("router.prefetch(destination)") && dialog.includes("router.push(dest)"));
assert.ok(dialog.includes("آخر دخول"));
assert.ok(dialog.includes('hidden={!optionsVisible}'), "the flow stays mounted under overlays (session claim is not cut)");

// ── العرض الحي ──
delete process.env.HOME_LIVE_DEMO_ENABLED;
assert.equal(isHomeLiveDemoEnabled(), false, "off by default until the owner reviews it");
process.env.HOME_LIVE_DEMO_ENABLED = "1";
assert.equal(isHomeLiveDemoEnabled(), true);
delete process.env.HOME_LIVE_DEMO_ENABLED;
process.env.HOME_DEMO_VIDEO_URL = "http://insecure.example/v.mp4";
assert.equal(homeDemoVideoUrl(), null, "https only");
process.env.HOME_DEMO_VIDEO_URL = "https://example.com/v.mp4";
assert.equal(homeDemoVideoUrl(), "https://example.com/v.mp4");
delete process.env.HOME_DEMO_VIDEO_URL;
assert.equal(homeDemoVideoUrl(), null, "button hidden without a video source");

// نص المادة بلفظه من المدونة — لا يُكتب يدويًا
const corpus = JSON.parse(read("data/legal_articles_export.json")) as Array<{ law_name: string; article_number: number; title: string; content: string }>;
const art = corpus.find((a) => a.law_name === LIVE_DEMO_ARTICLE.lawName && Number(a.article_number) === LIVE_DEMO_ARTICLE.articleNumber);
assert.ok(art, "article exists in the corpus");
const content = read("lib/modules/home/live-demo-content.ts");
assert.equal(content.includes(art.content.slice(0, 40)), false, "legal text is not hand-copied into the content file");
const source = read("lib/modules/home/live-demo-source.ts");
assert.ok(source.includes('import "server-only"') && source.includes("data/legal_articles_export.json"));
const payload = buildLiveDemoPayload({ lawName: art.law_name, title: art.title, content: art.content, articleNumber: art.article_number });
assert.equal(payload.article.content, art.content);
assert.ok(payload.chips[0].label.includes(`المادة ${art.article_number}`) && payload.chips[0].short.includes(`م ${art.article_number}`));
assert.ok(LIVE_DEMO_CHIPS.some((c) => c.needsOwnerReview), "unverified reference is flagged for owner review");
assert.equal(LIVE_DEMO_SIMILAR_RULINGS, null);
assert.equal(payload.chips.some((c) => c.label.includes("[العدد]")), false, "no placeholder count");
const next = read("next.config.mjs");
assert.ok(next.includes('"/": ["./data/legal_articles_export.json"]'), "corpus file traced for the home function");

// المراحل: نحو 15 ثانية مع توقف 5 ثوانٍ
const tl = liveDemoTimeline(payload.question.length);
const cycleS = (tl.end * LIVE_DEMO_TICK_MS) / 1000;
assert.ok(cycleS >= 13 && cycleS <= 17, `cycle ${cycleS}s`);
assert.ok(((tl.end - tl.chipsAt) * LIVE_DEMO_TICK_MS) / 1000 >= 5, "5s pause at the end");
const f0 = liveDemoFrame(0, payload);
assert.equal(f0.typed, "");
assert.equal(f0.showSearch, false);
const fMid = liveDemoFrame(Math.floor(payload.question.length / 2), payload);
assert.ok(fMid.typed.length > 0 && fMid.typed.length < payload.question.length && fMid.showCaret);
const fS = liveDemoFrame(tl.searchStart + 9, payload);
assert.deepEqual(fS.stepsDone, [true, false, false], "steps checked one by one");
const fEnd = liveDemoFrame(tl.end, payload);
assert.equal(fEnd.typed, payload.question);
assert.equal(fEnd.linesShown, 4);
assert.ok(fEnd.showText && fEnd.showChips && !fEnd.showCaret);

const demo = read("components/home/HomeLiveDemo.tsx");
assert.ok(demo.includes('aria-label="عرض حي لحكيم"'));
assert.ok(demo.includes('className="hk-demo__stage" aria-hidden'), "animated text hidden from AT");
assert.ok(demo.includes('className="sr-only"'), "full text transcript for screen readers");
assert.ok(demo.includes("prefers-reduced-motion: reduce") && demo.includes("IntersectionObserver") && demo.includes("visibilitychange"));
assert.ok(demo.includes('"إيقاف العرض مؤقتًا"') && demo.includes('aria-label="إعادة العرض"'));
assert.equal((demo.match(/setInterval/g) || []).length, 1, "one timer drives the stages");
assert.equal(/framer-motion|lottie|<video|\.mp4/.test(demo), false, "no motion libraries or video files");
const lazy = read("components/home/HomeLiveDemoLazy.tsx");
assert.ok(lazy.includes("ssr: false") && lazy.includes("hk-demo--placeholder"), "lazy with a fixed-size frame");
assert.ok(hero.includes("كيف يجيب حكيم؟") && hero.includes("شاهد التجربة كاملة"));
assert.equal(/from\s+["']@\/components\/home\/HomeLiveDemo["']/.test(hero), false, "demo is not in the first bundle");

console.log("test-workspace-handoff: OK");
