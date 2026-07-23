import { redirect } from "next/navigation";
import { requireUser } from "@/lib/modules/auth/session";
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * بعد Clerk → وجهة آمنة محفوظة عبر ?next= أو /dashboard.
 */
export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  await requireUser();
  redirect(safeDashboardNext(searchParams?.next));
}
