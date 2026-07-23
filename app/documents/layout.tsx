import { ConversionIndicator } from "@/components/doc-tool/ConversionIndicator";
import { ServiceExitBar } from "@/components/nav/StepNav";

// تخطيط منصة الوثائق — شريط رجوع موحّد + مؤشر المعالجة العائم.
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceExitBar title="منصة الوثائق" />
      {children}
      <ConversionIndicator />
    </>
  );
}
