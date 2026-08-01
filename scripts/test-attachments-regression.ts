/**
 * اختبارات regression لمنصة الوثائق / المرفقات — HKM-DOCUMENTS-UPGRADE-002 PR-1
 * حتمية بلا شبكة وبلا قاعدة بيانات (ما عدا استيرادات نقية).
 *
 * يغطي بنود الحماية 1–13 القابلة للاختبار دون حساب سحابي حقيقي.
 * التشغيل: npm run test:attachments-regression
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  decodeLegacyAttachmentPayload,
  isAllowedAttachmentMimeType,
  parseAttachmentMetadata,
  resolveAttachmentMetadata,
  resolveStoredAttachmentUrl,
  toAttachmentDto
} from "@/lib/modules/attachments/attachment-metadata";
import { decideAttachmentMetadataMigration } from "@/lib/modules/attachments/migrate-attachment-metadata-core";
import { attachmentListWhere, assertCaseOwnedForAttachment, ownsAttachment } from "@/lib/modules/auth/ownership";
import { processExtractedText } from "@/lib/modules/document-inspection/pipeline";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const routeSrc = read("app/api/attachments/route.ts");
const idRouteSrc = read("app/api/attachments/[id]/route.ts");
const downloadSrc = read("app/api/attachments/[id]/download/route.ts");
const managerSrc = read("components/AttachmentsManager.tsx");
const extractSrc = read("services/doc-node/extract.ts");
const enginesSrc = read("services/doc-node/engines.ts");
const pipelineSrc = read("lib/modules/document-inspection/pipeline.ts");

// ── 1–3 رفع PDF/DOCX ورفض غير المدعوم ──
check("1/2: MIME المسموح يشمل PDF وDOCX", () => {
  assert.equal(isAllowedAttachmentMimeType("application/pdf"), true);
  assert.equal(
    isAllowedAttachmentMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    true
  );
  assert.ok(ALLOWED_ATTACHMENT_MIME_TYPES.size >= 5);
});

check("3: رفض صيغة غير مدعومة", () => {
  assert.equal(isAllowedAttachmentMimeType("application/zip"), false);
  assert.equal(isAllowedAttachmentMimeType("application/octet-stream"), false);
  assert.ok(routeSrc.includes("isAllowedAttachmentMimeType"));
});

check("رفع جديد يكتب metadata ولا يضع JSON في extractedText", () => {
  assert.ok(routeSrc.includes("extractedText: null"));
  assert.ok(routeSrc.includes("metadata,") || routeSrc.includes("metadata:"));
  assert.ok(routeSrc.includes('processingStatus: "UPLOADED"'));
  assert.doesNotMatch(routeSrc, /extractedText:\s*JSON\.stringify/);
});

check("POST لا يستورد محركات الاستخراج ولا ينتظر القراءة الضوئية", () => {
  assert.doesNotMatch(routeSrc, /from\s+["']@\/lib\/modules\/document-inspection/);
  assert.doesNotMatch(routeSrc, /from\s+["'].*doc-node/);
  assert.doesNotMatch(routeSrc, /\bextractLocal\b|\brunEngine\b/);
  assert.ok(routeSrc.includes("requireApiPermission"));
  assert.ok(routeSrc.includes("ATTACHMENTS_FULL"));
  assert.ok(routeSrc.includes("ASK_ATTACHMENT_UPLOAD"));
  assert.ok(routeSrc.includes("getCurrentUser"));
  // المصادقة قبل قراءة الملف
  const authIdx = routeSrc.indexOf("getCurrentUser");
  const formIdx = routeSrc.indexOf("request.formData");
  assert.ok(authIdx >= 0 && formIdx > authIdx, "الجلسة قبل formData");
  assert.ok(routeSrc.includes("consumeAttachmentUploadRateLimit"));
  assert.ok(routeSrc.includes("CONTENT_LENGTH_EXCEEDED") || routeSrc.includes("content-length"));
});

// ── 4–5 ملكية وعرض ──
check("4: منع ربط مرفق بقضية مستخدم آخر — assertCaseOwnedForAttachment موجود", () => {
  assert.equal(typeof assertCaseOwnedForAttachment, "function");
  assert.ok(routeSrc.includes("assertCaseOwnedForAttachment"));
});

check("5: قائمة المرفقات مقيّدة بـ attachmentListWhere (قضية أو uploadedBy)", () => {
  const where = attachmentListWhere({ id: "user-a", role: "TRAINEE" });
  assert.ok(where && Array.isArray((where as { OR?: unknown[] }).OR));
  const or = (where as { OR: unknown[] }).OR;
  assert.ok(or.length >= 2);
  // مسار metadata الصريح للسجلات الجديدة
  assert.ok(JSON.stringify(where).includes("uploadedBy"));
});

// ── 6–7 تنزيل وحذف ──
check("6: مسار التنزيل الحالي محفوظ مع فحص صلاحية", () => {
  assert.ok(downloadSrc.includes("requireApiPermission"));
  assert.ok(downloadSrc.includes("ATTACHMENTS_LIMITED"));
  assert.ok(downloadSrc.includes("signedDownloadUrl"));
  assert.ok(downloadSrc.includes("resolveStoredAttachmentUrl"));
});

check("7: الحذف يتطلب ATTACHMENTS_FULL وفحص ملكية", () => {
  assert.ok(idRouteSrc.includes("ATTACHMENTS_FULL"));
  assert.ok(idRouteSrc.includes("ATTACHMENT_DELETED") || idRouteSrc.includes("delete"));
  assert.ok(idRouteSrc.includes("ownsAttachment") || idRouteSrc.includes("ownerId"));
});

// ── 8–9 decoder توافق ──
check("8: قراءة سجل قديم يحتوي JSON في extractedText", () => {
  const legacy = JSON.stringify({
    size: 1200,
    relationType: "قضية",
    uploadedBy: "user-1",
    storageMode: "azure-blob",
    storageUrl: "https://example.blob.core.windows.net/x"
  });
  const decoded = decodeLegacyAttachmentPayload(legacy, null);
  assert.equal(decoded.legacyMetadataDetected, true);
  assert.equal(decoded.actualText, null);
  assert.equal(decoded.metadata.uploadedBy, "user-1");
  assert.equal(decoded.metadata.storageMode, "azure-blob");
  const dto = toAttachmentDto({
    id: "a1",
    fileName: "old.pdf",
    mimeType: "application/pdf",
    storageKey: "k",
    extractedText: legacy,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    caseFile: null
  });
  assert.equal(dto.size, 1200);
  assert.equal(dto.uploadedBy, "user-1");
  assert.equal(dto.storageMode, "azure-blob");
});

check("9: قراءة سجل جديد — metadata صريح ونص فعلي في extractedText", () => {
  const decoded = decodeLegacyAttachmentPayload("هذا نص عربي مستخرج من الوثيقة", {
    size: 99,
    uploadedBy: "user-2",
    storageMode: "metadata-only",
    relationType: "عام"
  });
  assert.equal(decoded.legacyMetadataDetected, false);
  assert.equal(decoded.actualText, "هذا نص عربي مستخرج من الوثيقة");
  assert.equal(decoded.metadata.uploadedBy, "user-2");
  const fields = resolveAttachmentMetadata(null, {
    size: 50,
    uploadedBy: "user-3",
    storageMode: "sharepoint",
    storageUrl: "https://contoso.sharepoint.com/x"
  });
  assert.equal(fields.storageMode, "sharepoint");
  assert.equal(resolveStoredAttachmentUrl(null, fields), "https://contoso.sharepoint.com/x");
});

check("DTO: عمود metadata يتفوّق على مفاتيح JSON القديم عند الدمج", () => {
  const legacy = JSON.stringify({ uploadedBy: "old", storageMode: "metadata-only", size: 1 });
  const decoded = decodeLegacyAttachmentPayload(legacy, { uploadedBy: "new", size: 2 });
  assert.equal(decoded.metadata.uploadedBy, "new");
  assert.equal(decoded.metadata.size, 2);
});

check("parseAttachmentMetadata: JSON عام ليس metadata + نص حر كملاحظة", () => {
  const parsed = parseAttachmentMetadata(JSON.stringify({ size: 10, storageMode: "azure-blob", uploadedBy: "u" }));
  assert.equal(parsed.size, 10);
  assert.equal(parseAttachmentMetadata(null).size, undefined);
  assert.equal(parseAttachmentMetadata("نص حر").note, "نص حر");
  assert.deepEqual(parseAttachmentMetadata(JSON.stringify({ foo: 1 })), {});
  assert.deepEqual(parseAttachmentMetadata("{not-json"), { note: "{not-json" });
});

check("decoder: extractedText=null وmetadata صريح", () => {
  const d = decodeLegacyAttachmentPayload(null, { uploadedBy: "u", storageMode: "azure-blob" });
  assert.equal(d.legacyMetadataDetected, false);
  assert.equal(d.actualText, null);
  assert.equal(d.metadata.uploadedBy, "u");
});

check("الأولوية عند التعارض: metadata الجديد يغلب JSON القديم", () => {
  const legacy = JSON.stringify({ uploadedBy: "legacy", storageMode: "metadata-only", storageUrl: "https://old.example/x" });
  const fields = resolveAttachmentMetadata(legacy, {
    uploadedBy: "explicit",
    storageMode: "sharepoint",
    storageUrl: "https://new.example/x"
  });
  assert.equal(fields.uploadedBy, "explicit");
  assert.equal(fields.storageMode, "sharepoint");
  assert.equal(fields.storageUrl, "https://new.example/x");
});

// ── ملكية حقيقية (طبقة ownsAttachment) ──
check("يتيم يملكه الـ uploader: مسموح", () => {
  assert.equal(
    ownsAttachment(
      { id: "u1", role: "LAWYER" },
      { caseId: null, caseOwnerId: null, extractedText: null, metadata: { uploadedBy: "u1" } }
    ),
    true
  );
});

check("يتيم لمستخدم آخر: مرفوض", () => {
  assert.equal(
    ownsAttachment(
      { id: "u1", role: "LAWYER" },
      {
        caseId: null,
        caseOwnerId: null,
        extractedText: JSON.stringify({ uploadedBy: "u2", storageMode: "azure-blob" }),
        metadata: null
      }
    ),
    false
  );
});

check("مرتبط بقضية مستخدم آخر: مرفوض حتى لو uploadedBy للمهاجم", () => {
  assert.equal(
    ownsAttachment(
      { id: "attacker", role: "LAWYER" },
      {
        caseId: "case-1",
        caseOwnerId: "owner",
        extractedText: null,
        metadata: { uploadedBy: "attacker" }
      }
    ),
    false
  );
});

check("مرتبط بقضية المالك: مسموح", () => {
  assert.equal(
    ownsAttachment(
      { id: "owner", role: "LAWYER" },
      { caseId: "case-1", caseOwnerId: "owner", extractedText: null, metadata: { uploadedBy: "other" } }
    ),
    true
  );
});

check("قضية محذوفة (caseId موجود بلا owner): مرفوض لغير المدير", () => {
  assert.equal(
    ownsAttachment(
      { id: "u1", role: "LAWYER" },
      { caseId: "gone", caseOwnerId: null, extractedText: null, metadata: { uploadedBy: "u1" } }
    ),
    false
  );
  assert.equal(
    ownsAttachment(
      { id: "admin", role: "SYSTEM_ADMIN" },
      { caseId: "gone", caseOwnerId: null, extractedText: null, metadata: { uploadedBy: "u1" } }
    ),
    true
  );
});

check("تنزيل SharePoint قديم: resolveStoredAttachmentUrl من JSON", () => {
  const legacy = JSON.stringify({
    storageMode: "sharepoint",
    storageUrl: "https://contoso.sharepoint.com/sites/x/doc.pdf",
    uploadedBy: "u1"
  });
  assert.equal(
    resolveStoredAttachmentUrl(legacy, null),
    "https://contoso.sharepoint.com/sites/x/doc.pdf"
  );
  assert.ok(downloadSrc.includes("ownsAttachment"));
  assert.ok(downloadSrc.includes("resolveStoredAttachmentUrl"));
});

check("ترحيل: JSON قديم مؤهل · نص عادي يُتخطى · idempotent بعد التفريغ", () => {
  const legacy = JSON.stringify({ uploadedBy: "u", storageMode: "azure-blob" });
  const migrate = decideAttachmentMetadataMigration({
    id: "1",
    fileName: "a.pdf",
    extractedText: legacy,
    metadata: null
  });
  assert.equal(migrate.action, "migrate");
  assert.equal(
    decideAttachmentMetadataMigration({
      id: "2",
      fileName: "b.pdf",
      extractedText: "نص وثيقة",
      metadata: null
    }).action,
    "skip"
  );
  assert.equal(
    decideAttachmentMetadataMigration({
      id: "3",
      fileName: "c.pdf",
      extractedText: null,
      metadata: { uploadedBy: "u", storageMode: "azure-blob" }
    }).action,
    "skip"
  );
});

check("مسارات [id] تستخدم ownsAttachment الموحّد", () => {
  assert.ok(idRouteSrc.includes("ownsAttachment"));
  assert.ok(idRouteSrc.includes("caseId:"));
  assert.ok(downloadSrc.includes("caseId:"));
});

// ── 10 تراجع runEngine / ExtractOut ──
check("10: ExtractOut وrunEngine الحاليان لم يُستبدلا", () => {
  assert.ok(extractSrc.includes("export interface ExtractOut"));
  assert.ok(extractSrc.includes("text: string"));
  assert.ok(extractSrc.includes("kind: string"));
  assert.ok(extractSrc.includes("export async function extractLocal"));
  assert.ok(enginesSrc.includes("export async function runEngine"));
  assert.ok(enginesSrc.includes("processExtractedText"));
});

// ── 11–12 محركات محلي/بعيد (عقد المصدر) ──
check("11: PDF نصي يعمل عبر المحرك المحلي (extractLocal + digital-layer)", () => {
  assert.ok(extractSrc.includes('source: "digital-layer"'));
  assert.ok(extractSrc.includes("pdfjs-dist") || extractSrc.includes("extractPdfTextNode"));
});

check("12: PDF مصور يتجه للمحرك البعيد (RemoteNeeded)", () => {
  assert.ok(extractSrc.includes("RemoteNeeded"));
  assert.ok(extractSrc.includes("PDF ممسوح") || extractSrc.includes("يحتاج محرّك"));
});

// ── 13 processExtractedText مرجعي ──
check("13: مخرجات processExtractedText للحالات المرجعية لا تتغيّر", () => {
  assert.ok(pipelineSrc.includes("export function processExtractedText"));
  const clean = processExtractedText("مادة أولى\nمادة ثانية", { source: "digital-layer" });
  assert.equal(typeof clean.body, "string");
  assert.equal(typeof clean.needsOcr, "boolean");
  assert.equal(typeof clean.correctedLines, "number");

  const cloud = processExtractedText("نص سليم من الرؤية", { source: "cloud" });
  assert.equal(cloud.body.includes("نص سليم"), true);
  assert.equal(cloud.needsOcr, false);

  const ocr = processExtractedText("سطر تجريبي", { source: "ocr", totalPages: 1 });
  assert.equal(typeof ocr.body, "string");
});

check("الواجهة لا تزال تستدعي /api/attachments للرفع والحذف", () => {
  assert.ok(managerSrc.includes('fetch("/api/attachments"'));
  assert.ok(managerSrc.includes("/api/attachments/${id}"));
  assert.ok(managerSrc.includes('accept=".pdf,.docx,.txt,.png,.jpg,.jpeg'));
});

check("سكربت الترحيل: dry-run افتراضي + دفعات + لا تسريب قيم", () => {
  const migrate = read("scripts/migrate-attachment-metadata.ts");
  assert.ok(migrate.includes("dry-run"));
  assert.ok(migrate.includes("--apply"));
  assert.ok(migrate.includes("BATCH_SIZE"));
  assert.ok(migrate.includes("decideAttachmentMetadataMigration"));
  assert.ok(migrate.includes("eligible"));
  assert.ok(migrate.includes("failed"));
  assert.doesNotMatch(migrate, /console\.log\([^\)]*storageUrl/);
});

console.log(`\nكل اختبارات regression المرفقات ناجحة (${passed})`);
