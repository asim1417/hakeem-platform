import { redirect } from "next/navigation";

/** أُلغي التسجيل القديم — إعادة توجيه دائمة إلى Clerk SignUp. */
export default function RegisterRedirectPage({
  searchParams,
}: {
  searchParams?: { ref?: string };
}) {
  const ref = searchParams?.ref ? `?ref=${encodeURIComponent(searchParams.ref)}` : "";
  // Clerk لا يمرّر ref تلقائيًا؛ نحفظه في cookie عبر صفحة وسيطة بسيطة أو نمرّره لـ onboarding لاحقًا.
  redirect(`/sign-up${ref}`);
}
