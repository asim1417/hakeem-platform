import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// توحيد: «المحاكاة القضائية/الشات القضائيّ» صار وضع «محادثة» داخل «اسأل حكيم».
// كانت هذه الصفحة معزولة (بلا مدخل في الواجهة) ومكرِّرة للوظيفة — نحوّلها للوجهة الموحّدة.
export default function LegalChatPage() {
  redirect("/dashboard/ask?mode=chat");
}
