import type { Metadata } from "next";
import { CaseBrowser } from "@/components/documents/CaseBrowser";

export const metadata: Metadata = {
  title: "محطة العمل — منصة الوثائق",
  description:
    "تصفّح وثائقك القانونية: رفع PDF/Word، تصنيف وترميز، بحث اشتقاقي بترتيب الصلة، تلوين الكيانات، مقتطفات، جداول مشتقة، حفظ دائم، وتصدير."
};

export default function DocumentsAppPage() {
  return <CaseBrowser />;
}
