import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function AdminPage() {
  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">الإدارة والتقارير</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">لوحة الإدارة</h1>
      <p className="mt-4 rounded-md bg-white p-5 leading-8 text-gray-700">
        مسار الإدارة جاهز للربط بصلاحية مدير النظام وتقارير الأداء في المراحل التالية.
      </p>
      <Link className="mt-4 inline-block text-olive underline" href="/audit-logs">عرض سجل التدقيق</Link>
    </AppShell>
  );
}
