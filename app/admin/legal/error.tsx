"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { btnClass } from "@/components/editorial/ui";

/**
 * خطأ صفحة المكتب (ح١٤، ق١٤-٢) داخل غلاف الإدارة: رسالة مقروءة بلا تفاصيل داخلية، و«إعادة المحاولة»
 * و«لوحة الحالة»، بلا روابط «تسجيل الدخول».
 */
export default function EditorialDeskError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // خطأ مكوّن الخادم لا يزول بـ reset وحده: يُعاد جلب الصفحة ثم تُعاد المحاولة.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <div data-desk="" className="pb-10">
      <p className="dk-eyebrow">مكتب التحرير التشريعي</p>
      <div role="alert" className="dk-card mt-4 grid max-w-3xl gap-3">
        <CircleAlert size={24} aria-hidden className="text-[var(--desk-danger)]" />
        <h1 className="dk-card__title">تعذّر تحميل هذه الصفحة</h1>
        <p className="dk-body-text">تعذّر الاتصال بقاعدة البيانات أو قراءة بيانات المكتب. لم يتغير شيء.</p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className={btnClass("primary", { lg: true })} disabled={pending} aria-busy={pending || undefined} onClick={retry}>
            {pending ? <LoaderCircle size={18} aria-hidden className="dk-spin" /> : null}
            <span>{pending ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"}</span>
          </button>
          <Link href="/admin/legal" className={btnClass("correct", { lg: true })}>
            لوحة الحالة
          </Link>
        </div>
      </div>
    </div>
  );
}
