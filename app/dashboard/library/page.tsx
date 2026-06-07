import { redirect } from "next/navigation";

// المكتبة النظامية وُحِّدت مع النواة القانونية — يُعاد التوجيه إلى بحث النواة.
export default function LibraryPage() {
  redirect("/dashboard/legal-core/search");
}
