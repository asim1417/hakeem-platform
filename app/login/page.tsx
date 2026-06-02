import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-5">
      <section className="w-full max-w-md rounded-md border border-black/10 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-gold">حكيم</p>
        <h1 className="mt-2 text-3xl font-bold text-olive">تسجيل الدخول</h1>
        <p className="mt-3 leading-7 text-gray-600">نموذج المصادقة الفعلي يربط لاحقًا بـ RBAC والجلسات. هذه الصفحة تؤكد جاهزية المسار في الـ MVP.</p>
        <Link className="focus-ring mt-6 block rounded-md bg-olive px-5 py-3 text-center text-white" href="/dashboard">
          دخول تجريبي
        </Link>
      </section>
    </main>
  );
}
