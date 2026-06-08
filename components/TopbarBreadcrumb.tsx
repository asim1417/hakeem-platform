"use client";

import { usePathname } from "next/navigation";

const LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: "/dashboard/legal-core", label: "النواة القانونية" },
  { prefix: "/dashboard/cases", label: "الدعاوى" },
  { prefix: "/dashboard/consultations", label: "الاستشارات" },
  { prefix: "/dashboard/attachments", label: "المرفقات" },
  { prefix: "/dashboard/ask", label: "اسأل حكيم" },
  { prefix: "/dashboard/simulations", label: "القاضي التفاعلي" },
  { prefix: "/dashboard/training", label: "التدريب" },
  { prefix: "/dashboard", label: "الرئيسية" },
  { prefix: "/admin/ai", label: "إعدادات الذكاء" },
  { prefix: "/admin/users", label: "المستخدمون" },
  { prefix: "/admin", label: "الإعدادات" },
  { prefix: "/audit-logs", label: "سجل التدقيق" }
];

export function TopbarBreadcrumb() {
  const pathname = usePathname() || "/dashboard";
  const current = LABELS.find((item) => pathname.startsWith(item.prefix))?.label ?? "الرئيسية";
  return (
    <div className="topbar-path">
      <span className="seg">حكيم</span>
      <span className="sep">/</span>
      <span className="cur">{current}</span>
    </div>
  );
}
