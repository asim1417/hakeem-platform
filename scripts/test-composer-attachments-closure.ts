/**
 * اختبارات قبول إغلاق PR #594 — الفجوات الأربع.
 * تشغيل: npm run test:composer-attachments-closure
 */
import {
  decideClientExtractionWrite,
  verificationForProvenance,
} from "../lib/modules/attachments/extraction-provenance";
import {
  classifyAttachmentIds,
  resolveAttachedOnlyError,
} from "../lib/modules/attachments/attachment-classify";
import {
  fetchGraphContentFollowingRedirects,
  shouldSendGraphAuthorization,
} from "../lib/modules/attachments/sharepoint-download";
import {
  InMemoryAttachmentUploadRateLimiter,
  assertAttachmentsV2RateLimitReady,
  isAttachmentRateLimitDistributedEnabled,
  __setAttachmentUploadRateLimiterForTests,
  __resetAttachmentUploadRateLimitForTests,
} from "../lib/modules/attachments/upload-rate-limit";
import {
  decideAttachmentsRuntime,
  decideAgentSearchAttachmentsMode,
  readAttachmentsVersionClaim,
  ATTACHMENTS_VERSION_HEADER,
} from "../lib/modules/hakeem-composer/attachments-version";
import {
  deriveComposerAttachmentStatus,
  isAttachmentReadyForModel,
  planAskAttachmentSend,
} from "../lib/modules/hakeem-composer/attachment-send-policy";
import type { ComposerAttachment } from "../lib/modules/hakeem-composer/types";
import { NextRequest } from "next/server";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

function req(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers,
  });
}

