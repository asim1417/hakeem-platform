import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

// أداة معالجة الوثائق العربية — خدمة FastAPI مستقلة (tools/arabic-doc-tool)
// تُضبط عبر DOC_TOOL_URL (مثال: http://localhost:8080 أو https://tool.hakeem.example)
export default async function DocToolPage() {
  await requirePagePermission("ATTACHMENTS_LIMITED");

  const toolUrl = process.env.DOC_TOOL_URL?.trim();

  return (
    <div dir="rtl" className="flex h-full min-h-[70vh] flex-col">
      <div className="mb-4">
        <p className="text-sm font-semibold text-gold">معالجة الوثائق</p>
        <h1 className="mt-2 text-3xl font-bold text-olive">أداة معالجة الوثائق العربية</h1>
        <p className="mt-3 max-w-3xl leading-8 text-gray-700">
          ارفع وثائقك (نص / Word / PDF / صور) فتُستخرَج نصوصها وتُنظَّف بتطبيع عربي وتُفهرَس
          للبحث الفوري مع تظليل مواضع المطابقة. تعمل الأداة كخدمة مستقلة على خادمك —
          لا تُرسَل الوثائق لأي جهة خارجية.
        </p>
      </div>

      {toolUrl ? (
        <>
          <div className="mb-2 text-sm text-gray-500">
            الأداة تعمل على{" "}
            <a href={toolUrl} target="_blank" rel="noreferrer" className="text-gold underline">
              {toolUrl}
            </a>{" "}
            — افتحها في نافذة مستقلة إن لم تظهر أدناه.
          </div>
          <iframe
            src={toolUrl}
            title="أداة معالجة الوثائق العربية"
            className="min-h-[70vh] w-full flex-1 rounded-md border border-gray-200 bg-white"
          />
        </>
      ) : (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-5 leading-8 text-amber-900">
          <p className="font-semibold">⚠ خدمة الأداة غير مضبوطة بعد.</p>
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
            التفاصيل الكاملة في <code dir="ltr">tools/arabic-doc-tool/README_TOOL.md</code>.
          </p>
        </div>
      )}
    </div>
  );
}
