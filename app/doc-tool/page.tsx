import { DocToolApp } from "@/components/doc-tool/DocToolApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "أداة معالجة الوثائق العربية — حكيم",
  description: "رفع الوثائق واستخراج نصوصها وتطبيعها وفهرستها للبحث الفوري"
};

// النسخة الـ serverless المدمجة — تعمل على نشر حكيم (Vercel) مباشرةً دون خدمة خارجية.
// عند ضبط DOC_TOOL_URL يعترض بروكسي next.config.mjs هذا المسار ويقدّم نسخة الخادم
// الكاملة (FastAPI مع OCR) بدلاً من هذه الصفحة.
export default function DocToolPage() {
  return <DocToolApp />;
}
