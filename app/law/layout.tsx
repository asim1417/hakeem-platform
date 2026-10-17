import type { ReactNode } from "react";
import "./law.css";

// HKM-023-B: رموز صفحة النظام (app/law/law.css) مقيّدة بـ [data-law]؛ هذا الغلاف يستوردها فقط.
export default function LawLayout({ children }: { children: ReactNode }) {
  return children;
}
