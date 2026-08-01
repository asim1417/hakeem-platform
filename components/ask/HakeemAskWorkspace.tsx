"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  MessagesSquare,
  RotateCcw,
  Scale,
  Sparkles,
  Telescope,
} from "lucide-react";
import { extractFile } from "@/lib/modules/doc-tool/extract";
import { isBrokenExtraction } from "@/lib/modules/document-inspection/reshape";
import { LegalBasisPanel, type LegalBasisItem } from "@/components/legal/LegalBasisPanel";
import { AnswerRenderer } from "@/components/AnswerRenderer";
import { AnswerToolbar } from "@/components/AnswerToolbar";
import { useWakeLock } from "@/components/hooks/useWakeLock";
import { getAgentMode, type AgentModeId } from "@/lib/modules/agents/modes";
import {
  ASK_FIRST_SUGGESTIONS,
  ASK_TO_CASE_HANDOFF_KEY,
  HOME_ASK_PENDING_RUN_KEY,
} from "@/lib/modules/config/ask-first-home";
import {
  HAKEEM_ASK_MAX_CHARS,
  HOME_ASK_DRAFT_KEY,
  HOME_ASK_HANDOFF_KEY,
} from "@/lib/modules/config/home-inline-ask";
import { signInWithNext } from "@/lib/modules/auth/safe-next";
import {
  getAskSession,
  persistAskTurn,
  type AskSessionContext,
} from "@/components/ask/ask-session-api";
import { HakeemComposer } from "@/components/hakeem-composer";
import {
  COMPOSER_MAX_ATTACHMENTS,
  COMPOSER_MAX_DOC_CHARS,
  DEFAULT_SOURCES,
  buildSourceHint,
  composeAgentQuery,
  resolveEffectiveMode,
} from "@/lib/modules/hakeem-composer/constants";
import { composerSourcesToPolicy } from "@/lib/modules/hakeem-composer/source-policy";
import { routeComposerIntent } from "@/lib/modules/hakeem-composer/intent-router";
import {
  isComposerAttachmentClientPersistEnabled,
  isAttachmentsV2ClientEnabled,
  toMessageAttachmentRef,
} from "@/lib/modules/hakeem-composer/document-bridge";
import { persistAskAttachmentToServer } from "@/lib/modules/hakeem-composer/persist-ask-attachment";
import {
  canStartAskWithAttachments,
  deriveComposerAttachmentStatus,
  planAskAttachmentSend,
} from "@/lib/modules/hakeem-composer/attachment-send-policy";
import { ATTACHMENTS_VERSION_HEADER } from "@/lib/modules/hakeem-composer/attachments-version";
import type {
  ComposerAttachment,
  ComposerContextItem,
  ComposerModeId,
  ComposerSourceId,
} from "@/lib/modules/hakeem-composer/types";

type Precedents = {
  rulings: Array<{ title: string; snippet?: string }>;
  principles: Array<{ title: string; snippet?: string }>;
};

type StepStatus = "running" | "done";
type Step = { id: string; status: StepStatus; label: string; data?: unknown };

type Turn = {
  question: string;
  steps: Step[];
  answer: string | null;
  mode?: "live" | "offline" | "intent" | "blocked" | "native-agent";
  basis: LegalBasisItem[] | null;
  total: number;
  coverage?: { answered: number; total: number; issues?: Array<{ systemName?: string; status: string }> };
  clarify?: {
    message: string;
    dimension?: string;
    options: Array<{ id: string; label: string; query: string; exhaustive?: boolean; hint?: string }>;
  };
  groups?: Array<{ systemName: string; count: number; table: string }>;
  disclosure?: string;
  visibleGroups?: number;
  message?: string;
  error?: string;
  authRequired?: boolean;
  precedents?: Precedents;
  streaming: boolean;
  showMethod: boolean;
  /** معرّف المهمّة الخلفيّة لهذا الدور — للاستئناف من /api/jobs/{id} بعد انقطاع الاتّصال. */
  jobId?: string;
  /** الدور يُكمل في الخلفية (غادر المستخدم الصفحة) — نعرض إشعارًا هادئًا لا خطأً. */
  background?: boolean;
};

export type HakeemAskWorkspaceProps = {
  userName?: string;
  initialQuery?: string;
  initialMode?: string;
  /** home = واجهة المنصة في /dashboard (ومسار التوافق /dashboard/ask عند ASK_FIRST) */
  variant?: "home" | "page";
  /** جلسة دائمة لاستعادتها — من /dashboard/ask/c/[id] */
  conversationId?: string | null;
  /** يُستدعى عند إنشاء/تغيير معرّف الجلسة بعد الحفظ */
  onConversationIdChange?: (conversationId: string | null) => void;
};

function basisFromSources(sources: unknown): LegalBasisItem[] | null {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  return sources.map((raw) => {
    const s = raw as {
      systemName?: string;
      articleNumber?: string | number;
      title?: string;
      quote?: string;
      url?: string;
    };
    return {
      systemName: s.systemName || "مصدر",
      articleNumber: s.articleNumber,
      articleTitle: s.title,
      quote: s.quote,
      state: "auto" as const,
      internalUrl: s.url,
    };
  });
}

function turnsFromContext(ctx: AskSessionContext): {
  turns: Turn[];
  modeId: AgentModeId;
  detailed: boolean;
} {
  const turns: Turn[] = [];
  const msgs = [...ctx.messages].sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== "user") continue;
    const next = msgs[i + 1];
    const assistant = next && next.role === "assistant" ? next : null;
    const snap =
      assistant?.outputSnapshot && typeof assistant.outputSnapshot === "object"
        ? (assistant.outputSnapshot as Record<string, unknown>)
        : {};
    turns.push({
      question: m.content,
      steps: [],
      answer: assistant?.content ?? null,
      mode: (typeof snap.answerMode === "string" ? snap.answerMode : snap.mode) as Turn["mode"],
      basis: basisFromSources(assistant?.retrievedSources),
      total: typeof snap.total === "number" ? snap.total : 0,
      coverage: snap.coverage as Turn["coverage"],
      groups: Array.isArray(snap.groups) ? (snap.groups as Turn["groups"]) : undefined,
      disclosure: typeof snap.disclosure === "string" ? snap.disclosure : undefined,
      message: typeof snap.message === "string" ? snap.message : undefined,
      precedents: snap.precedents as Turn["precedents"],
      streaming: false,
      showMethod: false,
    });
    if (assistant) i += 1;
  }
  const state =
    ctx.state && typeof ctx.state === "object" && !Array.isArray(ctx.state)
      ? (ctx.state as Record<string, unknown>)
      : {};
  const detailed = Boolean(state.detailed);
  const modeId = getAgentMode(ctx.mode || "ask").id;
  return { turns, modeId, detailed };
}

/** تسميات ودّية لخطوات البث — ثلاث مراحل واضحة للمستخدم. */
function friendlyStepLabel(step: Step): string {
  const id = step.id || "";
  const label = step.label || "";
  if (
    /intent|breadth|takyeef|scope|classif|فهم/.test(id) ||
    /فهم|تصنيف|تكييف|رسالت|سؤال|intent/i.test(label)
  ) {
    return "فهم السؤال";
  }
  if (
    /retriev|search|scan|round|sweep|mazann|deepen|precedents|exhaustive|verify/.test(id) ||
    /بحث|استرجاع|مسح|استقصاء|مظان|تعميق|تحقّق|تحقق|مادة|أحكام/i.test(label)
  ) {
    return "البحث في المصادر";
  }
  if (
    /analysis|synth|generat|draft|answer/.test(id) ||
    /تحليل|إعداد|توليد|صياغ|أحلّل|أنجزت/i.test(label)
  ) {
    return "إعداد التحليل";
  }
  if (step.status === "running") return "إعداد التحليل";
  return label || "إعداد التحليل";
}

