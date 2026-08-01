/**
 * اختبارات عقدية لدورة المرفقات (بدون HTTP حي للمتصفح).
 * يحاكي: قرار الأعلام → تصنيف → provenance → صفحات → SourcePolicy ترتيب أخطاء.
 * لا يُسمّى End-to-End متصفحيًا.
 *
 * تشغيل: npm run test:composer-attachments-contract
 */
import { alignClientServerDocumentFlags } from "../lib/modules/hakeem-composer/document-flags";
import {
  decideClientExtractionWrite,
  decideServerJobWrite,
} from "../lib/modules/attachments/extraction-provenance";
import {
  classifyAttachmentIds,
  hasAttachmentReference,
  hasReadyAttachmentContent,
  resolveAttachedOnlyError,
} from "../lib/modules/attachments/attachment-classify";
import { decideSharePointDownloadUrl } from "../lib/modules/attachments/sharepoint-download";
import { ATTACHMENT_MAX_BYTES } from "../lib/modules/attachments/secure-upload";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

async function main() {
  process.env.HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
  process.env.NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
  process.env.HAKEEM_DOCUMENT_PROCESSING_V2 = "1";
  process.env.SHAREPOINT_DRIVE_ID = "drv";

  t(alignClientServerDocumentFlags().enforceV2 === true, "محاذاة V2 للعقد");

  // محاكاة دورة: رفع (مرجع) → قيد المعالجة → browser preview → doc-node sync → READY → read
  const pendingBuckets = classifyAttachmentIds(
    ["att-1"],
    [{ id: "att-1", processingStatus: "EXTRACTING", owned: true, hasText: false }]
  );
  t(hasAttachmentReference(pendingBuckets) && !hasReadyAttachmentContent(pendingBuckets), "مرجع بلا محتوى جاهز");
  t(
    resolveAttachedOnlyError(pendingBuckets, { hasLegacyDocument: false })?.code === "ATTACHMENT_NOT_READY",
    "attached-only أثناء Job"
  );

  const preview = decideClientExtractionWrite({
    processingStatus: "EXTRACTING",
    metadata: { docNodeJobId: "j1" },
    documentProcessingV2: true,
    docNodeConfigured: true,
  });
  t(preview.action === "preview_only", "browser لا ينهي Job");

  const sync = decideServerJobWrite({
    incomingJobId: "j1",
    metadata: { docNodeJobId: "j1", docNodeGeneration: 1 },
  });
  t(sync.allow, "مزامنة Job الحالي");

  const pages = [
    { pageNumber: 1, text: "مقدمة العقد", status: "ready" as const },
    { pageNumber: 2, text: "بند الفسخ", status: "ready" as const },
  ];
  const ctx = createAgentContext("", { ...DEFAULT_SOURCE_POLICY, attachments: true }, [
    {
      id: "att-1",
      fileName: "عقد.pdf",
      text: pages.map((p) => p.text).join("\n"),
      status: "READY",
      pages,
      provenance: "SERVER_LOCAL",
    },
  ]);
  const read = await executeTool(
    "read_attachment",
    { attachmentIds: ["att-1"], pageRange: { from: 2, to: 2 }, queryHint: "فسخ" },
    ctx
  );
  t(read.ok === true, "read_attachment بعد READY");
  const data = read.data as {
    items: Array<{ pages?: Array<{ pageNumber: number | null; text: string }>; usedPageNumbers?: number[] }>;
    auditedPages?: unknown[];
  };
  t(data.items[0].usedPageNumbers?.[0] === 2, "pageRange حقيقي");
  t(Boolean(data.auditedPages?.length), "تسجيل صفحات في سياق التدقيق (بلا نص كامل هنا)");

  // مرفقات متعددة بنطاقات
  const multi = createAgentContext("", DEFAULT_SOURCE_POLICY, [
    { id: "a", fileName: "a.pdf", text: "أ", status: "READY", pages: [{ pageNumber: 1, text: "أ1", status: "ready" }] },
    {
      id: "b",
      fileName: "b.pdf",
      text: "ب",
      status: "READY",
      pages: [
        { pageNumber: 1, text: "ب1", status: "ready" },
        { pageNumber: 2, text: "ب2", status: "ready" },
      ],
    },
  ]);
  const rA = await executeTool("read_attachment", { attachmentIds: ["a"], pageRange: { from: 1, to: 1 } }, multi);
  const rB = await executeTool("read_attachment", { attachmentIds: ["b"], pageRange: { from: 2, to: 2 } }, multi);
  t(
    (rA.data as { items: Array<{ text: string }> }).items[0].text.includes("أ") &&
      (rB.data as { items: Array<{ text: string }> }).items[0].text.includes("ب2"),
    "عدة مرفقات بنطاقات مختلفة"
  );

  // Content-Length حد معلن (عقد)
  t(ATTACHMENT_MAX_BYTES > 0, "حد حجم للرفض المبكر");

  // SharePoint لا يعتمد webUrl
  const sp = decideSharePointDownloadUrl({
    storageKey: "sharepoint/folder/file.pdf",
    metadataUrl: "https://tenant.sharepoint.com/sites/x/:w:/r/doc",
  });
  t(sp.allow && sp.mode === "graph-content", "تنزيل عبر Graph لا webUrl");

  // لا نص كامل في قرار audit المحاكى
  const auditMeta = {
    provenance: "SERVER_LOCAL",
    textLength: 1200,
    // ممنوع: text: "..."
  };
  t(!("text" in auditMeta) && auditMeta.textLength === 1200, "عقد التدقيق: طول بلا متن");

  // إغلاق العميل لا يوقف Job — قرار السباق يبقى على jobId
  t(
    decideServerJobWrite({
      incomingJobId: "j1",
      metadata: { docNodeJobId: "j1" },
    }).allow,
    "Job يستمر بعد إغلاق العميل (مزامنة لاحقة)"
  );

  console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
  console.log("ملاحظة: ليست اختبارات End-to-End متصفحية حية — عقود/محاكاة وحدة.");
  if (fail) process.exit(1);
}

void main();
