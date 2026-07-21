/**
 * /api/doc-tool/ocr/available — إشارةُ توفّرٍ خفيفة للقراءة السحابيّة (Gemini) لأيّ مستخدمٍ مسجَّل.
 * تعيد {configured} فقط (لا مفتاح، لا مصدر) — كي يعرف رافع مرفقات المعاون هل يُظهر خيار القراءة السحابيّة.
 * إدارة المفتاح تبقى في /ocr/settings (USERS_MANAGE). المصادقة تتكفّل بها الوسيطة.
 */
import { NextResponse } from "next/server";
import { getGeminiOcrStatus } from "@/lib/modules/ai/gemini-ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getGeminiOcrStatus().catch(() => ({ configured: false }));
  return NextResponse.json({ configured: Boolean(status.configured) });
}