function saveDraft(text: string) {
  try {
    if (!text.trim()) sessionStorage.removeItem(HOME_ASK_DRAFT_KEY);
    else sessionStorage.setItem(HOME_ASK_DRAFT_KEY, text.slice(0, HAKEEM_ASK_MAX_CHARS));
  } catch {
    /* تجاهل */
  }
}

function readDraft(): string {
  try {
    return sessionStorage.getItem(HOME_ASK_DRAFT_KEY) || "";
  } catch {
    return "";
  }
}

export function HakeemAskWorkspace({
  userName,
  initialQuery = "",
  initialMode = "ask",
  variant = "page",
  conversationId: conversationIdProp = null,
  onConversationIdChange,
}: HakeemAskWorkspaceProps) {
  const router = useRouter();
  const isHome = variant === "home";
  const [value, setValue] = useState(initialQuery);
  const [detailed, setDetailed] = useState(false);
  const initialComposerMode: ComposerModeId =
    initialMode && initialMode !== "ask" ? getAgentMode(initialMode).id : "auto";
  const [modeId, setModeId] = useState<ComposerModeId>(initialComposerMode);
  const [sources, setSources] = useState<ComposerSourceId[]>(DEFAULT_SOURCES);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [contextItems, setContextItems] = useState<ComposerContextItem[]>([]);
  useWakeLock(busy || extracting);
  const [attachStatus, setAttachStatus] = useState("");
  const [attachError, setAttachError] = useState("");
  const [cloudOcrAvailable, setCloudOcrAvailable] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(conversationIdProp);
  const [sessionLoading, setSessionLoading] = useState(Boolean(conversationIdProp));
  const [sessionError, setSessionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const backgroundedRef = useRef(false);
  const userStoppedRef = useRef(false);
  const busyRef = useRef(false);
  const requestTokenRef = useRef(0);
  const turnsRef = useRef<Turn[]>([]);
  const pendingRunHandledRef = useRef(false);
  const conversationIdRef = useRef<string | null>(conversationIdProp);
  const modeIdRef = useRef<ComposerModeId>(initialComposerMode);
  const sourcesRef = useRef<ComposerSourceId[]>(DEFAULT_SOURCES);
  const attachmentsRef = useRef<ComposerAttachment[]>([]);
  const detailedRef = useRef(false);
  /** آخر نتيجة بث لاعتماد الحفظ دون انتظار مزامنة turnsRef */
  const lastResultRef = useRef<Turn | null>(null);
  /** المهمّة الجاري استطلاعها الآن (منع ازدواج الاستطلاع من مصدرين: catch + مؤثّر الرؤية). */
  const pollingRef = useRef<string | null>(null);
  const pollStopRef = useRef(false);
  const askRef = useRef<(q?: string, override?: { detailed?: boolean; skipBreadth?: boolean }) => Promise<void>>(
    async () => undefined
  );
  const pollJobRef = useRef<(jobId: string, question: string, opts?: { append?: boolean }) => Promise<void>>(
    async () => undefined
  );

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    modeIdRef.current = modeId;
  }, [modeId]);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    detailedRef.current = detailed;
  }, [detailed]);

  // سياق الجلسة النشطة في شريط الصندوق
  useEffect(() => {
    if (!conversationId) {
      setContextItems((prev) => prev.filter((c) => c.type !== "session"));
      return;
    }
    setContextItems((prev) => {
      const without = prev.filter((c) => c.type !== "session");
      return [
        ...without,
        {
          type: "session",
          id: conversationId,
          // لا نعرض المعرّف الخام (cuid) للمستخدم — تسميةٌ عربيّة واضحة.
          label: "الجلسة الحالية",
          removable: false,
        },
      ];
    });
  }, [conversationId]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // مزامنة معرّف الجلسة من المسار الدائم
  useEffect(() => {
    setConversationId(conversationIdProp ?? null);
    conversationIdRef.current = conversationIdProp ?? null;
  }, [conversationIdProp]);

  // استعادة جلسة دائمة من المحرك (رسائل + وضع + سياق)
  useEffect(() => {
    if (!conversationIdProp) {
      setSessionLoading(false);
      setSessionError(null);
      return;
    }
    let cancelled = false;
    setSessionLoading(true);
    setSessionError(null);
    void getAskSession(conversationIdProp).then((res) => {
      if (cancelled) return;
      if (!res.ok || !res.context) {
        setSessionError(res.message ?? "تعذّر استعادة الجلسة.");
        setSessionLoading(false);
        return;
      }
      const restored = turnsFromContext(res.context);
      setTurns(restored.turns);
      turnsRef.current = restored.turns;
      setModeId(restored.modeId);
      modeIdRef.current = restored.modeId;
      setDetailed(restored.detailed);
      detailedRef.current = restored.detailed;
      setSessionLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationIdProp]);

  // جاهزية القراءة السحابية — نفس مسار منصة الوثائق (/api/doc-tool/ocr)
  useEffect(() => {
    let active = true;
    fetch("/api/doc-tool/ocr/available")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setCloudOcrAvailable(Boolean(d?.configured));
      })
      .catch(() => {
        if (active) setCloudOcrAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // تسليم من الرئيسية — يملأ الصندوق فقط دون تنفيذ تلقائي.
  useEffect(() => {
    if (initialQuery) return;
    try {
      const raw = sessionStorage.getItem(HOME_ASK_HANDOFF_KEY);
      if (!raw) return;
      sessionStorage.removeItem(HOME_ASK_HANDOFF_KEY);
      const parsed = JSON.parse(raw) as { question?: string };
      if (typeof parsed.question === "string" && parsed.question.trim()) {
        setValue(parsed.question.trim().slice(0, HAKEEM_ASK_MAX_CHARS));
      }
    } catch {
      /* تجاهل */
    }
  }, [initialQuery]);

  // على الرئيسية فقط: استعادة سؤال الزائر بعد الدخول — مرة واحدة، بلا URL ولا تحويل إلى /dashboard/ask.
  useEffect(() => {
    if (!isHome) return;
    if (pendingRunHandledRef.current) return;
    let pending = false;
    try {
      pending = sessionStorage.getItem(HOME_ASK_PENDING_RUN_KEY) === "1";
    } catch {
      return;
    }
    if (!pending) return;
    const draft = readDraft().trim();
    try {
      sessionStorage.removeItem(HOME_ASK_PENDING_RUN_KEY);
    } catch {
      /* تجاهل */
    }
    if (!draft) return;
    pendingRunHandledRef.current = true;
    setValue(draft);
    void askRef.current(draft);
  }, [isHome]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && busyRef.current) backgroundedRef.current = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, []);

  async function processFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).slice(0, COMPOSER_MAX_ATTACHMENTS);
    if (!files.length) return;

    const room = Math.max(0, COMPOSER_MAX_ATTACHMENTS - attachmentsRef.current.length);
    const toProcess = files.slice(0, room || COMPOSER_MAX_ATTACHMENTS);
    if (!toProcess.length) {
      setAttachError(`الحد الأقصى للمرفقات ${COMPOSER_MAX_ATTACHMENTS.toLocaleString("ar-SA")}.`);
      return;
    }

    setExtracting(true);
    setAttachError("");
    setAttachStatus("جارٍ قراءة الوثائق بمحرّك منصة الوثائق…");

    for (const file of toProcess) {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setAttachments((prev) => [
        ...prev.filter((a) => a.id !== id),
        {
          id,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          extractedText: "",
          status: "processing",
          progressMessage: "جارٍ القراءة…",
        },
      ]);

      try {
        const ext = (file.name.match(/\.([^.]+)$/)?.[1] ?? "").toLowerCase();
        const visual = /^(pdf|png|jpe?g|webp|bmp|tiff?|gif)$/.test(ext);
        const useCloud = cloudOcrAvailable && visual;

        let { text, kind, warning } = await extractFile(file, {
          onProgress: (m) => {
            setAttachStatus(m);
            setAttachments((prev) =>
              prev.map((a) => (a.id === id ? { ...a, progressMessage: m, status: "processing" } : a))
            );
          },
          cloudOcr: useCloud,
          cloudModel: "lite",
        });

        if (isBrokenExtraction(text) && cloudOcrAvailable) {
          setAttachStatus("أرفع دقّة القراءة (قراءة بصرية أقوى)…");
          const hi = await extractFile(file, {
            onProgress: (m) => {
              setAttachStatus(m);
              setAttachments((prev) =>
                prev.map((a) => (a.id === id ? { ...a, progressMessage: m } : a))
              );
            },
            cloudOcr: true,
            cloudModel: "pro",
          });
          if (hi.text && hi.text.trim().length >= 2) {
            text = hi.text;
            kind = hi.kind;
            warning = hi.warning;
          }
        }

        const trimmed = (text || "").trim();
        if (trimmed.length < 2) {
          throw new Error(
            kind
              ? `تعذّرت قراءة نص من الملف (${kind}).`
              : "تعذّرت قراءة نص من الملف. جرّب PDF نصيًا أو Word أو صورة أوضح."
          );
        }
        if (isBrokenExtraction(trimmed)) {
          throw new Error(
            cloudOcrAvailable
              ? "النص المقروء مشوّه (وثيقة ممسوحة أو خط غير قابل للنسخ). جرّب نسخة أوضح."
              : "النص المقروء مشوّه. فعّل القراءة السحابية من إعدادات منصة الوثائق، أو أرفق نسخة نصية أوضح."
          );
        }

        const forSend =
          trimmed.length > COMPOSER_MAX_DOC_CHARS
            ? trimmed.slice(0, COMPOSER_MAX_DOC_CHARS)
            : trimmed;

        let serverAttachmentId: string | undefined;
        let storageKey: string | undefined;
        let serverProcessingStatus: string | undefined;
        let serverVerificationStatus: string | undefined;
        let extractionMode: string | undefined;
        if (isComposerAttachmentClientPersistEnabled()) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status: "uploading",
                    localExtractionStatus: "ok",
                    progressMessage: "جارٍ حفظ المرفق على المنصة…",
                  }
                : a
            )
          );
          const persisted = await persistAskAttachmentToServer({
            file,
            extractedText: forSend,
            kind,
          });
          if (persisted?.rejectedAsLegacy) {
            setAttachStatus("الخادم بوضع Legacy — سيُستخدم النص المحلي دون مرفق V2.");
          } else if (persisted?.serverAttachmentId) {
            serverAttachmentId = persisted.serverAttachmentId;
            storageKey = persisted.storageKey;
            serverProcessingStatus = persisted.processingStatus;
            serverVerificationStatus = persisted.verificationStatus;
            extractionMode = persisted.extractionMode;
          }
        }

        const localExtractionStatus = "ok" as const;
        const derivedStatus = deriveComposerAttachmentStatus({
          localExtractionStatus,
          serverAttachmentId,
          serverProcessingStatus,
          serverVerificationStatus,
          processingV2: isAttachmentsV2ClientEnabled(),
        });
        const isPreviewOnly =
          serverVerificationStatus === "PREVIEW_ONLY" || extractionMode === "preview_only";

        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  kind,
                  extractedText: forSend,
                  previewText: isPreviewOnly ? forSend.slice(0, 2000) : undefined,
                  localExtractionStatus,
                  serverAttachmentId,
                  storageKey,
                  serverProcessingStatus,
                  serverVerificationStatus,
                  status: derivedStatus,
                  progressMessage:
                    trimmed.length > COMPOSER_MAX_DOC_CHARS
                      ? `طويل جدًا — سيُقطع لاحقًا عند الجاهزية الخادمية`
                      : serverAttachmentId
                        ? isPreviewOnly || derivedStatus === "processing"
                          ? warning
                            ? `${warning} · قيد المعالجة على المنصة`
                            : "قيد المعالجة على المنصة (معاينة محلية لا تُرسل للنموذج)"
                          : warning
                            ? `${warning} · جاهز على المنصة`
                            : "جاهز على المنصة"
                        : warning || undefined,
                  error: undefined,
                }
              : a
          )
        );
        setAttachStatus(
          derivedStatus === "processing" && serverAttachmentId
            ? `أُرفق المستند (${kind}) — بانتظار اكتمال المعالجة الخادمية.`
            : trimmed.length > COMPOSER_MAX_DOC_CHARS
              ? `أُرفق المستند (${kind}) — طويلٌ جدًّا.`
              : warning
                ? `أُرفق المستند (${kind}) — ${warning}`
                : `أُرفق المستند (${kind}) كاملًا (${trimmed.length.toLocaleString("ar-SA")} حرفًا).`
        );
      } catch (err) {
        const m = err instanceof Error ? err.message : "";
        const network = /load failed|failed to fetch|networkerror/i.test(m);
        const msg = network
          ? "تعذّر إكمال قراءة المستند — تحقّق من الاتصال ثم أعد المحاولة."
          : m || "تعذّر إرفاق المستند.";
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: "failed", error: msg, progressMessage: undefined } : a
          )
        );
        setAttachError(msg);
        setAttachStatus("");
      }
    }

    setExtracting(false);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachError("");
    setAttachStatus("");
  }

  function combinedDocument(list: ComposerAttachment[]): { text: string; name: string | null } {
    const plan = planAskAttachmentSend({
      attachments: list,
      attachmentsV2: isAttachmentsV2ClientEnabled(),
      processingV2: isAttachmentsV2ClientEnabled(),
    });
    if (plan.suppressLocalDocument) {
      const named = list.find((a) => a.serverAttachmentId);
      return { text: plan.document || "", name: named?.name ?? null };
    }
    const ready = list.filter((a) => a.status === "ready" && a.extractedText.trim());
    if (!ready.length) return { text: "", name: null };
    if (ready.length === 1) return { text: ready[0].extractedText, name: ready[0].name };
    const text = ready
      .map((a, i) => `—— المستند ${i + 1}: ${a.name} ——\n${a.extractedText}`)
      .join("\n\n");
    return {
      text: text.slice(0, COMPOSER_MAX_DOC_CHARS),
      name: `${ready.length} مستندات`,
    };
  }

  function patchLastTurn(patch: (t: Turn) => Turn) {
    setTurns((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice();
      next[next.length - 1] = patch(next[next.length - 1]);
      return next;
    });
  }

  /** يُطبّق التعديل على الدور صاحب jobId (استئنافٌ خلفيّ) وإلا على آخر دور. */
  function patchJobTurn(jobId: string | undefined, patch: (t: Turn) => Turn) {
    setTurns((prev) => {
      if (!prev.length) return prev;
      let idx = prev.length - 1;
      if (jobId) {
        const found = prev.map((t) => t.jobId).lastIndexOf(jobId);
        if (found >= 0) idx = found;
      }
      const next = prev.slice();
      next[idx] = patch(next[idx]);
      return next;
    });
  }

  // jobId (اختياريّ): عند الاستئناف الخلفيّ نوجّه الحدث إلى الدور صاحب المهمّة لا آخر دورٍ ظاهر.
  function applyEvent(evt: Record<string, unknown>, jobId?: string) {
    const patch = (fn: (t: Turn) => Turn) => patchJobTurn(jobId, fn);
    const type = evt.type;
    if (type === "step") {
      patch((t) => {
        const steps = t.steps.slice();
        const idx = steps.findIndex((s) => s.id === evt.id);
        const step: Step = {
          id: String(evt.id ?? ""),
          status: evt.status === "done" ? "done" : "running",
          label: String(evt.label ?? ""),
          data: evt.data,
        };
        if (idx >= 0) steps[idx] = step;
        else steps.push(step);
        return { ...t, steps };
      });
    } else if (type === "result") {
      // الوكيل الأصيل يحفظ الدور في «الغرفة» من الخادم ويعيد conversationId — نضبطه هنا
      // (ونحدّث المسار) فيصمد بعد الإغلاق الكامل، دون حفظٍ ثانٍ من العميل (يُتخطّى أدناه).
      if (typeof evt.conversationId === "string" && evt.conversationId && evt.conversationId !== conversationIdRef.current) {
        const id = evt.conversationId;
        conversationIdRef.current = id;
        setConversationId(id);
        onConversationIdChange?.(id);
        if (typeof window !== "undefined") {
          const target = `/dashboard/ask/c/${id}`;
          if (window.location.pathname !== target) router.replace(target);
        }
      }
      const precedents = evt.precedents as Precedents | undefined;
      patch((t) => {
        const next: Turn = {
          ...t,
          answer: typeof evt.answer === "string" ? evt.answer : null,
          mode: evt.mode as Turn["mode"],
          basis: (evt.basis ?? []) as LegalBasisItem[],
          total: typeof evt.total === "number" ? evt.total : 0,
          coverage: evt.coverage as Turn["coverage"],
          groups: Array.isArray(evt.groups) ? (evt.groups as Turn["groups"]) : undefined,
          disclosure: typeof evt.disclosure === "string" ? evt.disclosure : undefined,
          visibleGroups: Array.isArray(evt.groups) ? 3 : undefined,
          message: typeof evt.message === "string" ? evt.message : undefined,
          // نتيجةٌ وصلت → لم يعُد خلفيًّا ولا خطأً؛ نُزيل أيّ خطأ سابق (كان «غادرت الصفحة»).
          background: false,
          error: undefined,
          precedents:
            precedents && (precedents.rulings?.length || precedents.principles?.length)
              ? precedents
              : undefined,
        };
        lastResultRef.current = next;
        return next;
      });
    } else if (type === "clarify") {
      patch((t) => {
        const next: Turn = {
          ...t,
          background: false,
          error: undefined,
          clarify: {
            message: String(evt.message ?? ""),
            dimension: typeof evt.dimension === "string" ? evt.dimension : undefined,
            options: Array.isArray(evt.options)
              ? (evt.options as NonNullable<Turn["clarify"]>["options"])
              : [],
          },
        };
        lastResultRef.current = next;
        return next;
      });
    } else if (type === "error") {
      patch((t) => {
        const next = {
          ...t,
          error: typeof evt.message === "string" ? evt.message : "خطأ غير متوقع.",
        };
        lastResultRef.current = next;
        return next;
      });
    } else if (type === "done") {
      patch((t) => ({ ...t, streaming: false, showMethod: false, background: false }));
    }
  }

  // استطلاع مهمّةٍ خلفيّة حتى تكتمل ثم تطبيق نتيجتها. مصدرٌ واحدٌ للاستئناف: يُستدعى من
  // catch البحث (عند مغادرة الصفحة) ومن مؤثّر الرؤية (عند العودة/إعادة التحميل). يمنع الازدواج
  // عبر pollingRef، فلا يتصادم المصدران. append=true يُنشئ دورًا مستأنِفًا إن لم يوجد.
  async function pollJob(jobId: string, question: string, opts?: { append?: boolean }) {
    if (pollingRef.current === jobId) return;
    pollingRef.current = jobId;
    if (opts?.append) {
      setTurns((prev) => {
        if (prev.some((t) => t.jobId === jobId)) return prev; // دورٌ يتتبّعها أصلًا — لا تُكرّر
        return [
          ...prev,
          {
            question: question || "بحثٌ سابق",
            steps: [],
            answer: null,
            basis: null,
            total: 0,
            streaming: true,
            background: true,
            showMethod: false,
            jobId,
          },
        ];
      });
    }
    try {
      for (let i = 0; i < 180 && !pollStopRef.current; i += 1) {
        let j: { status?: string; meta?: { result?: Record<string, unknown> } } | null = null;
        try {
          const r = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
          if (r.status === 404) {
            try { sessionStorage.removeItem("hakeem-ask-job"); } catch { /* تجاهل */ }
            patchJobTurn(jobId, (t) => ({
              ...t,
              streaming: false,
              background: false,
              error: t.answer ? t.error : "تعذّر استئناف البحث الخلفيّ — أعد المحاولة.",
            }));
            break;
          }
          j = await r.json();
        } catch {
          /* أعِد المحاولة */
        }
        if (j && (j.status === "done" || j.status === "error")) {
          if (j.meta?.result) applyEvent(j.meta.result, jobId);
          applyEvent({ type: "done" }, jobId);
          try { sessionStorage.removeItem("hakeem-ask-job"); } catch { /* تجاهل */ }
          break;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
    } finally {
      if (pollingRef.current === jobId) pollingRef.current = null;
    }
  }
  pollJobRef.current = pollJob;

  // استئناف مهمّة «اسأل حكيم» الخلفيّة من sessionStorage عند التحميل والعودة إلى الصفحة.
  useEffect(() => {
    pollStopRef.current = false;
    const resumeFromStore = () => {
      if (busyRef.current) return; // بثٌّ حيٌّ جارٍ — لا حاجة للاستطلاع
      let raw = "";
      try { raw = sessionStorage.getItem("hakeem-ask-job") ?? ""; } catch { return; }
      if (!raw) return;
      let p: { jobId?: string; question?: string } = {};
      try { p = JSON.parse(raw); } catch { return; }
      if (!p.jobId) return;
      void pollJobRef.current(p.jobId, p.question || "بحثٌ سابق", { append: true });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") resumeFromStore();
    };
    resumeFromStore();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      pollStopRef.current = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask(q?: string, override?: { detailed?: boolean; skipBreadth?: boolean }) {
    const question = (q ?? value).trim();
    const sendPlan = planAskAttachmentSend({
      attachments: attachmentsRef.current,
      attachmentsV2: isAttachmentsV2ClientEnabled(),
      processingV2: isAttachmentsV2ClientEnabled(),
    });
    const { text: doc, name: attachedName } = combinedDocument(attachmentsRef.current);
    if ((!question && !canStartAskWithAttachments(attachmentsRef.current, question)) || busyRef.current) {
      return;
    }
    // مع مرفق خادمي معلّق: نسمح بالإرسال ليُرجع الخادم ATTACHMENT_NOT_READY
    if (!question && !doc && !sendPlan.attachmentIds.length) return;

    if (question.length > HAKEEM_ASK_MAX_CHARS) {
      return;
    }

    const intent = routeComposerIntent({
      text: question,
      mode: modeIdRef.current,
      hasAttachment: Boolean(doc) || sendPlan.attachmentIds.length > 0,
      sources: sourcesRef.current,
    });
    const effectiveMode = resolveEffectiveMode(
      modeIdRef.current === "auto" ? intent.suggestedMode : modeIdRef.current
    );

    const sourceHint = buildSourceHint(sourcesRef.current);
    const contextLabels = contextItems.map((c) => c.label);
    const queryForAgent = composeAgentQuery(question, {
      sourceHint,
      contextLabels,
    });

    busyRef.current = true;
    userStoppedRef.current = false;
    setBusy(true);
    const token = ++requestTokenRef.current;
    setValue("");
    saveDraft("");
    backgroundedRef.current = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const shown =
      question || (attachedName ? `تحليل المستند: ${attachedName}` : "تحليل المستند المرفق");
    lastResultRef.current = null;
    setTurns((prev) => [
      ...prev,
      {
        question: shown,
        steps: [],
        answer: null,
        basis: null,
        total: 0,
        streaming: true,
        showMethod: true,
      },
    ]);

    const history = turnsRef.current
      .filter((t) => t.answer)
      .flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.answer as string },
      ])
      .slice(-8);

    try {
      const attachmentIds = sendPlan.attachmentIds;
      const documentToSend = sendPlan.suppressLocalDocument ? undefined : doc || undefined;
      const sourcePolicy = composerSourcesToPolicy(sourcesRef.current);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAttachmentsV2ClientEnabled()) {
        headers[ATTACHMENTS_VERSION_HEADER] = "2";
      }

      const res = await fetch("/api/ai/agent-search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: queryForAgent,
          document: documentToSend,
          attachmentIds: attachmentIds.length ? attachmentIds : undefined,
          attachmentsVersion: isAttachmentsV2ClientEnabled() ? "2" : undefined,
          detailed: override?.detailed ?? detailed,
          skipBreadth: override?.skipBreadth ?? false,
          mode: effectiveMode,
          conversationId: conversationIdRef.current || undefined,
          history: history.length ? history : undefined,
          sources: sourcesRef.current,
          sourcePolicy,
        }),
        signal: controller.signal,
      });

      if (token !== requestTokenRef.current) return;

      if (!res.ok || !res.body) {
        const auth = res.status === 401;
        let msg = auth
          ? "انتهت الجلسة — يلزم تسجيل الدخول."
          : "تعذّر تنفيذ البحث الوكيلي.";
        try {
          const errJson = (await res.json()) as { message?: string; code?: string };
          if (errJson.code === "ATTACHMENT_NOT_READY") {
            msg = errJson.message || "المرفق لم يكتمل معالجته بعد.";
          } else if (errJson.code === "CLIENT_V2_SERVER_LEGACY") {
            msg = errJson.message || "محاذاة أعلام المرفقات غير متوافقة.";
          } else if (errJson.message) {
            msg = errJson.message;
          }
        } catch {
          /* ignore */
        }
        if (auth) {
          saveDraft(shown);
          setValue(shown);
        }
        patchLastTurn((t) => ({
          ...t,
          streaming: false,
          error: msg,
          authRequired: auth,
        }));
        busyRef.current = false;
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (token !== requestTokenRef.current) return;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(line) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (evt.type === "job" && evt.jobId) {
            const jid = String(evt.jobId);
            patchLastTurn((t) => ({ ...t, jobId: jid }));
            try {
              sessionStorage.setItem(
                "hakeem-ask-job",
                JSON.stringify({ jobId: evt.jobId, question: shown })
              );
            } catch {
              /* لا تخزين */
            }
          } else {
            applyEvent(evt);
            if (evt.type === "done") {
              try {
                sessionStorage.removeItem("hakeem-ask-job");
              } catch {
                /* لا تخزين */
              }
            }
          }
        }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
      if (token !== requestTokenRef.current) return;
      patchLastTurn((t) => ({ ...t, streaming: false }));

      const finished =
        lastResultRef.current ?? turnsRef.current[turnsRef.current.length - 1] ?? null;
      if (finished && finished.mode !== "native-agent" && !finished.error && (finished.answer || finished.clarify || finished.message)) {
        const turnKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `ask-${Date.now()}`;
        const readyAtts = attachmentsRef.current.filter(
          (a) => a.status === "ready" && a.extractedText.trim()
        );
        const persistResult = await persistAskTurn({
          conversationId: conversationIdRef.current,
          question: shown,
          answer: finished.answer,
          mode: effectiveMode,
          detailed: override?.detailed ?? detailedRef.current,
          basis: finished.basis ?? undefined,
          turnKey,
          attachments: readyAtts.length
            ? readyAtts.map((a) =>
                toMessageAttachmentRef(a, {
                  preferServerId: true,
                  previewOnly: Boolean(a.serverAttachmentId),
                })
              )
            : undefined,
          outputSnapshot: {
            answerMode: finished.mode,
            total: finished.total,
            coverage: finished.coverage,
            groups: finished.groups,
            disclosure: finished.disclosure,
            message: finished.message,
            precedents: finished.precedents,
            clarify: finished.clarify,
            sources: sourcesRef.current,
            intentCategory: intent.category,
            attachmentIds: readyAtts
              .map((a) => a.serverAttachmentId)
              .filter((id): id is string => Boolean(id)),
          },
        });
        if (persistResult.conversationId) {
          const id = persistResult.conversationId;
          conversationIdRef.current = id;
          setConversationId(id);
          onConversationIdChange?.(id);
          if (typeof window !== "undefined") {
            const target = `/dashboard/ask/c/${id}`;
            if (window.location.pathname !== target) {
              router.replace(target);
            }
          }
        }
      }
      setAttachments([]);
      attachmentsRef.current = [];
    } catch (e) {
      if (token !== requestTokenRef.current) return;
      if (userStoppedRef.current) {
        patchLastTurn((t) => ({
          ...t,
          streaming: false,
          background: false,
          error: undefined,
          message: t.answer
            ? t.message
            : "أُوقف التوليد بناءً على طلبك. يمكنك متابعة الكتابة أو إعادة المحاولة.",
        }));
        try {
          sessionStorage.removeItem("hakeem-ask-job");
        } catch {
          /* ignore */
        }
        return;
      }
      const backgrounded =
        backgroundedRef.current || (e instanceof DOMException && e.name === "AbortError");
      let pendingJobId = "";
      try {
        const raw = sessionStorage.getItem("hakeem-ask-job") ?? "";
        if (raw) pendingJobId = JSON.parse(raw).jobId ?? "";
      } catch {
        /* تجاهل */
      }
      if (backgrounded && pendingJobId) {
        patchLastTurn((t) => ({ ...t, streaming: true, background: true, error: undefined }));
        busyRef.current = false;
        setBusy(false);
        void pollJobRef.current(pendingJobId, shown);
      } else {
        patchLastTurn((t) => ({
          ...t,
          streaming: false,
          error: backgrounded
            ? "توقّف البحث لأنك غادرت الصفحة على الجوّال قبل اكتماله — أعد المحاولة."
            : "انقطع الاتصال أثناء البحث.",
        }));
      }
    } finally {
      if (token === requestTokenRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  askRef.current = ask;

  function retry(question: string) {
    if (busyRef.current) return;
    setTurns((prev) => prev.slice(0, -1));
    turnsRef.current = turnsRef.current.slice(0, -1);
    void ask(question);
  }

  function stopGeneration() {
    if (!busyRef.current) return;
    userStoppedRef.current = true;
    requestTokenRef.current += 1;
    abortRef.current?.abort();
    busyRef.current = false;
    setBusy(false);
    pollStopRef.current = true;
    pollingRef.current = null;
    patchLastTurn((t) => ({
      ...t,
      streaming: false,
      background: false,
      error: undefined,
      message: t.answer
        ? t.message
        : "أُوقف التوليد بناءً على طلبك. يمكنك متابعة الكتابة أو إعادة المحاولة.",
    }));
    try {
      sessionStorage.removeItem("hakeem-ask-job");
    } catch {
      /* ignore */
    }
  }

  function startNew() {
    if (busyRef.current) {
      userStoppedRef.current = true;
      abortRef.current?.abort();
      busyRef.current = false;
      setBusy(false);
    }
    requestTokenRef.current += 1;
    setTurns([]);
    turnsRef.current = [];
    setAttachments([]);
    attachmentsRef.current = [];
    setAttachStatus("");
    setAttachError("");
    setSessionError(null);
    conversationIdRef.current = null;
    setConversationId(null);
    onConversationIdChange?.(null);
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard/ask/c/")) {
      router.push("/dashboard/ask");
    }
  }

  function convertToCase(question: string) {
    try {
      sessionStorage.setItem(
        ASK_TO_CASE_HANDOFF_KEY,
        JSON.stringify({
          subject: question.slice(0, 120),
          factsNote: question.slice(0, 4000),
          at: Date.now(),
        })
      );
    } catch {
      /* تجاهل */
    }
    window.location.assign("/dashboard/judicial-assistant");
  }

  function fillSuggestion(text: string) {
    setValue(text.slice(0, HAKEEM_ASK_MAX_CHARS));
  }

  const greeting = userName ? `مرحبًا ${userName}` : "مرحبًا بك";
  const followUpMode = turns.length > 0 && Boolean(turns[turns.length - 1]?.answer) && !busy;
  const emptyTitle = isHome ? "كيف يساعدك حكيم اليوم؟" : greeting;
  const emptyLede = isHome
    ? "اكتب الواقعة أو السؤال القانوني، وسيبحث حكيم في مصادره ويعرض لك تحليلًا منظمًا وخطوات واضحة."
    : "كيف أساعدك اليوم؟ اسألني في الأنظمة السعودية وسأبحث في النواة القانونية الموثّقة.";
  const suggestions = isHome ? ASK_FIRST_SUGGESTIONS : null;
  const inputPlaceholder = followUpMode
    ? "اسأل عن نقطة أخرى في السياق نفسه…"
    : attachments.some((a) => a.status === "ready")
      ? "اكتب سؤالك عن المستند المرفق (اختياري)…"
      : isHome
        ? "اكتب سؤالك أو وقائع المسألة القانونية…"
        : getAgentMode(resolveEffectiveMode(modeId)).placeholder ?? "اسأل في القانون ما شئت…";
  const submitLabel = followUpMode ? "إرسال" : "اسأل حكيم";
  const streamingStatus =
    busy && turns.length
      ? turns[turns.length - 1]?.steps?.length
        ? friendlyStepLabel(turns[turns.length - 1].steps[turns[turns.length - 1].steps.length - 1])
        : "يفهم الطلب…"
      : attachStatus;

  if (sessionLoading) {
    return (
      <div
        className="min-h-[40vh] rounded-[var(--r-xl)] bg-[var(--hakeem-bg-soft)]"
        aria-busy="true"
        aria-label="جارٍ استعادة الجلسة"
      />
    );
  }

  const isEmpty = turns.length === 0;
  return (
    <div className={`flex min-h-[calc(100vh-9rem)] flex-col ${isEmpty ? "justify-center" : ""}`}>
      {sessionError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sessionError}{" "}
          <button type="button" className="font-semibold underline" onClick={() => startNew()}>
            جلسة جديدة
          </button>
        </div>
      ) : null}
      <div ref={scrollRef} className={`space-y-6 overflow-y-auto pb-6 ${isEmpty ? "flex-none" : "flex-1"}`}>
        {turns.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center px-2 text-center ${
              isHome ? "pt-2 pb-3" : "pt-4 pb-4"
            }`}
          >
            {!isHome ? (
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-[var(--gold-bright)] shadow-[var(--sh-md)]">
                <Sparkles size={30} aria-hidden />
              </span>
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-[var(--gold-bright)]">
                <Sparkles size={20} aria-hidden />
              </span>
            )}
            {isHome && userName ? (
              <p className="mt-3 text-sm font-semibold text-[var(--gold-dark)]">{greeting}</p>
            ) : null}
            <h1
              className={`t-head font-bold text-[var(--navy)] ${
                isHome ? "mt-2 text-xl md:text-2xl" : "mt-5 text-2xl md:text-3xl"
              }`}
            >
              {emptyTitle}
            </h1>
            <p className="mt-2 max-w-md leading-7 text-[var(--ink-70)]">{emptyLede}</p>

            {/* تلميحاتٌ بالمعيار العالميّ: رقائقُ مُدمجة مركزيّة (لا بطاقاتٌ عملاقة تدفع الصندوق للأسفل). */}
            {(() => {
              const chips = suggestions
                ? suggestions.slice(0, 4)
                : [
                    "ما مدّة الاستئناف أمام المحاكم التجارية؟",
                    "متى يسقط الحقّ بالتقادم؟",
                    "أحكام الفصل التعسّفي في نظام العمل",
                    "شروط صحّة عقد البيع نظامًا",
                  ];
              const onChip = (s: string) => (suggestions ? fillSuggestion(s) : void ask(s));
              return (
                <div className="mt-6 flex w-full max-w-xl flex-wrap items-center justify-center gap-2">
                  {chips.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => onChip(s)}
                      className="focus-ring rounded-full border border-[var(--ink-15)] bg-ivory px-3.5 py-2 text-[13px] leading-5 text-[var(--ink-70)] transition hover:border-[var(--gold)] hover:bg-[var(--gold-ghost)] hover:text-[var(--navy)] disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              );
            })()}

            {!isHome ? (
              <p className="mt-6 max-w-md text-xs leading-6 text-[var(--ink-40)]">
                الأزرار أسفل الصندوق{" "}
                <b className="font-semibold text-[var(--ink-60)]">أوضاعٌ</b> لعقلٍ واحد تغيّر زاوية
                الإجابة. وللوكلاء المخصّصين بنطاقاتٍ ومهاراتٍ مستقلّة، افتح{" "}
                <a
                  href="/dashboard/agents"
                  className="font-semibold text-[var(--navy)] underline underline-offset-2 hover:text-[var(--navy-mid)]"
                >
                  صفحة الوكلاء
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : (
          turns.map((turn, i) => (
            <div key={i} className="space-y-3">
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--navy)] px-4 py-2.5 text-sm leading-7 text-white">
                  {turn.question}
                </div>
              </div>

              <div className="space-y-3">
                {turn.steps.length > 0 ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-4">
                    <button
                      type="button"
                      onClick={() => patchTurn(setTurns, i, (t) => ({ ...t, showMethod: !t.showMethod }))}
                      className="focus-ring flex w-full items-center justify-between gap-2 text-right"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
                        <Telescope size={16} aria-hidden />
                        {turn.streaming ? "جارٍ تحليل السؤال…" : "طريقة البحث"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--ink-60)]">
                        {turn.showMethod ? "إخفاء طريقة البحث" : "إظهار طريقة البحث"}
                        {turn.showMethod ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                      </span>
                    </button>

                    {turn.showMethod ? (
                      <ol
                        className="mt-3 space-y-2.5 border-t border-[var(--ink-08)] pt-3"
                        aria-live="polite"
                        aria-busy={turn.streaming}
                        aria-label="خطوات عمل الوكيل"
                      >
                        {turn.steps.map((step) => (
                          <li key={step.id} className="flex items-start gap-3">
                            <span className="mt-0.5 shrink-0">
                              {step.status === "done" ? (
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--emerald-soft)] text-[var(--emerald)]">
                                  <Check size={12} aria-hidden />
                                </span>
                              ) : (
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--ink-80)]">
                                {friendlyStepLabel(step)}
                              </p>
                              {step.data &&
                              typeof step.data === "object" &&
                              step.data !== null &&
                              "sub" in step.data &&
                              typeof (step.data as { sub?: unknown }).sub === "string" ? (
                                <p className="mt-0.5 text-xs leading-6 text-[var(--ink-60)]">
                                  {(step.data as { sub: string }).sub}
                                </p>
                              ) : null}
                              {step.id === "retrieved" &&
                              step.data &&
                              typeof step.data === "object" &&
                              Array.isArray((step.data as { sample?: unknown }).sample) &&
                              ((step.data as { sample: unknown[] }).sample.length > 0) ? (
                                <ul className="mt-1.5 space-y-1">
                                  {(step.data as { sample: Array<{ systemName?: string; articleNumber?: number }> })
                                    .sample.slice(0, 6)
                                    .map((it, k) => (
                                      <li key={k} className="font-mono-legal text-[11px] text-[var(--ink-60)]">
                                        · {it.systemName} · م
                                        {Number(it.articleNumber).toLocaleString("ar-SA")}
                                      </li>
                                    ))}
                                </ul>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : turn.streaming && !turn.background ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--ink-60)]">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
                    جارٍ فهم السؤال…
                  </div>
                ) : null}

                {/* استمرار في الخلفية: غادر المستخدم الصفحة والخادم يُكمل — إشعارٌ هادئ لا خطأ. */}
                {turn.background && turn.streaming ? (
                  <div className="flex items-center gap-2 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2.5 text-sm leading-7 text-[var(--navy)]">
                    <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
                    <span>يكمل البحث في الخلفية — سيظهر الجواب هنا فور اكتماله، ولو غادرتَ الصفحة.</span>
                  </div>
                ) : null}

                {turn.mode === "blocked" ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center">
                    <p className="text-sm font-bold text-[var(--navy)]">انتهى رصيدك المجانيّ</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-80)]">
                      {turn.message ??
                        "للمتابعة في «اسأل حكيم» والقاضي والاستشارات، اشترك في حكيم. وتصفّح النواة القانونية يبقى مجانيًّا."}
                    </p>
                    <Link
                      href="/dashboard/billing"
                      className="focus-ring mt-4 inline-block rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)]"
                    >
                      الحساب والرصيد
                    </Link>
                  </div>
                ) : null}

                {turn.error ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] p-4 text-sm leading-7 text-[var(--ruby)]">
                    <span>{turn.error}</span>
                    <div className="flex flex-wrap gap-2">
                      {turn.authRequired ? (
                        <Link
                          href={signInWithNext("/dashboard")}
                          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--navy-mid)]"
                        >
                          تسجيل الدخول
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => retry(turn.question)}
                          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RotateCcw size={14} aria-hidden /> إعادة المحاولة
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                {turn.groups && turn.groups.length ? (
                  <div className="space-y-3">
                    {turn.answer ? (
                      <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-4 shadow-[var(--sh-xs)]">
                        <AnswerRenderer content={turn.answer} />
                        <p className="mt-1 text-xs text-[var(--ink-60)]">
                          وجدتُ مدداً في {turn.groups.length.toLocaleString("ar-SA")} أنظمة · إجمالي{" "}
                          {turn.total.toLocaleString("ar-SA")} مادة. تُعرَض دفعةً دفعة.
                        </p>
                      </div>
                    ) : null}
                    {turn.groups.slice(0, turn.visibleGroups ?? 3).map((g, gi) => (
                      <div
                        key={`${g.systemName}-${gi}`}
                        className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-4 shadow-[var(--sh-xs)]"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--ink-08)] pb-2">
                          <span className="text-sm font-bold text-[var(--navy)]">{g.systemName}</span>
                          <span className="rounded-full bg-[var(--gold-ghost)] px-2 py-0.5 text-[11px] font-semibold text-[var(--gold-dark)]">
                            {g.count.toLocaleString("ar-SA")} مادة بمدد
                          </span>
                        </div>
                        <AnswerRenderer content={g.table} />
                      </div>
                    ))}
                    {(turn.visibleGroups ?? 3) < turn.groups.length ? (
                      <button
                        type="button"
                        onClick={() =>
                          patchTurn(setTurns, i, (t) => ({
                            ...t,
                            visibleGroups: (t.visibleGroups ?? 3) + 3,
                          }))
                        }
                        className="focus-ring flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--gold)] bg-[var(--gold-ghost)] px-3 py-2.5 text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--gold)] hover:text-white"
                      >
                        عرض المزيد <ChevronDown size={16} aria-hidden /> (
                        {(turn.groups.length - (turn.visibleGroups ?? 3)).toLocaleString("ar-SA")} نظامًا
                        متبقّيًا)
                      </button>
                    ) : null}
                    {turn.disclosure ? (
                      <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-3">
                        <AnswerRenderer content={turn.disclosure} />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {turn.clarify ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
                    <p className="mb-3 flex items-start gap-2 text-sm font-semibold leading-7 text-[var(--navy)]">
                      <Compass size={16} className="mt-0.5 shrink-0" aria-hidden />
                      {turn.clarify.message}
                    </p>
                    <div className="flex flex-col gap-2">
                      {turn.clarify.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void ask(opt.query, { detailed: !!opt.exhaustive, skipBreadth: true })}
                          className="focus-ring flex items-center justify-between gap-2 rounded-lg border border-[var(--gold)] bg-ivory px-3.5 py-2.5 text-right text-sm font-semibold text-[var(--navy)] shadow-[var(--sh-xs)] transition hover:bg-[var(--navy)] hover:text-white disabled:opacity-50"
                        >
                          <span className="flex flex-col">
                            <span>{opt.label}</span>
                            {opt.hint ? (
                              <span className="text-[11px] font-normal opacity-70">{opt.hint}</span>
                            ) : null}
                          </span>
                          <span aria-hidden>←</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {turn.answer && !turn.groups ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-5 shadow-[var(--sh-xs)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 border-b border-[var(--ink-08)] pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-[var(--gold-bright)]">
                          <Sparkles size={15} aria-hidden />
                        </span>
                        <span className="text-sm font-bold text-[var(--navy)]">إجابة حكيم</span>
                        {turn.mode !== "intent" ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={
                              (turn.mode === "live" || turn.mode === "native-agent")
                                ? { color: "var(--emerald)", background: "var(--emerald-soft)" }
                                : { color: "var(--amber)", background: "var(--amber-soft)" }
                            }
                            title={
                              (turn.mode === "live" || turn.mode === "native-agent")
                                ? "صياغة ذكية مستندة للمواد"
                                : "صياغة تدريبية مُركّبة من المواد (دون مزوّد ذكاء مفعّل)"
                            }
                          >
                            {(turn.mode === "live" || turn.mode === "native-agent") ? "صياغة مستندة" : "صياغة تدريبية"}
                          </span>
                        ) : null}
                      </div>
                      {turn.mode !== "intent" ? (
                        <AnswerToolbar
                          answer={turn.answer}
                          basis={turn.basis ?? []}
                          question={turn.question}
                          printTargetId={`t${i}-answer`}
                        />
                      ) : null}
                    </div>
                    {turn.mode === "intent" ? (
                      <p className="whitespace-pre-wrap leading-8 text-[var(--ink-80)]">{turn.answer}</p>
                    ) : (
                      <AnswerRenderer
                        content={turn.answer}
                        basis={turn.basis ?? []}
                        anchorPrefix={`t${i}-src-`}
                        id={`t${i}-answer`}
                      />
                    )}
                  </div>
                ) : null}

                {turn.coverage && turn.coverage.total >= 2 ? (
                  <div
                    className="flex flex-wrap items-center gap-2 rounded-[var(--r-lg)] border px-4 py-2.5 text-xs font-semibold"
                    style={
                      turn.coverage.answered >= turn.coverage.total
                        ? {
                            color: "var(--emerald)",
                            background: "var(--emerald-soft)",
                            borderColor: "rgba(26,92,65,0.30)",
                          }
                        : {
                            color: "var(--amber)",
                            background: "var(--amber-soft)",
                            borderColor: "rgba(184,114,26,0.30)",
                          }
                    }
                  >
                    <Check size={14} aria-hidden />
                    <span>
                      التغطية: {turn.coverage.answered.toLocaleString("ar-SA")} من{" "}
                      {turn.coverage.total.toLocaleString("ar-SA")}
                      {turn.coverage.answered >= turn.coverage.total
                        ? " — كل الأنظمة المستهدفة مُجابة"
                        : " — بعض الأنظمة بلا نصّ مطابق"}
                    </span>
                    {Array.isArray(turn.coverage.issues) ? (
                      <span className="flex flex-wrap gap-1.5">
                        {turn.coverage.issues
                          .filter((iss) => iss.systemName)
                          .map((iss, k) => (
                            <span
                              key={k}
                              className="rounded-full bg-ivory/60 px-2 py-0.5"
                              style={{
                                color: iss.status === "answered" ? "var(--emerald)" : "var(--ink-60)",
                              }}
                            >
                              {iss.status === "answered" ? "✓" : "—"} {iss.systemName}
                            </span>
                          ))}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {turn.basis !== null && turn.mode !== "intent" && !turn.groups ? (
                  turn.basis.length ? (
                    <LegalBasisPanel
                      items={turn.basis}
                      anchorPrefix={`t${i}-src-`}
                      title="الحواشي — الأساس النظامي من النواة"
                      note={`الأرقام المُظلّلة أعلاه هوامشُ الدراسة: كلّ رقمٍ [n] في المتن يشير إلى مادّته هنا بنصّها. جميعها قائمةٌ فعلاً في النواة القانونية (إجمالي ${turn.total.toLocaleString("ar-SA")} نتيجة بحث).`}
                    />
                  ) : turn.answer ? null : (
                    <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
                      {turn.message ?? "لا يوجد سند نظامي كافٍ."}
                    </div>
                  )
                ) : null}

                {turn.precedents ? (
                  <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--navy)]">
                      <Scale size={15} aria-hidden /> سوابق قضائية استُؤنِس بها
                    </p>
                    <p className="mb-3 text-xs leading-6 text-[var(--ink-60)]">
                      وجّهت التحليل والترجيح — سياقٌ استئناسيّ، لا سندٌ نظاميّ للأرقام (الأرقام من المواد
                      أعلاه حصرًا).
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {turn.precedents.rulings.map((r, k) => (
                        <div key={`r-${k}`} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory p-2.5">
                          <p className="text-xs font-semibold text-[var(--navy)]">حكم · {r.title}</p>
                          {r.snippet ? (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--ink-60)]">
                              {r.snippet}
                            </p>
                          ) : null}
                        </div>
                      ))}
                      {turn.precedents.principles.map((p, k) => (
                        <div key={`p-${k}`} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory p-2.5">
                          <p className="text-xs font-semibold text-[var(--gold-dark)]">مبدأ · {p.title}</p>
                          {p.snippet ? (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--ink-60)]">
                              {p.snippet}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* مخارج متخصصة بعد الإجابة — فقط بضغطة المستخدم، بلا تحويل تلقائي لـ /dashboard/ask */}
                {!turn.streaming && turn.answer && i === turns.length - 1 ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => convertToCase(turn.question)}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--gold)] bg-[var(--gold-ghost)] px-3.5 py-2 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--gold)] hover:text-white"
                    >
                      <Scale size={14} aria-hidden /> تحويل إلى قضية
                    </button>
                    <Link
                      href="/dashboard/judicial-assistant"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory px-3.5 py-2 text-xs font-semibold text-[var(--ink-80)] transition hover:border-[var(--navy)] hover:text-[var(--navy)]"
                    >
                      فتح المعاون
                    </Link>
                    <Link
                      href="/dashboard/legal-core"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory px-3.5 py-2 text-xs font-semibold text-[var(--ink-80)] transition hover:border-[var(--navy)] hover:text-[var(--navy)]"
                    >
                      <BookOpen size={14} aria-hidden /> المكتبة
                    </Link>
                    <button
                      type="button"
                      onClick={startNew}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-ivory px-3.5 py-2 text-xs font-semibold text-[var(--ink-80)] transition hover:border-[var(--navy)] hover:text-[var(--navy)]"
                    >
                      <MessagesSquare size={14} aria-hidden /> محادثة جديدة
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`bg-gradient-to-t from-[var(--hakeem-bg)] via-[var(--hakeem-bg)] to-transparent pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] ${isEmpty ? "" : "sticky bottom-0"}`}>
        {turns.length > 0 && !busy ? (
          <div className="mb-2 flex justify-end px-1">
            <button
              type="button"
              onClick={startNew}
              className="focus-ring text-xs font-semibold text-[var(--ink-60)] underline-offset-2 hover:text-[var(--navy)] hover:underline"
            >
              محادثة جديدة
            </button>
          </div>
        ) : null}
        <HakeemComposer
          surface={isHome ? "home" : "ask"}
          value={value}
          onChange={(next) => {
            setValue(next);
            saveDraft(next);
          }}
          onSubmit={() => void ask()}
          onStop={stopGeneration}
          busy={busy}
          extracting={extracting}
          placeholder={inputPlaceholder}
          maxChars={HAKEEM_ASK_MAX_CHARS}
          draftKey={HOME_ASK_DRAFT_KEY}
          persistDraft
          modeId={modeId}
          onModeChange={setModeId}
          showModeSelector
          detailed={detailed}
          onDetailedChange={setDetailed}
          sources={sources}
          onSourcesChange={setSources}
          attachments={attachments}
          onAttachFiles={(files) => void processFiles(files)}
          onRemoveAttachment={removeAttachment}
          contextItems={contextItems}
          onRemoveContext={(id) => setContextItems((prev) => prev.filter((c) => c.id !== id))}
          followUp={followUpMode}
          submitLabel={submitLabel}
          statusMessage={streamingStatus || null}
          errorMessage={attachError || null}
        />
        <p className="mt-2 px-1 text-center text-[11px] leading-6 text-[var(--ink-40)]">
          مخرجات حكيم مساعدة تعليمية وليست حكمًا ملزمًا. إرفاق المستندات يستخدم محرّك «منصة الوثائق».
        </p>
      </div>
    </div>
  );
}

function patchTurn(
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>,
  index: number,
  patch: (t: Turn) => Turn
) {
  setTurns((prev) => {
    if (index < 0 || index >= prev.length) return prev;
    const next = prev.slice();
    next[index] = patch(next[index]);
    return next;
  });
}
