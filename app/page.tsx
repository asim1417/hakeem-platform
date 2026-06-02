import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-sand">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        <p className="mb-3 text-sm font-semibold text-gold">مكتب أمان للمحاماة والاستشارات القانونية</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight text-olive md:text-6xl">حكيم</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-700">
          منصة قانونية موحدة تجمع الاستشارات، المحاكاة القضائية، التدريب، المكتبة النظامية،
          المرفقات، المستخدمين، الإدارة، والحوكمة فوق نواة واحدة وقاعدة PostgreSQL مشتركة.
        </p>
        <div className="mt-8 flex gap-3">
          <Link className="focus-ring rounded-md bg-olive px-5 py-3 text-white" href="/dashboard">
            دخول لوحة حكيم
          </Link>
          <Link className="focus-ring rounded-md border border-olive px-5 py-3 text-olive" href="/dashboard/library">
            تصفح المكتبة
          </Link>
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-7 text-gray-600">
          تنبيه مهني: مخرجات الذكاء الاصطناعي في حكيم مساعدة وتعليمية ولا تعد رأيًا قانونيًا نهائيًا أو حكمًا فعليًا.
        </p>
      </section>
    </main>
  );
}
