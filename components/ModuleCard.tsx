import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function ModuleCard({
  href,
  title,
  description,
  icon: Icon,
  metric,
  badge
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  metric: string;
  /** شارة اختيارية (مثل «تجريبيّ») تُعرض بجانب المؤشّر لتمييز غير المكتمل. */
  badge?: string;
}) {
  return (
    <Link href={href} className="rounded-md border border-black/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <Icon className="text-olive" size={24} />
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{badge}</span>
          ) : null}
          <span className="rounded-full bg-sand px-3 py-1 text-xs text-olive">{metric}</span>
        </div>
      </div>
      <h3 className="mt-4 text-xl font-bold text-olive">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-gray-600">{description}</p>
    </Link>
  );
}
