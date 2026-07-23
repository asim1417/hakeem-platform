import { redirect } from "next/navigation";

/** /register → /sign-up مع الحفاظ على ref و next. */
export default function RegisterRedirectPage({
  searchParams,
}: {
  searchParams?: { ref?: string; next?: string; returnUrl?: string };
}) {
  const params = new URLSearchParams();
  if (searchParams?.ref) params.set("ref", searchParams.ref);
  const next = searchParams?.next || searchParams?.returnUrl;
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    params.set("next", next);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  redirect(`/sign-up${qs}`);
}
