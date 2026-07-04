import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "أداة معالجة الوثائق العربية — حكيم",
  description: "رفع الوثائق واستخراج نصوصها وتطبيعها وفهرستها للبحث الفوري"
};

// صفحة احتياطية: عند ضبط DOC_TOOL_URL يعترض بروكسي next.config.mjs المسار /doc-tool
// ويقدّم أداة FastAPI (tools/arabic-doc-tool) مباشرةً على نفس الدومين، فلا تُعرض هذه الصفحة.
// بدونه تُعرض تعليمات الإعداد التالية.
export default function DocToolSetupPage() {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-6 leading-8 text-amber-900">
        <h1 className="text-2xl font-bold">أداة معالجة الوثائق العربية</h1>
        <p className="mt-3 font-semibold">⚠ خدمة الأداة غير مضبوطة بعد.</p>
        <p className="mt-2">
          شغّل الخدمة ثم عرّف عنوانها في متغيّر البيئة <code dir="ltr">DOC_TOOL_URL</code> وأعد
          تشغيل تطبيق حكيم — بعدها تُقدَّم الأداة مباشرةً على هذا المسار (<code dir="ltr">/doc-tool</code>)
          على نفس الدومين:
        </p>
        <pre dir="ltr" className="mt-3 overflow-x-auto rounded bg-white p-3 text-sm text-gray-800">
{`# عبر Docker Compose (يشمل OCR عربي):
docker compose up -d doc-tool

# أو محلياً:
npm run tool:docs:install && npm run tool:docs

# ثم في .env:
DOC_TOOL_URL="http://localhost:8080"`}
        </pre>
        <p className="mt-3 text-sm">
          التفاصيل الكاملة في <code dir="ltr">tools/arabic-doc-tool/README_TOOL.md</code>.{" "}
          <Link href="/" className="underline">
            العودة إلى حكيم
          </Link>
        </p>
      </div>
    </div>
  );
}