async function main() {
// ── 1) Pending + CLIENT_PREVIEW → NOT_READY ──
{
  const buckets = classifyAttachmentIds(
    ["a1"],
    [{ id: "a1", processingStatus: "EXTRACTING", owned: true, hasText: false }]
  );
  const err2 = resolveAttachedOnlyError(buckets, { hasLegacyDocument: false });
  t(err2?.code === "ATTACHMENT_NOT_READY", "1) Pending → ATTACHMENT_NOT_READY");
}

// ── 2) CLIENT_PREVIEW لا يصل إلى النموذج ──
{
  const att: ComposerAttachment = {
    id: "local",
    name: "x.pdf",
    extractedText: "معاينة محلية طويلة",
    status: "processing",
    localExtractionStatus: "ok",
    serverAttachmentId: "srv-1",
    serverProcessingStatus: "EXTRACTING",
    serverVerificationStatus: "PREVIEW_ONLY",
  };
  t(!isAttachmentReadyForModel(att), "2) PREVIEW ليس جاهزًا للنموذج");
  const plan = planAskAttachmentSend({
    attachments: [att],
    attachmentsV2: true,
    processingV2: true,
  });
  t(plan.document === null && plan.suppressLocalDocument, "2b) لا document inline");
  t(plan.attachmentIds[0] === "srv-1", "2c) ids فقط");
}

// ── 3) CLIENT_FALLBACK فقط عند غياب doc-node ──
{
  const d = decideClientExtractionWrite({
    processingStatus: "UPLOADED",
    metadata: {},
    documentProcessingV2: true,
    docNodeConfigured: false,
  });
  t(d.action === "fallback_write", "3) fallback عند غياب doc-node");
  t(verificationForProvenance("CLIENT_FALLBACK") === "CLIENT_UNVERIFIED", "3b) CLIENT_UNVERIFIED");
  const preview = decideClientExtractionWrite({
    processingStatus: "EXTRACTING",
    metadata: { docNodeJobId: "j" },
    documentProcessingV2: true,
    docNodeConfigured: true,
  });
  t(preview.action === "preview_only", "3c) preview عند توفر doc-node");
}

// ── 4) READY SERVER_VERIFIED عبر ids ──
{
  const att: ComposerAttachment = {
    id: "l",
    name: "a.pdf",
    extractedText: "نص خادمي",
    status: "ready",
    localExtractionStatus: "ok",
    serverAttachmentId: "srv-ready",
    serverProcessingStatus: "READY",
    serverVerificationStatus: "SERVER_VERIFIED",
  };
  t(isAttachmentReadyForModel(att), "4) SERVER_VERIFIED جاهز");
  const plan = planAskAttachmentSend({
    attachments: [att],
    attachmentsV2: true,
    processingV2: true,
  });
  t(plan.attachmentIds.includes("srv-ready") && plan.document === null, "4b) عبر attachmentIds");
}

// ── 5) عميل V2 / خادم Legacy ──
{
  delete process.env.HAKEEM_COMPOSER_ATTACHMENTS_V2;
  const d = decideAttachmentsRuntime({ clientClaimsV2: true });
  t(!d.ok && d.code === "CLIENT_V2_SERVER_LEGACY", "5) رفض CLIENT_V2_SERVER_LEGACY");
  const search = decideAgentSearchAttachmentsMode({
    clientClaimsV2: true,
    hasAttachmentIds: true,
  });
  t(search.mode === "reject_v2_claim", "5b) agent-search يرفض ادّعاء V2");
}

// ── 6) خادم V2 / عميل Legacy ──
{
  process.env.HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
  const d = decideAttachmentsRuntime({ clientClaimsV2: false });
  t(d.ok && d.alignment.reason === "SERVER_V2_CLIENT_LEGACY", "6) SERVER_V2_CLIENT_LEGACY");
  const search = decideAgentSearchAttachmentsMode({
    clientClaimsV2: false,
    hasAttachmentIds: false,
  });
  t(search.mode === "legacy", "6b) بلا ids → legacy");
  const searchIds = decideAgentSearchAttachmentsMode({
    clientClaimsV2: false,
    hasAttachmentIds: true,
  });
  t(searchIds.mode === "v2", "6c) مع ids الخادم يفرض V2");
  const claim = readAttachmentsVersionClaim(req({ [ATTACHMENTS_VERSION_HEADER]: "2" }));
  t(claim.clientClaimsV2 === true, "6d) قراءة ترويسة الإصدار");
}

// ── 7–8) Graph redirect ──
{
  t(shouldSendGraphAuthorization("https://graph.microsoft.com/v1.0/drives/x/root:/a:/content"), "7) Graph يحمل Auth");
  t(!shouldSendGraphAuthorization("https://contoso.sharepoint.com/tmp/file"), "7b) SharePoint بلا Auth");

  const traces: Array<{ url: string; sentAuthorization: boolean }> = [];
  let hop = 0;
  const result = await fetchGraphContentFollowingRedirects(
    "https://graph.microsoft.com/v1.0/drives/d/root:/f:/content",
    "tok",
    {
      fetchImpl: async () => {
        hop += 1;
        if (hop === 1) {
          return {
            status: 302,
            headers: {
              get: (n) =>
                n.toLowerCase() === "location"
                  ? "https://contoso.sharepoint.com/_layouts/download.aspx?tmp=1"
                  : null,
            },
            ok: false,
          };
        }
        return {
          status: 200,
          headers: { get: () => null },
          ok: true,
          arrayBuffer: async () => new TextEncoder().encode("PDF").buffer,
        };
      },
      onTrace: (tr) => traces.push(tr),
    }
  );
  t(result.ok === true, "7c) redirect SharePoint مؤقت ينجح");
  t(traces[0]?.sentAuthorization === true, "7d) الطلب الأول يحمل Authorization");
  t(traces[1]?.sentAuthorization === false, "7e) الطلب الثاني بلا Authorization");

  const bad = await fetchGraphContentFollowingRedirects(
    "https://graph.microsoft.com/v1.0/drives/d/root:/f:/content",
    "tok",
    {
      fetchImpl: async () => ({
        status: 302,
        headers: {
          get: (n) => (n.toLowerCase() === "location" ? "https://evil.example.com/x" : null),
        },
        ok: false,
      }),
    }
  );
  t(!bad.ok && bad.reason === "EXTERNAL_REDIRECT_REJECTED", "8) redirect خارجي مرفوض");
}

// ── 9) Rate limiter ──
{
  __resetAttachmentUploadRateLimitForTests();
  delete process.env.HAKEEM_ATTACHMENT_RATE_LIMIT_DISTRIBUTED;
  t(!isAttachmentRateLimitDistributedEnabled(), "9) الموزّع غير مفعّل افتراضيًا");
  process.env.HAKEEM_FORCE_PRODUCTION_GUARDS = "1";
  const gate = assertAttachmentsV2RateLimitReady();
  t(!gate.ok && gate.code === "RATE_LIMITER_NOT_PRODUCTION_READY", "9b) إنتاج بلا موزّع ممنوع");
  delete process.env.HAKEEM_FORCE_PRODUCTION_GUARDS;

  const mem = new InMemoryAttachmentUploadRateLimiter(2);
  __setAttachmentUploadRateLimiterForTests(mem);
  t((await mem.consume("u")).allowed, "9c) memory limiter");
  t((await mem.consume("u")).allowed, "9d) memory 2");
  t(!(await mem.consume("u")).allowed, "9e) memory exceeded");
  t((await mem.consume("u")).provider === "memory", "9f) يوصف صراحة memory = development-only");
  __resetAttachmentUploadRateLimitForTests();
}

// ── 10) تحديث الصفحة لا يحوّل Pending→Ready من المعاينة المحلية ──
{
  const status = deriveComposerAttachmentStatus({
    localExtractionStatus: "ok",
    serverAttachmentId: "srv",
    serverProcessingStatus: "EXTRACTING",
    serverVerificationStatus: "PREVIEW_ONLY",
    processingV2: true,
  });
  t(status === "processing", "10) local ok + preview ≠ ready");
  const afterReload = deriveComposerAttachmentStatus({
    localExtractionStatus: "ok",
    serverAttachmentId: "srv",
    serverProcessingStatus: "EXTRACTING",
    serverVerificationStatus: "PREVIEW_ONLY",
    processingV2: true,
  });
  t(afterReload === "processing", "10b) إعادة اشتقاق تبقى processing");
}

console.log(`\nنتيجة القبول: ${ok} نجح، ${fail} فشل`);
if (fail) process.exit(1);
}

void main();
