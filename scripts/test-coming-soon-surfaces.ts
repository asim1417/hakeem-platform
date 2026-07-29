/**
 * تحقق أن الخدمات/الأيقونات غير الجاهزة موسومة بـ «قريبًا».
 * تشغيل: npx tsx scripts/test-coming-soon-surfaces.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const comingSoon = read("components/ui/ComingSoon.tsx");
assert.ok(comingSoon.includes("ComingSoonBadge"));
assert.ok(comingSoon.includes("ComingSoonControl"));
assert.ok(comingSoon.includes("قريبًا"));

const banner = read("components/ui/ComingSoonBanner.tsx");
assert.ok(banner.includes("ComingSoonBanner"));
assert.ok(banner.includes("قريبًا"));

const moduleCard = read("components/ModuleCard.tsx");
assert.ok(moduleCard.includes("comingSoon"));
assert.ok(moduleCard.includes("ComingSoonBadge"));

const lab = read("app/dashboard/lab/page.tsx");
assert.ok(lab.includes("comingSoon"));
assert.match(lab, /قريبًا/);

for (const page of [
  "app/dashboard/knowledge-graph/page.tsx",
  "app/dashboard/legal-rag/page.tsx",
  "app/dashboard/training/page.tsx",
]) {
  const src = read(page);
  assert.ok(src.includes("ComingSoonBanner"), `${page} must show ComingSoonBanner`);
  assert.match(src, /قريبًا/, `${page} must mention قريبًا`);
}

const searchBar = read("components/legal-core.tsx");
assert.match(searchBar, /قانون مقارن[\s\S]*قريبًا/);

const judgments = read("app/dashboard/legal-core/judgments/[id]/page.tsx");
assert.ok(judgments.includes("ComingSoonControl"));
assert.ok(judgments.includes("تحميل بالنقاط"));
assert.doesNotMatch(judgments, /SpendCreditsButton/);

const training = read("components/TrainingWorkspace.tsx");
assert.doesNotMatch(training, /\bTODO:/);
assert.match(training, /قريبًا/);

const attachments = read("components/AttachmentsManager.tsx");
assert.doesNotMatch(attachments, /\bTODO:/);
assert.match(attachments, /قريبًا/);

const docs = read("app/documents/page.tsx");
assert.ok(docs.includes("soon: true"));
assert.match(docs, /Drive[\s\S]*قريبًا|قريبًا[\s\S]*Drive/);

const caseBrowser = read("components/documents/CaseBrowser.tsx");
assert.match(caseBrowser, /Drive — قريبًا/);

const credits = read("components/credits/CreditsWidget.tsx");
assert.match(credits, /قريبًا/);

const quota = read("components/billing/QuotaCounter.tsx");
assert.ok(quota.includes("isPaidCheckoutUiEnabled"));
assert.match(quota, /قريبًا/);

const pricing = read("config/pricing.ts");
assert.match(pricing, /لوحة استخدام للفريق — قريبًا/);

console.log("test-coming-soon-surfaces: OK");
