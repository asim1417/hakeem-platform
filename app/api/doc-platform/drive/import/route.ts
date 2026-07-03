import { NextRequest, NextResponse } from "next/server";
import { importFile, type DriveFile } from "@/lib/modules/doc-platform/google-drive";

export const dynamic = "force-dynamic";

/** يستورد ملفاً واحداً: نصّاً جاهزاً (Google Docs/نص) أو بايتات للمتصفح (PDF/DOCX) */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("docplatform_gdrive")?.value;
  if (!token) return NextResponse.json({ error: "غير مربوط بـ Drive", needsAuth: true }, { status: 401 });
  try {
    const body: unknown = await request.json();
    const o = (typeof body === "object" && body !== null ? body : {}) as Partial<DriveFile>;
    if (!o.id || !o.name || !o.mimeType) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    const result = await importFile(token, { id: o.id, name: o.name, mimeType: o.mimeType });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّر الاستيراد" }, { status: 500 });
  }
}
