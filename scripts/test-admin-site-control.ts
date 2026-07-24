/**
 * اختبارات ثابتة — لوحة تحكم الموقع (مرحلة أ).
 * تشغيل: npx tsx scripts/test-admin-site-control.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const defaults = read("lib/modules/site/defaults.ts");
assert.ok(defaults.includes("DEFAULT_THEME"));
assert.ok(defaults.includes("themeToCssVars"));
assert.ok(defaults.includes("--hakeem-navy"));
assert.ok(defaults.includes("mergeSiteConfig"));

const store = read("lib/modules/site/site-store.ts");
assert.ok(store.includes("site_config"));
assert.ok(store.includes("site_pages"));
assert.ok(store.includes("CREATE TABLE IF NOT EXISTS"));
assert.ok(store.includes("getSiteConfig"));
assert.ok(store.includes("isBuiltinPageEnabled"));

const siteApi = read("app/api/admin/site/route.ts");
assert.ok(siteApi.includes("requireSuperAdminApi"));
assert.ok(siteApi.includes('from "@/lib/modules/auth/super-admin"'));
assert.ok(siteApi.includes("saveSiteConfig"));

const pagesApi = read("app/api/admin/site/pages/route.ts");
assert.ok(pagesApi.includes("requireSuperAdminApi"));
assert.ok(pagesApi.includes("upsertCustomPage"));

const pageIdApi = read("app/api/admin/site/pages/[id]/route.ts");
assert.ok(pageIdApi.includes("requireSuperAdminApi"));
assert.ok(pageIdApi.includes("deleteCustomPage"));

const adminPage = read("app/admin/site/page.tsx");
assert.ok(adminPage.includes("requireSuperAdminPage"));
assert.ok(adminPage.includes("AdminSiteManager"));

const manager = read("components/admin/AdminSiteManager.tsx");
assert.ok(manager.includes("/api/admin/site"));
assert.ok(manager.includes("تفعيل الصفحات"));
assert.ok(manager.includes("صفحات مخصّصة"));

const nav = read("components/admin/AdminNav.tsx");
assert.ok(nav.includes('href: "/admin/site"'));
assert.ok(nav.includes("لوحة الموقع"));

const layout = read("app/layout.tsx");
assert.ok(layout.includes("SiteThemeStyle"));

const home = read("app/page.tsx");
assert.ok(home.includes("getSiteConfig"));
assert.ok(home.includes("assertBuiltinPageEnabled"));

const hero = read("components/home/HomeHero.tsx");
assert.ok(hero.includes("SiteHomeContent"));
assert.ok(hero.includes("content"));

for (const page of ["pricing", "privacy", "terms"] as const) {
  const src = read(`app/${page}/page.tsx`);
  assert.ok(
    src.includes(`assertBuiltinPageEnabled("${page}")`),
    `${page} must respect site gate`,
  );
}

const custom = read("app/p/[slug]/page.tsx");
assert.ok(custom.includes("getCustomPageBySlug"));
assert.ok(custom.includes("onlyEnabled: true"));
assert.ok(custom.includes("whitespace-pre-wrap"));

async function main() {
  const {
    mergeSiteConfig,
    themeToCssVars,
    slugifyAr,
    DEFAULT_THEME,
  } = await import("../lib/modules/site/defaults");

  const merged = mergeSiteConfig({
    theme: {
      navy: "#112233",
      gold: "not-hex",
      bg: "#ffffff",
      paper: "#eeeeee",
      ink: "#111111",
    },
    home: { brandName: "اختبار", headline: "عنوان" },
    pages: { pricing: false },
  });
  assert.equal(merged.theme.navy, "#112233");
  assert.equal(merged.theme.gold, DEFAULT_THEME.gold);
  assert.equal(merged.home.brandName, "اختبار");
  assert.equal(merged.pages.pricing, false);
  assert.equal(merged.pages.home, true);

  const css = themeToCssVars(merged.theme);
  assert.ok(css.includes("--navy:#112233"));
  assert.ok(css.includes("--gold:"));

  assert.equal(slugifyAr("About Us!!"), "about-us");
  assert.ok(slugifyAr("عن المنصة").length > 0);

  console.log("test-admin-site-control: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
