import { NextRequest, NextResponse } from "next/server";
import {
  extractTextWithGemini,
  isGeminiOcrConfigured,
  GEMINI_OCR_MIME_TYPES,
  type GeminiOcrMime,
  type GeminiOcrModel
} from "@/lib/modules/ai/gemini-ocr";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// حد ملف الرفع — حد جسم الطلب في Vercel serverless ~4.5MB (وbase64 يضخّمه)
const MAX_FILE_BYTES = 3_500_000;

const EXT_MIME: Record<string, GeminiOcrMime> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf"
};

/** حالة الخدمة — يستعلمها العميل ليعرف إن كان الخيار السحابي متاحاً */
export async function GET() {
  return NextResponse.json({ configured: isGeminiOcrConfigured() });
}

/** OCR سحابي عبر Gemini — multipart: file (+ model اختياري: flash | pro) */
export async function POST(request: NextRequest) {
  if (!isGeminiOcrConfigured()) {
    return NextResponse.json(
      { error: "الخدمة السحابية غير مفعّلة — اضبط GEMINI_API_KEY في بيئة الخادم" },
      { status: 503 }
    );
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "أرفق ملفاً في الحقل file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `حجم الملف يتجاوز الحد (${Math.round(MAX_FILE_BYTES / 1_000_000)}MB) — استخدم OCR المحلي` },
        { status: 413 }
      );
    }
    const ext = (file.name.match(/\.([^.]+)$/)?.[1] ?? "").toLowerCase();
    const mime = EXT_MIME[ext] ?? (GEMINI_OCR_MIME_TYPES.includes(file.type as GeminiOcrMime) ? (file.type as GeminiOcrMime) : null);
    if (!mime) {
      return NextResponse.json({ error: "يُقبل: PNG أو JPG أو PDF" }, { status: 400 });
    }
    const modelParam = form.get("model");
    const model: GeminiOcrModel = modelParam === "pro" ? "pro" : "flash";

    const text = await extractTextWithGemini(Buffer.from(await file.arrayBuffer()), mime, model);
    return NextResponse.json({ text, model: model === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "تعذّر الاستخراج";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
