"use client";

import { usePathname } from "next/navigation";

const LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: "/dashboard/legal-core", label: "النواة القانونية" },
  { prefix: "/dashboard/cases", label: "الدعاوى" },
  { prefix: "/dashboard/consultations", label: "الاستشارات" },
  { prefix: "/dashboard/attachments", label: "المرفقات" },
  { prefix: "/dashboard/ask", label: "اسأل حكيم" },
  { prefix: "/dashboard/simulations", label: "القاضي التفاعلي" },
  { prefix: "/dashboard/subscribe", label: "خطط الاشتراك" },
  { prefix: "/dashboard/billing", label: "الفوترة والحساب" },
  { prefix: "/dashboard/training", label: "التدريب" },
  { prefix: "/pricing", label: "الأسعار" },
  { prefix: "/dashboard", label: "الرئيسية" },
  { prefix: "/admin/ai", label: "إعدادات الذكاء" },
  { prefix: "/admin/owner", label: "حساب المالك" },
  { prefix: "/admin/users", label: "المستخدمون" },
  { prefix: "/admin/settings", label: "إعدادات التشغيل" },
  { prefix: "/admin", label: "الإعدادات" },
  { prefix: "/login", label: "تسجيل الدخول" },
  { prefix: "/register", label: "إنشاء حساب" },
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
