import { redirect } from "next/navigation";

// المسار القديم — أصبحت الأداة قسم «البحث السريع» في منصة الوثائق الموحّدة.
// عند ضبط DOC_TOOL_URL يعترض بروكسي next.config.mjs هذا المسار قبل الوصول هنا
// ويقدّم نسخة الخادم (FastAPI + OCR) — فإعادة التوجيه لا تعطّلها.
export default function DocToolRedirect() {
  redirect("/documents/tool");
}
