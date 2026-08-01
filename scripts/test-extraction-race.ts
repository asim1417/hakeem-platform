/**
 * سباق browser extraction ↔ doc-node + provenance.
 * تشغيل: npm run test:extraction-race
 */
import {
  decideClientExtractionWrite,
  decideServerJobWrite,
  verificationForProvenance,
  type ExtractionProvenance,
} from "../lib/modules/attachments/extraction-provenance";
import { selectAttachmentPagesForRead, validatePageRange } from "../lib/modules/attachments/read-attachment-pages";
import {
  classifyAttachmentIds,
  resolveAttachedOnlyError,
} from "../lib/modules/attachments/attachment-classify";
import {
  decideSharePointDownloadUrl,
  buildGraphDriveContentUrl,
} from "../lib/modules/attachments/sharepoint-download";
import {
  consumeAttachmentUploadRateLimit,
  __resetAttachmentUploadRateLimitForTests,
} from "../lib/modules/attachments/upload-rate-limit";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

// ── سباق 1: doc-node يبدأ ثم browser يصل → preview only
{
  const d = decideClientExtractionWrite({
    processingStatus: "EXTRACTING",
    metadata: { docNodeJobId: "job-1" },
    documentProcessingV2: true,
    docNodeConfigured: true,
  });
  t(d.action === "preview_only", "1) doc-node نشط → browser معاينة فقط");
}

// ── سباق 2: browser fallback ثم doc-node يكتمل → يسمح server write
{
  const d = decideServerJobWrite({
    incomingJobId: "job-1",
    metadata: {
      docNodeJobId: "job-1",
      extractionProvenance: "CLIENT_FALLBACK",
      verificationStatus: "CLIENT_UNVERIFIED",
      docNodeGeneration: 1,
    },
  });
  t(d.allow === true, "2) doc-node يرقّي بعد browser fallback");
}

// ── سباق 3: Job قديم بعد forceReprocess
{
  const stale = decideServerJobWrite({
    incomingJobId: "job-old",
    metadata: { docNodeJobId: "job-new", docNodeGeneration: 2 },
  });
  t(stale.allow === false && stale.reason === "STALE_JOB_ID", "3) Job قديم مرفوض");
  const force = decideServerJobWrite({
    incomingJobId: "job-old",
    metadata: { docNodeJobId: "job-new" },
    forceReprocess: true,
  });
  t(force.allow === true, "3b) forceReprocess يسمح");
}

// ── سباق 4: doc-node يفشل → browser fallback مسموح
{
  const d = decideClientExtractionWrite({
    processingStatus: "FAILED",
    metadata: { docNodeJobId: "job-x" },
    documentProcessingV2: true,
    docNodeConfigured: false,
  });
  t(d.action === "fallback_write", "4) doc-node غير متاح → CLIENT_FALLBACK");
  t(verificationForProvenance("CLIENT_FALLBACK") === "CLIENT_UNVERIFIED", "4b) ليس SERVER_VERIFIED");
}

// ── سباق 5: browser فشل منطقيًا وdoc-node ينجح — قرار server منفصل
{
  t(verificationForProvenance("SERVER_LOCAL") === "SERVER_VERIFIED", "5) خادمي موثق");
}

// ── سباق 6: كلاهما يفشلان — لا write جاهز من قرار العميل عند V2+node
{
  const d = decideClientExtractionWrite({
    processingStatus: "UPLOADED",
    metadata: {},
    documentProcessingV2: true,
    docNodeConfigured: true,
  });
  t(d.action === "preview_only", "6) لا READY من عميل بينما doc-node مفضّل");
}

const provenances: ExtractionProvenance[] = [
  "SERVER_LOCAL",
  "SERVER_GEMINI",
  "SERVER_QARI",
  "CLIENT_PREVIEW",
  "CLIENT_FALLBACK",
];
t(provenances.length === 5, "أنواع provenance كاملة");

// ── صفحات
{
  const pages = [
    { pageNumber: 1, text: "صفحة واحدة عقد", status: "ready" as const, confidence: 0.9 },
    { pageNumber: 2, text: "صفحة اثنان فسخ", status: "ready" as const },
    { pageNumber: 3, text: "", status: "failed" as const },
    { pageNumber: 4, text: "جزئي", status: "partial" as const },
  ];
  const one = selectAttachmentPagesForRead({ pages, fullText: "", pageRange: { from: 1, to: 1 } });
  t(one.ok && one.items.length === 1 && one.items[0].pageNumber === 1, "صفحة واحدة");
  const multi = selectAttachmentPagesForRead({ pages, fullText: "", pageRange: { from: 1, to: 2 } });
  t(multi.ok && multi.usedPageNumbers.length === 2, "عدة صفحات");
  const valid = validatePageRange({ from: 1, to: 2 }, 4);
  t(valid.ok === true, "نطاق صالح");
  const rev = validatePageRange({ from: 3, to: 1 }, 4);
  t(rev.ok === false, "نطاق معكوس");
  const out = validatePageRange({ from: 1, to: 99 }, 4);
  t(out.ok === false && out.code === "PAGE_OUT_OF_RANGE", "نطاق خارج المستند");
  const failed = selectAttachmentPagesForRead({ pages, fullText: "", pageRange: { from: 3, to: 3 } });
  t(failed.ok && failed.items[0].status === "FAILED", "صفحة failed");
  const partial = selectAttachmentPagesForRead({ pages, fullText: "", pageRange: { from: 4, to: 4 } });
  t(partial.ok && partial.items[0].status === "PARTIAL", "PARTIAL");
  const noPages = selectAttachmentPagesForRead({ fullText: "نص مجمّع بلا صفحات", pages: [] });
  t(noPages.textFallback && noPages.items[0].pageNumber === null, "بلا metadata.pages");
  const hint = selectAttachmentPagesForRead({
    pages,
    fullText: "",
    queryHint: "فسخ",
  });
  t(hint.ok && hint.items.some((i) => i.text.includes("فسخ")), "queryHint حتمي");
}

