/**
 * /api/doc-tool/ocr/settings — إدارة مفتاح Gemini للـ OCR من واجهة منصة الوثائق.
 *  GET    : حالة المفتاح (المصدر + آخر 4 خانات) — دون كشفه أبداً.
 *  POST   : اختبار وحفظ المفتاح (يُشفّر AES-256-GCM في app_settings).
 *  DELETE : إزالة المفتاح المخزّن (يبقى مفتاح البيئة إن وُجد).
 * للمدير فقط (USERS_MANAGE) — مع تسجيل في سجلّ التدقيق.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import {
  getGeminiOcrStatus,
  saveGeminiOcrKey,
  clearGeminiOcrKey,
  testGeminiOcrKey
} from "@/lib/modules/ai/gemini-ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  apiKey: z.string().min(20).max(200),
  test: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("USERS_MANAGE", request);
  if (auth.response) return auth.response;
  return NextResponse.json(await getGeminiOcrStatus());
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("USERS_MANAGE", request);
  if (auth.response) return auth.response;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "صيغة المفتاح غير صالحة." }, { status: 400 });
  }

  const { apiKey, test } = parsed.data;

  if (test !== false) {
    const check = await testGeminiOcrKey(apiKey);
    if (!check.ok) return NextResponse.json({ ok: false, message: check.message }, { status: 422 });
  }

  const saved = await saveGeminiOcrKey(apiKey);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, message: saved.message ?? "تعذّر الحفظ." }, { status: 500 });
  }

  await auditEvent({
    actorId: auth.user?.id,
    subject: "ADMIN",
    action: "DOC_OCR_KEY_SAVED",
    metadata: { source: "documents-platform" }
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, ...(await getGeminiOcrStatus()), message: "حُفظ المفتاح مشفّراً — الخدمة السحابية مفعّلة." });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiPermission("USERS_MANAGE", request);
  if (auth.response) return auth.response;

  await clearGeminiOcrKey();
  await auditEvent({
    actorId: auth.user?.id,
    subject: "ADMIN",
    action: "DOC_OCR_KEY_REMOVED",
    metadata: { source: "documents-platform" }
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, ...(await getGeminiOcrStatus()), message: "أُزيل المفتاح المخزّن." });
}
