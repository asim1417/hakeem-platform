/** Validate an explicitly captured official text without a database or production writes.
 * node --import tsx scripts/backfill/validate-rendered-bundle.ts --text=... --url=... --law=... --out=... [--expected=721]
 * READY is deliberately not assigned: source matching, temporal updates and runtime
 * alignment still need the normal legal release gate.
 */
import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "../../lib/legal-parser";
import { splitOfficialSystemBundle } from "../../lib/modules/legal-core/official-bundle";
import { assertOfficialSourceUrl, sha256Text } from "../../lib/modules/legal-core/official-source-policy";

const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const textPath = arg("text"), url = arg("url"), law = arg("law"), out = arg("out");
if (!textPath || !url || !law || !out) throw new Error("Required: --text --url --law --out");
const sourceArg = arg("source") ?? "NCAR";
if (sourceArg !== "NCAR" && sourceArg !== "BOE") throw new Error("Unsupported source");
assertOfficialSourceUrl(sourceArg, url);
const expected = arg("expected") ? Number(arg("expected")) : undefined;
if (expected !== undefined && (!Number.isSafeInteger(expected) || expected < 1)) throw new Error("Invalid --expected");
const sourceText = fs.readFileSync(textPath, "utf8");
const bundle = splitOfficialSystemBundle({ htmlOrText: sourceText, systemName: law, sourceUrl: url, sourceCode: sourceArg });
const issues = [...bundle.issues];
const documents = bundle.documents.map(d => {
  const parsed = parseDocument(d.rawText, { kind: d.docType });
  if (!parsed.reconstructionOk) issues.push(`RECONSTRUCTION_FAILED:${d.docType}`);
  issues.push(...parsed.warnings.map(w => `${d.docType}:${w}`));
  if (d.docType !== "SYSTEM_TEXT") {
    for (const required of ["INSTRUMENT_OPENING", "RECITAL", "INSTRUMENT_CLAUSE"] as const) {
      if (!parsed.units.some(u => u.type === required)) issues.push(`${d.docType}:${required}_MISSING`);
    }
  }
  return { ...d, verificationStatus: "REVIEW_REQUIRED" as const, contentSha256: sha256Text(d.rawText), units: parsed.units };
});
const system = documents.find(d => d.docType === "SYSTEM_TEXT");
// Preserve the entire source prefix, including any introduction the splitter
// could not classify. Offsets address the unchanged UTF-16 source snapshot.
const systemStart = system ? sourceText.indexOf(system.rawText) : -1;
const introductionText = systemStart >= 0 ? sourceText.slice(0, systemStart) : sourceText;
let cursor = 0;
const unclassified: { charStart: number; charEnd: number; rawText: string }[] = [];
const instruments = documents.filter(d => d.docType !== "SYSTEM_TEXT").map(d => {
  const start = introductionText.indexOf(d.rawText, cursor);
  if (start < 0) {
    issues.push(`INTRODUCTION_INSTRUMENT_NOT_IN_SOURCE:${d.docType}`);
    return { docType: d.docType, charStart: -1, charEnd: -1 };
  }
  if (start > cursor) unclassified.push({ charStart: cursor, charEnd: start, rawText: introductionText.slice(cursor, start) });
  cursor = start + d.rawText.length;
  return { docType: d.docType, charStart: start, charEnd: cursor };
});
if (cursor < introductionText.length) unclassified.push({ charStart: cursor, charEnd: introductionText.length, rawText: introductionText.slice(cursor) });
const hasUnclassifiedText = unclassified.some(s => s.rawText.replace(/[\s\u200B-\u200F\uFEFF]/g, "").length > 0);
if (systemStart < 0) issues.push("SYSTEM_TEXT_NOT_IN_SOURCE");
if (hasUnclassifiedText) issues.push("INTRODUCTION_UNCLASSIFIED_TEXT");
const introduction = {
  rawText: introductionText, contentSha256: sha256Text(introductionText),
  sourceCharStart: 0, sourceCharEnd: introductionText.length,
  instruments, unclassified, fullyClassified: systemStart >= 0 && !hasUnclassifiedText && instruments.every(i => i.charStart >= 0),
};
const anchors = system?.units.filter(u => u.type === "ARTICLE") ?? [];
const articles = anchors.map(u => {
  const next = system!.units.find(v => v.charStart > u.charStart && ["ARTICLE", "CHAPTER", "PART", "SECTION"].includes(v.type));
  const end = next?.charStart ?? system!.rawText.length;
  const rawText = system!.rawText.slice(u.charStart, end);
  const heading = rawText.match(/^\s*المادة[^\n:：]+[:：]/u);
  const headingLength = heading ? heading[0].length : Math.max(0, rawText.indexOf("\n") + 1);
  const content = rawText.slice(headingLength).trim();
  return { article_number: Number(u.number), law_name: law, title: u.label, content,
    rawText, sourceCharStart: u.charStart, sourceCharEnd: end, contentSha256: sha256Text(rawText) };
});
if (!articles.length) issues.push("NO_ARTICLES");
if (expected !== undefined && articles.length !== expected) issues.push(`ARTICLE_COUNT:${articles.length}!=${expected}`);
// Strict sequential validation is opt-in: repealed/repeated articles in other laws
// require a version-aware audit rather than an inferred renumbering.
if (expected !== undefined && !articles.every((a, i) => a.article_number === i + 1)) issues.push("ARTICLE_SEQUENCE_MISMATCH");
if (articles.some(a => !a.content)) issues.push("EMPTY_ARTICLE");
const hashes = new Set(articles.map(a => sha256Text(a.content)));
if (hashes.size !== articles.length) issues.push("DUPLICATE_ARTICLE_CONTENT_REVIEW");
const result = {
  status: bundle.ok && issues.length === 0 ? "STRUCTURALLY_VALID_REVIEW_REQUIRED" : "BLOCKED",
  productionApplied: false,
  sourceSnapshot: { sourceUrl: url, sourceCode: sourceArg, file: path.basename(textPath), sha256: sha256Text(sourceText) },
  validatedAt: new Date().toISOString(), systemName: law, articleCount: articles.length, issues,
  introduction, documents, articles,
};
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ status: result.status, documents: documents.length, articles: articles.length, issues }, null, 2));
if (result.status === "BLOCKED") process.exitCode = 1;
