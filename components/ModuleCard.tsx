import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ComingSoonBadge } from "@/components/ui/ComingSoon";

export function ModuleCard({
  href,
  title,
  description,
  icon: Icon,
  metric,
  badge,
  comingSoon = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  metric: string;
  /** شارة اختيارية — عند comingSoon تُستبدل تلقائيًا بـ «قريبًا» إن لم تُمرَّر. */
  badge?: string;
  /** ميزة غير جاهزة: وسم قريبًا + تعطيل الانتقال. */
  comingSoon?: boolean;
}) {
  const shownBadge = comingSoon ? badge || "قريبًا" : badge;
  const inner = (
    <>
      <div className="flex items-center justify-between gap-3">
        <Icon className="text-olive" size={24} aria-hidden />
        <div className="flex items-center gap-2">
          {shownBadge ? (
            comingSoon || shownBadge === "قريبًا" ? (
              <ComingSoonBadge>{shownBadge}</ComingSoonBadge>
            ) : (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {shownBadge}
              </span>
            )
          ) : null}
          <span className="rounded-full bg-sand px-3 py-1 text-xs text-olive">{metric}</span>
        </div>
      </div>
      <h3 className="mt-4 text-xl font-bold text-olive">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-muted">{description}</p>
      {comingSoon ? (
        <p className="mt-3 text-xs font-semibold text-amber-800">ستُفتح هذه الخدمة قريبًا ضمن تحديثات المنصة.</p>
      ) : null}
    </>
  );

  const shellClass =
    "rounded-md border border-line bg-ivory p-5 shadow-sm transition " +
    (comingSoon ? "opacity-90" : "hover:-translate-y-0.5 hover:shadow-md");

  if (comingSoon) {
    return (
      <div className={shellClass} aria-disabled="true" title="قريبًا">
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={shellClass}>
      {inner}
    </Link>
  );
}
