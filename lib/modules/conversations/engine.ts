import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureConversationSessionSchema } from "@/lib/modules/conversations/ensure-schema";
import { generateConversationTitle, assertRenamableTitle } from "@/lib/modules/conversations/titles";
import type {
  ConversationContext,
  ConversationListItem,
  ConversationService,
  MessageAttachmentRef,
  MessageRole,
  MessageStatus,
  RetrievedSource,
} from "@/lib/modules/conversations/types";

export class ConversationEngineError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "VALIDATION"
      | "DELETED"
      | "SERVICE_MISMATCH"
  ) {
    super(message);
    this.name = "ConversationEngineError";
  }
}

function asService(value: string): ConversationService {
  if (value === "ask" || value === "judicial-assistant" || value === "legal-chat") return value;
  throw new ConversationEngineError("خدمة غير مدعومة.", "VALIDATION");
}

function previewFrom(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 160 ? `${t.slice(0, 160)}…` : t;
}

/** قائمة خفيفة — بلا نصوص كاملة. */
export async function listConversations(input: {
  userId: string;
  serviceKey: ConversationService;
  q?: string;
  includeArchived?: boolean;
  /** إزاحة صفوف — ترقيم بسيط للمرحلة 2 */
  offset?: number;
  take?: number;
}): Promise<{ items: ConversationListItem[]; nextOffset: number | null }> {
  await ensureConversationSessionSchema();
  const take = Math.min(Math.max(input.take ?? 30, 1), 50);
  const offset = Math.max(input.offset ?? 0, 0);
  const where: Prisma.ChatConversationWhereInput = {
    userId: input.userId,
    serviceKey: input.serviceKey,
    deletedAt: null,
    ...(input.includeArchived ? {} : { archivedAt: null }),
    ...(input.q?.trim()
      ? {
          OR: [
            { title: { contains: input.q.trim(), mode: "insensitive" } },
            { generatedTitle: { contains: input.q.trim(), mode: "insensitive" } },
            { preview: { contains: input.q.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.chatConversation.findMany({
    where,
    orderBy: [{ pinnedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    skip: offset,
    select: {
      id: true,
      title: true,
      generatedTitle: true,
      serviceKey: true,
      mode: true,
      status: true,
      preview: true,
      updatedAt: true,
      createdAt: true,
      pinnedAt: true,
      archivedAt: true,
      judicialCaseId: true,
      caseFileId: true,
      parentConversationId: true,
      _count: { select: { messages: true } },
    },
  });

  const slice = rows.slice(0, take);
  const nextOffset = rows.length > take ? offset + take : null;

  return {
    items: slice.map((r) => ({
      id: r.id,
      title: r.title,
      generatedTitle: r.generatedTitle,
      serviceKey: asService(r.serviceKey),
      mode: r.mode,
      status: r.status,
      preview: r.preview,
      updatedAt: r.updatedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      pinnedAt: r.pinnedAt?.toISOString() ?? null,
      archivedAt: r.archivedAt?.toISOString() ?? null,
      judicialCaseId: r.judicialCaseId,
      caseFileId: r.caseFileId,
      messageCount: r._count.messages,
      parentConversationId: r.parentConversationId,
    })),
    nextOffset,
  };
}

async function getOwnedConversation(input: {
  userId: string;
  conversationId: string;
  serviceKey: ConversationService;
  includeDeleted?: boolean;
}) {
  await ensureConversationSessionSchema();
  const row = await prisma.chatConversation.findFirst({
    where: {
      id: input.conversationId,
      userId: input.userId,
      serviceKey: input.serviceKey,
      ...(input.includeDeleted ? {} : { deletedAt: null }),
    },
  });
  if (!row) {
    // ميّز تضارب الخدمة عن الغياب دون تسريب ملكية عبر رسائل مختلفة قدر الإمكان
    const any = await prisma.chatConversation.findFirst({
      where: { id: input.conversationId, userId: input.userId },
      select: { serviceKey: true, deletedAt: true },
    });
    if (any?.deletedAt && !input.includeDeleted) {
      throw new ConversationEngineError("الجلسة محذوفة.", "DELETED");
    }
    if (any && any.serviceKey !== input.serviceKey) {
      throw new ConversationEngineError("الخدمة لا تطابق الجلسة.", "SERVICE_MISMATCH");
    }
    throw new ConversationEngineError("الجلسة غير موجودة.", "NOT_FOUND");
  }
  return row;
}

/** استعادة سياق كامل عند فتح الجلسة. */
export async function getConversationContext(input: {
  userId: string;
  conversationId: string;
  serviceKey: ConversationService;
}): Promise<ConversationContext> {
  const conv = await getOwnedConversation(input);
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { sequence: "asc" },
  });

  const stateObj =
    conv.state && typeof conv.state === "object" && !Array.isArray(conv.state)
      ? (conv.state as Record<string, unknown>)
      : {};
  const contextVersion =
    typeof stateObj.contextVersion === "number" && Number.isFinite(stateObj.contextVersion)
      ? stateObj.contextVersion
      : 1;

  return {
    conversationId: conv.id,
    serviceKey: asService(conv.serviceKey),
    mode: conv.mode,
    title: conv.title,
    generatedTitle: conv.generatedTitle,
    status: conv.status,
    summary: conv.summary,
    state: conv.state,
    judicialCaseId: conv.judicialCaseId,
    caseFileId: conv.caseFileId,
    parentConversationId: conv.parentConversationId,
    branchFromMessageId: conv.branchFromMessageId,
    contextVersion,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sequence: m.sequence,
      status: m.status,
      mode: m.mode,
      model: m.model,
      clientRequestId: m.clientRequestId,
      attachments: m.attachments,
      retrievedSources: m.retrievedSources,
      warnings: m.warnings,
      inputSnapshot: m.inputSnapshot,
      outputSnapshot: m.outputSnapshot,
      toolCalls: m.toolCalls,
      jobId: m.jobId,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export type AppendMessageInput = {
  userId: string;
  serviceKey: ConversationService;
  conversationId?: string | null;
  /** يُنشئ جلسة عند غياب conversationId — مطلوب مع أول رسالة */
  mode?: string;
  judicialCaseId?: string | null;
  caseFileId?: string | null;
  role: MessageRole;
  content: string;
  clientRequestId?: string | null;
  status?: MessageStatus;
  attachments?: MessageAttachmentRef[];
  retrievedSources?: RetrievedSource[];
  warnings?: unknown;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  toolCalls?: unknown;
  model?: string | null;
  jobId?: string | null;
  statePatch?: Record<string, unknown>;
};

/**
 * يحفظ رسالة. إن لم تُمرَّر conversationId يُنشئ جلسة عند أول رسالة فقط.
 * يمنع التكرار عبر (conversationId, clientRequestId).
 */
export async function appendMessage(input: AppendMessageInput): Promise<{
  conversationId: string;
  messageId: string;
  sequence: number;
  created: boolean;
  deduped: boolean;
}> {
  await ensureConversationSessionSchema();
  const content = input.content?.trim();
  if (!content || content.length < 1) {
    throw new ConversationEngineError("محتوى الرسالة فارغ.", "VALIDATION");
  }
  if (input.serviceKey === "judicial-assistant" && !input.conversationId && !input.judicialCaseId) {
    // يسمح بجلسات بلا قضية فقط إن وُجدت محادثة قائمة؛ الإنشاء الجديد يفضّل قضية
    // لا نفرض هنا بقسوة مفرطة — التحقق الأذني يتم في API
  }

  return prisma.$transaction(async (tx) => {
    let conversationId = input.conversationId ?? null;
    let created = false;

    if (conversationId) {
      const existing = await tx.chatConversation.findFirst({
        where: {
          id: conversationId,
          userId: input.userId,
          serviceKey: input.serviceKey,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!existing) {
        throw new ConversationEngineError("الجلسة غير موجودة.", "NOT_FOUND");
      }

      if (input.clientRequestId) {
        const dup = await tx.chatMessage.findFirst({
          where: {
            conversationId,
            clientRequestId: input.clientRequestId,
          },
          select: { id: true, sequence: true },
        });
        if (dup) {
          return {
            conversationId,
            messageId: dup.id,
            sequence: dup.sequence,
            created: false,
            deduped: true,
          };
        }
      }
    } else {
      // لا صف فارغ: الإنشاء مع أول رسالة فقط
      const generated = generateConversationTitle(content, input.serviceKey);
      const mode = input.mode?.trim() || (input.serviceKey === "ask" ? "ask" : input.serviceKey === "legal-chat" ? "RESEARCHER" : "workspace");
      const conv = await tx.chatConversation.create({
        data: {
          userId: input.userId,
          serviceKey: input.serviceKey,
          title: generated,
          generatedTitle: generated,
          mode,
          status: "active",
          preview: previewFrom(content),
          judicialCaseId: input.judicialCaseId ?? null,
          caseFileId: input.caseFileId ?? null,
          state: {
            contextVersion: 1,
            ...(input.statePatch ?? {}),
          } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      conversationId = conv.id;
      created = true;
    }

    const agg = await tx.chatMessage.aggregate({
      where: { conversationId: conversationId! },
      _max: { sequence: true },
    });
    const sequence = (agg._max.sequence ?? 0) + 1;

    try {
      const msg = await tx.chatMessage.create({
        data: {
          conversationId: conversationId!,
          role: input.role,
          content,
          sequence,
          status: input.status ?? "completed",
          mode: input.mode ?? null,
          model: input.model ?? null,
          clientRequestId: input.clientRequestId ?? null,
          attachments: (input.attachments ?? undefined) as Prisma.InputJsonValue | undefined,
          retrievedSources: (input.retrievedSources ?? undefined) as Prisma.InputJsonValue | undefined,
          warnings: (input.warnings ?? undefined) as Prisma.InputJsonValue | undefined,
          inputSnapshot: (input.inputSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          outputSnapshot: (input.outputSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          toolCalls: (input.toolCalls ?? undefined) as Prisma.InputJsonValue | undefined,
          jobId: input.jobId ?? null,
        },
        select: { id: true, sequence: true },
      });

      const updateData: Prisma.ChatConversationUpdateInput = {
        preview: previewFrom(content),
        updatedAt: new Date(),
      };
      if (input.mode) updateData.mode = input.mode;
      if (input.statePatch && !created) {
        const current = await tx.chatConversation.findUnique({
          where: { id: conversationId! },
          select: { state: true },
        });
        const base =
          current?.state && typeof current.state === "object" && !Array.isArray(current.state)
            ? (current.state as Record<string, unknown>)
            : {};
        updateData.state = { ...base, ...input.statePatch } as Prisma.InputJsonValue;
      }
      await tx.chatConversation.update({
        where: { id: conversationId! },
        data: updateData,
      });

      return {
        conversationId: conversationId!,
        messageId: msg.id,
        sequence: msg.sequence,
        created,
        deduped: false,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        input.clientRequestId &&
        conversationId
      ) {
        const dup = await tx.chatMessage.findFirst({
          where: { conversationId, clientRequestId: input.clientRequestId },
          select: { id: true, sequence: true },
        });
        if (dup) {
          return {
            conversationId,
            messageId: dup.id,
            sequence: dup.sequence,
            created: false,
            deduped: true,
          };
        }
      }
      throw e;
    }
  });
}

export async function renameConversation(input: {
  userId: string;
  conversationId: string;
  serviceKey: ConversationService;
  title: string;
}): Promise<void> {
  const title = assertRenamableTitle(input.title);
  const conv = await getOwnedConversation(input);
  await prisma.chatConversation.update({
    where: { id: conv.id },
    data: { title },
  });
}

export async function setConversationStatus(input: {
  userId: string;
  conversationId: string;
  serviceKey: ConversationService;
  status: "active" | "processing" | "error";
}): Promise<void> {
  const conv = await getOwnedConversation(input);
  await prisma.chatConversation.update({
    where: { id: conv.id },
    data: { status: input.status },
  });
}

/** يربط مهمة خلفية بالمحادثة والرسالة (جدول generation_jobs). */
export async function linkGenerationJob(input: {
  jobId: string;
  ownerId: string;
  conversationId: string;
  messageId: string;
  serviceKey: ConversationService;
  clientRequestId?: string | null;
}): Promise<boolean> {
  // تحقق ملكية الجلسة أولًا
  await getOwnedConversation({
    userId: input.ownerId,
    conversationId: input.conversationId,
    serviceKey: input.serviceKey,
  });

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "generation_jobs"
          SET "conversation_id"=$2,
              "message_id"=$3,
              "service_key"=$4,
              "client_request_id"=COALESCE($5,"client_request_id"),
              "updated_at"=NOW()
        WHERE "id"=$1::uuid AND "owner_id"=$6`,
      input.jobId,
      input.conversationId,
      input.messageId,
      input.serviceKey,
      input.clientRequestId ?? null,
      input.ownerId
    );
    await prisma.chatMessage.updateMany({
      where: {
        id: input.messageId,
        conversationId: input.conversationId,
      },
      data: { jobId: input.jobId },
    });
    return true;
  } catch {
    return false;
  }
}
