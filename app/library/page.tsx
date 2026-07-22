import { redirect } from "next/navigation";

// المكتبة النظامية وُحِّدت مع النواة القانونية — يُعاد التوجيه إلى تصفّح النواة (لا بحثٌ تقليديّ).
export default function LibraryAliasPage() {
  redirect("/dashboard/legal-core");
}
