import { redirect } from "next/navigation";
import { requireUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

/**
 * بعد Clerk: دخول سلس إلى اللوحة (أو ?next=).
 * إكمال الملف والنقاط اختيارية — تُعرض كتذكير داخل اللوحة.
 */
export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  await requireUser();
  const nextRaw = searchParams?.next;
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";
  redirect(next);
}
