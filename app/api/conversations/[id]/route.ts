import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireConversationService } from "@/lib/modules/conversations/api-auth";
import {
  ConversationEngineError,
  getConversationContext,
  renameConversation,
  setConversationStatus,
} from "@/lib/modules/conversations/engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * GET /api/conversations/:id?service=ask
 * استعادة سياق الجلسة الكامل (رسائل + مصادر + حالة).
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const url = new URL(request.url);
  const auth = await requireConversationService(request, url.searchParams.get("service"));
  if (!auth.ok) return auth.response;

  try {
    const context = await getConversationContext({
      userId: auth.userId,
      conversationId: params.id,
      serviceKey: auth.serviceKey,
    });
    return NextResponse.json({ ok: true, context });
  } catch (e) {
    if (e instanceof ConversationEngineError) {
      const status =
        e.code === "NOT_FOUND" || e.code === "SERVICE_MISMATCH"
          ? 404
          : e.code === "DELETED"
            ? 410
            : e.code === "FORBIDDEN"
              ? 403
              : 400;
      return NextResponse.json({ ok: false, message: e.message, code: e.code }, { status });
    }
    console.error("[conversations.get]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "تعذّر استعادة الجلسة." }, { status: 500 });
  }
}

const patchSchema = z.object({
  service: z.enum(["ask", "judicial-assistant", "legal-chat"]),
  title: z.string().min(2).max(120).optional(),
  status: z.enum(["active", "processing", "error"]).optional(),
  pin: z.boolean().optional(),
  archive: z.boolean().optional(),
  softDelete: z.boolean().optional(),
});

/**
 * PATCH /api/conversations/:id
 * إدارة خفيفة: إعادة تسمية / تثبيت / أرشفة / حذف ناعم / status.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "طلب غير صالح." }, { status: 400 });
  }

  const auth = await requireConversationService(request, body.service);
  if (!auth.ok) return auth.response;

  try {
    if (body.title !== undefined) {
      await renameConversation({
        userId: auth.userId,
        conversationId: params.id,
        serviceKey: auth.serviceKey,
        title: body.title,
      });
    }
    if (body.status !== undefined) {
      await setConversationStatus({
        userId: auth.userId,
        conversationId: params.id,
        serviceKey: auth.serviceKey,
        status: body.status,
      });
    }

    const data: {
      pinnedAt?: Date | null;
      archivedAt?: Date | null;
      deletedAt?: Date | null;
    } = {};
    if (body.pin === true) data.pinnedAt = new Date();
    if (body.pin === false) data.pinnedAt = null;
    if (body.archive === true) data.archivedAt = new Date();
    if (body.archive === false) data.archivedAt = null;
    if (body.softDelete === true) data.deletedAt = new Date();

    if (Object.keys(data).length) {
      const updated = await prisma.chatConversation.updateMany({
        where: {
          id: params.id,
          userId: auth.userId,
          serviceKey: auth.serviceKey,
          deletedAt: null,
        },
        data,
      });
      if (!updated.count) {
        return NextResponse.json({ ok: false, message: "الجلسة غير موجودة.", code: "NOT_FOUND" }, { status: 404 });
      }
    }

    if (body.softDelete) {
      return NextResponse.json({ ok: true, deleted: true });
    }

    const context = await getConversationContext({
      userId: auth.userId,
      conversationId: params.id,
      serviceKey: auth.serviceKey,
    });

    return NextResponse.json({ ok: true, context });
  } catch (e) {
    if (e instanceof ConversationEngineError) {
      const status =
        e.code === "NOT_FOUND" || e.code === "SERVICE_MISMATCH"
          ? 404
          : e.code === "DELETED"
            ? 410
            : e.code === "VALIDATION"
              ? 400
              : 400;
      return NextResponse.json({ ok: false, message: e.message, code: e.code }, { status });
    }
    console.error("[conversations.patch]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "تعذّر تحديث الجلسة." }, { status: 500 });
  }
}
