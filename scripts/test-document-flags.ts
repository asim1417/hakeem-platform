/**
 * مصفوفة أعلام الوثائق + محاذاة عميل/خادم.
 * تشغيل: npm run test:document-flags
 */
import {
  alignClientServerDocumentFlags,
  isAttachmentsV2ClientEnabled,
  isAttachmentsV2ServerEnabled,
  isComposerAttachmentClientPersistEnabled,
  isComposerDocumentsClientEnabled,
  isComposerDocumentsV1Enabled,
  isDocumentsV1ClientEnabled,
  resolveComposerDocumentsMode,
} from "../lib/modules/hakeem-composer/document-flags";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

function clearFlags() {
  for (const k of [
    "HAKEEM_COMPOSER_DOCUMENTS_V1",
    "NEXT_PUBLIC_HAKEEM_COMPOSER_DOCUMENTS_V1",
    "HAKEEM_COMPOSER_ATTACHMENTS_V2",
    "NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2",
  ]) {
    delete process.env[k];
  }
}

clearFlags();
t(!isComposerDocumentsV1Enabled() && !isAttachmentsV2ServerEnabled(), "جميعها معطّلة — خادم");
t(!isComposerAttachmentClientPersistEnabled(), "جميعها معطّلة — عميل لا يصرّ");
t(resolveComposerDocumentsMode() === "off", "mode=off");

process.env.HAKEEM_COMPOSER_DOCUMENTS_V1 = "1";
process.env.NEXT_PUBLIC_HAKEEM_COMPOSER_DOCUMENTS_V1 = "1";
t(isComposerDocumentsV1Enabled() && isDocumentsV1ClientEnabled(), "DOCUMENTS_V1 فقط");
t(isComposerAttachmentClientPersistEnabled(), "V1 عميل → persist مفعّل");
t(!isAttachmentsV2ClientEnabled(), "V2 عميل معطّل");
t(resolveComposerDocumentsMode() === "legacy_v1", "mode=legacy_v1");
clearFlags();

process.env.HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
process.env.NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
t(isAttachmentsV2ServerEnabled() && isAttachmentsV2ClientEnabled(), "ATTACHMENTS_V2 فقط");
t(isComposerAttachmentClientPersistEnabled(), "V2 وحده يكفي للـ persist (بلا V1)");
t(!isComposerDocumentsV1Enabled(), "V1 غير مطلوب");
t(resolveComposerDocumentsMode() === "attachments_v2", "mode=attachments_v2");
clearFlags();

process.env.HAKEEM_COMPOSER_DOCUMENTS_V1 = "1";
process.env.NEXT_PUBLIC_HAKEEM_COMPOSER_DOCUMENTS_V1 = "1";
process.env.HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
process.env.NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
t(resolveComposerDocumentsMode() === "mixed_v1_v2", "كلاهما → mixed");
t(isComposerDocumentsClientEnabled() === isComposerAttachmentClientPersistEnabled(), "alias deprecated");
clearFlags();

process.env.NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
// خادم معطّل
{
  const a = alignClientServerDocumentFlags();
  t(a.misaligned && a.reason === "CLIENT_V2_SERVER_LEGACY", "عميل V2 / خادم Legacy → misaligned");
  t(a.enforceV2 === false, "لا تُنفَّذ واجهة V2 خادميًا عند غياب العلم");
  t(a.clientMayPersist === true, "العميل قد يحاول الرفع لكنه سيفشل/legacy");
}
clearFlags();

process.env.HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
{
  const a = alignClientServerDocumentFlags({ clientClaimsV2: false });
  t(a.misaligned && a.reason === "SERVER_V2_CLIENT_LEGACY", "خادم V2 / عميل Legacy");
  t(a.enforceV2 === true, "الخادم يفرض V2 عند attachmentIds");
}
clearFlags();

process.env.HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
process.env.NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
{
  const a = alignClientServerDocumentFlags();
  t(!a.misaligned && a.enforceV2, "محاذاة V2");
}

console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
if (fail) process.exit(1);
