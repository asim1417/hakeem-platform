import { readFile } from "fs/promises";
import path from "path";
import { normalizeForCompare } from "@/lib/modules/rasd/normalize/arabic";
import { normalizeDigitsForCompare } from "@/lib/modules/rasd/normalize/numbers";
import { buildCanonicalIdentityKey } from "@/lib/modules/rasd/normalize/identity";
import { parseDocumentStructure } from "@/lib/modules/rasd/parse/structure";
import { buildDiffResult } from "@/lib/modules/rasd/diff/engine";
import { detectSourceConflicts } from "@/lib/modules/rasd/conflict/engine";
import { scoreMatch } from "@/lib/modules/rasd/match/engine";
import { contentFingerprint, fingerprintObject } from "@/lib/modules/rasd/hash";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function fixture(relative: string): Promise<string> {
  return readFile(path.join(process.cwd(), "data/rasd/fixtures", relative), "utf8");
}

async function main(): Promise<void> {
  await test("arabic normalize", () => {
    assert(normalizeForCompare("أحكامُ الشــريعة").includes("احكام"), "hamza/diacritics/tatweel should normalize");
  });

  await test("digits", () => {
    assert(normalizeDigitsForCompare("١٢٣٤٥٦٧٨٩۰") === "1234567890", "eastern and persian digits should normalize");
  });

  await test("identity key", () => {
    const a = buildCanonicalIdentityKey({ documentType: "LAW", title: "نظام المرافعات", instrumentNumber: "م/1" });
    const b = buildCanonicalIdentityKey({ documentType: "LAW", title: "نِظام المُرافعات", instrumentNumber: "م / ١" });
    assert(a === b, "semantic identity key should be stable");
  });

  await test("instrument parse through structure parser", async () => {
    const parsed = parseDocumentStructure(await fixture("boe/law-sample.html"), "BOE");
    assert(Boolean(parsed.metadata.instrumentNumber || parsed.metadata.normalizedInstrumentNumber), "instrument number should be extracted");
  });

  await test("fingerprints", () => {
    assert(contentFingerprint("abc") === contentFingerprint(Buffer.from("abc")), "buffer/string fingerprints should match");
    assert(fingerprintObject({ b: 1, a: 2 }) === fingerprintObject({ a: 2, b: 1 }), "object fingerprint should be stable");
  });

  await test("structure parse on fixtures", async () => {
    const base = parseDocumentStructure(await fixture("boe/law-sample.html"), "BOE");
    const amended = parseDocumentStructure(await fixture("boe/law-sample-amended.html"), "BOE");
    assert(base.provisions.filter((item) => item.provisionType === "ARTICLE").length >= 3, "base should parse articles");
    assert(amended.provisions.some((item) => item.articleNumberNormalized === "4"), "amended fixture should include article 4");
  });

  await test("diff detects new article and amendment", async () => {
    const base = parseDocumentStructure(await fixture("boe/law-sample.html"), "BOE");
    const amended = parseDocumentStructure(await fixture("boe/law-sample-amended.html"), "BOE");
    const diff = buildDiffResult(base, amended);
    assert(diff.provisionDiffs.some((item) => item.changeType === "ARTICLE_ADDED"), "new article should be detected");
    assert(diff.provisionDiffs.some((item) => item.changeType === "TEXT_AMENDED"), "article amendment should be detected");
  });

  await test("conflict between boe and ncar fixtures", async () => {
    const boe = parseDocumentStructure(await fixture("boe/law-sample.html"), "BOE");
    const ncar = parseDocumentStructure(await fixture("ncar/document-sample.html"), "NCAR");
    const conflicts = detectSourceConflicts({
      BOE: [{ field: "text", value: boe.normalizedHash }],
      NCAR: [{ field: "text", value: ncar.normalizedHash }]
    });
    assert(conflicts.length > 0, "different source hashes should conflict");
  });

  await test("match scoring", async () => {
    const parsed = parseDocumentStructure(await fixture("boe/law-sample.html"), "BOE");
    const match = scoreMatch(parsed, {
      id: "sys1",
      name: "نظام المرافعات الشرعية",
      royalDecree: "م/1",
      articles: [{ articleNumber: 1, content: "تطبق المحاكم على القضايا المعروضة أمامها أحكام الشريعة الإسلامية." }]
    });
    assert(match.score > 0.7, "matching candidate should score high");
  });

  console.log(`Rasd unit tests: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
