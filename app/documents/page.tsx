import type { Metadata } from "next";
import { DocumentWorkstation } from "@/components/documents/DocumentWorkstation";

export const metadata: Metadata = {
  title: "محطة فحص الوثائق — أمان | حكيم",
  description:
    "قراءة وثائق القضية وفهرستها: تصنيف وترميز هرمي وفق المرجع التشغيلي، استخراج كيانات حتمي، ومؤشر جودة ظاهر."
};

export default function DocumentsPage() {
  return <DocumentWorkstation />;
}
