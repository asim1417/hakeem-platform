import Link from "next/link";

export default function NotFound() {
  return (
    <div dir="rtl" className="grid min-h-screen place-items-center bg-[var(--hakeem-bg)] p-6">
      <div className="w-full max-w-lg rounded-[var(--r-2xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-10 text-center shadow-[var(--sh-md)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--navy)] text-3xl font-bold text-[var(--gold)]" style={{ fontFamily: "var(--font-judicial)" }}>
          ٤٠٤
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[var(--navy)]" style={{ fontFamily: "var(--font-display)" }}>
          الصفحة غير موجودة
        </h1>
        <p className="mt-3 leading-8 text-[var(--ink-60)]">
          تعذّر العثور على الصفحة المطلوبة. ربما نُقل المحتوى أو تغيّر الرابط.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard" className="btn btn-gold">العودة إلى الرئيسية</Link>
          <Link href="/dashboard/ask" className="btn btn-outline">اسأل حكيم</Link>
        </div>
      </div>
    </div>
  );
}
