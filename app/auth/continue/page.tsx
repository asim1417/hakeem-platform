import { redirect } from "next/navigation";
import { requireUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

/**
 * بعد Clerk دائمًا → /dashboard (الصفحة الرئيسية للمنصة)
 * إلا إذا طُلب مسار داخلي آمن صراحةً عبر ?next=
 */
export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  await requireUser();
  const nextRaw = searchParams?.next;
  const next =
    nextRaw &&
    nextRaw.startsWith("/") &&
    !nextRaw.startsWith("//") &&
    (nextRaw === "/dashboard" || nextRaw.startsWith("/dashboard/"))
      ? nextRaw
      : "/dashboard";
  redirect(next);
}
