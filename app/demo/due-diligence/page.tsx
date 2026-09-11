import Link from "next/link";
import { PublicDueDiligenceDemo } from "@/components/due-diligence/PublicDueDiligenceDemo";

export const dynamic = "force-dynamic";

export default function PublicDueDiligenceDemoPage() {
  return (
    <>
      <div className="bg-[#082728] px-4 py-2 text-center text-xs font-semibold text-emerald-50" dir="rtl">
        نسخة تجريبية عامة — لا تتصل ببيانات حقيقية ولا تتطلب تسجيل الدخول. <Link href="/" className="underline underline-offset-4">العودة إلى حكيم</Link>
      </div>
      <PublicDueDiligenceDemo />
    </>
  );
}
