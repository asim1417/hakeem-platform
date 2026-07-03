import type { Metadata } from "next";
import { CaseBrowser } from "@/components/documents/CaseBrowser";

export const metadata: Metadata = {
  title: "محطة فحص الوثائق | حكيم",
  description:
    "تصفّح وثائقك القانونية: تصنيف وترميز، بحث اشتقاقي بترتيب الصلة، تلوين الكيانات، مقتطفات وملاحظات، جداول مشتقة، وتصدير — كله في متصفحك."
};

export default function DocumentsPage() {
  return <CaseBrowser />;
}
