/**
 * اختبارات جسر مرفقات Ask — حتمية بلا شبكة/DB.
 * تشغيل: npm run test:composer-documents
 */
import {
  ASK_ATTACHMENT_RELATION_TYPE,
  combineComposerDocuments,
  finalizeComposerExtractedText,
  isComposerDocumentsV1Enabled,
  mapExtractKindToTextSource,
  MESSAGE_ATTACHMENT_TEXT_PREVIEW,
  resolveAskDocumentText,
  toMessageAttachmentRef,
} from "../lib/modules/hakeem-composer/document-bridge";
import { processExtractedText } from "../lib/modules/document-inspection/pipeline";
import type { ComposerAttachment } from "../lib/modules/hakeem-composer/types";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

process.env.HAKEEM_COMPOSER_DOCUMENTS_V1 = "1";
t(isComposerDocumentsV1Enabled() === true, "العلم مفعّل");
process.env.HAKEEM_COMPOSER_DOCUMENTS_V1 = "0";
t(isComposerDocumentsV1Enabled() === false, "العلم معطّل → توافق خلفي");
process.env.HAKEEM_COMPOSER_DOCUMENTS_V1 = "1";

t(ASK_ATTACHMENT_RELATION_TYPE === "اسأل", "relationType لـ Ask");

t(mapExtractKindToTextSource("pdf-text") === "digital-layer", "kind نصي → digital-layer");
t(mapExtractKindToTextSource("ocr-tesseract") === "ocr", "kind ocr → ocr");
t(mapExtractKindToTextSource("cloud-gemini") === "cloud", "kind cloud → cloud");

const sample =
  "المادة الأولى: يسري هذا النظام على العقود التجارية.\n\nالمادة الثانية: تختص المحكمة التجارية.";
const finalized = finalizeComposerExtractedText(sample, "pdf-text");
t(finalized.text.includes("المادة الأولى"), "finalize يحتفظ بالمتن");
t(finalized.source === "digital-layer", "مصدر digital-layer");

const pipeline = processExtractedText(sample, { source: "digital-layer" });
t(pipeline.body.length > 0, "processExtractedText يعمل (اعتماد موجود)");

const combined = combineComposerDocuments([
  { name: "a.pdf", text: "نص أ" },
  { name: "b.pdf", text: "نص ب" },
]);
t(combined.name === "2 مستندات" && combined.text.includes("المستند 1"), "دمج مستندين");

const fromAtts = resolveAskDocumentText({
  requestDocument: "نص عميل قديم",
  attachmentDocuments: [{ fileName: "عقد.pdf", text: "نص خادمي موثوق" }],
});
t(fromAtts.source === "attachments" && fromAtts.text.includes("خادمي"), "أولوية نص المرفقات الخادمية");

const fromReq = resolveAskDocumentText({
  requestDocument: "نص الطلب فقط",
  attachmentDocuments: [],
});
t(fromReq.source === "request", "سقوط إلى document عند غياب ids");

const none = resolveAskDocumentText({ requestDocument: "", attachmentDocuments: [] });
t(none.source === "none" && none.text === "", "بلا مستند");

const inlineAtt: ComposerAttachment = {
  id: "local-uuid",
  name: "x.pdf",
  extractedText: "أ".repeat(5000),
  status: "ready",
};
const inlineRef = toMessageAttachmentRef(inlineAtt);
t(inlineRef.id === "local-uuid" && inlineRef.processingStatus === "inline", "بدون server id → inline");
t((inlineRef.extractedText?.length ?? 0) === 5000, "inline يحفظ نصًا أوسع");

const serverAtt: ComposerAttachment = {
  id: "local-uuid",
  name: "x.pdf",
  extractedText: "ب".repeat(5000),
  status: "ready",
  serverAttachmentId: "cuid_server_1",
  storageKey: "blob/key",
};
const serverRef = toMessageAttachmentRef(serverAtt);
t(serverRef.id === "cuid_server_1", "Adapter يستخدم Attachment.id");
t(serverRef.processingStatus === "ready", "status=ready");
t(serverRef.storageKey === "blob/key", "storageKey يُمرَّر");
t(
  (serverRef.extractedText?.length ?? 0) === MESSAGE_ATTACHMENT_TEXT_PREVIEW,
  "معاينة محدودة عند وجود id خادمي"
);

// سياسة attached-only ما زالت تتطلب مرفقًا — تكامل مع المرحلة 1
t(
  resolveAskDocumentText({ requestDocument: "x", attachmentDocuments: [] }).text.length > 0,
  "التوافق: document الخام كافٍ عند تعطيل المسار الخادمي للمرفقات"
);

console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
if (fail) process.exit(1);
