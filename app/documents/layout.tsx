import { ConversionIndicator } from "@/components/doc-tool/ConversionIndicator";

// تخطيط منصة الوثائق — يضمّ المؤشر العائم للمعالجة المستمرة فوق كل الشاشات
// (البوابة/البحث السريع/محطة العمل)، فيبقى ظاهراً أثناء التنقّل بينها.
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ConversionIndicator />
    </>
  );
}
