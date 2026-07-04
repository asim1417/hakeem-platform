import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "أداة معالجة الوثائق العربية — حكيم",
  description: "رفع الوثائق واستخراج نصوصها وتطبيعها وفهرستها للبحث الفوري"
};

// صفحة مستقلة بملء الشاشة لأداة معالجة الوثائق (خدمة FastAPI في tools/arabic-doc-tool).
// خارج قشرة اللوحة وخارج مسارات الحماية — الأداة نفسها تُقفل بكلمة مرور عبر APP_PASSWORD.
export default function DocToolStandalonePage() {
  const toolUrl = process.env.DOC_TOOL_URL?.trim();

  if (!toolUrl) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-6 leading-8 text-amber-900">
          <h1 className="text-2xl font-bold">أداة معالجة الوثائق العربية</h1>
          <p className="mt-3 font-semibold">⚠ خدمة الأداة غير مضبوطة بعد.</p>
          <p className="mt-2">
            شغّل الخدمة ثم عرّف عنوانها في متغيّر البيئة <code dir="ltr">DOC_TOOL_URL</code>:
          </p>
          <pre dir="ltr" className="mt-3 overflow-x-auto rounded bg-white p-3 text-sm text-gray-800">
{`# عبر Docker Compose (يشمل OCR عربي):
docker compose up -d doc-tool

# أو محلياً:
npm run tool:docs:install && npm run tool:docs

# ثم:
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

  return (
    <div dir="rtl" className="flex h-screen flex-col">
      <iframe
        src={toolUrl}
        title="أداة معالجة الوثائق العربية"
        className="h-full w-full flex-1 border-0"
      />
    </div>
  );
}