// ── أخطاء المرفقات
{
  const order = [
    resolveAttachedOnlyError(
      classifyAttachmentIds(["x"], [{ id: "x", processingStatus: "READY", owned: false, hasText: true }]),
      { hasLegacyDocument: false }
    )?.code,
    resolveAttachedOnlyError(classifyAttachmentIds([], []), { hasLegacyDocument: false })?.code,
    resolveAttachedOnlyError(
      classifyAttachmentIds(["q"], [{ id: "q", processingStatus: "QUARANTINED", owned: true, hasText: false }]),
      { hasLegacyDocument: false }
    )?.code,
    resolveAttachedOnlyError(
      classifyAttachmentIds(["f"], [{ id: "f", processingStatus: "FAILED", owned: true, hasText: false }]),
      { hasLegacyDocument: false }
    )?.code,
    resolveAttachedOnlyError(
      classifyAttachmentIds(["p"], [{ id: "p", processingStatus: "EXTRACTING", owned: true, hasText: false }]),
      { hasLegacyDocument: false }
    )?.code,
  ];
  t(order[0] === "ATTACHMENT_FORBIDDEN", "خطأ 1 FORBIDDEN");
  t(order[1] === "SOURCE_POLICY_REQUIRES_ATTACHMENT", "خطأ 2 REQUIRES");
  t(order[2] === "ATTACHMENT_QUARANTINED", "خطأ 3 QUARANTINED");
  t(order[3] === "ATTACHMENT_PROCESSING_FAILED", "خطأ 4 FAILED منفصل عن NOT_READY");
  t(order[4] === "ATTACHMENT_NOT_READY", "خطأ 5 NOT_READY");
  const partialOk = resolveAttachedOnlyError(
    classifyAttachmentIds(["a"], [{ id: "a", processingStatus: "PARTIAL", owned: true, hasText: true }]),
    { hasLegacyDocument: false }
  );
  t(partialOk === null, "PARTIAL مسموح مع تحذير لاحقًا");
}

// ── SharePoint SSRF
{
  process.env.SHAREPOINT_DRIVE_ID = "drive1";
  const graph = buildGraphDriveContentUrl("sharepoint/attachments/2026/file.pdf");
  t(Boolean(graph && graph.includes("graph.microsoft.com") && graph.includes("/content")), "Graph content URL");
  const web = decideSharePointDownloadUrl({
    storageKey: "sharepoint/bad",
    metadataUrl: "https://evil.example.com/steal",
    driveId: "",
  });
  // بدون driveId وwebUrl عام
  delete process.env.SHAREPOINT_DRIVE_ID;
  const blocked = decideSharePointDownloadUrl({
    storageKey: "sharepoint/x",
    metadataUrl: "https://evil.example.com/x",
  });
  t(blocked.allow === false, "رفض نطاق غير مسموح / webUrl مع Auth");
  const http = decideSharePointDownloadUrl({
    storageKey: "sharepoint/x",
    metadataUrl: "http://graph.microsoft.com/v1.0/drives/d/root:/a:/content",
  });
  t(http.allow === false, "رفض غير HTTPS");
  process.env.SHAREPOINT_DRIVE_ID = "drive1";
  const okDecision = decideSharePointDownloadUrl({
    storageKey: "sharepoint/attachments/f.pdf",
    metadataUrl: "https://contoso.sharepoint.com/sites/x",
  });
  t(okDecision.allow && okDecision.mode === "graph-content", "يفضّل Graph على webUrl");
}

// ── Rate limit
{
  __resetAttachmentUploadRateLimitForTests();
  process.env.ATTACHMENT_UPLOAD_RATE_LIMIT = "3";
  const u = "user-rate";
  t(consumeAttachmentUploadRateLimit(u, 3).allowed, "rate 1");
  t(consumeAttachmentUploadRateLimit(u, 3).allowed, "rate 2");
  t(consumeAttachmentUploadRateLimit(u, 3).allowed, "rate 3");
  t(!consumeAttachmentUploadRateLimit(u, 3).allowed, "rate exceeded");
  __resetAttachmentUploadRateLimitForTests();
}

console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
if (fail) process.exit(1);
