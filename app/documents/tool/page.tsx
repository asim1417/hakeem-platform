import type { Metadata } from "next";
import { DocToolApp } from "@/components/doc-tool/DocToolApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "البحث السريع — منصة الوثائق",
  description:
    "ارفع وثائقك (نص/Word/PDF/صور) فتُستخرَج وتُطبَّع عربياً وتُفهرَس للبحث الفوري مع تظليل المطابقات — المعالجة كلها في متصفحك."
};

// «البحث السريع» — أحد قسمي منصة الوثائق الموحّدة:
//   /documents        ← البوابة
//   /documents/tool   ← البحث السريع (هذه الصفحة)
//   /documents/app    ← محطة العمل (الفحص المتقدم)
export default function DocumentsQuickToolPage() {
  return <DocToolApp />;
}
