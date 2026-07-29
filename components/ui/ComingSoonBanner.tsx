import Link from "next/link";
import { ComingSoonBadge } from "@/components/ui/ComingSoon";

/** شريط تسويقي أعلى صفحات الخدمات غير الجاهزة بعد. */
export function ComingSoonBanner({
  title = "هذه الخدمة قيد التجهيز",
  description = "نعرضها مسبقًا لتعريفك بما سيصل قريبًا. يمكنك متابعة العمل من الوحدات الجاهزة الآن.",
  backHref = "/dashboard/lab",
  backLabel = "العودة إلى المختبر",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div
      role="status"
      className="mb-6 rounded-[var(--r-lg)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ComingSoonBadge />
        <p className="font-bold">{title}</p>
      </div>
      <p className="mt-1 text-amber-900/90">{description}</p>
      {backHref ? (
        <Link
          href={backHref}
          className="mt-2 inline-flex text-sm font-semibold text-amber-900 underline-offset-4 hover:underline"
        >
          {backLabel} ←
        </Link>
      ) : null}
    </div>
  );
}
