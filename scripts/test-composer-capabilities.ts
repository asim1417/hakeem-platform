/**
 * اختبارات Composer Capability Registry + استشهاد موحّد + JDS handoff.
 * تشغيل: npm run test:composer-capabilities
 */
import {
  COMPOSER_CAPABILITIES,
  capabilityRegistryStats,
  getCapability,
  isCapabilityEnabled,
  listCapabilitiesForMode,
  resolveComposerCapabilities,
} from "../lib/modules/hakeem-composer/capability-registry";
import {
  buildUnifiedCitationSet,
  formatAttachmentPageCitation,
  fromRetrievedSource,
  renderUnifiedCitationsMarkdown,
} from "../lib/modules/hakeem-composer/unified-citations";
import {
  isComposerJdsHandoffEnabled,
  suggestJdsHandoff,
  validateJdsServiceIds,
} from "../lib/modules/hakeem-composer/jds-handoff";
import { isComposerCaseContextEnabled } from "../lib/modules/hakeem-composer/case-context-bridge";
import { createAgentContext, executeTool } from "../lib/modules/hakeem-agent/tools";
import { DEFAULT_SOURCE_POLICY } from "../lib/modules/hakeem-composer/source-policy";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

async function main() {
  const stats = capabilityRegistryStats();
  t(stats.total >= 15, `سجل القدرات ≥ 15 (الآن ${stats.total})`);
  t(stats.allIndependent === true, "كل القدرات independent=true");
  t(Boolean(stats.byOwner.ask && stats.byOwner["legal-core"]), "أصحاب Ask + legal-core");
  t(Boolean(stats.byOwner["judicial-assistant"]), "المعاون مستقل في السجل");
  t(Boolean(getCapability("ask.legal_search")), "قدرة legal_search");
  t(Boolean(getCapability("jds.handoff")?.entry.kind === "redirect"), "JDS handoff = redirect لا دمج");

  const askCaps = listCapabilitiesForMode("ask");
  t(askCaps.some((c) => c.id === "ask.host"), "وضع ask يحلّ المضيف");

  const attached = resolveComposerCapabilities({
    mode: "ask",
    intentCategory: "document-review",
    sources: ["attached-only"],
    hasAttachment: true,
  });
  t(attached.toolNames.includes("read_attachment"), "attached-only → read_attachment");
  t(!attached.toolNames.includes("legal_search") || attached.capabilities.some((c) => c.id === "ask.read_attachment"), "تركيز المرفقات");

  // أعلام JDS handoff OFF افتراضيًا
  delete process.env.HAKEEM_COMPOSER_JDS_HANDOFF_V1;
  t(!isComposerJdsHandoffEnabled(), "JDS handoff معطّل افتراضيًا");
  t(suggestJdsHandoff({ intentCategory: "case-analysis" }) === null, "لا اقتراح بلا علم");

  process.env.HAKEEM_COMPOSER_JDS_HANDOFF_V1 = "1";
  const handoff = suggestJdsHandoff({ intentCategory: "case-analysis" });
  t(Boolean(handoff && handoff.autoExecute === false), "اقتراح تسليم بلا تنفيذ تلقائي");
  t(Boolean(handoff?.href.includes("/dashboard/judicial-assistant")), "رابط المعاون المستقل");
  t(validateJdsServiceIds(["JS-001", "JS-999"]).length === 1, "تحقق معرفات JS");

  delete process.env.HAKEEM_COMPOSER_CASE_CONTEXT_V1;
  t(!isComposerCaseContextEnabled(), "سياق القضية تدريجي OFF");

  // استشهاد موحّد
  const legal = fromRetrievedSource({
    sourceId: "art-1",
    systemName: "نظام العمل",
    articleNumber: 77,
    articleTitle: "إنهاء",
    snippet: "يجوز…",
    status: "ساري",
    internalUrl: "/legal/x",
    cite: 1,
  });
  t(legal.kind === "legal-article" && legal.label.includes("المادة (77)"), "استشهاد مادة موحّد");

  const page = formatAttachmentPageCitation({
    attachmentId: "att-1",
    fileName: "عقد.pdf",
    pageNumber: 2,
    cite: 2,
  });
  t(page.kind === "attachment-page" && page.label.includes("الصفحة (2)"), "استشهاد صفحة مرفق");

  const noPage = formatAttachmentPageCitation({
    attachmentId: "att-1",
    fileName: "عقد.pdf",
    pageNumber: null,
    textFallback: true,
  });
  t(noPage.kind === "attachment-document" && noPage.pageNumber === null, "بلا ادّعاء رقم صفحة");

  const set = buildUnifiedCitationSet({
    legal: [
      {
        sourceId: "a",
        systemName: "نظام",
        articleNumber: 1,
        articleTitle: "",
        snippet: "نص",
        status: null,
        internalUrl: "/",
        cite: 1,
      },
    ],
    attachmentReads: [
      { attachmentId: "x", fileName: "م.pdf", pageNumbers: [1, 2], textFallback: false, snippets: ["ص1", "ص2"] },
    ],
  });
  t(set.length === 3, "دمج قانوني + صفحات");
  t(renderUnifiedCitationsMarkdown(set).includes("### المراجع"), "Markdown مراجع");

  // read_attachment يعيد unifiedCitations
  process.env.HAKEEM_COMPOSER_ATTACHMENTS_V2 = "1";
  const ctx = createAgentContext("", DEFAULT_SOURCE_POLICY, [
    {
      id: "att_p",
      fileName: "م.pdf",
      text: "كامل",
      status: "READY",
      pages: [
        { pageNumber: 1, text: "صفحة أولى", status: "ready" },
        { pageNumber: 2, text: "صفحة ثانية", status: "ready" },
      ],
    },
  ]);
  const read = await executeTool(
    "read_attachment",
    { attachmentIds: ["att_p"], pageRange: { from: 1, to: 1 } },
    ctx
  );
  t(read.ok === true, "read_attachment");
  const uc = (read.data as { unifiedCitations?: unknown[] }).unifiedCitations;
  t(Array.isArray(uc) && uc.length >= 1, "unifiedCitations في نتيجة الأداة");

  // ظل JDS: القدرة لا تُفعَّل بلا أعلام
  delete process.env.JDS_DRAFTING_SHADOW;
  delete process.env.JDS_ENFORCE;
  const shadow = getCapability("jds.shadow_review")!;
  t(!isCapabilityEnabled(shadow), "ظل JDS OFF افتراضيًا في السجل");
  process.env.JDS_DRAFTING_SHADOW = "1";
  t(isCapabilityEnabled(shadow), "ظل JDS يُفعَّل تدريجيًا");

  t(Boolean(getCapability("jds.records")), "قدرة محاضر JDS (§18)");
  t(Boolean(getCapability("jds.objections")), "قدرة اعتراضات JDS (§20)");
  t(Boolean(getCapability("jds.statement_trace")), "قدرة تتبّع عبارات (§22)");
  t(Boolean(getCapability("jds.durable_agent")), "قدرة وكيل دائم (§25)");
  t(getCapability("jds.records")?.independent === true, "محرّكات JDS تبقى مستقلة");

  delete process.env.JDS_RECORD_V2;
  t(!isCapabilityEnabled(getCapability("jds.records")!), "محاضر JDS OFF افتراضيًا");
  process.env.JDS_RECORD_V2 = "1";
  t(isCapabilityEnabled(getCapability("jds.records")!), "محاضر JDS تدريجيًا");

  const draftHandoff = suggestJdsHandoff({ intentCategory: "legal-drafting", stage: "drafting" });
  t(
    Boolean(draftHandoff?.suggestedServiceIds.includes("JS-018")),
    "صياغة → اقتراح JS-018 دون تنفيذ"
  );

  console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
  if (fail) process.exit(1);
}

void main();
