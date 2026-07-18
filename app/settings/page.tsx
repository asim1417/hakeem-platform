import { redirect } from "next/navigation";

/** إعدادات المستخدم → لوحة الفوترة والحساب (لا تكسر مسار /admin للعمليات). */
export default function SettingsAliasPage() {
  redirect("/dashboard/billing");
}
