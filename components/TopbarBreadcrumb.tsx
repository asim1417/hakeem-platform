"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Crumb = { href: string; label: string };

/** أطول بادئة أولًا — لبناء مسار ملاحي متعدد المستويات. */
const SEGMENT_LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: "/dashboard/judicial-assistant/cases", label: "قضايا المعاون" },
  { prefix: "/dashboard/judicial-assistant", label: "المعاون القضائي" },
  { prefix: "/dashboard/legal-core/systems", label: "الأنظمة" },
  { prefix: "/dashboard/legal-core/articles", label: "المواد" },
  { prefix: "/dashboard/legal-core/judgments", label: "الأحكام" },
  { prefix: "/dashboard/legal-core/principles", label: "المبادئ" },
  { prefix: "/dashboard/legal-core/citations", label: "الاستناد" },
  { prefix: "/dashboard/legal-core/search", label: "بحث المكتبة" },
  { prefix: "/dashboard/legal-core/admin", label: "إدارة المكتبة" },
  { prefix: "/dashboard/legal-core", label: "المكتبة القانونية" },
  { prefix: "/dashboard/legal-search", label: "البحث" },
  { prefix: "/dashboard/legal-rag", label: "التحليل الذكي" },
  { prefix: "/dashboard/knowledge-graph", label: "المعرفة المترابطة" },
  { prefix: "/dashboard/cases", label: "الدعاوى" },
  { prefix: "/dashboard/consultations", label: "الاستشارات" },
  { prefix: "/dashboard/attachments", label: "المرفقات" },
  { prefix: "/dashboard/files", label: "ملفاتي" },
  { prefix: "/dashboard/ask", label: "اسأل حكيم" },
  { prefix: "/dashboard/simulations", label: "القاضي التفاعلي" },
  { prefix: "/dashboard/training", label: "التدريب" },
  { prefix: "/dashboard/agents", label: "الوكلاء" },
  { prefix: "/dashboard/billing", label: "الفوترة" },
  { prefix: "/dashboard/subscribe", label: "الاشتراك" },
  { prefix: "/dashboard/lab", label: "المختبر" },
  { prefix: "/dashboard", label: "لوحة التحكم" },
  { prefix: "/admin/ai", label: "إعدادات الذكاء" },
  { prefix: "/admin/owner", label: "حساب المالك" },
  { prefix: "/admin/users", label: "المستخدمون" },
  { prefix: "/admin/services", label: "خدمات المنصة" },
  { prefix: "/admin/jobs", label: "المهام الخلفية" },
  { prefix: "/admin/audit", label: "تدقيق الإدارة" },
  { prefix: "/admin/roles", label: "الأدوار والصلاحيات" },
  { prefix: "/admin/settings", label: "إعدادات التشغيل" },
  { prefix: "/admin/api-keys", label: "مفاتيح API" },
  { prefix: "/admin", label: "لوحة الإدارة" },
  { prefix: "/documents/tool", label: "أداة الوثائق" },
  { prefix: "/documents/app", label: "تطبيق الوثائق" },
  { prefix: "/documents", label: "منصة الوثائق" },
  { prefix: "/audit-logs", label: "سجل التدقيق" },
  { prefix: "/onboarding", label: "الملف الشخصي" },
];

function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ href: "/dashboard", label: "لوحة التحكم" }];
  if (pathname === "/dashboard") return crumbs;

  // اجمع كل البادئات المطابقة من الأعمق للأقل عمقًا ثم اعكس للعرض
  const matched = SEGMENT_LABELS.filter(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`) || pathname === item.prefix
  ).sort((a, b) => a.prefix.length - b.prefix.length);

  for (const item of matched) {
    if (item.prefix === "/dashboard") continue;
    const last = crumbs[crumbs.length - 1];
    if (last?.href === item.prefix) continue;
    crumbs.push({ href: item.prefix, label: item.label });
  }

  // إن لم يُطابق شيء سوى لوحة التحكم
  if (crumbs.length === 1) {
    const leaf = SEGMENT_LABELS.find((item) => pathname.startsWith(item.prefix));
    if (leaf && leaf.prefix !== "/dashboard") {
      crumbs.push({ href: pathname, label: leaf.label });
    }
  }

  return crumbs;
}

/**
 * مسار ملاحي: لوحة التحكم ← … ← الصفحة الحالية (روابط قابلة للنقر).
 */
export function TopbarBreadcrumb() {
  const pathname = usePathname() || "/dashboard";
  const crumbs = buildCrumbs(pathname);
  const lastIdx = crumbs.length - 1;

  return (
    <nav className="topbar-path" aria-label="مسار التنقّل">
      <ol className="topbar-path__list">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === lastIdx;
          return (
            <li key={`${crumb.href}-${idx}`} className="topbar-path__item">
              {idx > 0 ? (
                <span className="sep" aria-hidden>
                  /
                </span>
              ) : null}
              {isLast ? (
                <span className="cur" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="seg seg--link">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
