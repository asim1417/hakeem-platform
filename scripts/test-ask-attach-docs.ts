/**
 * إرفاق مستند في اسأل حكيم — محرّك منصة الوثائق بلا خدمة جديدة.
 * npx tsx scripts/test-ask-attach-docs.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const ws = read("components/ask/HakeemAskWorkspace.tsx");
assert.ok(ws.includes('from "@/lib/modules/doc-tool/extract"'));
assert.ok(ws.includes("isBrokenExtraction"));
assert.ok(ws.includes("/api/doc-tool/ocr/available"));
assert.ok(ws.includes("cloudOcr"));
assert.ok(ws.includes("attachError"));
assert.ok(ws.includes("تعذّرت قراءة نص"));
assert.ok(ws.includes("جارٍ القراءة"));
assert.ok(ws.includes("12000"));
assert.doesNotMatch(ws, /catch\s*\{\s*setAttachedDoc\(""\)/);

const extract = read("lib/modules/doc-tool/extract.ts");
assert.ok(extract.includes("document-inspection") || extract.includes("ExtractResult"));
assert.ok(extract.includes("cloudOcr"));

const uploader = read("components/judicial-assistant/AttachmentUploader.tsx");
assert.ok(uploader.includes("extractFile"));
assert.ok(uploader.includes("/api/doc-tool/ocr/available"));

console.log("test-ask-attach-docs: OK");
