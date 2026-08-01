/**
 * /api/ai/agent-search — الوكيل القانوني الشفّاف (المراحل ١+٣+٤+٥).
 *
 * التدفّق: بوّابة النيّة → التكييف الأصولي → التخريج (بحث النواة) → التحقّق (حارس التلفيق)
 *          → حارس الترابط (امتناع عند التناثر) → الصياغة المستندة. يبثّ كل خطوة (NDJSON).
 * وضعان: سريع (افتراضي) و«بحث تفصيلي» (detailed → deep). المصدر الوحيد: النواة القانونية.
 * خلف الدخول. للقراءة فقط. لا يلمس الأمن ولا المصادقة ولا نواة الترتيب.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { createConsultationDraft } from "@/lib/modules/ai/ai-gateway";
import { orchestrate, suggestMode } from "@/lib/modules/agents/orchestrator";
import { classifyIntent, intentNeedsSearch, isCaseHelpWithoutFacts } from "@/lib/modules/agents/intent-gate";
import { assessCaseIntake } from "@/lib/modules/agents/thinking/intake";
import { nativeAgentEnabled } from "@/lib/modules/hakeem-agent/flag";
import { runHakeemAgent } from "@/lib/modules/hakeem-agent/runtime";
import { loadRoomContext } from "@/lib/modules/hakeem-agent/session";
import { appendMessage } from "@/lib/modules/conversations/engine";
import { verifyCitations } from "@/lib/modules/agents/thinking/verifier";
import { buildScopeDisclosure } from "@/lib/modules/agents/thinking/disclosure";
import { getAgentMode } from "@/lib/modules/agents/modes";
import { synthesizeWithMode } from "@/lib/modules/agents/mode-synthesis";
import { gateAdvancedUse, settleAdvancedUse } from "@/lib/modules/billing/access-gate";
import { createJob, updateJob } from "@/lib/modules/jobs/job-store";
import { waitUntil } from "@vercel/functions";
import { enterAiUsageContext } from "@/lib/modules/billing/ai-usage-meter";
import { getUsageServiceCost } from "@/lib/modules/credits/usage-ledger";
import { auditEvent } from "@/lib/modules/audit/audit";
import {
  DEFAULT_SOURCE_POLICY,
  defaultServerCapabilities,
  describeSourcePolicy,
  isSourcePolicyV2Enabled,
  resolveEffectiveSourcePolicy,
  type SourcePolicy,
} from "@/lib/modules/hakeem-composer/source-policy";
import {
  isComposerDocumentsV1Enabled,
  resolveAskDocumentText,
} from "@/lib/modules/hakeem-composer/document-bridge";
import { loadOwnedAttachmentDocuments } from "@/lib/modules/attachments/complete-extraction";
import {
  isAttachmentsV2Enabled,
  syncAttachmentProcessing,
} from "@/lib/modules/attachments/document-processing-adapter";
import {
  classifyAttachmentIds,
  hasReadyAttachmentContent,
  resolveAttachedOnlyError,
  type OwnedAttachmentRow,
} from "@/lib/modules/attachments/attachment-classify";
import { ownsAttachment } from "@/lib/modules/auth/ownership";
import type { DocumentPageResult } from "@/lib/modules/attachments/extraction-provenance";
import {
  decideAgentSearchAttachmentsMode,
  readAttachmentsVersionClaim,
} from "@/lib/modules/hakeem-composer/attachments-version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// الدراسة الموسّعة (حلقة أدوات Claude متعدّدة الجولات) قد تطول — نمنحها حتى 300 ثانية كي
// تُكمل ولو غادر المستخدم الصفحة: التنفيذ يستمرّ ويُحفظ ناتجه في المهمّة (job) فيستأنفه
// العميل عند العودة عبر /api/jobs/{id}. بلا هذا الحدّ كان الطويل يُقتل قبل الحفظ.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return new Response(JSON.stringify({ type: "error", message: "يلزم تسجيل الدخول." }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  enterAiUsageContext({ userId: user.id, serviceKey: "ask" });

  let body: {
    query?: string;
    document?: string;
    attachmentIds?: unknown;
    detailed?: boolean;
    skipBreadth?: boolean;
    mode?: string;
    conversationId?: string;
    history?: Array<{ role?: string; content?: string }>;
    sources?: unknown;
    sourcePolicy?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    /* تجاهل */
  }
  // السؤال المكتوب منفصلٌ عن نصّ المستند المرفق — كي يُصنَّف المنطق على السؤال لا على المستند.
  const typed = String(body?.query ?? "").trim().slice(0, 16000);
  // حدّ المستند المرفق: 200000 حرفًا ليستوعب الوثيقة القانونية كاملةً (حكمٌ/عقدٌ طويل).
  // الوكيل لا يحقنه تلقائيًّا — يقرؤه Claude عبر read_attachment عند الحاجة فقط. الأضخم مساره منصّة الوثائق.
  let requestDoc = String(body?.document ?? "").trim().slice(0, 200_000);
  const versionClaim = readAttachmentsVersionClaim(request, body as Record<string, unknown>);
  const rawAttachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.map(String).filter(Boolean).slice(0, 10)
    : [];

  const searchMode = decideAgentSearchAttachmentsMode({
    clientClaimsV2: versionClaim.clientClaimsV2,
    hasAttachmentIds: rawAttachmentIds.length > 0,
  });
  if (searchMode.mode === "reject_v2_claim") {
    return new Response(
      JSON.stringify({
        type: "error",
        message: searchMode.message,
        code: searchMode.code,
        alignment: searchMode.alignment,
      }),
      { status: 409, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  const documentsEnabled = isComposerDocumentsV1Enabled() || isAttachmentsV2Enabled();
  const attachmentsV2 = searchMode.mode === "v2" || (isAttachmentsV2Enabled() && rawAttachmentIds.length > 0);

  // عند وجود attachmentIds في مسار V2: لا تثق بـ document المحلي (يمنع تجاوز NOT_READY)
  if (attachmentsV2 && rawAttachmentIds.length > 0) {
    requestDoc = "";
  }

  // مزامنة سريعة لمهام doc-node الجارية قبل القراءة (لا تنتظر OCR الطويل)
  if (attachmentsV2 && rawAttachmentIds.length) {
    for (const id of rawAttachmentIds) {
      await syncAttachmentProcessing({ attachmentId: id, user }).catch(() => undefined);
    }
  }

  let loadedAttachments: Array<{
    id: string;
    fileName: string;
    text: string;
    storageKey: string;
    status?: string;
    pages?: DocumentPageResult[];
    provenance?: string;
  }> = [];
  let attachmentBuckets = classifyAttachmentIds([], []);

  if (documentsEnabled && rawAttachmentIds.length) {
    loadedAttachments = await loadOwnedAttachmentDocuments({
      user,
      attachmentIds: rawAttachmentIds,
    }).catch(() => []);

    const rows = await prisma.attachment.findMany({
      where: { id: { in: rawAttachmentIds } },
      include: { caseFile: { select: { ownerId: true } } },
    });
    const ownedRows: OwnedAttachmentRow[] = [];
    for (const row of rows) {
      const owned = ownsAttachment(user, {
        caseId: row.caseId,
        caseOwnerId: row.caseFile?.ownerId ?? null,
        extractedText: row.extractedText,
        metadata: row.metadata,
      });
      const text = String(row.extractedText ?? "").trim();
      ownedRows.push({
        id: row.id,
        processingStatus: row.processingStatus,
        owned,
        hasText: Boolean(text),
      });
      if (!owned) continue;
      const existing = loadedAttachments.find((a) => a.id === row.id);
      const meta =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      const pages = Array.isArray(meta.pages) ? (meta.pages as DocumentPageResult[]) : undefined;
      if (existing) {
        existing.status = row.processingStatus;
        existing.pages = pages ?? existing.pages;
        existing.provenance =
          typeof meta.extractionProvenance === "string" ? meta.extractionProvenance : existing.provenance;
      } else {
        loadedAttachments.push({
          id: row.id,
          fileName: row.fileName,
          text,
          storageKey: row.storageKey,
          status: row.processingStatus,
          pages,
          provenance: typeof meta.extractionProvenance === "string" ? meta.extractionProvenance : undefined,
        });
      }
    }
    // المعرفات المطلوبة وغير الموجودة في DB → missing
    for (const id of rawAttachmentIds) {
      if (!ownedRows.some((r) => r.id === id)) {
        ownedRows.push({ id, processingStatus: "MISSING", owned: false, hasText: false });
      }
    }
    attachmentBuckets = classifyAttachmentIds(rawAttachmentIds, ownedRows);
  }

  const readyLoaded = loadedAttachments.filter(
    (a) =>
      a.text?.trim() &&
      (!a.status || ["READY", "PARTIAL"].includes(String(a.status)))
  );
  const hasAttachmentReference =
    attachmentBuckets.readyIds.length +
      attachmentBuckets.partialIds.length +
      attachmentBuckets.pendingIds.length +
      attachmentBuckets.failedIds.length +
      attachmentBuckets.quarantinedIds.length >
    0;
  const hasReadyAttachmentContentFlag = hasReadyAttachmentContent(attachmentBuckets);

  // نص المستند: أولوية المرفقات الجاهزة؛ عند ids خادمية V2 لا يُستخدم document العميل أبدًا
  const resolvedDoc = resolveAskDocumentText({
    requestDocument:
      attachmentsV2 && rawAttachmentIds.length > 0
        ? null
        : !attachmentsV2 || isComposerDocumentsV1Enabled()
          ? requestDoc
          : readyLoaded.length
            ? null
            : requestDoc,
    attachmentDocuments: readyLoaded.map((a) => ({ fileName: a.fileName, text: a.text })),
  });
  const attachedDoc = resolvedDoc.text;
  /** محتوى نصي جاهز أو مرجع مرفق مملوك (حتى لو قيد المعالجة) لسياسة attached-only */
  const hasDoc = attachedDoc.length > 0 || hasReadyAttachmentContentFlag;
  const hasAttachmentForPolicy = hasDoc || hasAttachmentReference;

  // سياسة المصادر: الخادم يبني effectivePolicy ولا يثق بـ boolean من العميل.
  const policyEnabled = isSourcePolicyV2Enabled();
  let sourcePolicy: SourcePolicy = DEFAULT_SOURCE_POLICY;
  let requestedPolicy: SourcePolicy | null = null;
  let requestedSources: string[] = [];
  let deniedSources: Array<{ source: string; reason: string }> = [];
  let policyReasons: string[] = [];
  let usedFallback = false;

  if (policyEnabled) {
    const resolved = resolveEffectiveSourcePolicy({
      requestedSources: body.sources,
      requestedPolicy: body.sourcePolicy,
      hasAttachment: hasAttachmentForPolicy,
      caseContext: null, // ربط القضايا في مرحلة لاحقة
      serverCapabilities: defaultServerCapabilities({
        hasAttachment: hasAttachmentForPolicy,
        caseOwned: false,
      }),
      failOnInvalidPolicy: true,
    });
    if (!resolved.ok) {
      return new Response(
        JSON.stringify({
          type: "error",
          message: resolved.message,
          code: "INVALID_SOURCE_POLICY",
          details: resolved.details,
        }),
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }
    requestedPolicy = resolved.requestedPolicy;
    requestedSources = resolved.requestedSources;
    sourcePolicy = resolved.effectivePolicy; // التنفيذ يعتمد على هذه فقط
    deniedSources = resolved.deniedSources.map((d) => ({ source: String(d.source), reason: d.reason }));
    policyReasons = resolved.reasons;
  }
  // مادّة التحليل: السؤال + المستند (إن وُجد). المستند لا يُصنَّف بوابة الاتّساع عليه.
  const query = hasDoc
    ? typed
      ? `${typed}\n\n[نصّ المستند المرفق]\n${attachedDoc}`
      : `حلّل المستند المرفق التالي وبيّن مركزه النظاميّ والمسائل التي يثيرها:\n\n${attachedDoc}`
    : typed;
  const detailed = Boolean(body?.detailed);
  const skipBreadth = Boolean(body?.skipBreadth);
  // الوضع: «اسأل» (افتراضيّ) بلا تغيير، أو وضعٌ بتعليمة إخراج خاصّة (حلّل قضية…).
  const agentMode = getAgentMode(body?.mode);
  // تاريخ المحادثة (للأوضاع الحوارية) — يُنقّى ويُقصَر لآخر ٨ رسائل.
  const history = Array.isArray(body?.history)
    ? body!.history!
        .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim())
        .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 4000) }))
        .slice(-8)
    : [];
  if (!query) {
    return new Response(JSON.stringify({ type: "error", message: "اكتب سؤالك أولاً." }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  if (
    policyEnabled &&
    !sourcePolicy.legalLibrary &&
    !sourcePolicy.regulations &&
    !sourcePolicy.judgments &&
    sourcePolicy.attachments
  ) {
    const attErr = resolveAttachedOnlyError(attachmentBuckets, {
      // لا تسمح لنص محلي بتجاوز NOT_READY عند وجود attachmentIds
      hasLegacyDocument:
        !(attachmentsV2 && rawAttachmentIds.length > 0) &&
        attachedDoc.length > 0 &&
        readyLoaded.length === 0,
    });
    // عند وجود نص legacy جاهز بدون ids نتخطى أخطاء المرفقات
    if (attErr && !(attachedDoc.length > 0 && rawAttachmentIds.length === 0)) {
      // إذا كان الخطأ REQUIRES فقط ولا ids — أو أخطاء ids
      if (
        attErr.code === "SOURCE_POLICY_REQUIRES_ATTACHMENT" ||
        rawAttachmentIds.length > 0 ||
        attachmentsV2
      ) {
        return new Response(
          JSON.stringify({
            type: "error",
            message: attErr.message,
            code: attErr.code,
            attachmentIds: attErr.attachmentIds,
            buckets: attachmentsV2
              ? {
                  missingIds: attachmentBuckets.missingIds,
                  forbiddenIds: attachmentBuckets.forbiddenIds,
                  pendingIds: attachmentBuckets.pendingIds,
                  failedIds: attachmentBuckets.failedIds,
                  quarantinedIds: attachmentBuckets.quarantinedIds,
                  partialIds: attachmentBuckets.partialIds,
                  readyIds: attachmentBuckets.readyIds,
                }
              : undefined,
            requestedPolicy,
            effectivePolicy: sourcePolicy,
            deniedSources,
          }),
          { status: attErr.status, headers: { "Content-Type": "application/json; charset=utf-8" } }
        );
      }
    }
  }

  // مهمّةٌ خلفيّة قابلةٌ للاستئناف (يُكمل الخادم البحث ويحفظ نتيجته حتى لو غادر العميل).
  const jobId = await createJob(user.id, "hakeem-ask", typed.slice(0, 120) || "تحليل مستند").catch(() => null);

  const encoder = new TextEncoder();

  // ── فصل التنفيذ عن الاتّصال (استمرار العمل في الخلفية) ──
  // العمل يُنتِج أحداثه في طابورٍ داخليّ، لا مباشرةً إلى controller الاتّصال. لو غادر المستخدم
  // (أغلق التبويب أو خفت المتصفّح على الجوّال) وانقطع البثّ، لا يتوقّف العمل: نُسجّله بـ waitUntil
  // فتُبقيه المنصّة حيًّا حتى ينتهي ويُحفظ ناتجه في المهمّة (job) + الغرفة، فيستأنفه العميل بالعودة.
  const queue: Uint8Array[] = [];
  let finished = false;
  let wake: (() => void) | null = null;
  const push = (u: Uint8Array) => {
    queue.push(u);
    if (wake) { const w = wake; wake = null; w(); }
  };
  const finish = () => {
    finished = true;
    if (wake) { const w = wake; wake = null; w(); }
  };
  const send = (obj: unknown) => {
    // «اسأل حكيم» يبثّ خطواتٍ ثمّ «result» واحدًا؛ نحفظ النتيجة كاملةً عند إرسالها — قبل أيّ
    // اعتبارٍ لحال الاتّصال، فيُحفظ الناتج ولو غادر العميل.
    const e = obj as { type?: string };
    if (jobId && e?.type === "result") void updateJob(jobId, { text: "", meta: { result: obj }, status: "done" });
    if (jobId && e?.type === "error") void updateJob(jobId, { status: "error" });
    try { push(encoder.encode(JSON.stringify(obj) + "\n")); } catch { /* تجاهل */ }
  };

  const work = (async () => {
    {
      if (jobId) send({ type: "job", jobId });
      // حصّة أولًا ثم نقاط: خصم الحصّة مرّة بعد النجاح؛ النقاط تُخصم عند البوابة إن لزم.
      let accessVia: "usage" | "quota" | "credits" | "open" = "quota";
      let accessReservationId: string | null = null;
      let consumed = false;
      const consume = () => {
        if (consumed) return;
        consumed = true;
        void (async () => {
          const actualMilliUnits =
            accessVia === "usage"
              ? (await getUsageServiceCost(
                  "ASK_HAKEEM",
                  Math.max(1_000, Math.ceil(query.length / 4) + 3_000)
                )) +
                (await getUsageServiceCost("HYBRID_SEARCH", 1)) +
                (await getUsageServiceCost("RERANK", 1))
              : undefined;
          await settleAdvancedUse(user.id, accessVia, {
            reservationId: accessReservationId,
            actualMilliUnits,
            referenceId: jobId ?? undefined,
          });
        })().catch(() => undefined);
      };
      try {
        const access = await gateAdvancedUse(user.id, {
          serviceCode: "ASK_HAKEEM",
          quantity: Math.max(1_000, Math.ceil(query.length / 4) + 3_000),
          idempotencyKey: `ask:${request.headers.get("idempotency-key") || jobId || crypto.randomUUID()}`,
          referenceId: jobId ?? undefined,
        });
        if (!access.allowed) {
          send({
            type: "result",
            answer: null,
            mode: "blocked",
            blocked: true,
            reason: "exhausted",
            basis: [],
            total: 0,
            message: access.message
          });
          send({ type: "done" });
          return;
        }
        accessVia = access.via;
        accessReservationId = access.reservationId ?? null;

        if (policyEnabled) {
          send({
            type: "step",
            id: "source-policy",
            status: "done",
            label: `نطاق المصادر: ${describeSourcePolicy(sourcePolicy).join(" · ") || "افتراضي"}`,
            data: {
              requestedPolicy,
              effectivePolicy: sourcePolicy,
              deniedSources,
              reasons: policyReasons,
              enforced: true,
              featureFlag: "HAKEEM_COMPOSER_SOURCE_POLICY_V2",
            },
          });
          void auditEvent({
            actorId: user.id,
            subject: "AI_GATEWAY",
            action: "AGENT_SEARCH_SOURCE_POLICY",
            entityId: jobId ?? undefined,
            metadata: {
              requestedSources: requestedSources.slice(0, 20),
              requestedPolicy,
              effectivePolicy: sourcePolicy,
              deniedSources,
              reasons: policyReasons,
              featureFlagEnabled: true,
              usedFallback: false,
              mode: agentMode.id,
              hasDocument: hasDoc,
              queryPreview: typed.slice(0, 80),
              documentsV1: documentsEnabled || undefined,
              attachmentIds: loadedAttachments.map((a) => a.id).slice(0, 10),
              documentSource: resolvedDoc.source,
            },
          }).catch(() => undefined);
        }

        if (documentsEnabled && (rawAttachmentIds.length > 0 || resolvedDoc.source !== "none")) {
          send({
            type: "step",
            id: "documents",
            status: "done",
            label:
              resolvedDoc.source === "attachments"
                ? `مرفقات المنصة: ${loadedAttachments.length.toLocaleString("ar-SA")}`
                : resolvedDoc.source === "request"
                  ? "مستند الطلب (مسار توافق)"
                  : "بلا مستند",
            data: {
              enforced: true,
              featureFlag: "HAKEEM_COMPOSER_DOCUMENTS_V1",
              source: resolvedDoc.source,
              attachmentIds: loadedAttachments.map((a) => a.id),
              requestedAttachmentIds: rawAttachmentIds,
              textLength: attachedDoc.length,
            },
          });
        }

        // بوّابة النيّة قبل الوكيل الأصيل — تُصلح خلل «تحية/سؤال ناقص → مواد عشوائية من النواة».
        // التحية/الشكر/التعريف/خارج النطاق لا تستدعي بحثًا أبدًا؛ والغامض في أوّل الحوار (بلا تاريخ)
        // كذلك. نردّ مباشرةً بلا أساسٍ نظاميّ ودون تشغيل حلقة الأدوات (أسرع + بلا استرجاعٍ لا صلة له).
        // لا نحجب سؤالًا قانونيًّا: أيّ إشارةٍ قانونية تُصنَّف legal_question فتمرّ للوكيل كالمعتاد.
        if (agentMode.id === "ask" && !hasDoc) {
          const gate = classifyIntent(typed);
          const alwaysReplyDirect =
            gate.type === "greeting" || gate.type === "thanks" || gate.type === "meta" || gate.type === "non_legal";
          const ambiguousFirstTurn = gate.type === "ambiguous" && history.length === 0;
          if (!intentNeedsSearch(gate.type) && gate.reply && (alwaysReplyDirect || ambiguousFirstTurn)) {
            send({ type: "result", answer: gate.reply, mode: "intent", basis: [], total: 0, intent: gate.type });
            send({ type: "done" });
            return;
          }
        }

        // ── الوكيل الأصيل (HKM-CLAUDE-NATIVE-001، خلف علم CLAUDE_NATIVE_AGENT_ENABLED) ──
        // في وضع «اسأل» فقط: Claude يستقبل الرسالة ويدير الحوار بحلقة أدوات حقيقية — يقرّر
        // بنفسه ردًّا مباشرًا أو استيضاحًا أو دراسةً موسّعة (بحث/قراءة مصادر). لا يصنّف الكود
        // النيّة ولا يفرض أداة. سقوطٌ آمن للمسار القياسيّ عند تعطّل المزوّد أو أيّ خطأ.
        if (nativeAgentEnabled() && agentMode.id === "ask") {
          // «الغرفة»: إن وُجدت جلسةٌ قائمة نحمّل حوارها كاملًا من المحرّك الدائم فيرى الوكيل
          // السياق من أوّل المحادثة (لا آخر ٨ أدوار). سقوطٌ آمن لتاريخ العميل عند التعذّر.
          let roomHistory = history;
          let roomSummary: string | undefined;
          const convId = typeof body?.conversationId === "string" ? body.conversationId : null;
          if (convId) {
            const room = await loadRoomContext({ userId: user.id, conversationId: convId }).catch(() => null);
            if (room) {
              roomHistory = room.history;
              roomSummary = room.summary ?? undefined;
            }
          }
          // زرّ «دراسة موسّعة» (detailed) = تلميحٌ صريحٌ للوكيل بتفضيل الدراسة العميقة؛ Claude يبقى
          // هو من يقرّر، لكن يُعلَم برغبة المستخدم. لا يُحفظ التلميح في الغرفة (نحفظ نصّ المستخدم فقط).
          const agentQuery = detailed ? `${typed}\n\n(يطلب المستخدم دراسةً موسّعة مفصّلة قدر ما تسمح به الوقائع.)` : typed;
          const agent = await runHakeemAgent({
            query: agentQuery,
            document: attachedDoc,
            attachments: readyLoaded.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              text: a.text,
              status: a.status,
              pages: a.pages,
              provenance: a.provenance,
            })),
            history: roomHistory,
            summary: roomSummary,
            sourcePolicy: policyEnabled ? sourcePolicy : undefined,
            onStep: (s) => send({ type: "step", ...s }),
          }).catch((e) => ({
            ok: false as const,
            answer: "",
            basis: [],
            toolTurns: 0,
            error: e instanceof Error ? e.message : "خطأ",
            deniedTools: [] as Array<{ tool: string; reason: string }>,
            invokedTools: [] as string[],
            sourcePolicy,
          }));
          if (agent.ok) {
            consume();
            // حفظٌ خادميّ للدور في «الغرفة» (سجلّ المحادثة الدائم) — فيبقى الردّ محفوظًا
            // حتى لو غادر المستخدم ولم يعُد أبدًا (أُغلق التبويب مثلًا). العميل لا يحفظ هذا
            // الدور ثانيةً (يتخطّاه عند mode=native-agent) فلا ازدواج. أفضل-جهد.
            let roomConvId = convId;
            try {
              const attachRefs = attachedDoc
                ? loadedAttachments.length
                  ? loadedAttachments.map((a) => ({
                      id: a.id,
                      fileName: a.fileName,
                      extractedText: a.text.slice(0, 2_000),
                      storageKey: a.storageKey,
                      processingStatus: "ready" as const,
                    }))
                  : [
                      {
                        id: `att-${jobId ?? "x"}`,
                        fileName: "المرفق",
                        extractedText: attachedDoc.slice(0, 200_000),
                        processingStatus: "inline" as const,
                      },
                    ]
                : undefined;
              const u = await appendMessage({
                userId: user.id,
                serviceKey: "ask",
                conversationId: convId,
                role: "user",
                content: typed,
                mode: "ask",
                attachments: attachRefs,
                inputSnapshot: policyEnabled
                  ? {
                      detailed,
                      mode: "ask",
                      sources: body.sources ?? null,
                      requestedPolicy,
                      effectivePolicy: sourcePolicy,
                    }
                  : undefined,
              });
              roomConvId = u.conversationId;
              await appendMessage({
                userId: user.id,
                serviceKey: "ask",
                conversationId: roomConvId,
                role: "assistant",
                content: agent.answer,
                mode: "ask",
                model: "hakeem-agent",
                retrievedSources: agent.basis.map((b) => ({ kind: "article" as const, systemName: b.systemName, articleNumber: b.articleNumber, title: b.articleTitle, quote: b.quote, url: b.internalUrl })),
                outputSnapshot: {
                  answerMode: "native-agent",
                  total: agent.basis.length,
                  requestedPolicy: policyEnabled ? requestedPolicy : undefined,
                  effectivePolicy: policyEnabled ? sourcePolicy : undefined,
                  deniedSources: policyEnabled ? deniedSources : undefined,
                  invokedTools: agent.invokedTools ?? [],
                  deniedTools: agent.deniedTools ?? [],
                  usedFallback: false,
                },
              });
            } catch {
              /* أفضل-جهد: إن تعذّر الحفظ (سكيمة/شبكة) يبقى الناتج في المهمّة (job) */
            }
            if (policyEnabled) {
              void auditEvent({
                actorId: user.id,
                subject: "AI_GATEWAY",
                action: "AGENT_SEARCH_SOURCES_USED",
                entityId: roomConvId ?? jobId ?? undefined,
                metadata: {
                  requestedPolicy,
                  effectivePolicy: sourcePolicy,
                  deniedSources,
                  invokedTools: agent.invokedTools ?? [],
                  deniedTools: agent.deniedTools ?? [],
                  basisCount: agent.basis.length,
                  usedFallback: false,
                  featureFlagEnabled: true,
                },
              }).catch(() => undefined);
            }
            send({
              type: "result",
              answer: agent.answer,
              mode: "native-agent",
              basis: agent.basis,
              total: agent.basis.length,
              conversationId: roomConvId ?? undefined,
              requestedPolicy: policyEnabled ? requestedPolicy : undefined,
              effectivePolicy: policyEnabled ? sourcePolicy : undefined,
              deniedSources: policyEnabled ? deniedSources : undefined,
              invokedTools: agent.invokedTools ?? [],
              deniedTools: agent.deniedTools ?? [],
            });
            send({ type: "done" });
            return;
          }
          usedFallback = true;
          send({
            type: "step",
            id: "native-fallback",
            status: "done",
            label: "تعذّر الوكيل الأصيل — متابعةٌ بالمسار القياسيّ",
            data: {
              error: agent.error,
              usedFallback: true,
              effectivePolicy: policyEnabled ? sourcePolicy : undefined,
            },
          });
        }

        // ①→③ المنسّق: بوّابة النيّة + التكييف + التخريج، ويبثّ خطواته حيًّا.
        // يستقبل effectivePolicy فقط — لا يُمرَّر body.sourcePolicy الخام.
        // المستوى: وضع «اسأل» — مبدّل «بحث تفصيلي» يفرض العميق وإلا يُقترَح تلقائيًّا. أوضاع الإخراج
        // الأخرى (حلّل قضية…) تشغّل الوكيل مرّة واحدة (quick) وتتخطّى الاتّساع، ثم تُصاغ بتعليمة الوضع.
        // أوضاع التحليل (حلّل قضية · خطة عمل · تقدير حكم) تستحقّ استرجاعًا عميقًا (٧ جولات +
        // مسحة + تعميق بالمظانّ + سوابق + تحقّق)، لكن مع تخطّي التحليل العامّ (skipAnalysis)
        // كي تُصاغ بتعليمة الوضع نفسها على هذا الأساس الأغنى بدل أن يعترضها التحليل العامّ.
        const deepModes = new Set(["analyze-case", "action-plan", "verdict-estimate"]);
        const isDeepMode = deepModes.has(agentMode.id);

        // «المستقبِل الأوّل» (Claude): يستقبل طلبَ المساعدة بقضيةٍ بلا وقائع **قبل** التفكيك
        // والدراسة الموسّعة، فيقيّم الكفاية. إن نقص عنصرٌ جوهريّ استوضحه بأسئلةٍ مُوجّهة؛ وإن
        // كفت وحّد الوقائع وأذِن بالدراسة على هذا الأساس الأغنى. سقوطٌ آمن: إن كان Claude غير
        // مفعّل يتولّى المنسّق (بوّابة النيّة) الاستيضاح الحتميّ الثابت بلا انقطاع.
        let studyQuery = query;
        if (agentMode.id === "ask" && !hasDoc && isCaseHelpWithoutFacts(typed)) {
          send({ type: "step", id: "intake", status: "running", label: "المستقبِل الأوّل: أقيّم كفاية معلومات القضية" });
          const intake = await assessCaseIntake({ query: typed, history }).catch(() => ({ ok: false, ready: false, message: "", consolidatedFacts: undefined }));
          if (intake.ok && !intake.ready) {
            send({ type: "step", id: "intake", status: "done", label: "أحتاج تفاصيلَ قبل بدء الدراسة الموسّعة" });
            send({ type: "result", answer: intake.message, mode: "intake", basis: [], total: 0 });
            send({ type: "done" });
            return;
          }
          if (intake.ok && intake.ready && intake.consolidatedFacts) {
            send({ type: "step", id: "intake", status: "done", label: "المعلومات كافية — أبدأ الدراسة الموسّعة" });
            studyQuery = intake.consolidatedFacts;
          }
          // intake.ok=false (المزوّد غير مفعّل) → نُكمل بـ studyQuery=query فيتولّى المنسّق الاستيضاح الحتميّ.
        }

        const mode = agentMode.id === "ask" ? (detailed || hasDoc ? "deep" : suggestMode(studyQuery)) : isDeepMode ? "deep" : "quick";
        // مع مستندٍ مرفَق: نتخطّى بوّابة الاتّساع دائمًا — المستخدم يريد تحليل مستنده لا قائمة استيضاح.
        const modeSkipBreadth = hasDoc ? true : agentMode.id === "ask" ? skipBreadth : true;
        const result = await orchestrate(studyQuery, {
          mode,
          skipBreadth: modeSkipBreadth,
          skipAnalysis: isDeepMode,
          sourcePolicy: policyEnabled ? sourcePolicy : undefined,
          onStep: (s) => send({ type: "step", ...s }),
        });

        // نيّة غير قانونية (تحية/شكر/تعريف/خارج النطاق) → ردّ مباشر بلا بحث.
        if (!intentNeedsSearch(result.intent)) {
          send({ type: "result", answer: result.reply ?? null, mode: "intent", basis: [], total: 0, intent: result.intent });
          send({ type: "done" });
          return;
        }

        // حظر استرجاع بالمكتبة وفق effectivePolicy (مثل مرفقات فقط أو سقوط من الوكيل الأصيل)
        if (
          policyEnabled &&
          result.reply &&
          !result.articles.length &&
          !result.analysis &&
          !result.clarify &&
          !(result.enumGroups && result.enumGroups.length)
        ) {
          if (policyEnabled) {
            void auditEvent({
              actorId: user.id,
              subject: "AI_GATEWAY",
              action: "AGENT_SEARCH_SOURCES_USED",
              entityId: jobId ?? undefined,
              metadata: {
                requestedSources: requestedSources.slice(0, 20),
                requestedPolicy,
                effectivePolicy: sourcePolicy,
                deniedSources,
                reasons: policyReasons,
                deniedTools: [],
                invokedTools: [],
                usedFallback,
                featureFlagEnabled: true,
                retrievalBlockedByPolicy: true,
              },
            }).catch(() => undefined);
          }
          send({
            type: "result",
            answer: result.reply,
            mode: usedFallback ? "source-policy-fallback" : "source-policy",
            basis: [],
            total: 0,
            requestedPolicy,
            effectivePolicy: sourcePolicy,
            deniedSources,
            enforced: true,
            usedFallback,
          });
          send({ type: "done" });
          return;
        }

        // بوّابة الاتّساع: سؤال واسع → استيضاح بخيارات (لا بحث فوريّ). المستخدم يختار فيُعاد الإرسال.
        if (result.clarify) {
          send({ type: "clarify", message: result.clarify.message, dimension: result.clarify.dimension, options: result.clarify.options });
          send({ type: "done" });
          return;
        }

        // الاستقصاء الشامل: مجموعات لكل نظام تُعرَض بالتدرّج (دفعات + «عرض المزيد»).
        if (result.enumGroups && result.enumGroups.length) {
          consume();
          send({
            type: "result",
            mode: "live",
            answer: "## حصر المدد عبر الأنظمة",
            groups: result.enumGroups,
            total: result.enumGroups.reduce((s, g) => s + g.count, 0),
            basis: [],
            disclosure: buildScopeDisclosure({ systems: result.scannedSystems ?? [], dimension: "المدد", complete: false })
          });
          send({ type: "done" });
          return;
        }

        // إجابة جاهزة من المنسّق (تحليل متعمّق أو حصر كامل للنظام) → تُقدَّم مباشرةً.
        // المواد مُخرَّجة من النواة (قائمة فعلاً)؛ الحصر الاستقرائي حتميّ من نصوص المواد.
        if (result.analysis) {
          // المرحلة ٥: لوحة الأساس تُبنى من المواد **المُتحقَّقة بترتيبها المُغذّى للتحليل** كي
          // يطابق ذيل [n] في النصّ ترتيب المصدر في اللوحة؛ سقوط إلى المواد المُخرَّجة إن غابت.
          const basis = (result.verified?.length
            ? result.verified.map((c) => ({
                systemName: c.systemName ?? "",
                articleNumber: c.articleNumber ?? 0,
                articleTitle: undefined as string | undefined,
                quote: c.quote,
                state: "official" as const,
                enforcement: c.status ?? null,
                internalUrl: c.articleId ? `/dashboard/legal-core/articles/${c.articleId}` : undefined
              }))
            : result.articles.slice(0, 40).map((a) => ({
                systemName: a.systemName,
                articleNumber: a.articleNumber,
                articleTitle: a.articleTitle,
                quote: a.snippet,
                state: "official" as const,
                enforcement: a.status ?? null,
                internalUrl: a.internalUrl
              })));
          consume();
          if (policyEnabled) {
            void auditEvent({
              actorId: user.id,
              subject: "AI_GATEWAY",
              action: "AGENT_SEARCH_SOURCES_USED",
              entityId: jobId ?? undefined,
              metadata: {
                requestedSources: requestedSources.slice(0, 20),
                requestedPolicy,
                effectivePolicy: sourcePolicy,
                deniedSources,
                reasons: policyReasons,
                usedFallback,
                featureFlagEnabled: true,
                basisCount: basis.length,
              },
            }).catch(() => undefined);
          }
          send({
            type: "result",
            answer: result.analysis,
            mode: "live",
            basis,
            total: result.articles.length,
            issues: result.issues.map((i) => i.issue),
            coverage: result.coverage ? { answered: result.coverage.answered, total: result.coverage.issues.length, issues: result.coverage.issues } : undefined,
            requestedPolicy: policyEnabled ? requestedPolicy : undefined,
            effectivePolicy: policyEnabled ? sourcePolicy : undefined,
            deniedSources: policyEnabled ? deniedSources : undefined,
            enforced: policyEnabled || undefined,
            usedFallback: usedFallback || undefined,
          });
          send({ type: "done" });
          return;
        }

        // ④ التحقّق (حارس التلفيق): كل مادة مُخرَّجة تُتحقَّق فعلاً في النواة؛ المُختلَق يُحجَب.
        send({ type: "step", id: "verify", status: "running", label: "أتحقّق من ورود المواد فعلاً" });
        const outcome = await verifyCitations(
          result.articles.map((a) => ({ articleId: a.articleId, systemName: a.systemName, articleNumber: Number(a.articleNumber), quote: a.snippet }))
        );
        send({
          type: "step",
          id: "verify",
          status: "done",
          label: "تحقّقت من ورود المواد في النواة",
          data: { verified: outcome.verified.length, blocked: outcome.blocked.length }
        });

        // ⑤ حارس الترابط: لا سند مُتحقَّق → امتناع صادق (لا تلفيق، لا ملء فراغ).
        if (!outcome.verified.length) {
          send({
            type: "result",
            answer: null,
            mode: "offline",
            basis: [],
            total: 0,
            message: "لا يوجد سند نظامي كافٍ مطابق في النواة القانونية الحالية. جرّب إعادة صياغة سؤالك."
          });
          send({ type: "done" });
          return;
        }

        // ⑥ الصياغة المستندة (حصرًا من مواد النواة، بحارس داخلي ضدّ أرقام غير موجودة).
        // وضعُ إخراجٍ غير «اسأل» → يُصاغ بتعليمة الوضع من **المواد المُتحقَّقة نفسها** (استدعاء وكيل
        // واحد، بلا إعادة استرجاع). سقوط آمن لعرض المواد الخام عند تعذّر الصياغة/رصد تلفيق.
        if (agentMode.systemPrompt) {
          send({ type: "step", id: "synthesize", status: "running", label: `أصوغ بوضع «${agentMode.name}» مستندًا للمواد` });
          const modeBasis = outcome.verified.map((c) => ({
            systemName: c.systemName ?? "",
            articleNumber: c.articleNumber ?? 0,
            articleTitle: undefined as string | undefined,
            quote: c.quote,
            state: "official" as const,
            enforcement: c.status ?? null,
            internalUrl: c.articleId ? `/dashboard/legal-core/articles/${c.articleId}` : undefined
          }));
          const synth = await synthesizeWithMode({
            query: studyQuery,
            systemPrompt: agentMode.systemPrompt,
            citations: outcome.verified.map((c) => ({ articleId: c.articleId, systemName: c.systemName, articleNumber: c.articleNumber, quote: c.quote })),
            history: agentMode.conversational ? history : undefined,
            // أوضاع التحليل العميقة: نمرّر السوابق القضائية المُسترجَعة (سياقًا) ونرفع سقف الرموز
            // لتفادي قصّ المخرَجات ذات العناوين السبعة/الثمانية.
            supporting: isDeepMode
              ? {
                  rulings: (result.rulings ?? []).map((r) => ({ title: r.title, snippet: r.snippet })),
                  principles: (result.principles ?? []).map((p) => ({ title: p.title, snippet: p.snippet }))
                }
              : undefined,
            maxTokens: isDeepMode ? 2600 : undefined
          }).catch(() => null);
          if (!synth) {
            send({ type: "step", id: "synthesize", status: "done", label: "تعذّرت الصياغة المستندة؛ إليك المواد المُتحقَّقة", data: { blocked: true } });
            send({ type: "result", answer: null, mode: "offline", basis: modeBasis, total: result.articles.length, message: modeBasis.length ? "تعذّرت الصياغة المستندة؛ إليك المواد المُتحقَّقة من النواة." : undefined });
            send({ type: "done" });
            return;
          }
          send({ type: "step", id: "synthesize", status: "done", label: `صغت بوضع «${agentMode.name}» مستندًا للمواد`, data: { mode: synth.mode, citations: modeBasis.length } });
          send({ type: "step", id: "guard", status: "done", label: "فحصت المخرَج ضد التلفيق", data: { sourceOfTruth: "legal_core.legal_articles" } });

          // وضع «استشارة»: يُحفَظ سجلّ الاستشارة (كصفحة الاستشارات) — سقوط آمن لا يكسر الردّ.
          if (agentMode.id === "consultation") {
            const consultCitations = outcome.verified
              .filter((c): c is typeof c & { articleId: string; articleNumber: number } => Boolean(c.articleId) && typeof c.articleNumber === "number")
              .map((c) => ({ articleId: c.articleId, lawName: c.systemName ?? "", articleNumber: c.articleNumber, quote: c.quote ?? "" }));
            await prisma.consultation
              .create({
                data: {
                  userId: user.id,
                  facts: studyQuery,
                  output: synth.output,
                  status: "GENERATED",
                  qualityReport: { sourceOfTruth: "legal_core.legal_articles", mode: "consultation", agent: true, citations: consultCitations.length },
                  citations: { create: consultCitations }
                }
              })
              .catch(() => undefined);
          }

          consume();
          // السوابق القضائية التي استُؤنِس بها في الصياغة — تُعرَض للمستخدم (شفافية)، لا في الصياغة فقط.
          const precedents = isDeepMode
            ? {
                rulings: (result.rulings ?? []).slice(0, 6).map((r) => ({ title: r.title, snippet: r.snippet })),
                principles: (result.principles ?? []).slice(0, 6).map((p) => ({ title: p.title, snippet: p.snippet }))
              }
            : undefined;
          send({ type: "result", answer: synth.output, mode: synth.mode, basis: modeBasis, total: result.articles.length, issues: result.issues.map((i) => i.issue), precedents });
          send({ type: "done" });
          return;
        }

        send({ type: "step", id: "synthesize", status: "running", label: "أصوغ إجابة مستندة للمواد فقط" });
        const draft = await createConsultationDraft({ facts: studyQuery, actorId: user.id }).catch(() => null);

        if (!draft || draft.blocked) {
          const rawBasis = result.articles.map((a) => ({
            systemName: a.systemName,
            articleNumber: a.articleNumber,
            articleTitle: a.articleTitle,
            quote: a.snippet,
            state: "official" as const,
            enforcement: a.status ?? null,
            internalUrl: a.internalUrl
          }));
          send({ type: "step", id: "synthesize", status: "done", label: "لا يوجد سند نظامي كافٍ للصياغة", data: { blocked: true } });
          send({
            type: "result",
            answer: null,
            mode: draft?.mode ?? "offline",
            basis: rawBasis,
            total: result.articles.length,
            message: rawBasis.length ? "تعذّرت الصياغة المستندة؛ إليك المواد المُتحقَّقة من النواة." : undefined
          });
          send({ type: "done" });
          return;
        }

        send({ type: "step", id: "synthesize", status: "done", label: "صغت الإجابة مستندة للمواد الموثّقة", data: { mode: draft.mode, citations: draft.citations.length } });
        send({ type: "step", id: "guard", status: "done", label: "فحصت المخرَج ضد التلفيق", data: { sourceOfTruth: "legal_core.legal_articles" } });

        const basis = draft.citations.map((c) => ({
          systemName: c.lawName,
          articleNumber: c.articleNumber,
          articleTitle: undefined as string | undefined,
          quote: c.quote,
          state: "official" as const,
          internalUrl: `/dashboard/legal-core/articles/${c.articleId}`
        }));

        consume();
        send({
          type: "result",
          answer: draft.output,
          mode: draft.mode,
          basis,
          total: result.articles.length,
          issues: result.issues.map((i) => i.issue)
        });
        send({ type: "done" });
      } catch (error) {
        console.error("[agent-search] Error:", error);
        send({ type: "error", message: "تعذّر تنفيذ البحث الوكيلي حاليًا." });
      } finally {
        finish();
      }
    }
  })();

  // نُبقي العمل حيًّا بعد انقطاع الاتّصال حتى يكتمل ويُحفَظ ناتجه. غير متاحٍ محليًّا → لا يضرّ:
  // العمل (IIFE) يجري أصلًا؛ waitUntil يمنع المنصّة من قتله مبكّرًا فقط.
  try { waitUntil(work); } catch { /* بيئةٌ لا تدعمه — العمل مستمرّ على أيّ حال */ }

  // البثّ يستنزف الطابور: يوقظه العمل عند كلّ حدث، ويُغلق حين ينتهي العمل ويفرغ الطابور.
  // إن انقطع (غادر العميل) يبقى العمل يعمل عبر waitUntil؛ الطابور يُهمَل ويُجمَع تلقائيًّا.
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!queue.length && !finished) {
        await new Promise<void>((resolve) => { wake = resolve; });
      }
      while (queue.length) controller.enqueue(queue.shift()!);
      if (finished && !queue.length) {
        try { controller.close(); } catch { /* أُغلق مسبقًا */ }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
}
