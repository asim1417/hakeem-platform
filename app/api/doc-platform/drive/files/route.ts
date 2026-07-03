import { NextRequest, NextResponse } from "next/server";
import { listFiles } from "@/lib/modules/doc-platform/google-drive";

export const dynamic = "force-dynamic";

/** يسرد ملفات المستخدم القابلة للاستيراد من Drive */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("docplatform_gdrive")?.value;
  if (!token) return NextResponse.json({ error: "غير مربوط بـ Drive", needsAuth: true }, { status: 401 });
  try {
    const query = request.nextUrl.searchParams.get("q") ?? undefined;
    const files = await listFiles(token, query);
    return NextResponse.json({ files });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "تعذّر السرد";
    // انتهاء صلاحية الوصول → يحتاج إعادة ربط
    return NextResponse.json({ error: msg, needsAuth: true }, { status: 401 });
  }
}
