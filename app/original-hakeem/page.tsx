import Link from "next/link";

export const metadata = {
  title: "تجربة حكيم الأصلية"
};

export default function OriginalHakeemPage() {
  return (
    <main className="min-h-screen bg-[#0B1F3A]">
      <div className="flex h-screen flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C09B5A]/25 bg-[#0B1F3A] px-5 py-3 text-white">
          <div>
            <p className="text-xs text-[#E8D5A8]">Mirror Static</p>
            <h1 className="font-bold">تجربة حكيم الأصلية من hakim1111.html</h1>
            <p className="mt-1 text-xs text-white/70">هذه نسخة مرجعية أصلية معروضة كما هي للمقارنة والتثبيت البصري.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <a className="rounded-md border border-[#C09B5A]/40 px-3 py-2 text-[#E8D5A8]" href="/original-hakeem/hakim1111.html" target="_blank" rel="noreferrer">
              فتح الملف في تبويب مستقل
            </a>
            <Link className="rounded-md border border-white/20 px-3 py-2 text-white" href="/dashboard">
              العودة للوحة التحكم
            </Link>
            <Link className="rounded-md bg-[#C09B5A] px-3 py-2 text-[#0B1F3A]" href="/dashboard/simulations">
              القاضي حكيم
            </Link>
          </div>
        </header>
        <div className="border-b border-amber-300/30 bg-amber-100 px-5 py-2 text-sm text-amber-950">
          تنبيه: هذه النسخة الأصلية محفوظة كمرجع ثابت. الملف المباشر داخل public عام بطبيعته، أما صفحة القاضي داخل لوحة التحكم فتبقى محمية بتسجيل الدخول والصلاحيات.
        </div>
        <iframe
          title="تجربة حكيم الأصلية"
          src="/original-hakeem/hakim1111.html"
          className="min-h-0 flex-1 border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        />
      </div>
    </main>
  );
}
