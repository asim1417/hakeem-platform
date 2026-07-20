import { redirect } from "next/navigation";

/** أُلغي المسار القديم — إعادة توجيه دائمة إلى Clerk. */
export default function LoginRedirectPage() {
  redirect("/sign-in");
}
