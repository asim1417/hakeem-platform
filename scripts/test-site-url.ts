/**
 * اختبار أصل الموقع الموحّد.
 * npx tsx scripts/test-site-url.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  absoluteUrl,
  DEFAULT_SITE_URL,
  getSiteHost,
  getSiteUrl,
  isVercelDeploymentHost,
  resolveSiteUrl,
} from "../lib/modules/config/site-url";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const prevPublic = process.env.NEXT_PUBLIC_SITE_URL;
const prevNextAuth = process.env.NEXTAUTH_URL;

delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.NEXTAUTH_URL;
// HKM-061: الاحتياط هو النطاق العام، لا نطاق Vercel المؤقت.
assert.equal(DEFAULT_SITE_URL, "https://hakeemai.net");
assert.equal(getSiteUrl(), DEFAULT_SITE_URL);
assert.equal(absoluteUrl("/legal"), `${DEFAULT_SITE_URL}/legal`);
assert.equal(absoluteUrl("/"), DEFAULT_SITE_URL);
assert.equal(getSiteHost(), "hakeemai.net");

// HKM-061: قيمة *.vercel.app في البيئة تُتجاوز (الإنتاج القديم والمعاينات) فيبقى canonical على hakeemai.net.
process.env.NEXT_PUBLIC_SITE_URL = "https://hakeem-platform.vercel.app";
process.env.NEXTAUTH_URL = "https://hakeem-platform.vercel.app/";
assert.equal(getSiteUrl(), "https://hakeemai.net");
assert.equal(absoluteUrl("/sitemap.xml"), "https://hakeemai.net/sitemap.xml");
assert.equal(getSiteHost(), "hakeemai.net");
// المتغير الأول على vercel.app والثاني نطاق حقيقي: يؤخذ الثاني.
process.env.NEXTAUTH_URL = "https://hakeemsa.com";
assert.equal(getSiteUrl(), "https://hakeemsa.com");
delete process.env.NEXTAUTH_URL;
for (const v of [
  "hakeem-platform.vercel.app",
  "HTTPS://HAKEEM-PLATFORM.VERCEL.APP/",
  "https://hakeem-platform-git-aman-hkm-061-asim1417.vercel.app",
  "https://vercel.app",
  "   ",
  "https://",
]) {
  process.env.NEXT_PUBLIC_SITE_URL = v;
  assert.equal(getSiteUrl(), "https://hakeemai.net", `ignored: ${JSON.stringify(v)}`);
}
assert.equal(isVercelDeploymentHost("hakeem-platform.vercel.app"), true);
assert.equal(isVercelDeploymentHost("x.vercel.app:443"), true);
assert.equal(isVercelDeploymentHost("hakeemai.net"), false);
assert.equal(isVercelDeploymentHost("notvercel.app"), false);
assert.equal(isVercelDeploymentHost("vercel.app.example.com"), false);
// التطوير المحلي يبقى على localhost (روابط البريد والعرض).
assert.equal(resolveSiteUrl(["http://localhost:3000/"]), "http://localhost:3000");
assert.equal(resolveSiteUrl([undefined, null, ""]), DEFAULT_SITE_URL);
assert.equal(resolveSiteUrl(["https://www.hakeemai.net"]), "https://www.hakeemai.net");

process.env.NEXT_PUBLIC_SITE_URL = "https://hakeemsa.com/";
assert.equal(getSiteUrl(), "https://hakeemsa.com");
assert.equal(absoluteUrl("/pricing"), "https://hakeemsa.com/pricing");
assert.equal(getSiteHost(), "hakeemsa.com");

process.env.NEXT_PUBLIC_SITE_URL = "hakeemsa.com";
assert.equal(getSiteUrl(), "https://hakeemsa.com");

const siteMod = read("lib/modules/config/site-url.ts");
assert.ok(siteMod.includes("NEXT_PUBLIC_SITE_URL"));
assert.ok(siteMod.includes("DEFAULT_SITE_URL"));

const envExample = read(".env.example");
assert.ok(envExample.includes("NEXT_PUBLIC_SITE_URL"));

const layout = read("app/layout.tsx");
assert.ok(layout.includes("metadataBase"));
assert.ok(layout.includes("site-url"));

const nextCfg = read("next.config.mjs");
assert.ok(nextCfg.includes("NEXT_PUBLIC_SITE_URL"));
assert.ok(nextCfg.includes("*.clerk.accounts.dev"), "Clerk CSP hosts must remain");
assert.ok(nextCfg.includes("clerk.shared.lcl.dev"), "Clerk lcl.dev must remain");
assert.ok(nextCfg.includes("resolveClerkProductionHosts"), "Clerk production (custom domain) hosts must be in CSP");
// allowedOrigins تراكمية — لا قيمة واحدة من SITE_URL
assert.ok(nextCfg.includes("hakeem-platform.vercel.app"), "current host must stay in Server Actions list");
assert.ok(nextCfg.includes('"hakeemai.net"') && nextCfg.includes('"www.hakeemai.net"'), "public host in Server Actions list");
assert.ok(nextCfg.includes('const fallback = "https://hakeemai.net"'), "next.config fallback must match DEFAULT_SITE_URL");
assert.ok(nextCfg.includes('.endsWith(".vercel.app")'), "next.config must skip *.vercel.app like getSiteUrl");
assert.ok(nextCfg.includes("hakeemsa.com"), "new host must be alongside current");
assert.ok(nextCfg.includes("resolveServerActionOrigins"), "cumulative origins helper required");
assert.ok(
  !nextCfg.includes('allowedOrigins: Array.from(new Set(["localhost:3000", siteHost]))'),
  "must not derive allowedOrigins from a single siteHost"
);

const siteUrlSrc = read("lib/modules/config/site-url.ts");
assert.ok(
  siteUrlSrc.includes("قيمة احتياط") || siteUrlSrc.includes("ليست مصدر الحقيقة"),
  "DEFAULT_SITE_URL must be documented as fallback only"
);

assert.equal(fs.existsSync(path.join(root, "app/sitemap.ts")), false, "HKM-061: app/sitemap.ts replaced by app/sitemap.xml/route.ts (index)");

for (const rel of [
  "app/sitemap.xml/route.ts",
  "app/sitemaps/[file]/route.ts",
  "app/robots.ts",
  "app/llms.txt/route.ts",
  "app/developers/page.tsx",
  "app/legal/[slug]/[article]/page.tsx",
  "app/admin/settings/page.tsx",
  "lib/modules/support/notify.ts",
  "lib/modules/email/send.ts",
  "lib/modules/referrals/codes.ts",
]) {
  const src = read(rel);
  assert.equal(
    src.includes('"https://hakeem-platform.vercel.app"'),
    false,
    `${rel} must not hardcode site URL string literal`
  );
  assert.ok(
    src.includes("getSiteUrl") || src.includes("absoluteUrl") || src.includes("site-url"),
    rel
  );
}

// HKM-061: روابط MCP العامة تتبع الأصل الموحّد، وسياسة/شروط أمان على النطاق العام.
const toolRunner = read("lib/mcp/tool-runner.ts");
assert.ok(toolRunner.includes("siteUrl: getSiteUrl"), "tool-runner upgrade_url uses getSiteUrl()");
const triage = read("lib/mcp/tools/aman-triage.ts");
assert.ok(triage.includes('"https://hakeemai.net/privacy"') && triage.includes('"https://hakeemai.net/terms"'));
assert.ok(!triage.includes('DEFAULT_PRIVACY_URL = "https://hakeem-platform.vercel.app'), "aman-triage default policy URL on public domain");
assert.ok(!read("app/mcp/route.ts").includes("الرابط بعد النشر: https://hakeem-platform.vercel.app/mcp"));

const legal = read("app/legal/page.tsx");
assert.ok(legal.includes("absoluteUrl") || legal.includes("getSiteUrl"));
assert.equal(legal.includes('"https://hakeem-platform.vercel.app/legal"'), false);

const adminSettings = read("app/admin/settings/page.tsx");
assert.ok(adminSettings.includes("absoluteUrl"));
assert.equal(adminSettings.includes("hakeem-platform.vercel.app"), false);

// next.config.mjs الفعلي (وقت البناء) بمتغير قديم على vercel.app: CSP وServer Actions يتبعان القاعدة نفسها.
async function loadNextConfig(tag: string) {
  const mod = (await import(`${pathToFileURL(path.join(root, "next.config.mjs")).href}?hkm061=${tag}`)) as {
    default: {
      experimental: { serverActions: { allowedOrigins: string[] } };
      headers: () => Promise<Array<{ headers: Array<{ key: string; value: string }> }>>;
    };
  };
  const cfg = mod.default;
  const csp = (await cfg.headers())[0].headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
  return { origins: cfg.experimental.serverActions.allowedOrigins, csp };
}
async function nextConfigChecks() {
process.env.NEXT_PUBLIC_SITE_URL = "https://hakeem-platform.vercel.app";
delete process.env.NEXTAUTH_URL;
{
  const { origins, csp } = await loadNextConfig("legacy");
  for (const h of ["hakeemai.net", "www.hakeemai.net", "hakeem-platform.vercel.app", "hakeemsa.com", "localhost:3000"]) {
    assert.ok(origins.includes(h), `serverActions.allowedOrigins keeps ${h}`);
  }
  const formAction = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("form-action")) ?? "";
  assert.ok(formAction.includes("'self'") && formAction.includes("https://hakeemai.net"), formAction);
  assert.ok(formAction.includes("https://*.clerk.com"), "Clerk stays in form-action");
}
process.env.NEXT_PUBLIC_SITE_URL = "https://hakeemsa.com";
{
  const { origins, csp } = await loadNextConfig("custom");
  assert.ok(origins.includes("hakeemsa.com") && origins.includes("hakeemai.net"));
  assert.ok(csp.includes("connect-src 'self' https://hakeemsa.com"), "explicit non-Vercel site URL is honoured");
}
}

nextConfigChecks().then(
  () => {

    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevPublic;
    if (prevNextAuth === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prevNextAuth;
    console.log("test-site-url: OK");
  },
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
