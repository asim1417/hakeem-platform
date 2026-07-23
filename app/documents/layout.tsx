import { ConversionIndicator } from "@/components/doc-tool/ConversionIndicator";
import { ServiceExitBar } from "@/components/nav/StepNav";
import { ClerkRoot } from "@/components/providers/ClerkRoot";

// تخطيط منصة الوثائق — Clerk للجلسة + شريط رجوع + مؤشر المعالجة.
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkRoot>
      <ServiceExitBar title="منصة الوثائق" />
      {children}
      <ConversionIndicator />
    </ClerkRoot>
  );
}
