import assert from "node:assert/strict";
import { discoverOfficialLinks, explicitCandidates, requireDiscoveredDocuments } from "../lib/modules/legal-core/official-source-discovery";

const ncar = "https://ncar.gov.sa/rules-regulations";
assert.throws(() => requireDiscoveredDocuments(discoverOfficialLinks("NCAR", '<app-root></app-root><script src="main.js"></script>', ncar)), /OFFICIAL_DISCOVERY_EMPTY/);
assert.deepEqual(discoverOfficialLinks("NCAR", `<a href="${ncar}">الأنظمة</a><a href="${ncar}#top">الأنظمة</a>`, ncar), []);
const boe = "https://laws.boe.gov.sa/BoeLaws/Laws/LawsHome";
const links = discoverOfficialLinks("BOE", `
  <a href="/BoeLaws/Laws/LawsHome">الأنظمة</a>
  <a href="/BoeLaws/Laws/LawDetails/abc/1">نظام</a>
  <a href="/BoeLaws/Laws/LawDetails/abc/1#article">نظام</a>
  <a href="/BoeLaws/Laws/Viewer/decision?lawId=abc&amp;v=1">قرار</a>
  <a href="https://example.org/BoeLaws/Laws/LawDetails/abc/1">غير رسمي</a>
`, boe);
assert.equal(links.length, 2);
assert.equal(links[1].url, "https://laws.boe.gov.sa/BoeLaws/Laws/Viewer/decision?lawId=abc&v=1");
requireDiscoveredDocuments(links);
assert.equal(explicitCandidates("BOE", [links[1].url, links[1].url + "#top"]).length, 1);
assert.throws(() => explicitCandidates("BOE", ["https://example.org/law"]), /HOST_FORBIDDEN/);
assert.throws(() => explicitCandidates("BOE", ["https://user:password@laws.boe.gov.sa/law"]), /USERINFO_FORBIDDEN/);
assert.throws(() => explicitCandidates("BOE", ["http://laws.boe.gov.sa/law"]), /HTTPS_REQUIRED/);
assert.equal(discoverOfficialLinks("NCAR", '<a href="/document-details/123">وثيقة</a>', ncar).length, 1);
console.log("✓ Official discovery: empty JavaScript shell, navigation exclusion, deduplication, query preservation, official URL restrictions");
