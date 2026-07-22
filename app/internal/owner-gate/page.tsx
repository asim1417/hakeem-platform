import { notFound } from "next/navigation";
import { isOwnerEmergencyLoginEnabled } from "@/lib/modules/auth/owner-emergency";
import { OwnerEmergencyLogin } from "@/components/auth/OwnerEmergencyLogin";

export const metadata = {
  title: "دخول داخلي",
  robots: { index: false, follow: false },
};

/**
 * مسار داخلي غير مدرج في القوائم — يظهر فقط عند تفعيل Feature Flag.
 * /internal/owner-gate
 */
export default function OwnerGatePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  if (!isOwnerEmergencyLoginEnabled()) notFound();

  const nextUrl =
    searchParams?.next && searchParams.next.startsWith("/") && !searchParams.next.startsWith("//")
      ? searchParams.next
      : "/dashboard";

  return (
    <main className="login-page login-page--compact" lang="ar" dir="rtl">
      <div className="login-panel" style={{ minHeight: "100dvh" }}>
        <div className="w-full max-w-md">
          <p className="mb-4 text-center text-sm font-semibold text-[#0E3435]/70">حكيم · مسار داخلي</p>
          <OwnerEmergencyLogin nextUrl={nextUrl} />
        </div>
      </div>
    </main>
  );
}
